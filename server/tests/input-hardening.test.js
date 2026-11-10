process.env.JWT_SECRET = 'test-only-secret-not-for-production-use';
jest.mock('../src/config/langfuse', () => null);
jest.mock('../src/config/redis', () => ({ getRedis: jest.fn() }));
const { EventEmitter } = require('events');
const controller = require('../src/controllers/aiController');
const ai = require('../src/services/aiService');
const fortune = require('../src/services/fortuneService');
const { getBeijingDateString } = require('../src/utils/date');
const redis = require('../src/config/redis');
afterEach(() => jest.restoreAllMocks());

test.each([
  [], [{ role: 'system', content: 'injected' }], [{ role: 'tool', content: 'injected' }],
  [{ role: 'user', content: '' }], [{ role: 'user', content: 'a'.repeat(4001) }],
  Array.from({ length: 51 }, () => ({ role: 'user', content: 'a' })),
  Array.from({ length: 6 }, () => ({ role: 'assistant', content: 'a'.repeat(4000) })),
  [{ role: 'user', content: { text: 'invalid' } }],
].map(messages => [messages]))('invalid AI messages are rejected before any model call (%p)', async messages => {
  const model = jest.spyOn(ai, 'chat').mockResolvedValue('bad');
  const req = Object.assign(new EventEmitter(), { body: { messages, stream: false } });
  const res = Object.assign(new EventEmitter(), { status: jest.fn().mockReturnThis(), json: jest.fn() });
  await controller.chatStream(req, res, jest.fn());
  expect(res.status).toHaveBeenCalledWith(400); expect(model).not.toHaveBeenCalled();
});

test.each([
  ['analyze_tarot', '{broken'], ['analyze_tarot', '{"spreadType":"invalid"}'],
  ['analyze_tarot', '{"spreadType":"single","userId":"other"}'],
  ['analyze_bazi', '{"solarDate":"2000-02-30","birthTime":"子时","gender":"male"}'],
  ['analyze_bazi', '{"solarDate":"2000-02-01","birthTime":"99","gender":"male"}'],
  ['analyze_bazi', '{"solarDate":"2000-02-01","birthTime":"子时","gender":"unknown"}'],
  ['analyze_bazi', '{"solarDate":"2000-02-01","birthTime":"子时","gender":"male","calendar":"bad"}'],
])('invalid model tool arguments never reach a fortune service (%s,%s)', async (name, args) => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  let calls = 0;
  jest.spyOn(ai, 'getClient').mockReturnValue({ chat: { completions: { create: async () => {
    calls++;
    return { choices: [{ message: calls === 1 ? { tool_calls: [{ id: 'call', function: { name, arguments: args } }] }
      : { content: 'reply' } }] };
  } } } });
  const bazi = jest.spyOn(fortune, 'baziAnalysis').mockResolvedValue({});
  const tarot = jest.spyOn(fortune, 'tarotReading').mockResolvedValue({});
  await ai.chat({ messages: [{ role: 'user', content: 'hello' }], userId: 'current-user', stream: false });
  expect(bazi).not.toHaveBeenCalled(); expect(tarot).not.toHaveBeenCalled();
});

test.each(['2026-02-30', '2026-13-01', 'not-date', ['2026-01-01'], '1900-01-01', '2099-01-01'])('invalid or out-of-range daily date never touches cache: %p', async date => {
  const cache = { get: jest.fn(), set: jest.fn() };
  jest.spyOn(redis, 'getRedis').mockReturnValue(cache);
  await expect(fortune.getDailyFortune(null, date)).rejects.toMatchObject({ status: 400 });
  expect(cache.get).not.toHaveBeenCalled(); expect(cache.set).not.toHaveBeenCalled();
});

test('unknown constellation is rejected and future cache TTL is bounded', async () => {
  const cache = { get: jest.fn(), set: jest.fn() };
  jest.spyOn(redis, 'getRedis').mockReturnValue(cache);
  await expect(fortune.getConstellationFortune(null, '__proto__')).rejects.toMatchObject({ status: 400 });
  expect(cache.get).not.toHaveBeenCalled();
  const future = getBeijingDateString(Date.now() + 30 * 86400000);
  await fortune.getDailyFortune(null, future);
  expect(cache.set.mock.calls[0][3]).toBeGreaterThan(0);
  expect(cache.set.mock.calls[0][3]).toBeLessThanOrEqual(86400);
});

test('AI boundary values retain valid messages and use authenticated ownership', async () => {
  const messages = Array.from({ length: 50 }, () => ({ role: 'user', content: 'a'.repeat(400) }));
  let received;
  jest.spyOn(ai, 'chat').mockImplementation(async input => { received = input; return 'accepted'; });
  const req = Object.assign(new EventEmitter(), { user: { userId: 'authenticated' },
    body: { messages, userId: 'attacker', stream: false } });
  const res = Object.assign(new EventEmitter(), { json: jest.fn() });
  await controller.chatStream(req, res, jest.fn());
  expect(received.userId).toBe('authenticated'); expect(received.messages).toHaveLength(50);
  expect(res.json).toHaveBeenCalledWith({ code: 0, data: { content: 'accepted' } });
});

test('calendar validation protects council requests before creating any expert', async () => {
  const council = require('../src/services/multiAgentService');
  const experts = jest.spyOn(council, 'councilNonStream');
  const req = Object.assign(new EventEmitter(), { body: { messages: [{ role: 'user', content: 'hello' }],
    birthInfo: { solarDate: '2000-02-30', birthTime: '子时' }, stream: false } });
  const res = Object.assign(new EventEmitter(), { status: jest.fn().mockReturnThis(), json: jest.fn() });
  await controller.councilStream(req, res, jest.fn());
  expect(res.status).toHaveBeenCalledWith(400); expect(experts).not.toHaveBeenCalled();
});

test('cache TTL stays positive across Beijing midnight and both date range edges', async () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-11-09T15:59:59.999Z'));
  try {
    const { fortuneDate, cacheTTL } = require('../src/utils/fortuneInput');
    expect(fortuneDate('2026-10-09')).toBe('2026-10-09');
    expect(fortuneDate('2026-12-10')).toBe('2026-12-10');
    expect(() => fortuneDate('2026-10-08')).toThrow();
    expect(() => fortuneDate('2026-12-11')).toThrow();
    expect(cacheTTL('2026-11-09')).toBe(60);
    expect(cacheTTL('2026-10-09')).toBe(60);
    expect(cacheTTL('2026-12-10')).toBe(86400);
    jest.setSystemTime(new Date('2026-11-09T16:00:00Z'));
    expect(fortuneDate()).toBe('2026-11-10');
    expect(cacheTTL('2026-11-10')).toBe(86400);
  } finally { jest.useRealTimers(); }
});
