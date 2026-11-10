const Pet = require('../models/Pet');

function getPetTypeByBirthDate(solarDate) {
  if (!solarDate) return 'egg';
  const date = new Date(solarDate);
  if (Number.isNaN(date.getTime())) return 'egg';
  const value = date.getMonth() + 1 + date.getDate() / 100;
  if ([2.04, 3.20, 5.05, 6.21, 8.07, 9.22, 11.07, 12.22].includes(value)) return 'qilin';
  if (value >= 3.20 && value <= 6.20) return 'qinglong';
  if (value >= 6.21 && value <= 9.21) return 'zhuque';
  if (value >= 9.22 && value <= 12.21) return 'baihu';
  return 'xuanwu';
}
function getDefaultPetName(type) {
  return { egg: '神秘星运蛋', qinglong: '东方青龙', zhuque: '南方朱雀',
    baihu: '西方白虎', xuanwu: '北方玄武', qilin: '祥瑞麒麟' }[type] || '神秘灵兽';
}

async function ensurePet(userId, solarDate) {
  const existing = await Pet.findOne({ userId });
  if (existing) return existing;
  const type = getPetTypeByBirthDate(solarDate);
  try {
    return await Pet.findOneAndUpdate({ userId }, { $setOnInsert: { type, name: getDefaultPetName(type) } },
      { upsert: true, new: true, setDefaultsOnInsert: true });
  } catch (error) {
    if (error.code !== 11000) throw error;
    const pet = await Pet.findOne({ userId });
    if (!pet) throw error;
    return pet;
  }
}

// Recompute state after contention; every balance writer advances the same version.
async function mutatePet(userId, change, consumed = {}) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const pet = await Pet.findOne({ userId });
    if (!pet) return { code: 404, message: '神兽尚未苏醒' };
    const before = pet.toObject();
    const result = change(pet);
    if (result.code !== 0 || !pet.isModified()) return result;
    const filter = { userId, __v: before.__v === undefined ? { $exists: false } : before.__v };
    for (const [key, amount] of Object.entries(consumed)) filter[key] = { $gte: amount };
    const update = { $inc: { __v: 1 }, $set: {} };
    for (const key of Object.keys(before)) {
      if (['_id', '__v', 'userId', 'createdAt', 'updatedAt', 'inventory', 'giftBoxes'].includes(key)) continue;
      if (JSON.stringify(before[key]) !== JSON.stringify(pet.get(key))) update.$set[key] = pet.get(key);
    }
    for (const key of ['giftBoxes', ...Object.keys(before.inventory).map(item => `inventory.${item}`)]) {
      const old = key === 'giftBoxes' ? before.giftBoxes : before.inventory[key.split('.')[1]];
      const delta = pet.get(key) - old;
      if (delta) update.$inc[key] = delta;
      if (delta < 0) filter[key] = { $gte: -delta };
    }
    if (!Object.keys(update.$set).length) delete update.$set;
    const saved = await Pet.findOneAndUpdate(filter, update, { new: true, runValidators: true });
    if (saved) {
      if (result.data?.pet) result.data.pet = saved;
      else result.data = saved;
      return result;
    }
  }
  const error = new Error('神兽状态正在更新，请稍后重试');
  error.status = 409;
  throw error;
}

async function rewardCheckIn(userId, day) {
  await ensurePet(userId);
  await Pet.findOneAndUpdate({ userId, $or: [
    { lastCheckInRewardDay: { $lt: day } }, { lastCheckInRewardDay: { $exists: false } },
  ] }, { $set: { lastCheckInRewardDay: day }, $inc: { 'inventory.morningDew': 1, __v: 1 } }, { new: true });
}

module.exports = { ensurePet, mutatePet, rewardCheckIn, getPetTypeByBirthDate, getDefaultPetName };
