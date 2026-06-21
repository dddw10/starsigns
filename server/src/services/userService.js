const axios = require('axios');
const { Solar } = require('lunar-javascript');
const User = require('../models/User');
const Feedback = require('../models/Feedback');
const wechatConfig = require('../config/wechat');
const { generateToken } = require('../middleware/auth');
const { getRedis } = require('../config/redis');

const GAN_WUXING = {
  '\u7532': 'wood',
  '\u4e59': 'wood',
  '\u4e19': 'fire',
  '\u4e01': 'fire',
  '\u620a': 'earth',
  '\u5df1': 'earth',
  '\u5e9a': 'metal',
  '\u8f9b': 'metal',
  '\u58ec': 'water',
  '\u7678': 'water',
};

const ZHI_WUXING = {
  '\u5b50': 'water',
  '\u4e11': 'earth',
  '\u5bc5': 'wood',
  '\u536f': 'wood',
  '\u8fb0': 'earth',
  '\u5df3': 'fire',
  '\u5348': 'fire',
  '\u672a': 'earth',
  '\u7533': 'metal',
  '\u9149': 'metal',
  '\u620c': 'earth',
  '\u4ea5': 'water',
};

class UserService {
  async wxLogin(code) {
    if (String(code).startsWith('h5-') || this._shouldUseMockLogin()) {
      return this._mockWxLogin(code);
    }

    const url = wechatConfig.getJsCodeSessionUrl(
      wechatConfig.appId,
      wechatConfig.appSecret,
      code
    );
    const wxResult = await axios.get(url);

    if (wxResult.data.errcode) {
      throw new Error(`Wechat login failed: ${wxResult.data.errmsg}`);
    }

    const { openid, unionid, session_key: sessionKey } = wxResult.data;
    const user = await this._findOrCreateUser({ openid, unionid });
    await this._cacheSession(openid, sessionKey);

    return this._buildLoginResult(user, openid);
  }

  async getProfile(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    return this._formatUserInfo(user);
  }

  async updateProfile(userId, data) {
    const updateData = {};
    if (data.nickname !== undefined) updateData.nickname = data.nickname;
    if (data.avatar !== undefined) updateData.avatar = data.avatar;
    if (data.gender !== undefined) updateData.gender = data.gender;

    const user = await User.findByIdAndUpdate(userId, { $set: updateData }, { new: true });
    if (!user) {
      throw new Error('User not found');
    }
    return this._formatUserInfo(user);
  }

  async updateBirthInfo(userId, data) {
    const birthInfo = {
      solarDate: data.solarDate,
      lunarDate: data.lunarDate || '',
      birthTime: data.birthTime,
    };

    if (data.solarDate) {
      const [year, month, day] = data.solarDate.split('-').map(Number);
      const lunar = Solar.fromYmd(year, month, day).getLunar();

      birthInfo.lunarDate = `${lunar.getYear()}-${lunar.getMonth()}-${lunar.getDay()}`;

      const eightChar = lunar.getEightChar();
      birthInfo.yearGanZhi = eightChar.getYear();
      birthInfo.monthGanZhi = eightChar.getMonth();
      birthInfo.dayGanZhi = eightChar.getDay();
      birthInfo.hourGanZhi = eightChar.getTime();
      birthInfo.wuxing = this._calculateWuxing(eightChar);
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { birthInfo } },
      { new: true }
    );

    if (!user) {
      throw new Error('User not found');
    }

    // 自动清除当前用户今日已缓存的每日运势，以触发基于新八字重算
    try {
      const redis = getRedis();
      if (redis) {
        const targetDate = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
        await redis.del(`daily_fortune:user:${userId}:${targetDate}`);
      }
    } catch (err) {
      console.warn('Redis clear failed on updateBirthInfo:', err.message);
    }

