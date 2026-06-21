const Pet = require('../models/Pet');
const User = require('../models/User');

// 根据出生日期获取神兽类型
function getPetTypeByBirthDate(solarDateStr) {
  if (!solarDateStr) return 'egg';
  try {
    const date = new Date(solarDateStr);
    if (isNaN(date.getTime())) return 'egg';
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const val = month + day / 100;

    // 四季交替与节气交界日 (立春、春分、立夏、夏至、立秋、秋分、立冬、冬至) -> 麒麟
    const qilinDays = [2.04, 3.20, 5.05, 6.21, 8.07, 9.22, 11.07, 12.22];
    if (qilinDays.includes(val)) {
      return 'qilin';
    }

    // 3.20 - 6.20: 青龙 (木)
    // 6.21 - 9.21: 朱雀 (火)
    // 9.22 - 12.21: 白虎 (金)
    // 12.22 - 3.19: 玄武 (水)
    if (val >= 3.20 && val <= 6.20) {
      return 'qinglong';
    } else if (val >= 6.21 && val <= 9.21) {
      return 'zhuque';
    } else if (val >= 9.22 && val <= 12.21) {
      return 'baihu';
    } else {
      return 'xuanwu';
    }
  } catch (e) {
    return 'egg';
  }
}

// 获取默认名称
function getDefaultPetName(type) {
  const names = {
    egg: '神秘星运蛋',
    qinglong: '东方青龙',
    zhuque: '南方朱雀',
    baihu: '西方白虎',
    xuanwu: '北方玄武',
    qilin: '祥瑞麒麟',
  };
  return names[type] || '神秘灵兽';
}

// 经验值升级上限公式: 100 * L^2
function getLevelUpExp(level) {
  return 100 * level * level;
}

// 1. 获取宠物状态
exports.getPetStatus = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user) {
      return res.json({ code: 404, message: '用户不存在' });
    }

    let pet = await Pet.findOne({ userId });
    const userBirthDate = user.birthInfo && user.birthInfo.solarDate;

    // 若宠物不存在，初始化一个
    if (!pet) {
      const type = getPetTypeByBirthDate(userBirthDate);
      const name = getDefaultPetName(type);
      pet = new Pet({
        userId,
        type,
        name,
        inventory: {
          coarseGrass: 1, // 赠送1个仙草
          morningDew: 0,
          wuguPill: 0,
          taijiPeach: 0,
        },
      });
      await pet.save();
    } else {
      // 若已有宠物是蛋形态，但用户现在填写了生日，则破壳孵化
      if (pet.type === 'egg' && userBirthDate) {
        pet.type = getPetTypeByBirthDate(userBirthDate);
        if (!pet.name || pet.name === '神秘星运蛋') {
          pet.name = getDefaultPetName(pet.type);
        }
      }

      // 计算自然衰减 (每小时饱食度-2，心情在24小时不登录时-15)
      const now = new Date();
      const timeDiffMs = now - pet.lastDecayAt;
      if (timeDiffMs > 0) {
        const hoursPassed = timeDiffMs / (3600 * 1000);
        
        // 饱食度自然流逝 -2/小时
        const hungerDecay = Math.floor(hoursPassed * 2);
        // 心情自然流逝 -15/24小时 (约 0.625/小时)
        const moodDecay = Math.floor(hoursPassed * (15 / 24));

        if (hungerDecay > 0 || moodDecay > 0) {
          pet.hunger = Math.max(0, pet.hunger - hungerDecay);
          pet.mood = Math.max(0, pet.mood - moodDecay);
          
          // 保留未够一整小时的小数部分，使得时间累计精确
          const elapsedDecayedMs = Math.max(hungerDecay / 2, moodDecay / (15 / 24)) * 3600 * 1000;
          pet.lastDecayAt = new Date(pet.lastDecayAt.getTime() + elapsedDecayedMs);
        }
      }

      // 检查跨天重置抚摸次数
      const lastInteractDate = new Date(pet.lastInteractedAt).toDateString();
      const todayDate = now.toDateString();
      if (lastInteractDate !== todayDate) {
        pet.dailyInteractCount = 0;
      }

      await pet.save();
    }

    res.json({
      code: 0,
      message: 'success',
      data: pet,
    });
  } catch (error) {
    next(error);
  }
};

// 2. 喂食
exports.feedPet = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { itemType } = req.body; // coarseGrass | morningDew | wuguPill | taijiPeach

    const pet = await Pet.findOne({ userId });
    if (!pet) {
      return res.json({ code: 404, message: '神兽尚未苏醒' });
    }

    if (!pet.inventory[itemType] || pet.inventory[itemType] <= 0) {
      return res.json({ code: 400, message: '该饲料库存不足，多去测算或签到获取吧！' });
    }

    // 饲料数据定义
    const feedProps = {
      coarseGrass: { hunger: 10, exp: 10, name: '粗粮仙草' },
      morningDew: { hunger: 30, exp: 40, name: '晨露琼浆' },
      wuguPill: { hunger: 60, exp: 90, name: '五谷朱砂丹' },
      taijiPeach: { hunger: 100, exp: 200, name: '太极蟠桃' },
    };

    const prop = feedProps[itemType];
    if (!prop) {
      return res.json({ code: 400, message: '无效的饲料类型' });
    }

    // 扣除道具，增加数值
    pet.inventory[itemType] -= 1;
    pet.hunger = Math.min(100, pet.hunger + prop.hunger);
    pet.exp += prop.exp;
    pet.totalExpEarned += prop.exp;

    // 升级检测
    let didLevelUp = false;
    let levelUps = 0;
    while (pet.exp >= getLevelUpExp(pet.level)) {
      pet.exp -= getLevelUpExp(pet.level);
      pet.level += 1;
      pet.giftBoxes += 1; // 每次升级赠送一个福袋
      didLevelUp = true;
      levelUps += 1;
    }

    // 随机掉落机制: 10% 概率额外掉落一个福袋
    let extraBoxDropped = false;
    if (Math.random() < 0.10) {
      pet.giftBoxes += 1;
      extraBoxDropped = true;
    }

    pet.lastFedAt = new Date();
    // 喂食友好地更新衰减计时点
    pet.lastDecayAt = new Date();
    await pet.save();

    res.json({
      code: 0,
      message: '喂食成功',
      data: {
        pet,
        addedHunger: prop.hunger,
        addedExp: prop.exp,
        didLevelUp,
        levelUps,
        extraBoxDropped,
      },
    });
  } catch (error) {
    next(error);
  }
};

