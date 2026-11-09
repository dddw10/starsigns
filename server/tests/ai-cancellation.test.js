process.env.JWT_SECRET = 'test-only-secret-not-for-production-use';
jest.mock('../src/config/langfuse', () => null);
const { EventEmitter } = require('events');
const aiService = require('../src/services/aiService');
const council = require('../src/services/multiAgentService');
const controller = require('../src/controllers/aiController');

function response() {
  const res = new EventEmitter();
  Object.assign(res, { headersSent: false, writableFinished: false, destroyed: false, chunks: [] });
  res.setHeader = () => {};
  res.flushHeaders = () => { res.headersSent = true; };
  res.write = chunk => { if (res.destroyed) throw new Error('write after disconnect'); res.chunks.push(chunk); };
  res.end = () => { res.writableFinished = true; res.emit('finish'); res.emit('close'); };
  res.json = data => { res.data = data; res.end(); };
  res.status = () => res;
  return res;
}
function request(stream = true) {
  return Object.assign(new EventEmitter(), { body: { messages: [{ role: 'user', content: 'hello' }], stream }, user: null });
}
const turn = () => new Promise(resolve => setImmediate(resolve));
afterEach(() => jest.restoreAllMocks());

test.each([true, false])('disconnect cancels council and prevents the next expert (stream=%s)', async stream => {
  let release;
  const first = new Promise(resolve => { release = resolve; });
  const calls = [];
  jest.spyOn(council, 'getClient').mockReturnValue({ chat: { completions: { create: async (payload, options) => {
    calls.push(options?.signal);
    if (calls.length === 1) await first;
    if (payload.stream) return (async function* () { yield { choices: [{ delta: { content: 'fake' } }] }; })();
    return { choices: [{ message: { content: 'fake' } }], usage: {} };
  } } } });
  const req = request(stream), res = response(), errors = [];
  const pending = controller.councilStream(req, res, err => errors.push(err));
  await turn();
  res.destroyed = true;
  res.emit('close');
  release();
  await pending;
  await turn();
  expect(calls).toHaveLength(1);
  expect(calls[0]?.aborted).toBe(true);
  expect(res.chunks).toEqual([]);
  expect(errors).toEqual([]);
});

test('normal request-body close does not cancel a completed non-stream response', async () => {
  const signals = [];
  jest.spyOn(aiService, 'getClient').mockReturnValue({ chat: { completions: { create: async (_payload, options) => {
    signals.push(options?.signal);
    return { choices: [{ message: { content: 'fake reply' } }], usage: {} };
  } } } });
  const req = request(false), res = response();
  const pending = controller.chatStream(req, res, err => { throw err; });
  req.emit('close');
  await pending;
  expect(res.data).toEqual({ code: 0, data: { content: 'fake reply' } });
  expect(signals.every(signal => signal && !signal.aborted)).toBe(true);
  expect(res.listenerCount('close')).toBe(0);
  expect(req.listenerCount('aborted')).toBe(0);
});


test('ordinary chat aborts during tool decision before any tool or final completion', async () => {
  const abort = new AbortController(), calls = [];
  jest.spyOn(aiService, 'getClient').mockReturnValue({ chat: { completions: { create: async (_payload, options) => {
    calls.push(options.signal); abort.abort();
    return { choices: [{ message: { tool_calls: [{ id: 'fake', function: { name: 'analyze_tarot', arguments: '{}' } }] } }] };
  } } } });
  const tool = jest.spyOn(require('../src/services/fortuneService'), 'tarotReading');
  await expect(aiService.chat({ messages: [{ role: 'user', content: 'hello' }], signal: abort.signal })).rejects.toMatchObject({ name: 'AbortError' });
  expect(calls).toEqual([abort.signal]); expect(tool).not.toHaveBeenCalled();
});

test('ordinary final stream receives the same signal and cannot yield after cancellation', async () => {
  const abort = new AbortController(), signals = [];
  jest.spyOn(aiService, 'getClient').mockReturnValue({ chat: { completions: { create: async (payload, options) => {
    signals.push(options.signal);
    if (!payload.stream) return { choices: [{ message: { content: 'thinking' } }] };
    return (async function* () { abort.abort(); yield { choices: [{ delta: { content: 'stale' } }] }; })();
  } } } });
  const stream = await aiService.chat({ messages: [{ role: 'user', content: 'hello' }], signal: abort.signal });
  await expect(stream.next()).rejects.toMatchObject({ name: 'AbortError' });
  expect(signals).toEqual([abort.signal, abort.signal]);
});

test.each([true, false])('normal council completes four fake experts (stream=%s)', async stream => {
  const signals = [];
  jest.spyOn(council, 'getClient').mockReturnValue({ chat: { completions: { create: async (payload, options) => {
    signals.push(options.signal);
    return payload.stream ? (async function* () { yield { choices: [{ delta: { content: 'reply' } }] }; })()
      : { choices: [{ message: { content: 'reply' } }] };
  } } } });
  const req = request(stream), res = response();
  await controller.councilStream(req, res, err => { throw err; });
  expect(signals).toHaveLength(4); expect(signals.every(s => s && !s.aborted)).toBe(true);
  expect(res.writableFinished).toBe(true);
  expect(req.listenerCount('aborted')).toBe(0); expect(res.listenerCount('close')).toBe(0);
});

test.each([true, false])('real HTTP response disconnect cancels, body close does not (disconnect=%s)', async disconnect => {
  const http = require('http'), express = require('express');
  let release, observed, entered;
  const gate = new Promise(resolve => { release = resolve; });
  const called = new Promise(resolve => { entered = resolve; });
  jest.spyOn(aiService, 'getClient').mockReturnValue({ chat: { completions: { create: async (_payload, options) => {
    observed = options.signal; entered(); await gate;
    return { choices: [{ message: { content: 'reply' } }] };
  } } } });
  const app = express(); app.use(express.json()); app.post('/chat', controller.chatStream);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  let req;
  const received = new Promise(resolve => {
    req = http.request({ host: '127.0.0.1', port: server.address().port, path: '/chat', method: 'POST',
      headers: { 'content-type': 'application/json' } }, res => {
      let data = ''; res.on('data', chunk => data += chunk); res.on('end', () => resolve(data));
    });
    req.on('error', () => resolve('disconnected'));
    req.end(JSON.stringify({ messages: [{ role: 'user', content: 'hello' }], stream: false }));
  });
  try {
    await called; await turn(); expect(observed.aborted).toBe(false);
    if (disconnect) {
      req.destroy();
      await new Promise(resolve => observed.addEventListener('abort', resolve, { once: true }));
      expect(observed.aborted).toBe(true);
    }
    release(); const data = await received;
    if (!disconnect) expect(JSON.parse(data).data.content).toBe('reply');
  } finally { release(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});

test.each([true, false])('upstream details stay private for stream=%s', async stream => {
  jest.spyOn(aiService, 'chat').mockRejectedValue(new Error('PRIVATE_UPSTREAM_SECRET'));
  const res = response(); await controller.chatStream(request(stream), res, error => { throw error; });
  expect(JSON.stringify(res.data || res.chunks)).not.toContain('PRIVATE_UPSTREAM_SECRET');
  expect(res.writableFinished).toBe(true);
});