    return user.birthInfo;
  }

  async getStats(userId) {
    const Fortune = require('../models/Fortune');
    const Order = require('../models/Order');
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const fortuneCount = await Fortune.countDocuments({ userId });
    const orderCount = await Order.countDocuments({ userId, status: 'paid' });

    return {
      fortuneCount,
      orderCount,
      fortuneQuota: user.fortuneQuota,
      memberLevel: user.memberLevel,
    };
  }

  async getMemberStatus(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    return {
      memberLevel: user.memberLevel,
      memberExpireAt: user.memberExpireAt,
      isMember: user.isMember,
    };
  }

  async checkIn(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('用户不存在');
    }

    const getLocalDateString = (date) => {
      if (!date) return '';
      const localTime = new Date(date.getTime() + 8 * 60 * 60 * 1000);
      return localTime.toISOString().slice(0, 10);
    };

    const todayStr = getLocalDateString(new Date());
    const lastCheckInStr = getLocalDateString(user.lastCheckInAt);

    if (todayStr === lastCheckInStr) {
      throw new Error('您今天已经签到过了哦，明天再来吧！');
    }

    user.fortuneQuota += 1;
    user.lastCheckInAt = new Date();
    await user.save();

    // 签到赠送神兽琼浆饲料
    let petRewardMessage = '';
    try {
      const Pet = require('../models/Pet');
      let pet = await Pet.findOne({ userId });
      if (!pet) {
        pet = new Pet({
          userId,
          type: 'egg',
          name: '神秘星运蛋',
          inventory: {
            coarseGrass: 1,
            morningDew: 1,
            wuguPill: 0,
            taijiPeach: 0
          }
        });
      } else {
        pet.inventory.morningDew += 1;
      }
      await pet.save();
      petRewardMessage = '，并为您的神兽带回了 1 滴晨露琼浆';
    } catch (e) {
      console.warn('签到赠送神兽琼浆失败:', e.message);
    }

    return {
      fortuneQuota: user.fortuneQuota,
      lastCheckInAt: user.lastCheckInAt,
      petRewardMessage,
    };
  }

  _shouldUseMockLogin() {
    return (
      process.env.NODE_ENV === 'development' ||
      !wechatConfig.appId ||
      !wechatConfig.appSecret ||
      wechatConfig.appId === 'your_app_id' ||
      wechatConfig.appSecret === 'your_app_secret'
    );
  }

  async _mockWxLogin(code = 'dev-code') {
    const suffix = String(code || 'dev-code').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'dev-code';
    const openid = `dev_openid_${suffix}`;
    const unionid = `dev_unionid_${suffix}`;
    const sessionKey = 'dev_session_key';
    const isH5 = String(code).startsWith('h5-');
    const user = await this._findOrCreateUser({
      openid,
      unionid,
      nickname: isH5 ? 'H5 用户' : 'Local Dev User',
      avatar: '',
    });

    await this._cacheSession(openid, sessionKey);
    return this._buildLoginResult(user, openid);
  }

  async _findOrCreateUser({ openid, unionid, nickname = '', avatar = '' }) {
    let user = await User.findOne({ openid });
    if (!user) {
      user = await User.create({ openid, unionid, nickname, avatar });
    } else {
      if (unionid && !user.unionid) user.unionid = unionid;
      user.lastLoginAt = new Date();
      await user.save();
    }
    return user;
  }

  async _cacheSession(openid, sessionKey) {
    try {
      const redis = getRedis();
      if (redis && sessionKey) {
        await redis.set(`session:${openid}`, sessionKey, 'EX', 7200);
      }
    } catch (error) {
      console.warn('Session cache skipped:', error.message);
    }
  }

  _buildLoginResult(user, openid) {
    const token = generateToken({
      userId: user._id.toString(),
      openid,
    });

    return {
      token,
      userInfo: this._formatUserInfo(user),
    };
  }

  _formatUserInfo(user) {
    return {
      userId: user._id,
      nickname: user.nickname,
      avatar: user.avatar,
      gender: user.gender,
      memberLevel: user.memberLevel,
      vipLevel: user.memberLevel,
      memberExpireAt: user.memberExpireAt,
      fortuneQuota: user.fortuneQuota,
      freeUsage: user.fortuneQuota,
      totalUsage: 0,
      birthInfo: user.birthInfo,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };
  }

  async submitFeedback(userId, { type, content, contact }) {
    if (!content || !content.trim()) {
      throw new Error('反馈内容不能为空');
    }
    const feedback = new Feedback({
      userId,
      type: type || 'suggestion',
      content: content.trim(),
      contact: contact ? contact.trim() : undefined,
    });
    return await feedback.save();
  }

  async getUserFeedbackList(userId, { page = 1, pageSize = 10 }) {
    const total = await Feedback.countDocuments({ userId });
    const list = await Feedback.find({ userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(Number(pageSize));

    return {
      total,
      page: Number(page),
      pageSize: Number(pageSize),
      list,
    };
  }

  _calculateWuxing(eightChar) {
    const wuxing = { metal: 0, wood: 0, water: 0, fire: 0, earth: 0 };
    [
      eightChar.getYear(),
      eightChar.getMonth(),
      eightChar.getDay(),
      eightChar.getTime(),
    ].forEach((ganZhi) => {
      const gan = ganZhi.charAt(0);
      const zhi = ganZhi.charAt(1);
      if (GAN_WUXING[gan]) wuxing[GAN_WUXING[gan]] += 1;
      if (ZHI_WUXING[zhi]) wuxing[ZHI_WUXING[zhi]] += 1;
    });
    return wuxing;
  }
}

module.exports = new UserService();
