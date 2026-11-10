process.env.JWT_SECRET = 'test-only-secret-not-for-production-use';
jest.mock('../src/config/langfuse', () => null);
jest.mock('../src/config/redis', () => ({ getRedis: () => null }));
const { spawnSync } = require('child_process');
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Pet = require('../src/models/Pet');
const users = require('../src/services/userService');
const fortune = require('../src/services/fortuneService');
const controller = require('../src/controllers/petController');
const { ensurePet } = require('../src/services/petService');
const { getBeijingDateString } = require('../src/utils/date');
const databaseTest = process.env.RUN_PET_DB_TESTS === '1' ? test : test.skip;
function docker(args) {
  const result = spawnSync('docker', args, { encoding: 'utf8', timeout: 30000 });
  if (result.status !== 0) throw new Error(`Isolated fixture ${args[0]} failed (${result.status}): ${result.stderr}`);
  return result.stdout.trim();
}
async function call(userId, method, body = {}) {
  let result, error;
  await controller[method]({ user: { userId: userId.toString() }, body },
    { json: data => { result = data; } }, err => { error = err; });
  if (error) throw error;
  return result;
}

databaseTest('real Mongoose upsert and balance/version conditions preserve concurrent rewards and consume once', async () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const container = `fortune-pet-test-${suffix}`, network = `fortune-pet-net-${suffix}`;
  let started = false;
  docker(['image', 'inspect', 'mongo:7']);
  docker(['network', 'create', network]);
  try {
    docker(['run', '--pull=never', '-d', '--name', container, '--network', network,
      '-p', '127.0.0.1::27017', '-e', 'MONGO_INITDB_ROOT_USERNAME=fixture_admin',
      '-e', 'MONGO_INITDB_ROOT_PASSWORD=fixture_only_password', 'mongo:7', '--auth']);
    started = true;
    const binding = docker(['port', container, '27017/tcp']);
    expect(binding).toMatch(/^127\.0\.0\.1:\d+$/);
    const uri = `mongodb://fixture_admin:fixture_only_password@${binding}/fixture_pet?authSource=admin`;
    let ready = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 1000 });
        ready = true; break;
      } catch (error) { await new Promise(resolve => setTimeout(resolve, 500)); }
    }
    expect(ready).toBe(true);
    await Promise.all([User.init(), Pet.init()]);
    const user = await User.create({ openid: `fixture-${suffix}`, authSource: 'dev_mock' });
    const userId = user._id;
    const pets = await Promise.all([ensurePet(userId), ensurePet(userId), ensurePet(userId)]);
    expect(new Set(pets.map(pet => pet._id.toString())).size).toBe(1);
    expect(await Pet.countDocuments({ userId })).toBe(1);

    await Promise.allSettled([users.checkIn(userId), users.checkIn(userId)]);
    expect((await Pet.findOne({ userId })).inventory.morningDew).toBe(1);
    // Recover an acknowledgement failure after the reward was already committed.
    await User.updateOne({ _id: userId }, { $set: { checkInRewardPending: getBeijingDateString() } });
    await Promise.all([users.checkIn(userId), users.checkIn(userId)]);
    expect((await Pet.findOne({ userId })).inventory.morningDew).toBe(1);
    expect((await User.findById(userId)).checkInRewardPending).toBe('');

    jest.spyOn(Math, 'random').mockReturnValue(0.9);
    const consumed = await Promise.all([call(userId, 'feedPet', { itemType: 'coarseGrass' }), call(userId, 'feedPet', { itemType: 'coarseGrass' })]);
    expect(consumed.filter(result => result.code === 0)).toHaveLength(1);
    let pet = await Pet.findOne({ userId });
    expect(pet.inventory.coarseGrass).toBe(0); expect(pet.exp).toBe(10);
    await Promise.all(Array.from({ length: 4 }, () => fortune._rewardPetFood(userId)));
    expect((await Pet.findOne({ userId })).inventory.coarseGrass).toBe(4);

    await Pet.updateOne({ userId }, { $set: { exp: 95, giftBoxes: 0 }, $inc: { __v: 1 } });
    const original = Pet.findOneAndUpdate.bind(Pet);
    let injected = false;
    jest.spyOn(Pet, 'findOneAndUpdate').mockImplementation(async (filter, update, options) => {
      if (!injected && filter.__v !== undefined) {
        injected = true;
        await original({ userId }, { $inc: { giftBoxes: 2, __v: 1 } });
      }
      return original(filter, update, options);
    });
    expect((await call(userId, 'feedPet', { itemType: 'coarseGrass' })).code).toBe(0);
    pet = await Pet.findOne({ userId });
    expect(pet.level).toBe(2); expect(pet.exp).toBe(5); expect(pet.giftBoxes).toBe(3);
    expect(pet.inventory.coarseGrass).toBe(3);
    jest.restoreAllMocks();
  } finally {
    jest.restoreAllMocks();
    await mongoose.disconnect();
    if (started) docker(['rm', '-f', '-v', container]);
    docker(['network', 'rm', network]);
  }
}, 90000);
