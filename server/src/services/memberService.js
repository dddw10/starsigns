const User = require('../models/User');
const { getRedis } = require('../config/redis');

// 会员等级配置
const MEMBER_LEVELS = {
  0: {
    name: '普通用户',
    dailyFree: 1,
    discount: 1.0,
    features: [],
    priceMonthly: 0,
    priceYearly: 0,
  },
  1: {
    name: 'VIP会员',
    dailyFree: 5,
    discount: 0.8,
    features: ['专属客服', '优先响应', '详细解读', '历史记录'],
    priceMonthly: 1990,
    priceYearly: 19900,
  },
  2: {
    name: 'SVIP会员',
    dailyFree: 10,
    discount: 0.6,
    features: ['专属客服', '优先响应', '详细解读', '历史记录', 'AI深度分析', '个性化报告', '运势提醒'],
    priceMonthly: 2990,
    priceYearly: 29900,
  },
};

// 免费用户每日免费次数
const DAILY_FREE_QUOTA = 1;

class MemberService {
  // 获取用户会员信息
  async getMemberInfo(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('用户不存在');
    }

    const now = new Date();
    const isMember = user.memberLevel > 0 && user.memberExpireAt && user.memberExpireAt > now;
    const level = isMember ? user.memberLevel : 0;
    const memberConfig = MEMBER_LEVELS[level];

    // 检查今日免费次数使用情况
    const todayUsed = await this._getTodayUsedCount(userId);
    const dailyFree = level > 0 ? memberConfig.dailyFree : DAILY_FREE_QUOTA;
    const remaining = Math.max(0, dailyFree - todayUsed);

