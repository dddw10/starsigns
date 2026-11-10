process.env.JWT_SECRET = 'test-only-secret-not-for-production-use';
jest.mock('../src/config/langfuse', () => null);
jest.mock('../src/config/redis', () => ({ getRedis: () => null }));
const Pet = require('../src/models/Pet');
const User = require('../src/models/User');
const controller = require('../src/controllers/petController');
const users = require('../src/services/userService');
const fortune = require('../src/services/fortuneService');
const userId = '507f1f77bcf86cd799439011';
const clone = value => {
  if (value instanceof Date) return new Date(value);
  if (value?.toHexString) return value.toHexString();
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
  return value;
};
const get = (object, path) => path.split('.').reduce((value, key) => value?.[key], object);
function set(object, path, value) {
  const keys = path.split('.'), last = keys.pop();
  const parent = keys.reduce((value, key) => (value[key] ||= {}), object);
  parent[last] = clone(value);
}
function matches(object, filter) {
  return object && Object.entries(filter).every(([key, expected]) => {
    if (key === '$or') return expected.some(branch => matches(object, branch));
    const actual = get(object, key);
    if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
      return Object.entries(expected).every(([op, value]) => {
        if (op === '$gte') return actual >= value;
        if (op === '$lt') return actual != null && actual < value;
        if (op === '$exists') return (actual !== undefined) === value;
        if (op === '$in') return value.some(item => item === null ? actual == null : item === actual);
        throw new Error(`unsupported query operator ${op}`);
      });
    }
    return expected === null ? actual == null : String(actual) === String(expected);
  });
}
let state, user, beforeUpdate;
function hydrate() { return state ? Pet.hydrate(clone(state)) : null; }
beforeEach(() => {
  state = new Pet({ userId, name: '神秘星运蛋' }).toObject();
  state.__v = 0;
  user = { _id: userId, lastCheckInAt: null, checkInRewardPending: '', birthInfo: {}, save: jest.fn(async function () { user.lastCheckInAt = this.lastCheckInAt; }) };
  beforeUpdate = null;
  jest.spyOn(Math, 'random').mockReturnValue(0.9);
  jest.spyOn(Pet, 'findOne').mockImplementation(async () => hydrate());
  jest.spyOn(Pet.prototype, 'save').mockImplementation(async function () {
    if (!state) state = this.toObject();
    else for (const path of this.directModifiedPaths()) set(state, path, this.get(path));
    return this;
  });
  jest.spyOn(Pet, 'findOneAndUpdate').mockImplementation(async (filter, update, options = {}) => {
    if (beforeUpdate) { const action = beforeUpdate; beforeUpdate = null; action(); }
    if (!state && options.upsert) {
      state = new Pet({ userId, ...update.$setOnInsert }).toObject(); state.__v = 0;
    } else if (!matches(state, filter)) return null;
    for (const [path, value] of Object.entries(update.$set || {})) set(state, path, value);
    for (const [path, value] of Object.entries(update.$inc || {})) set(state, path, (get(state, path) || 0) + value);
    return hydrate();
  });
  jest.spyOn(User, 'findById').mockImplementation(async () => ({ ...user }));
  jest.spyOn(User, 'findOneAndUpdate').mockImplementation(async (filter, update) => {
    if (!matches(user, filter)) return null;
    Object.assign(user, update.$set); return { ...user };
  });
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });
async function call(method, body = {}) {
  let result, error;
  await controller[method]({ user: { userId }, body }, { json: data => { result = data; } }, err => { error = err; });
  if (error) throw error;
  return result;
}

test('same Beijing day check-in claims and rewards only once under contention', async () => {
  const results = await Promise.allSettled([users.checkIn(userId), users.checkIn(userId)]);
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  expect(state.inventory.morningDew).toBe(1);
});

test('check-in opens exactly at Beijing midnight', async () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-11-09T16:00:00Z'));
  user.lastCheckInAt = new Date('2026-11-09T15:59:59.999Z');
  await users.checkIn(userId);
  await expect(users.checkIn(userId)).rejects.toThrow('签到');
  expect(state.inventory.morningDew).toBe(1);
});

