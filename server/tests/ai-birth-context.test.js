process.env.JWT_SECRET = 'test-only-secret-not-for-production-use';
jest.mock('../src/config/langfuse', () => ({
  trace: jest.fn(() => ({ generation: jest.fn(() => ({ update() {} })), span: jest.fn(() => ({ update() {} })) })),
  shutdownAsync: async () => {},
}));
jest.mock('../src/config/redis', () => ({ getRedis: () => null }));
const { EventEmitter } = require('events');
const ai = require('../src/services/aiService');
const council = require('../src/services/multiAgentService');
const controller = require('../src/controllers/aiController');
const langfuse = require('../src/config/langfuse');
const { validateAIInput } = require('../src/utils/aiInput');
const messages = [{ role: 'user', content: 'hello' }];
const completeBirth = {
  solarDate: '1984-02-02', lunarDate: '1984-1-1', birthTime: '卯时', calendar: 'solar',
  yearGanZhi: '癸亥', monthGanZhi: '乙丑', dayGanZhi: '丙寅', hourGanZhi: '辛卯',
  wuxing: { metal: 1, wood: 3, water: 2, fire: 1, earth: 1 },
};
let requests;
beforeEach(() => {
  requests = [];
  langfuse.trace.mockClear();
  const client = { chat: { completions: { create: async request => {
    requests.push(JSON.parse(JSON.stringify(request)));
    if (requests.length > 4) throw new Error('fixture exceeded four model creates');
    if (request.stream) return (async function* () { yield { choices: [{ delta: { content: 'fixture response' } }] }; })();
    return { choices: [{ message: { role: 'assistant', content: 'fixture response' } }], usage: {} };
  } } } };
  jest.spyOn(ai, 'getClient').mockReturnValue(client);
  jest.spyOn(council, 'getClient').mockReturnValue(client);
});
afterEach(() => jest.restoreAllMocks());
async function invoke(mode, stream, body) {
  let status = 200, output = '';
  const req = Object.assign(new EventEmitter(), { user: { userId: 'fixture-user' }, body: { ...body, stream } });
  const res = Object.assign(new EventEmitter(), {
    status(value) { status = value; return this; }, json(value) { output = JSON.stringify(value); },
    setHeader() {}, flushHeaders() { this.headersSent = true; }, write(value) { output += value; },
    end() { this.writableFinished = true; },
  });
  await controller[mode === 'private' ? 'chatStream' : 'councilStream'](req, res, error => { throw error; });
  return { status, output };
}
async function direct(mode, stream, body) {
  if (mode === 'private') {
    const result = await ai.chat({ ...body, stream });
    if (stream) { for await (const chunk of result) expect(chunk.choices[0].delta.content).toBe('fixture response'); }
    else expect(result).toBe('fixture response');
  } else if (stream) {
    let output = '';
    for await (const chunk of council.councilStream(body)) output += chunk;
    expect(output).toContain('[DONE]');
  } else expect(await council.councilNonStream(body)).toHaveLength(4);
}

for (const mode of ['private', 'council']) for (const stream of [false, true]) for (const entry of ['controller', 'direct']) {
  test(`${entry} ${mode} stream=${stream}: unknown large birth fields never reach models or tracing`, async () => {
    const huge = 'UNTRUSTED_CONTEXT_'.repeat(6250);
    const birthInfo = { ...completeBirth, additionalContext: huge, nested: { payload: huge },
      wuxing: { ...completeBirth.wuxing, additionalContext: huge } };
    const original = JSON.stringify(birthInfo);
    const body = { messages, birthInfo, gender: 'female' };
    if (entry === 'controller') {
      const result = await invoke(mode, stream, body);
      expect(result.status).toBe(200);
      expect(result.output).toContain('fixture response');
    } else await direct(mode, stream, body);
    expect(requests).toHaveLength(mode === 'private' ? 2 : 4);
    expect(JSON.stringify(requests)).not.toContain('UNTRUSTED_CONTEXT_');
    expect(langfuse.trace.mock.calls).toHaveLength(1);
    expect(langfuse.trace.mock.calls[0][0].metadata).toEqual({ birthInfo: completeBirth, gender: 'female' });
    const generations = langfuse.trace.mock.results[0].value.generation.mock.calls;
    expect(JSON.stringify(generations)).not.toContain('UNTRUSTED_CONTEXT_');
    if (mode === 'private') {
      const context = requests[0].messages[0].content.match(/用户的出生信息: (.+)/)[1];
      expect(JSON.parse(context)).toEqual(completeBirth);
    }
    else expect(requests[0].messages[0].content).toContain('八字: 癸亥 乙丑 丙寅 辛卯');
    expect(JSON.stringify(birthInfo)).toBe(original);
  });
}

