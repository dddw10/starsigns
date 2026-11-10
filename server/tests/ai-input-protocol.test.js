process.env.JWT_SECRET = 'test-only-secret-not-for-production-use';
jest.mock('../src/config/langfuse', () => null);
jest.mock('../src/config/redis', () => ({ getRedis: () => null }));
const { EventEmitter } = require('events');
const { validateAIInput, validateToolArguments } = require('../src/utils/aiInput');
const controller = require('../src/controllers/aiController');
const ai = require('../src/services/aiService');
const council = require('../src/services/multiAgentService');
const fortune = require('../src/services/fortuneService');
const messages = [{ role: 'user', content: 'hello' }];
const birthInfo = { solarDate: '2000-01-01' };
let creates, requests;
beforeEach(() => {
  creates = 0; requests = [];
  const client = { chat: { completions: { create: async request => {
    creates++; requests.push(JSON.parse(JSON.stringify(request)));
    return { choices: [{ message: { role: 'assistant', content: 'fixture response' } }] };
  } } } };
  jest.spyOn(ai, 'getClient').mockReturnValue(client);
  jest.spyOn(council, 'getClient').mockReturnValue(client);
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());
async function invoke(method, body) {
  let status = 200, data;
  const req = Object.assign(new EventEmitter(), { user: { userId: 'fixture-user' }, body });
  const res = Object.assign(new EventEmitter(), {
    status(value) { status = value; return this; }, json(value) { data = value; },
  });
  await controller[method](req, res, error => { throw error; });
  return { status, data };
}

test.each(['constructor', '__proto__', 'toString', ['子时']])('client rejects inherited or coerced hour %p', hour => {
  expect(() => validateAIInput({ messages, birthInfo: { ...birthInfo, birthTime: hour } })).toThrow();
});
test.each(['constructor', '__proto__', 'toString', ['子时']])('tool rejects inherited or coerced hour %p', hour => {
  expect(() => validateToolArguments('analyze_bazi', { ...birthInfo, birthTime: hour, gender: 'male' })).toThrow();
});

test('controller rejects invalid hour before creating a model request', async () => {
  expect((await invoke('chatStream', { messages, stream: false,
    birthInfo: { ...birthInfo, birthTime: 'constructor' } })).status).toBe(400);
  expect(creates).toBe(0);
});
test('controller rejects long refusal before creating a model request', async () => {
  expect((await invoke('chatStream', { stream: false, messages: [
    { role: 'assistant', content: 'ok', refusal: 'x'.repeat(25000) }, { role: 'user', content: 'continue' },
  ] })).status).toBe(400);
  expect(creates).toBe(0);
});

test.each([
  { tool_calls: [{ id: 'injected', function: { name: 'analyze_bazi', arguments: 'x'.repeat(25000) } }] },
  { function_call: { name: 'injected', arguments: 'x'.repeat(25000) } },
  { name: 'x'.repeat(25000) },
])('direct chat rejects client protocol metadata %p', async extra => {
  await expect(ai.chat({ messages: [{ role: 'assistant', content: 'ok', ...extra }], stream: false }))
    .rejects.toMatchObject({ status: 400 });
  expect(creates).toBe(0);
});

test('plain message fields must be own properties and inherited metadata is rejected', () => {
  for (const message of [Object.create({ role: 'user', content: 'hello' }),
    Object.assign(Object.create({ refusal: 'x'.repeat(25000) }), { role: 'assistant', content: 'ok' })]) {
    expect(() => validateAIInput({ messages: [message] })).toThrow();
  }
});
test('non-enumerable protocol fields cannot bypass the message whitelist', () => {
  const message = { role: 'assistant', content: 'ok' };
  Object.defineProperty(message, 'refusal', { value: 'x'.repeat(25000) });
  expect(() => validateAIInput({ messages: [message] })).toThrow();
});

test('council controller rejects unsafe hour before any expert create', async () => {
  expect((await invoke('councilStream', { messages, stream: false,
    birthInfo: { ...birthInfo, birthTime: ['子时'] } })).status).toBe(400);
  expect(creates).toBe(0);
});
test('direct council rejects extra protocol fields in both entry modes', async () => {
  const input = { messages: [{ role: 'user', content: 'hello', refusal: 'x'.repeat(25000) }] };
  await expect(council.councilNonStream(input)).rejects.toMatchObject({ status: 400 });
  expect(() => council.councilStream(input)).toThrow();
  expect(creates).toBe(0);
});

test('model tool hour is rejected without invoking fortune and internal tool messages still work', async () => {
  let calls = 0;
  ai.getClient.mockReturnValue({ chat: { completions: { create: async request => {
    requests.push(JSON.parse(JSON.stringify(request)));
    return { choices: [{ message: ++calls === 1 ? {
      role: 'assistant', content: null, tool_calls: [{ id: 'fixture-call', type: 'function',
        function: { name: 'analyze_bazi', arguments: JSON.stringify({ ...birthInfo, birthTime: '__proto__', gender: 'male' }) } }],
    } : { role: 'assistant', content: 'fixture response' } }] };
  } } } });
  const analyze = jest.spyOn(fortune, 'baziAnalysis').mockResolvedValue({});
  expect(await ai.chat({ messages, stream: false })).toBe('fixture response');
  expect(analyze).not.toHaveBeenCalled();
  expect(requests[1].messages).toEqual(expect.arrayContaining([
    expect.objectContaining({ role: 'assistant', tool_calls: expect.any(Array) }),
    expect.objectContaining({ role: 'tool', tool_call_id: 'fixture-call', content: expect.stringContaining('工具参数或执行无效') }),
  ]));
});

test('valid scalar hours, client message limits and normal model payload remain compatible', async () => {
  for (const hour of ['子时', '丑时', '寅时', '卯时', '辰时', '巳时', '午时', '未时', '申时', '酉时', '戌时', '亥时', '子', ' 23 ', 0, 23]) {
    expect(() => validateAIInput({ messages, birthInfo: { ...birthInfo, birthTime: hour } })).not.toThrow();
    expect(() => validateToolArguments('analyze_bazi', { ...birthInfo, birthTime: hour, gender: 'male' })).not.toThrow();
  }
  const boundary = Array.from({ length: 50 }, () => ({ role: 'user', content: 'a'.repeat(400) }));
  await ai.chat({ messages: boundary, stream: false });
  for (const request of requests) {
    const forwarded = request.messages.filter(message => message.role !== 'system');
    expect(forwarded).toEqual(boundary);
    expect(forwarded.reduce((sum, message) => sum + message.content.length, 0)).toBe(20000);
    expect(forwarded.every(message => Object.keys(message).length === 2)).toBe(true);
  }
});