test('failed check-in reward remains recoverable without awarding twice', async () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-11-10T04:00:00Z'));
  Pet.findOneAndUpdate.mockRejectedValueOnce(new Error('database unavailable'));
  await expect(users.checkIn(userId)).rejects.toMatchObject({ status: 503 });
  expect(user.checkInRewardPending).toBe('2026-11-10');
  expect(state.inventory.morningDew).toBe(0);
  await users.checkIn(userId);
  expect(state.inventory.morningDew).toBe(1); expect(user.checkInRewardPending).toBe('');
  await expect(users.checkIn(userId)).rejects.toThrow('签到');
  expect(state.inventory.morningDew).toBe(1);
});

test('reward committed before a failed acknowledgement recovers without duplication', async () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-11-10T04:00:00Z'));
  const original = User.findOneAndUpdate.getMockImplementation();
  let calls = 0;
  User.findOneAndUpdate.mockImplementation(async (...args) => {
    if (++calls === 2) throw new Error('acknowledgement failed');
    return original(...args);
  });
  await expect(users.checkIn(userId)).rejects.toMatchObject({ status: 503 });
  expect(state.inventory.morningDew).toBe(1); expect(user.checkInRewardPending).toBe('2026-11-10');
  await users.checkIn(userId);
  expect(state.inventory.morningDew).toBe(1); expect(user.checkInRewardPending).toBe('');
});

test('legacy same-day check-in without recovery marker does not receive another reward', async () => {
  user.lastCheckInAt = new Date(); delete user.checkInRewardPending;
  await expect(users.checkIn(userId)).rejects.toThrow('签到');
  expect(state.inventory.morningDew).toBe(0);
});

test('a single food item cannot be consumed twice and gains experience once', async () => {
  const results = await Promise.all([call('feedPet', { itemType: 'coarseGrass' }), call('feedPet', { itemType: 'coarseGrass' })]);
  expect(results.filter(result => result.code === 0)).toHaveLength(1);
  expect(state.inventory.coarseGrass).toBe(0);
  expect(state.exp).toBe(10); expect(state.totalExpEarned).toBe(10);
});

test('concurrent rewards accumulate without losing food', async () => {
  await Promise.all([fortune._rewardPetFood(userId), fortune._rewardPetFood(userId)]);
  expect(state.inventory.coarseGrass).toBe(3);
});

test('concurrent first initialization creates one pet and retains all rewards', async () => {
  state = null;
  await Promise.all([call('getPetStatus'), fortune._rewardPetFood(userId)]);
  expect(state.inventory.coarseGrass).toBe(2);
  expect(state.userId.toString()).toBe(userId);
});

test('one gift bag produces one reward under contention', async () => {
  state.giftBoxes = 1;
  const results = await Promise.all([call('drawPetReward'), call('drawPetReward')]);
  expect(results.filter(result => result.code === 0)).toHaveLength(1);
  expect(state.giftBoxes).toBe(0); expect(state.inventory.coarseGrass).toBe(4);
});

test('pet mutation recomputes after a concurrent gift balance change', async () => {
  state.exp = 95;
  beforeUpdate = () => { state.giftBoxes += 2; state.__v += 1; };
  const result = await call('feedPet', { itemType: 'coarseGrass' });
  expect(result.code).toBe(0);
  expect(state.level).toBe(2); expect(state.exp).toBe(5); expect(state.giftBoxes).toBe(3);
});

test('three daily interactions stay capped and retain each experience gain', async () => {
  const results = await Promise.all(Array.from({ length: 4 }, () => call('interactPet')));
  expect(results.filter(result => result.code === 0)).toHaveLength(3);
  expect(state.dailyInteractCount).toBe(3); expect(state.exp).toBe(15);
});