test.each([
  { solarDate: false }, { solarDate: [] }, { lunarDate: 'x'.repeat(100000) },
  { yearGanZhi: { payload: 'x'.repeat(100000) } }, { monthGanZhi: ['甲子'] },
  { dayGanZhi: 'x'.repeat(100000) }, { hourGanZhi: 12 },
  { birthTime: `${' '.repeat(100000)}0` }, { wuxing: [] },
  { wuxing: { metal: '1' } }, { wuxing: { wood: Infinity } }, { wuxing: { earth: -1 } },
  { wuxing: { fire: { payload: 'x'.repeat(100000) } } },
])('known birth fields reject wrong types or unbounded values before side effects (%#)', async extra => {
  const body = { messages, birthInfo: { ...completeBirth, ...extra }, gender: 'male' };
  expect((await invoke('private', false, body)).status).toBe(400);
  expect((await invoke('council', false, body)).status).toBe(400);
  await expect(ai.chat({ ...body, stream: false })).rejects.toMatchObject({ status: 400 });
  await expect(council.councilNonStream(body)).rejects.toMatchObject({ status: 400 });
  expect(() => council.councilStream(body)).toThrow();
  expect(requests).toHaveLength(0);
  expect(langfuse.trace.mock.calls).toHaveLength(0);
});

test('user birth fields, empty form, solar/lunar dates and scalar hours retain their supported values', async () => {
  for (const hour of [...Array.from({ length: 24 }, (_, i) => i), '0', '23', '子时', '卯时']) {
    for (const calendar of ['solar', 'lunar']) {
      const birthInfo = { ...completeBirth, birthTime: hour, calendar };
      expect(validateAIInput({ messages, birthInfo, gender: 'male' }).birthInfo).toEqual(birthInfo);
    }
  }
  const empty = { solarDate: '', birthTime: '' };
  expect(validateAIInput({ messages, birthInfo: empty, gender: '' }).birthInfo).toEqual(empty);
  expect(validateAIInput({ messages }).birthInfo).toBeUndefined();
});

test('numeric midnight reaches the council model as calculated bazi', async () => {
  await council.councilNonStream({ messages, birthInfo: { solarDate: '1984-02-02', birthTime: 0 }, gender: 'female' });
  expect(requests).toHaveLength(4);
  expect(requests[0].messages[0].content).toContain('八字:');
  expect(requests[0].messages[0].content).not.toContain('未提供生辰八字');
});

for (const mode of ['private', 'council']) for (const stream of [false, true]) for (const entry of ['controller', 'direct']) {
  test(`${entry} ${mode} stream=${stream}: unknown birth time stays explicit without stale full chart context`, async () => {
    const birthInfo = { ...completeBirth, birthTime: '未知', additionalContext: 'x'.repeat(100000) };
    const body = { messages, birthInfo, gender: 'female' };
    if (entry === 'controller') {
      const result = await invoke(mode, stream, body);
      expect(result.status).toBe(200);
      expect(result.output).toContain('fixture response');
    } else await direct(mode, stream, body);
    expect(requests).toHaveLength(mode === 'private' ? 2 : 4);
    expect(requests[0].messages[0].content).toContain('时辰未知');
    expect(JSON.stringify(requests)).not.toContain('癸亥');
    expect(JSON.stringify(requests)).not.toContain('x'.repeat(100000));
    expect(langfuse.trace.mock.calls[0][0].metadata.birthInfo).toEqual({
      solarDate: '1984-02-02', lunarDate: '1984-1-1', calendar: 'solar', birthTime: '未知',
    });
  });
}

test('unknown time cannot be filled in by a model tool call with an invented valid hour', async () => {
  const fortune = require('../src/services/fortuneService');
  const analyze = jest.spyOn(fortune, 'baziAnalysis').mockResolvedValue({});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  ai.getClient.mockReturnValue({ chat: { completions: { create: async request => {
    requests.push(request);
    return { choices: [{ message: requests.length === 1 ? { role: 'assistant', tool_calls: [{ id: 'invented',
      function: { name: 'analyze_bazi', arguments: JSON.stringify({ solarDate: '1984-02-02', birthTime: '子时', gender: 'male' }) } }] }
      : { role: 'assistant', content: '请补充已知时辰' } }] };
  } } } });
  expect(await ai.chat({ messages, birthInfo: { solarDate: '1984-02-02', birthTime: '未知' }, stream: false })).toBe('请补充已知时辰');
  expect(analyze).not.toHaveBeenCalled();
  expect(requests[0].tools.some(tool => tool.function.name === 'analyze_bazi')).toBe(false);
  expect(requests).toHaveLength(3);
});