// 3. 互动抚摸 (摸摸头)
exports.interactPet = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const pet = await Pet.findOne({ userId });
    if (!pet) {
      return res.json({ code: 404, message: '神兽尚未苏醒' });
    }

    const now = new Date();
    const lastInteractDate = new Date(pet.lastInteractedAt).toDateString();
    const todayDate = now.toDateString();

    if (lastInteractDate !== todayDate) {
      pet.dailyInteractCount = 0;
    }

    if (pet.dailyInteractCount >= 3) {
      return res.json({ code: 400, message: '今天抚摸次数已达上限(3次)，明天再来吧！' });
    }

    pet.dailyInteractCount += 1;
    pet.mood = Math.min(100, pet.mood + 10);
    pet.exp += 5; // 抚摸加5点微弱经验值

    // 抚摸可能导致升级
    let didLevelUp = false;
    while (pet.exp >= getLevelUpExp(pet.level)) {
      pet.exp -= getLevelUpExp(pet.level);
      pet.level += 1;
      pet.giftBoxes += 1;
      didLevelUp = true;
    }

    pet.lastInteractedAt = now;
    await pet.save();

    res.json({
      code: 0,
      message: '抚摸成功，神兽发出愉悦的叫声~',
      data: {
        pet,
        didLevelUp,
      },
    });
  } catch (error) {
    next(error);
  }
};

// 4. 改名
exports.renamePet = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { name } = req.body;

    if (!name || name.trim().length === 0) {
      return res.json({ code: 400, message: '名称不能为空' });
    }

    if (name.trim().length > 10) {
      return res.json({ code: 400, message: '昵称字数不能超过10个字' });
    }

    const pet = await Pet.findOne({ userId });
    if (!pet) {
      return res.json({ code: 404, message: '神兽尚未苏醒' });
    }

    pet.name = name.trim();
    await pet.save();

    res.json({
      code: 0,
      message: '更名成功',
      data: pet,
    });
  } catch (error) {
    next(error);
  }
};

// 5. 开启神兽福袋 (气运抽奖)
exports.drawPetReward = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const pet = await Pet.findOne({ userId });
    if (!pet) {
      return res.json({ code: 404, message: '神兽尚未苏醒' });
    }

    if (pet.giftBoxes <= 0) {
      return res.json({ code: 400, message: '您目前没有可开启的神兽八卦福袋' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.json({ code: 404, message: '用户不存在' });
    }

    // 扣除福袋
    pet.giftBoxes -= 1;

    // 抽奖概率划分:
    // 金色传说 (2%): 30天会员体验
    // 极佳好运 (8%): 7天会员体验
    // 凡品好礼 (30%): 2个太极蟠桃
    // 阳光普照 (60%): 200经验值 或 3个粗粮仙草 (各占30%)
    const rand = Math.random() * 100;
    let rewardType = 'white';
    let rewardName = '';
    let rewardDesc = '';

    if (rand < 2) {
      rewardType = 'gold';
      rewardName = '30天会员卡';
      rewardDesc = '已为您自动激活/顺延30天VIP会员特权！';

      // 赠送30天会员
      user.memberLevel = 1;
      const baseDate = (user.memberExpireAt && user.memberExpireAt > new Date()) ? user.memberExpireAt : new Date();
      user.memberExpireAt = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000);
      await user.save();
    } else if (rand < 10) {
      rewardType = 'blue';
      rewardName = '7天会员卡';
      rewardDesc = '已为您自动激活/顺延7天VIP会员特权！';

      // 赠送7天会员
      user.memberLevel = 1;
      const baseDate = (user.memberExpireAt && user.memberExpireAt > new Date()) ? user.memberExpireAt : new Date();
      user.memberExpireAt = new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      await user.save();
    } else if (rand < 40) {
      rewardType = 'green';
      rewardName = '太极蟠桃';
      rewardDesc = '福袋飘出仙气，您的神兽库房增加了 2 颗太极蟠桃！';

      pet.inventory.taijiPeach += 2;
    } else {
      rewardType = 'white';
      if (Math.random() < 0.5) {
        rewardName = '灵气大补 (200 EXP)';
        rewardDesc = '福袋金光一闪，神兽顿时领悟，灵气增加了 200 点！';
        pet.exp += 200;
        
        // 经验增幅也可能触发升级
        while (pet.exp >= getLevelUpExp(pet.level)) {
          pet.exp -= getLevelUpExp(pet.level);
          pet.level += 1;
          pet.giftBoxes += 1;
        }
      } else {
        rewardName = '粗粮仙草';
        rewardDesc = '福袋掉出几束仙草，您的神兽库房增加了 3 株粗粮仙草！';
        pet.inventory.coarseGrass += 3;
      }
    }

    await pet.save();

    res.json({
      code: 0,
      message: '开启成功',
      data: {
        rewardType,
        rewardName,
        rewardDesc,
        pet,
      },
    });
  } catch (error) {
    next(error);
  }
};