    return {
      userId,
      memberLevel: level,
      memberName: memberConfig.name,
      isMember,
      memberExpireAt: user.memberExpireAt,
      features: memberConfig.features,
      discount: memberConfig.discount,
      dailyFree,
      todayUsed,
      remaining,
      fortuneQuota: user.fortuneQuota || 0,
      prices: {
        monthly: MEMBER_LEVELS[1].priceMonthly,
        yearly: MEMBER_LEVELS[1].priceYearly,
        svipMonthly: MEMBER_LEVELS[2].priceMonthly,
        svipYearly: MEMBER_LEVELS[2].priceYearly,
      },
    };
  }

  // 获取今日已使用次数
  async _getTodayUsedCount(userId) {
    const redis = getRedis();
    const today = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const key = `fortune:daily:${userId}:${today}`;
    const count = await redis.get(key);
    return parseInt(count, 10) || 0;
  }

  // 记录今日使用次数
  async recordUsage(userId) {
    const redis = getRedis();
    const today = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const key = `fortune:daily:${userId}:${today}`;
    await redis.incr(key);
    await redis.expire(key, 2 * 24 * 60 * 60); // 2天过期
  }

  // 检查用户是否有免费次数
  async checkFreeQuota(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('用户不存在');
    }

    const now = new Date();
    const isMember = user.memberLevel > 0 && user.memberExpireAt && user.memberExpireAt > now;
    const level = isMember ? user.memberLevel : 0;
    const memberConfig = MEMBER_LEVELS[level];

    // 检查今日免费次数
    const todayUsed = await this._getTodayUsedCount(userId);
    const dailyFree = level > 0 ? memberConfig.dailyFree : DAILY_FREE_QUOTA;

    if (todayUsed < dailyFree) {
      return { canUse: true, type: 'free', remaining: dailyFree - todayUsed };
    }

    // 检查付费次数
    if (user.fortuneQuota > 0) {
      return { canUse: true, type: 'quota', remaining: user.fortuneQuota };
    }

    return { canUse: false, type: 'none', remaining: 0 };
  }

  // 扣除使用次数
  async deductUsage(userId, type = 'free') {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('用户不存在');
    }

    if (type === 'free') {
      // 记录免费次数使用
      await this.recordUsage(userId);
    } else if (type === 'quota') {
      // 扣除付费次数
      if (user.fortuneQuota <= 0) {
        throw new Error('算命次数不足');
      }
      user.fortuneQuota -= 1;
      await user.save();
    }

    return true;
  }

  // 激活会员
  async activateMembership(userId, productType) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('用户不存在');
    }

    const now = new Date();
    const baseTime = user.memberExpireAt && user.memberExpireAt > now ? user.memberExpireAt : now;

    let newLevel;
    let duration;

    switch (productType) {
      case 'member_monthly':
        newLevel = 1;
        duration = 30 * 24 * 60 * 60 * 1000;
        break;
      case 'member_yearly':
        newLevel = 2;
        duration = 365 * 24 * 60 * 60 * 1000;
        break;
      default:
        throw new Error('无效的会员类型');
    }

    // 升级逻辑：高等级会员不降级
    if (newLevel > user.memberLevel) {
      user.memberLevel = newLevel;
    }

    user.memberExpireAt = new Date(baseTime.getTime() + duration);
    await user.save();

    // 清除缓存
    const redis = getRedis();
    await redis.del(`member:info:${userId}`);

    return {
      memberLevel: user.memberLevel,
      memberExpireAt: user.memberExpireAt,
      memberName: MEMBER_LEVELS[user.memberLevel].name,
    };
  }

  // 会员续费
  async renewMembership(userId, productType) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('用户不存在');
    }

    if (user.memberLevel === 0) {
      throw new Error('您不是会员，请先开通');
    }

    const now = new Date();
    const baseTime = user.memberExpireAt && user.memberExpireAt > now ? user.memberExpireAt : now;

    let duration;
    switch (productType) {
      case 'member_monthly':
        duration = 30 * 24 * 60 * 60 * 1000;
        break;
      case 'member_yearly':
        duration = 365 * 24 * 60 * 60 * 1000;
        break;
      default:
        throw new Error('无效的续费类型');
    }

    user.memberExpireAt = new Date(baseTime.getTime() + duration);
    await user.save();

    // 清除缓存
    const redis = getRedis();
    await redis.del(`member:info:${userId}`);

    return {
      memberLevel: user.memberLevel,
      memberExpireAt: user.memberExpireAt,
      memberName: MEMBER_LEVELS[user.memberLevel].name,
    };
  }

  // 会员降级（过期处理）
  async downgradeExpiredMembers() {
    const now = new Date();
    const expiredUsers = await User.find({
      memberLevel: { $gt: 0 },
      memberExpireAt: { $lte: now },
    });

    for (const user of expiredUsers) {
      user.memberLevel = 0;
      user.memberExpireAt = null;
      await user.save();

      // 清除缓存
      const redis = getRedis();
      await redis.del(`member:info:${user._id}`);
    }

    return expiredUsers.length;
  }

  // 获取会员权益列表
  getMemberBenefits() {
    return MEMBER_LEVELS;
  }

  // 检查用户是否享有某项权益
  async checkFeature(userId, feature) {
    const user = await User.findById(userId);
    if (!user) return false;

    const now = new Date();
    const isMember = user.memberLevel > 0 && user.memberExpireAt && user.memberExpireAt > now;
    if (!isMember) return false;

    const memberConfig = MEMBER_LEVELS[user.memberLevel];
    return memberConfig.features.includes(feature);
  }

  // 获取会员统计
  async getMemberStats(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('用户不存在');
    }

    const now = new Date();
    const isMember = user.memberLevel > 0 && user.memberExpireAt && user.memberExpireAt > now;

    // 计算会员天数
    let memberDays = 0;
    if (isMember) {
      const created = new Date(user.createdAt).getTime();
      const expire = new Date(user.memberExpireAt).getTime();
      memberDays = Math.floor((expire - created) / (24 * 60 * 60 * 1000));
    }

    return {
      isMember,
      memberLevel: user.memberLevel,
      memberName: MEMBER_LEVELS[user.memberLevel].name,
      memberDays,
      totalUsage: user.totalUsage || 0,
      fortuneQuota: user.fortuneQuota || 0,
    };
  }
}

module.exports = new MemberService();
