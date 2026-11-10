process.env.JWT_SECRET = 'test-only-secret-not-for-production-use';
jest.mock('../src/config/redis', () => ({ getRedis: () => null }));
jest.mock('../src/algorithms/bazi', () => {
  const actual = jest.requireActual('../src/algorithms/bazi');
  return { ...actual, getEightChar: jest.fn(actual.getEightChar) };
});
const { validationResult } = require('express-validator');
const { userValidation, fortuneValidation } = require('../src/middleware/validator');
const userService = require('../src/services/userService');
const controller = require('../src/controllers/userController');
const fortune = require('../src/services/fortuneService');
const User = require('../src/models/User');
const Fortune = require('../src/models/Fortune');
const { getEightChar } = require('../src/algorithms/bazi');
const { validateToolArguments } = require('../src/utils/aiInput');
const userId = '507f1f77bcf86cd799439011';
const fullBirth = { solarDate: '1984-02-02', birthTime: '卯时', lunarDate: '1984-1-1',
  yearGanZhi: '癸亥', monthGanZhi: '乙丑', dayGanZhi: '丙寅', hourGanZhi: '辛卯',
  wuxing: { metal: 1, wood: 3, water: 2, fire: 1, earth: 1 } };
let saved, writes;
beforeEach(() => {
  saved = new User({ _id: userId, birthInfo: fullBirth, gender: 1 });
  writes = [];
  getEightChar.mockClear();
  jest.spyOn(User, 'findById').mockImplementation(async () => saved);
  jest.spyOn(User, 'findByIdAndUpdate').mockImplementation(async (id, update) => {
    writes.push({ id, update });
    saved = new User({ ...saved.toObject(), ...update.$set });
    return saved;
  });
  jest.spyOn(Fortune, 'countDocuments').mockResolvedValue(0);
  jest.spyOn(Fortune, 'create').mockImplementation(() => { throw new Error('unexpected fortune persistence'); });
});
afterEach(() => jest.restoreAllMocks());
async function validate(chain, body) {
  const req = { body };
  for (const middleware of chain.slice(0, -1)) await middleware.run(req);
  return validationResult(req).array();
}
async function saveThroughController(body) {
  const req = { body, user: { userId } };
  for (const middleware of userValidation.updateBirthInfo.slice(0, -1)) await middleware.run(req);
  let status = 200, data;
  const res = { status(value) { status = value; return this; }, json(value) { data = value; } };
  let pending;
  userValidation.updateBirthInfo.at(-1)(req, res, () => {
    pending = controller.updateBirthInfo(req, res, error => {
      status = error.status || 500; data = { message: error.message };
    });
  });
  await pending;
  return { status, data };
}

test.each([
  [{ solarDate: '1984-02-02', birthTime: '未知' }, '1984-02-02', '1984-1-1'],
  [{ solarDate: '1984-01-01', calendar: 'lunar', birthTime: '未知' }, '1984-02-02', '1984-1-1'],
])('personal save accepts unknown, replaces old chart, and profile/default daily remain usable (%#)', async (input, solar, lunar) => {
  const response = await saveThroughController(input);
  expect(response.status).toBe(200);
  expect(response.data.code).toBe(0);
  expect(response.data.data).toMatchObject({ solarDate: solar, lunarDate: lunar, birthTime: '未知' });
  expect(getEightChar).not.toHaveBeenCalled();
  expect(writes).toHaveLength(1);
  const profile = await userService.getProfile(userId);
  expect(profile.birthInfo.birthTime).toBe('未知');
  for (const key of ['yearGanZhi', 'monthGanZhi', 'dayGanZhi', 'hourGanZhi']) expect(profile.birthInfo[key]).toBeUndefined();
  expect(await fortune.getDailyFortune(userId)).toEqual(await fortune.getDailyFortune(null));
});

test('direct personal save preserves unknown and adding a valid time restores the real chart', async () => {
  const unknown = await userService.updateBirthInfo(userId, { solarDate: '1984-02-02', birthTime: '未知' });
  expect(unknown.birthTime).toBe('未知');
  expect(unknown.yearGanZhi).toBeUndefined();
  expect(getEightChar).not.toHaveBeenCalled();
  const known = await userService.updateBirthInfo(userId, { solarDate: '1984-02-02', birthTime: '卯时' });
  expect(known).toMatchObject(fullBirth);
  expect(getEightChar).toHaveBeenCalledTimes(1);
});

test.each([
  { solarDate: '2000-02-30' }, { solarDate: '1900-02-29' }, { solarDate: '1849-12-31' },
  { solarDate: '2101-01-01' }, { solarDate: ['1984-02-02'] }, { solarDate: {} },
  { solarDate: '1984-01-31', calendar: 'lunar' }, { calendar: ['solar'] },
  { birthTime: ['未知'] }, { birthTime: ['子时'] }, { birthTime: {} },
  { birthTime: '' }, { birthTime: '不知道' }, { birthTime: '未知'.repeat(10000) }, { birthTime: 0 },
])('invalid personal date/time types fail before persistence in both entry paths (%#)', async extra => {
  const input = { solarDate: '1984-02-02', birthTime: '未知', ...extra };
  const response = await saveThroughController(input);
  expect(response.status).toBe(400);
  await expect(userService.updateBirthInfo(userId, input)).rejects.toMatchObject({ status: 400 });
  expect(writes).toHaveLength(0);
});

test('unknown remains invalid for formal bazi, matching and model tool calculations', async () => {
  const input = { solarDate: '1984-02-02', birthTime: '未知', gender: 'male' };
  expect(await validate(fortuneValidation.bazi, input)).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'birthTime' })]));
  const pair = { name1: '张三', solarDate1: input.solarDate, birthTime1: '未知', gender1: 'male',
    name2: '李四', solarDate2: input.solarDate, birthTime2: '卯时', gender2: 'female', relationType: 'love' };
  expect(await validate(fortuneValidation.baziMatch, pair)).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'birthTime1' })]));
  expect(() => validateToolArguments('analyze_bazi', input)).toThrow();
  await expect(fortune.baziAnalysis(null, input)).rejects.toMatchObject({ status: 400 });
  await expect(fortune.baziMatchAnalysis(userId, pair)).rejects.toMatchObject({ status: 400 });
  expect(Fortune.create).not.toHaveBeenCalled();
});