test('status decay and rename preserve balances and upgrade rewards', async () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-11-10T04:00:00Z'));
  state.lastDecayAt = new Date('2026-11-10T02:45:00Z');
  state.lastMoodDecayAt = new Date('2026-11-10T02:00:00Z');
  state.hunger = 80; state.mood = 80;
  await call('getPetStatus');
  expect(state.hunger).toBe(78); expect(state.mood).toBe(79);
  expect(new Date(state.lastDecayAt).toISOString()).toBe('2026-11-10T03:45:00.000Z');
  expect(new Date(state.lastMoodDecayAt).toISOString()).toBe('2026-11-10T03:36:00.000Z');
  await Promise.all([call('renamePet', { name: '小青龙' }), fortune._rewardPetFood(userId, 'morningDew', 2)]);
  expect(state.name).toBe('小青龙'); expect(state.inventory.morningDew).toBe(2);
});

test('feeding and gift rewards retain product probabilities and level thresholds', async () => {
  state.inventory.taijiPeach = 1; state.exp = 90;
  Math.random.mockReturnValue(0.05);
  const feed = await call('feedPet', { itemType: 'taijiPeach' });
  expect(feed.data).toMatchObject({ addedHunger: 100, addedExp: 200, levelUps: 1, extraBoxDropped: true });
  expect(state.level).toBe(2); expect(state.exp).toBe(190); expect(state.giftBoxes).toBe(2);
  await call('drawPetReward'); expect(state.inventory.taijiPeach).toBe(2); expect(state.giftBoxes).toBe(1);
  Math.random.mockReturnValueOnce(0.2).mockReturnValueOnce(0.2);
  await call('drawPetReward'); expect(state.exp).toBe(390); expect(state.giftBoxes).toBe(0);
});

test.each(['', '十一二三四五六七八九十', 123])('invalid rename returns an actionable response: %p', async name => {
  expect(await call('renamePet', { name })).toMatchObject({ code: 400 });
  expect(state.name).toBe('神秘星运蛋');
});

test.each(['__proto__', 'constructor', 'inventory.coarseGrass', {}])('unknown food cannot mutate pet state: %p', async itemType => {
  expect(await call('feedPet', { itemType })).toMatchObject({ code: 400 });
  expect(state.exp).toBe(0); expect(state.inventory.coarseGrass).toBe(1);
});

test('persistent contention fails with a retryable conflict without changing balances', async () => {
  Pet.findOneAndUpdate.mockResolvedValue(null);
  await expect(call('feedPet', { itemType: 'coarseGrass' })).rejects.toMatchObject({ status: 409 });
  expect(state.exp).toBe(0); expect(state.inventory.coarseGrass).toBe(1);
});

test('legacy pet without version is updated without migration', async () => {
  delete state.__v;
  expect((await call('feedPet', { itemType: 'coarseGrass' })).code).toBe(0);
  expect(state.inventory.coarseGrass).toBe(0); expect(state.__v).toBe(1);
});

test('gift bag consumption checks balance even when an upgrade replaces the bag', async () => {
  state.giftBoxes = 1;
  Math.random.mockReturnValue(0.2);
  beforeUpdate = () => { state.giftBoxes = 0; };
  expect((await call('drawPetReward')).code).toBe(400);
  expect(state.exp).toBe(0); expect(state.giftBoxes).toBe(0);
});

test('a stale midnight request cannot replace the previous day pending reward', async () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-11-09T16:00:00Z'));
  user.lastCheckInAt = new Date('2026-11-09T15:59:59Z');
  user.checkInRewardPending = '2026-11-09';
  User.findById.mockResolvedValueOnce({ ...user, checkInRewardPending: '' });
  await expect(users.checkIn(userId)).rejects.toMatchObject({ status: 409 });
  expect(user.checkInRewardPending).toBe('2026-11-09'); expect(state.inventory.morningDew).toBe(0);
  await users.checkIn(userId);
  expect(state.inventory.morningDew).toBe(2); expect(user.checkInRewardPending).toBe('');
});
