const axios = require('axios');
const User = require('../models/User');
const Feedback = require('../models/Feedback');
const wechatConfig = require('../config/wechat');
const { generateToken } = require('../middleware/auth');
const { isAdminUser } = require('../config/admin');
const { getRedis } = require('../config/redis');
const { getEightChar, resolveSolarDate } = require('../algorithms/bazi');
const { getBeijingDateString } = require('../utils/date');

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
    // H5 端拿不到微信 code，前端传的是一个存在浏览器里的持久 UUID（h5- 前缀）。
    // 这是 H5 的正式身份来源，生产环境同样要放行
    if (String(code).startsWith('h5-')) {
      return this._mockWxLogin(code);
    }

    if (this._shouldUseMockLogin()) {
      if (!this._hasWechatCredentials()) {
        console.warn('[login] 微信凭证缺失，本次走 mock 登录：openid 由一次性 code 派生，换个 code 就是换个用户，仅限本地开发');
      }
      return this._mockWxLogin(code);
    }

    if (!this._hasWechatCredentials()) {
      // 这里宁可报错也不能降级：降级会悄悄给用户换一个身份，比登录失败难查得多
      console.error(
        '[login] 拒绝登录：WECHAT_APP_ID / WECHAT_APP_SECRET 未配置或仍是占位值。' +
        '生产环境不允许降级到 mock 登录（每次冷启动都会新建一个用户，用户会发现自己的数据没了）。' +
        '请补全环境变量后重启服务；确实要在生产用 mock 请显式设置 ALLOW_MOCK_LOGIN=true。'
      );
      const err = new Error('服务端未配置微信登录凭证');
      err.status = 503;
      throw err;
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
    const Fortune = require('../models/Fortune');
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    // 总测算次数以 fortunes 集合实际条数为准（{userId, type} 索引可覆盖该查询）
    const totalUsage = await Fortune.countDocuments({ userId });
    return {
      ...this._formatUserInfo(user),
      totalUsage,
    };
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
    // 历法选农历时，先把用户填的农历日期折算成公历。
    // birthInfo.solarDate 存的必须是真公历，否则每日运势会按农历日期重算出错的八字
    const solarDate = resolveSolarDate(data.solarDate, data.calendar);

    const birthInfo = {
      solarDate,
      lunarDate: data.lunarDate || '',
      birthTime: data.birthTime,
    };

    if (solarDate) {
      // 时辰要一起传进去，否则时柱恒等于子时那一柱
      const eightChar = getEightChar(solarDate, data.birthTime);
      const lunar = eightChar.getLunar();

      birthInfo.lunarDate = `${lunar.getYear()}-${lunar.getMonth()}-${lunar.getDay()}`;

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
        const targetDate = getBeijingDateString();
        await redis.del(`daily_fortune:user:${userId}:${targetDate}`);
      }
    } catch (err) {
      console.warn('Redis clear failed on updateBirthInfo:', err.message);
    }

    return user.birthInfo;
  }

  async getStats(userId) {
    const Fortune = require('../models/Fortune');
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const fortuneCount = await Fortune.countDocuments({ userId });

    return {
      fortuneCount,
    };
  }

  async checkIn(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('用户不存在');
    }

    // 签到跨天一律按北京时间判定，跟服务器时区无关
    const todayStr = getBeijingDateString();
    const lastCheckInStr = user.lastCheckInAt ? getBeijingDateString(user.lastCheckInAt) : '';

    if (todayStr === lastCheckInStr) {
      throw new Error('您今天已经签到过了哦，明天再来吧！');
    }

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
      lastCheckInAt: user.lastCheckInAt,
      petRewardMessage,
    };
  }

  // 微信凭证是否齐全。AppID 和 AppSecret 少一个 jscode2session 都换不出 openid
  _hasWechatCredentials() {
    return wechatConfig.hasCredentials();
  }

  // mock 登录的身份是拿一次性的 login code 拼出来的（openid = dev_openid_<code>），
  // 小程序每次冷启动 code 都不一样，也就等于换了一个新用户：生辰、历史记录、神兽全都对不上。
  // 线上真出过这事——WECHAT_APP_SECRET 还是占位值，于是每次进小程序都新建一个账号。
  // 所以凭证齐全就一律走真实登录；凭证缺失时只有非生产环境（或显式 ALLOW_MOCK_LOGIN=true）才允许降级，
  // 生产环境宁可让登录报错，也不能悄悄发一个换了人的身份出去。
  _shouldUseMockLogin() {
    if (this._hasWechatCredentials()) {
      return process.env.ALLOW_MOCK_LOGIN === 'true';
    }
    return process.env.ALLOW_MOCK_LOGIN === 'true' || process.env.NODE_ENV !== 'production';
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
      phone: user.phone || '',
      isAdmin: isAdminUser(user),
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

  async bindPhone(userId, code) {
    // 手机号是管理员凭据，mock 绑定只允许在 mock 登录环境（本地/未配 AppID）下发生。
    // 注意：这里不能再认裸的 code === 'mock-phone-code'，否则线上任何登录用户
    // 都能把自己的 phone 写成白名单里的号码从而提权。
    if (this._shouldUseMockLogin() || String(code).startsWith('h5-')) {
      return this._mockBindPhone(userId);
    }

    try {
      const pushService = require('./pushService');
      const accessToken = await pushService._getAccessToken();

      const url = `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${accessToken}`;
      const res = await axios.post(url, { code });

      if (res.data.errcode !== 0) {
        throw new Error(`WeChat phone binding failed: ${res.data.errmsg} (code: ${res.data.errcode})`);
      }

      const phoneNumber = res.data.phone_info.phoneNumber;
      const user = await User.findByIdAndUpdate(userId, { $set: { phone: phoneNumber } }, { new: true });
      if (!user) {
        throw new Error('User not found');
      }
      return this._formatUserInfo(user);
    } catch (error) {
      console.error('WeChat bind phone error:', error.message);
      if (this._shouldUseMockLogin()) {
        return this._mockBindPhone(userId);
      }
      throw error;
    }
  }

  async _mockBindPhone(userId) {
    const mockPhone = (process.env.MOCK_BIND_PHONE || '13580006666').trim();
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { phone: mockPhone } },
      { new: true }
    );
    if (!user) {
      throw new Error('User not found');
    }
    return this._formatUserInfo(user);
  }

  async register(username, password) {
    if (!username || !username.trim()) {
      throw new Error('用户名不能为空');
    }
    if (!password || password.length < 6) {
      throw new Error('密码长度不能少于 6 位');
    }

    const existingUser = await User.findOne({ username: username.trim() });
    if (existingUser) {
      throw new Error('该账号已被注册');
    }

    const crypto = require('crypto');
    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');

    const openid = `h5_openid_${username.trim()}_${Math.random().toString(36).substring(2, 8)}`;
    const user = await User.create({
      username: username.trim(),
      password: hashedPassword,
      nickname: username.trim(),
      openid: openid
    });

    return this._buildLoginResult(user, openid);
  }

  async loginAccount(username, password) {
    if (!username || !username.trim()) {
      throw new Error('用户名不能为空');
    }
    if (!password) {
      throw new Error('密码不能为空');
    }

    const user = await User.findOne({ username: username.trim() });
    if (!user || !user.password) {
      throw new Error('账号或密码错误');
    }

    const crypto = require('crypto');
    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');

    if (user.password !== hashedPassword) {
      throw new Error('账号或密码错误');
    }

    return this._buildLoginResult(user, user.openid || `h5_openid_${user.username}`);
  }
}

module.exports = new UserService();
