const axios = require('axios');
const PushSubscription = require('../models/PushSubscription');
const PushLog = require('../models/PushLog');
const User = require('../models/User');
const wechatConfig = require('../config/wechat');
const { getRedis } = require('../config/redis');
const { getBeijingDateString } = require('../utils/date');

class PushService {
  async getSettings(userId) {
    const user = await User.findById(userId).select('pushSettings subscribeAccepted');
    if (!user) {
      throw new Error('用户不存在');
    }

    return this._normalizeSettings(user.pushSettings, user.subscribeAccepted);
  }

  async updateSettings(userId, settings) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('用户不存在');
    }

    const nextSettings = this._normalizeSettings(settings, user.subscribeAccepted);
    user.pushSettings = nextSettings;
    user.subscribeAccepted = nextSettings.pushEnabled;
    await user.save();

    return nextSettings;
  }

  // 订阅推送消息
  async subscribe(userId, templateId) {
    if (!this._isPushConfigured()) {
      throw new Error('微信订阅消息尚未完成服务端配置');
    }
    if (templateId !== wechatConfig.templates.dailyFortune) {
      throw new Error('订阅模板无效');
    }
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('用户不存在');
    }

    // 查找或创建订阅
    let subscription = await PushSubscription.findOne({
      userId,
      templateId,
    });

    if (subscription) {
      subscription.status = 'active';
      subscription.expireAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await subscription.save();
    } else {
      subscription = await PushSubscription.create({
        userId,
        openid: user.openid,
        templateId,
        status: 'active',
      });
    }

    return {
      subscriptionId: subscription._id,
      status: 'active',
    };
  }

  // 取消订阅推送消息
  async unsubscribe(userId, templateId) {
    const subscription = await PushSubscription.findOneAndUpdate(
      { userId, templateId },
      { status: 'inactive' },
      { new: true }
    );

    if (!subscription) {
      throw new Error('订阅不存在');
    }

    return true;
  }

  // 获取用户订阅列表
  async getSubscriptions(userId) {
    const subscriptions = await PushSubscription.find({
      userId,
      status: 'active',
    }).select('-__v');

    return subscriptions;
  }

  // 获取推送历史记录
  async getPushHistory(userId, options = {}) {
    const { page = 1, pageSize = 10 } = options;

    const query = { userId };
    const total = await PushLog.countDocuments(query);
    const logs = await PushLog.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(parseInt(pageSize, 10));

    return {
      total,
      page: parseInt(page, 10),
      pageSize: parseInt(pageSize, 10),
      logs,
    };
  }

  // 发送订阅消息
  async sendSubscribeMessage(openid, templateId, data) {
    try {
      // 获取 access_token
      const accessToken = await this._getAccessToken();

      // 构建消息数据
      const messageData = {
        touser: openid,
        template_id: templateId,
        page: '/pages/index/index',
        data: {},
      };

      // 填充模板数据
      for (const [key, value] of Object.entries(data)) {
        messageData.data[key] = { value };
      }

      // 发送消息
      const result = await axios.post(
        `${wechatConfig.apiBase}/cgi-bin/message/subscribe/send?access_token=${accessToken}`,
        messageData
      );

      return {
        success: result.data.errcode === 0,
        errcode: result.data.errcode,
        errmsg: result.data.errmsg,
      };
    } catch (error) {
      console.error('发送订阅消息失败:', error);
      return {
        success: false,
        errcode: -1,
        errmsg: error.message,
      };
    }
  }

  // 获取 access_token
  async _getAccessToken() {
    const redis = getRedis();
    const cacheKey = 'wechat:access_token';

    // 尝试从缓存获取
    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // 调用微信接口获取
    const url = wechatConfig.getAccessTokenUrl(wechatConfig.appId, wechatConfig.appSecret);
    const result = await axios.get(url);

    if (result.data.errcode) {
      throw new Error(`获取 access_token 失败: ${result.data.errmsg}`);
    }

    const { access_token, expires_in } = result.data;
    // 缓存，提前 5 分钟过期
    if (redis) {
      await redis.set(cacheKey, access_token, 'EX', expires_in - 300);
    }

    return access_token;
  }

  // 触发每日运势推送
  async triggerDailyPush() {
    // 获取所有订阅了每日运势的用户
    const subscriptions = await PushSubscription.find({
      status: 'active',
      expireAt: { $gt: new Date() },
    }).populate('userId');

    let successCount = 0;
    let failCount = 0;

    for (const sub of subscriptions) {
      try {
        // 获取用户的八字信息
        const user = sub.userId;
        if (!user.birthInfo || !user.birthInfo.yearGanZhi) {
          continue;
        }

        // 生成每日运势
        const { generateDailyFortune } = require('../algorithms/daily-fortune');
        const fortune = await generateDailyFortune(user.birthInfo);

        const truncate = (val, len = 20) => {
          if (!val) return '';
          const str = String(val);
          return str.length > len ? str.slice(0, len - 3) + '...' : str;
        };

        const todayStr = getBeijingDateString();

        const fortuneKeywords = truncate(`宜:${fortune.yi.slice(0,2).join(' ')} 忌:${fortune.ji.slice(0,2).join(' ')}`, 20);
        const fortuneSummary = truncate(`${fortune.score}分 - ${fortune.overall}`, 20);

        // 构建推送数据
        const pushData = {
          // 命名属性
          date: todayStr,
          overall: fortuneSummary,
          career: truncate(fortune.career, 20),
          wealth: truncate(fortune.wealth, 20),
          love: truncate(fortune.love, 20),
          health: truncate(fortune.health, 20),
          luckyNumber: truncate(fortune.luckyNumber.toString(), 20),
          luckyColor: truncate(fortune.luckyColorName || fortune.luckyColor, 20),

          // 微信标准订阅消息编号字段映射（以防开发者使用不同的模板参数配置）
          date1: todayStr,
          date2: todayStr,
          date3: todayStr,
          date4: todayStr,
          date5: todayStr,

          thing1: fortuneKeywords,
          thing2: fortuneSummary,
          thing3: truncate(fortune.yi.join('、'), 20),
          thing4: truncate(fortune.ji.join('、'), 20),
          thing5: truncate(fortune.overall, 20),
          
          character_string1: fortuneKeywords,
          character_string2: fortuneSummary,
          character_string3: truncate(fortune.luckyNumber.toString(), 32),
          character_string4: truncate(fortune.luckyColorName || fortune.luckyColor, 32),
          character_string5: truncate(fortune.overall, 32),

          phrase1: truncate(fortune.yi.slice(0, 2).join('、'), 15),
          phrase2: truncate(fortune.ji.slice(0, 2).join('、'), 15),
          phrase3: truncate(fortune.luckyColorName || '红色', 15),
          phrase4: '今日运势',
          phrase5: '温馨提示',

          number1: fortune.luckyNumber,
          number2: fortune.score,
          number3: fortune.score,
          number4: fortune.luckyNumber,
          number5: fortune.score,
        };

        // 发送推送
        const result = await this.sendSubscribeMessage(
          sub.openid,
          wechatConfig.templates.dailyFortune,
          pushData
        );

        // 记录推送日志
        await PushLog.create({
          userId: user._id,
          openid: sub.openid,
          templateId: wechatConfig.templates.dailyFortune,
          type: 'daily_fortune',
          content: pushData,
          status: result.success ? 'success' : 'failed',
          errcode: result.errcode,
          errmsg: result.errmsg,
          pushedAt: new Date(),
        });

        // 微信一次订阅授权只能发送一条消息，发送后必须重新授权。
        sub.lastPushAt = new Date();
        sub.pushCount += 1;
        sub.status = 'inactive';
        await sub.save();

        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        console.error('推送失败:', error);
        failCount++;
      }
    }

    return {
      total: subscriptions.length,
      success: successCount,
      failed: failCount,
    };
  }

  _normalizeSettings(settings = {}, subscribeAccepted = false) {
    const pushTypes = {
      dailyFortune: true,
      general: true,
      constellation: false,
      tarot: false,
      bazi: false,
      ...(settings.pushTypes || {}),
    };

    return {
      pushEnabled: Boolean(settings.pushEnabled ?? subscribeAccepted),
      pushTime: /^([01]\d|2[0-3]):[0-5]\d$/.test(settings.pushTime || '') ? settings.pushTime : '00:00',
      pushTypes,
    };
  }

  _isPushConfigured() {
    return Boolean(
      wechatConfig.appId && wechatConfig.appId !== 'your_app_id'
      && wechatConfig.appSecret && wechatConfig.appSecret !== 'your_app_secret'
      && wechatConfig.templates.dailyFortune
    );
  }
}

module.exports = new PushService();
