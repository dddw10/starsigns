const axios = require('axios');
const { hashPassword, verifyPassword } = require('../utils/password');
const User = require('../models/User');
const Feedback = require('../models/Feedback');
const wechatConfig = require('../config/wechat');
const { generateToken } = require('../middleware/auth');
const { isAdminUser, normalizePhone } = require('../config/admin');
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
        '请补全环境变量后重启服务；模拟登录只允许隔离开发环境。'
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
    if (typeof openid !== 'string' || !openid.trim()) throw new Error('微信登录响应缺少有效身份');
    const user = await this._findOrCreateUser({ openid, unionid, authSource: 'wechat' });
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
    const { rewardCheckIn } = require('./petService');
    const now = new Date();
    const today = getBeijingDateString(now);
    let user = await User.findById(userId);
    if (!user) throw new Error('用户不存在');
    const deliver = async day => {
      try {
        await rewardCheckIn(userId, day);
        await User.findOneAndUpdate({ _id: userId, checkInRewardPending: day },
          { $set: { checkInRewardPending: '' } }, { new: true });
      } catch (cause) {
        const error = new Error('签到奖励暂未确认，请稍后重新签到补发');
        error.status = 503;
        error.expose = true;
        throw error;
      }
    };
    // 先恢复已认领的日期，再允许下一天认领；Pet 日期标记保证补发只加一次。
    const pending = user.checkInRewardPending;
    if (pending) await deliver(pending);
    if (pending !== today) {
      const start = new Date(`${today}T00:00:00+08:00`);
      user = await User.findOneAndUpdate({ _id: userId, checkInRewardPending: { $in: ['', null] },
        $or: [{ lastCheckInAt: null }, { lastCheckInAt: { $lt: start } }] },
      { $set: { lastCheckInAt: now, checkInRewardPending: today } }, { new: true });
      if (!user) {
        const latest = await User.findById(userId);
        const completed = latest && !latest.checkInRewardPending && latest.lastCheckInAt
          && getBeijingDateString(latest.lastCheckInAt) === today;
        const error = new Error(completed ? '您今天已经签到过了哦，明天再来吧！' : '签到状态正在更新，请稍后重试');
        error.status = completed ? 400 : 409;
        throw error;
      }
      await deliver(today);
    }
    return { lastCheckInAt: user.lastCheckInAt,
      petRewardMessage: '，并为您的神兽带回了 1 滴晨露琼浆' };
  }

  // 微信凭证是否齐全。AppID 和 AppSecret 少一个 jscode2session 都换不出 openid
  _hasWechatCredentials() {
    return wechatConfig.hasCredentials();
  }

  // mock 登录的身份是拿一次性的 login code 拼出来的（openid = dev_openid_<code>），
  // 小程序每次冷启动 code 都不一样，也就等于换了一个新用户：生辰、历史记录、神兽全都对不上。
  // 线上真出过这事——WECHAT_APP_SECRET 还是占位值，于是每次进小程序都新建一个账号。
  // 凭证缺失的模拟登录只允许非生产环境，生产环境不能用开关绕过。
  // 生产环境宁可让登录报错，也不能悄悄发一个换了人的身份出去。
  _shouldUseMockLogin() {
    if (!['development', 'test'].includes(process.env.NODE_ENV)) return false;
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
    if (!isH5 && !this._shouldUseMockLogin()) throw new Error('当前环境禁止模拟登录');
    const user = await this._findOrCreateUser({
      openid,
      unionid,
      nickname: isH5 ? 'H5 用户' : 'Local Dev User',
      avatar: '',
      authSource: isH5 ? 'h5_guest' : 'dev_mock',
    });

    await this._cacheSession(openid, sessionKey);
    return this._buildLoginResult(user, openid);
  }

  async _findOrCreateUser({ openid, unionid, nickname = '', avatar = '', authSource }) {
    let user = await User.findOne({ openid });
    if (!user) {
      user = await User.create({ openid, unionid, nickname, avatar, authSource });
    } else {
      if (unionid && !user.unionid) user.unionid = unionid;
      user.authSource = authSource;
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
      authSource: user.authSource || 'unknown',
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
    if (typeof code !== 'string' || !code.trim() || code.startsWith('h5-')) {
      const error = new Error('手机号授权凭证无效');
      error.status = 400;
      throw error;
    }
    if (this._shouldUseMockLogin()) {
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

      const phoneNumber = normalizePhone(res.data.phone_info?.phoneNumber);
      if (!/^1\d{10}$/.test(phoneNumber)) throw new Error('微信手机号响应无效');
      const user = await User.findByIdAndUpdate(userId,
        { $set: { phone: phoneNumber, phoneVerifiedSource: 'wechat' } }, { new: true });
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
    if (!this._shouldUseMockLogin()) throw new Error('当前环境禁止模拟手机号绑定');
    const mockPhone = (process.env.MOCK_BIND_PHONE || '13580006666').trim();
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { phone: mockPhone, phoneVerifiedSource: 'mock' } },
      { new: true }
    );
    if (!user) {
      throw new Error('User not found');
    }
    return this._formatUserInfo(user);
  }

  async register(username, password) {
    if (typeof username !== 'string' || !username.trim() || username.length > 32) {
      throw new Error('用户名不能为空');
    }
    if (typeof password !== 'string' || password.length < 6 || password.length > 64) {
      throw new Error('密码长度不能少于 6 位');
    }

    const existingUser = await User.findOne({ username: username.trim() });
    if (existingUser) {
      throw new Error('该账号已被注册');
    }

    const hashedPassword = await hashPassword(password);

    const openid = `h5_openid_${username.trim()}_${Math.random().toString(36).substring(2, 8)}`;
    const user = await User.create({
      username: username.trim(),
      password: hashedPassword,
      nickname: username.trim(),
      authSource: 'account',
      openid: openid
    });

    return this._buildLoginResult(user, openid);
  }

  async loginAccount(username, password) {
    if (typeof username !== 'string' || !username.trim() || username.length > 32) {
      throw new Error('用户名不能为空');
    }
    if (typeof password !== 'string' || !password || password.length > 64) {
      throw new Error('密码不能为空');
    }

    const user = await User.findOne({ username: username.trim() });
    if (!user || !user.password) {
      throw new Error('账号或密码错误');
    }

    if (!await verifyPassword(password, user.password)) {
      throw new Error('账号或密码错误');
    }

    if (/^[0-9a-f]{64}$/.test(user.password)) user.password = await hashPassword(password);
    user.authSource = 'account';
    user.lastLoginAt = new Date();
    await user.save();

    return this._buildLoginResult(user, user.openid || `h5_openid_${user.username}`);
  }
}

module.exports = new UserService();
