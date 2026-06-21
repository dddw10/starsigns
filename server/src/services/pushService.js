const axios = require('axios');
const PushSubscription = require('../models/PushSubscription');
const PushLog = require('../models/PushLog');
const User = require('../models/User');
const wechatConfig = require('../config/wechat');
const { getRedis } = require('../config/redis');

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
      subscription.expireAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
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
    const cached = await redis.get(cacheKey);
    if (cached) {
      return cached;
    }

    // 调用微信接口获取
    const url = wechatConfig.getAccessTokenUrl(wechatConfig.appId, wechatConfig.appSecret);
    const result = await axios.get(url);

    if (result.data.errcode) {
      throw new Error(`获取 access_token 失败: ${result.data.errmsg}`);
    }

    const { access_token, expires_in } = result.data;
    // 缓存，提前 5 分钟过期
    await redis.set(cacheKey, access_token, 'EX', expires_in - 300);

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

        const todayStr = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);

        // 构建推送数据
        const pushData = {
          // 命名属性
          date: todayStr,
          overall: truncate(`${fortune.score}分 - ${fortune.overall}`, 20),
          career: truncate(fortune.career, 20),
          wealth: truncate(fortune.wealth, 20),
          love: truncate(fortune.love, 20),
          health: truncate(fortune.health, 20),
          luckyNumber: truncate(fortune.luckyNumber.toString(), 20),
          luckyColor: truncate(fortune.luckyColorName || fortune.luckyColor, 20),

          // 微信标准订阅消息编号字段映射（以防开发者使用不同的模板参数配置）
          date1: todayStr,
          date2: todayStr,
          thing1: truncate(`${fortune.score}分 - ${fortune.overall}`, 20), // 运势简评
          thing2: truncate(fortune.yi.join('、'), 20), // 今日所宜
          thing3: truncate(fortune.ji.join('、'), 20), // 今日所忌
          thing4: truncate(fortune.overall, 20), // 温馨提示
          thing5: truncate(`色:${fortune.luckyColorName || fortune.luckyColor} 数:${fortune.luckyNumber}`, 20), // 幸运提示
          
          character_string1: truncate(fortune.luckyNumber.toString(), 32),
          character_string2: truncate(fortune.luckyColorName || fortune.luckyColor, 32),
          number1: fortune.luckyNumber,
          number2: fortune.score,
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

        // 更新订阅记录
        sub.lastPushAt = new Date();
        sub.pushCount += 1;
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
      pushTime: /^([01]\d|2[0-3]):[0-5]\d$/.test(settings.pushTime || '') ? settings.pushTime : '08:00',
      pushTypes,
    };
  }
}

module.exports = new PushService();
