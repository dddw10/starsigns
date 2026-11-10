const axios = require('axios');
const { randomUUID } = require('crypto');
const PushSubscription = require('../models/PushSubscription');
const PushLog = require('../models/PushLog');
const User = require('../models/User');
const { canReceiveWechatPush } = require('./identity');
const wechatConfig = require('../config/wechat');
const { getRedis } = require('../config/redis');
const { getBeijingDateString } = require('../utils/date');
const { buildTemplateData } = require('./push/templateMapping');
const {
  PUSH_MAX_QUOTA,
  PUSH_TIME_LABEL,
  ERRCODE_DATA_MISMATCH,
  ERRCODE_USER_REFUSED,
  sendSettlement,
  shouldSkipDuplicate,
} = require('./push/quota');

const { ttlFromNow } = PushSubscription;

// 全局错误处理只对 4xx 回显 err.message，5xx 一律替换成「服务器内部错误」（app.js）。
// 「没配模板」「模板对不上」「不支持微信订阅」都是用户或管理员必须看到的原因，
// 所以这里每个 throw 都显式带 status——否则线上只剩一句「服务器内部错误」，真实原因被吞掉。
// 503 这类 5xx 额外带 expose，让 app.js 放行这句文案。
function httpError(message, status, expose) {
  const err = new Error(message);
  err.status = status;
  if (expose) err.expose = true;
  return err;
}

class PushService {
  async _requireUniqueIndex() {
    let indexes = [];
    try { indexes = await PushSubscription.collection.indexes(); }
    catch (error) { if (error.code !== 26) throw error; }
    if (!PushSubscription.hasUniqueSubscriptionIndex(indexes)) {
      const error = httpError('推送订阅尚未完成唯一索引迁移；请暂停写入及发送，运行 scripts/migrate-push-subscriptions.js 预览并按运行说明处理', 503, true);
      error.code = 'PUSH_MIGRATION_REQUIRED';
      throw error;
    }
  }
  // 推送时间的唯一来源。客户端从 GET /api/config 取，不再自己写死文案
  get pushTimeLabel() {
    return PUSH_TIME_LABEL;
  }

  get maxQuota() {
    return PUSH_MAX_QUOTA;
  }

  // 推送要真的发得出去，四项必须齐全：AppID、AppSecret、模板 ID、字段映射
  isPushConfigured() {
    return wechatConfig.hasCredentials() && wechatConfig.hasPushTemplate();
  }

  // 能不能收到推送，权威状态在 PushSubscription 上，不在 localStorage 的布尔值里。
  // 旧实现只回 user.pushSettings，而服务端发完一条就把订阅置 inactive，
  // 客户端那个 true 却永远不变——用户既看不出已经用完，首页也不再出现重新授权的入口。
  _buildSettings(user, sub) {
    const quota = sub ? Math.max(0, sub.remainingQuota || 0) : 0;
    const notExpired = Boolean(sub && sub.expireAt && sub.expireAt.getTime() > Date.now());
    const available = Boolean(canReceiveWechatPush(user) && sub && sub.openid === user.openid
      && sub.status === 'active' && quota > 0 && notExpired);

    return {
      // 「还能收到吗」
      pushEnabled: available,
      remainingQuota: available ? quota : 0,
      maxQuota: PUSH_MAX_QUOTA,
      expireAt: sub && sub.expireAt ? sub.expireAt : null,
      lastPushDate: (sub && sub.lastPushDate) || '',
      pushTimeLabel: PUSH_TIME_LABEL,
      configured: this.isPushConfigured(),
      // 「用户想要吗」——他曾经打开过开关，但授权可能已经用完
      intended: Boolean(user && (user.pushSettings ? user.pushSettings.pushEnabled : user.subscribeAccepted)),
    };
  }

  async _findSubscription(userId) {
    const templateId = wechatConfig.templates.dailyFortune;
    if (!templateId) return null;
    return PushSubscription.findOne({ userId, templateId });
  }

  async getSettings(userId) {
    const user = await User.findById(userId).select('pushSettings subscribeAccepted authSource openid');
    if (!user) {
      throw httpError('用户不存在', 404);
    }

    return this._buildSettings(user, await this._findSubscription(userId));
  }

  // 只保留 pushEnabled 一个意愿开关：pushTime / pushTypes 从来没有被推送逻辑读过，
  // 留着就是「界面写了但代码不做」，已从 User schema 一并删掉
  async updateSettings(userId, settings = {}) {
    const user = await User.findById(userId);
    if (!user) {
      throw httpError('用户不存在', 404);
    }

    const pushEnabled = Boolean(settings.pushEnabled);
    user.pushSettings = { pushEnabled };
    user.subscribeAccepted = pushEnabled;
    await user.save();

    // 关掉开关就该真的不再推送，而不是只改一个没人读的字段
    if (!pushEnabled && wechatConfig.templates.dailyFortune) {
      await PushSubscription.updateMany({ userId, templateId: wechatConfig.templates.dailyFortune }, {
        $set: { status: 'inactive', remainingQuota: 0 }, $inc: { cancelEpoch: 1 },
      });
    }
    const sub = await this._findSubscription(userId);

    return this._buildSettings(user, sub);
  }

  // 订阅推送消息：每次用户在微信弹窗里点「允许」都调一次，余额 +1
  async subscribe(userId, templateId) {
    if (!this.isPushConfigured()) {
      // 503 而不是 500：这是「服务端还没配好」，用户看到的必须是这句话。
      // 客户端也据此把开关置灰、**不要**先弹微信授权窗——那一次授权会被白烧掉
      throw httpError('微信订阅消息尚未完成服务端配置，暂时无法开启提醒', 503, true);
    }

    const expected = wechatConfig.templates.dailyFortune;
    if (templateId && templateId !== expected) {
      throw httpError('订阅模板无效，请重新进入小程序后再试', 400);
    }

    const user = await User.findById(userId);
    if (!user) {
      throw httpError('用户不存在', 404);
    }
    if (!canReceiveWechatPush(user)) {
      // H5 端没有微信订阅消息这条通道
      throw httpError('当前登录方式不支持微信服务通知', 400);
    }

    await this._requireUniqueIndex();
    const key = { userId: user._id, templateId: expected };
    const update = [{ $set: {
      openid: { $literal: user.openid }, status: 'active',
      remainingQuota: { $min: [PUSH_MAX_QUOTA, { $add: [{ $ifNull: ['$remainingQuota', 0] }, 1] }] },
      subscribedAt: new Date(), expireAt: ttlFromNow(),
      createdAt: { $ifNull: ['$createdAt', new Date()] },
      lastPushDate: { $ifNull: ['$lastPushDate', ''] },
      sendState: { $ifNull: ['$sendState', 'idle'] },
      sendToken: { $ifNull: ['$sendToken', ''] },
      cancelEpoch: { $ifNull: ['$cancelEpoch', 0] },
      authEpoch: { $add: [{ $ifNull: ['$authEpoch', 0] }, 1] },
    } }];
    let sub;
    try {
      sub = await PushSubscription.findOneAndUpdate(key, update, { upsert: true, new: true });
    } catch (error) {
      if (error.code !== 11000) throw error;
      sub = await PushSubscription.findOneAndUpdate(key, update, { new: true });
      if (!sub) throw error;
    }

    if (!user.pushSettings || !user.pushSettings.pushEnabled || !user.subscribeAccepted) {
      user.pushSettings = { pushEnabled: true };
      user.subscribeAccepted = true;
      await user.save();
    }

    return { subscriptionId: sub._id, ...this._buildSettings(user, sub) };
  }

  // 取消订阅：把余额清零。刻意做成幂等——用户关开关时如果因为「订阅不存在」报错，
  // 开关会卡在开着的状态，而他要的结果（不再收到）其实已经达成了
  async unsubscribe(userId, templateId) {
    const target = templateId || wechatConfig.templates.dailyFortune;

    await User.findByIdAndUpdate(userId, {
      $set: { 'pushSettings.pushEnabled': false, subscribeAccepted: false },
    });

    if (target) {
      await PushSubscription.updateMany(
        { userId, templateId: target },
        { $set: { status: 'inactive', remainingQuota: 0 }, $inc: { cancelEpoch: 1 } }
      );
    }

    return true;
  }

  // 获取用户订阅列表
  async getSubscriptions(userId) {
    return PushSubscription.find({ userId, status: 'active' }).select('-__v');
  }

  // 获取推送历史记录
  async getPushHistory(userId, options = {}) {
    const page = Math.max(1, parseInt(options.page, 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(options.pageSize, 10) || 10));

    const query = { userId };
    const total = await PushLog.countDocuments(query);
    const logs = await PushLog.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize);

    return { total, page, pageSize, logs };
  }

  // 发送订阅消息。data 必须已经是 {字段名: {value}} 形态，且键与模板参数**完全一致**
  async sendSubscribeMessage(openid, templateId, data, options = {}) {
    let dispatched = false;
    try {
      const accessToken = await this._getAccessToken();

      const body = {
        touser: openid,
        template_id: templateId,
        page: options.page || 'pages/index/index',
        lang: 'zh_CN',
        data,
      };

      // token 查询也会等待网络；完成后再核验，不能使用查询前的取消状态。
      if (options.beforeSend && !(await options.beforeSend())) {
        return { success: false, errcode: -1, errmsg: '订阅已取消或过期，未发送', outcome: 'failed' };
      }
      dispatched = true;
      const result = await axios.post(
        `${wechatConfig.sendMessageUrl}?access_token=${accessToken}`,
        body,
        { timeout: 15000 }
      );

      const hasCode = Boolean(result.data && Number.isInteger(result.data.errcode));
      const errcode = hasCode ? result.data.errcode : -1;
      const errmsg = (result.data && result.data.errmsg) || '';

      if (errcode === ERRCODE_DATA_MISMATCH) {
        // 47003 只可能是字段映射配错：微信要求 data 的键与模板参数严格一致，
        // 多一个、少一个、类型不符（phrase 塞了非汉字、character_string 塞了中文）都整条拒收
        const declared = wechatConfig.templates.dailyFortuneFields
          .map((item) => `${item.field}:${item.contentKey}`)
          .join(',');
        console.error(
          `[push] 47003 模板参数不匹配：${errmsg}。当前 WECHAT_TPL_DAILY_FORTUNE_FIELDS = ${declared || '(空)'}，` +
          '请到微信公众平台核对该模板的参数列表（字段名和顺序都要对得上），改完重启服务。'
        );
      }

      return { success: errcode === 0, errcode, errmsg, outcome: hasCode ? (errcode === 0 ? 'success' : 'failed') : 'unknown' };
    } catch (error) {
      console.error('发送订阅消息失败:', error.message);
      return { success: false, errcode: -1, errmsg: error.message, outcome: dispatched ? 'unknown' : 'failed' };
    }
  }

  // 获取 access_token。微信的 access_token 按 AppID 全局唯一，
  // 并发去取会互相顶掉，所以这里靠 Redis 共享缓存（cluster 下多个 worker 也只取一次）
  async _getAccessToken() {
    const redis = getRedis();
    const cacheKey = 'wechat:access_token';

    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) return cached;
      } catch (err) {
        console.warn('Redis read failed in _getAccessToken:', err.message);
      }
    }

    const url = wechatConfig.getAccessTokenUrl(wechatConfig.appId, wechatConfig.appSecret);
    const result = await axios.get(url);

    if (result.data.errcode) {
      throw httpError(`获取 access_token 失败: ${result.data.errmsg}`, 502);
    }

    const { access_token, expires_in } = result.data;
    if (redis) {
      try {
        // 提前 5 分钟过期
        await redis.set(cacheKey, access_token, 'EX', Math.max(60, (expires_in || 7200) - 300));
      } catch (err) {
        console.warn('Redis write failed in _getAccessToken:', err.message);
      }
    }

    return access_token;
  }

  // 把 expireAt 已过的订阅标记为过期。定时任务里排在推送之前跑
  async checkExpiredSubscriptions() {
    const result = await PushSubscription.updateMany(
      { status: 'active', expireAt: { $lt: new Date() } },
      { $set: { status: 'expired', remainingQuota: 0 }, $inc: { cancelEpoch: 1 } }
    );
    return result.modifiedCount || 0;
  }

  /**
   * 触发每日运势推送。
   *
   * @param {object}  [options]
   * @param {boolean} [options.force] 无视「今天已经推过」这条去重，重新发一遍。
   *   只给管理员的手动接口用，定时任务永远不传。两者共用数据库条件认领。
   *   手动接口需要它的场景是真实存在的：改完字段映射要复验、早上那轮内容发错了要补推、
   *   上线自检。没有它，`POST /api/push/trigger-daily` 在当天推送完成之后就成了一个
   *   永远回 skipped 的死接口——而它整个存在的理由就是自检和补推。
   *   force 放开成功/尝试日期去重；pending/unknown 仍阻塞，额度/取消边界不变。
   *   43101 仅在发送期间未新增授权且未取消时清零。
   */
  async triggerDailyPush(options = {}) {
    const force = Boolean(options.force);
    const today = getBeijingDateString();
    const stats = {
      total: 0,
      success: 0,
      failed: 0,
      // skipped 拆成两个原因：合成一个数字时，「没收到」既可能是缺生辰也可能是当日已推，
      // 光看 skipped:1 分辨不出来（这次就是这样卡住的）
      skipped: 0,
      skippedNoBirthInfo: 0,
      skippedAlreadyPushed: 0,
      skippedClaimed: 0,
      unknown: 0,
      date: today,
      configured: true,
      forced: force,
    };

    if (!this.isPushConfigured()) {
      stats.configured = false;
      console.warn(
        '[push] 跳过每日推送：需要 WECHAT_APP_ID / WECHAT_APP_SECRET / ' +
        'WECHAT_TPL_DAILY_FORTUNE / WECHAT_TPL_DAILY_FORTUNE_FIELDS 四项齐全'
      );
      return stats;
    }

    const templateId = wechatConfig.templates.dailyFortune;
    const mapping = wechatConfig.templates.dailyFortuneFields;
    await this._requireUniqueIndex();

    const subscriptions = await PushSubscription.find({
      templateId,
      status: 'active',
      remainingQuota: { $gt: 0 },
      expireAt: { $gt: new Date() },
    }).populate('userId');

    stats.total = subscriptions.length;

    // 惰性 require，避免与 fortuneService 形成加载期循环依赖
    const fortuneService = require('./fortuneService');

    for (const sub of subscriptions) {
      let claim;
      let result;
      let mustKeepClaimBlocked = false;
      try {
        const user = sub.userId;
        if (!canReceiveWechatPush(user) || sub.openid !== user.openid) {
          stats.skipped += 1;
          continue;
        }
        if (!user || !user.birthInfo || !user.birthInfo.yearGanZhi) {
          stats.skipped += 1;
          stats.skippedNoBirthInfo += 1;
          continue;
        }
        // 当日去重：cluster 重复注册、管理员手动重试都不会重复发、不会重复扣配额。
        // force 只有管理员手动接口会传（复验字段映射 / 补推 / 上线自检）
        if (shouldSkipDuplicate({ lastPushDate: sub.lastPushDate, today, force })) {
          stats.skipped += 1;
          stats.skippedAlreadyPushed += 1;
          continue;
        }

        claim = await PushSubscription.findOneAndUpdate({
          _id: sub._id, openid: user.openid, status: 'active', remainingQuota: { $gt: 0 },
          expireAt: { $gt: new Date() }, sendState: { $nin: ['pending', 'unknown'] },
          // CAS 代际让同批 force 竞争者也只能认领一次。
          sendToken: sub.sendToken || { $in: ['', null] },
          ...(!force ? { lastPushDate: { $ne: today }, lastAttemptDate: { $ne: today } } : {}),
        }, { $set: { sendState: 'pending', sendToken: randomUUID(), lastAttemptDate: today, claimedAt: new Date() } }, { new: true });
        if (!claim) { stats.skipped += 1; stats.skippedClaimed += 1; continue; }

        // 走和小程序完全同一条路：getDailyFortune 会补齐 dayMaster 并共用同一份 Redis 缓存。
        // 旧代码直接 generateDailyFortune(user.birthInfo)，而 birthInfo 里没有 dayMaster，
        // 于是分数不加减五行、relation 恒为 companion——推送里的分数和宜忌和 App 里不是一份
        const fortune = await fortuneService.getDailyFortune(user._id, today);
        const data = buildTemplateData(mapping, fortune);

        const beforeSend = () => PushSubscription.exists({ _id: claim._id, sendToken: claim.sendToken, sendState: 'pending',
          cancelEpoch: claim.cancelEpoch || { $in: [0, null] }, status: 'active', remainingQuota: { $gt: 0 }, expireAt: { $gt: new Date() } });
        if (!(await beforeSend())) throw new Error('订阅已取消或过期，未发送');
        mustKeepClaimBlocked = true;
        result = await this.sendSubscribeMessage(claim.openid, templateId, data, { beforeSend });
        // 43101 仍需按 epoch 条件清零；结算失败不能仅释放 failed 而留下旧额度。
        mustKeepClaimBlocked = result.outcome !== 'failed' || result.errcode === ERRCODE_USER_REFUSED;
        // 先原子落账再写审计日志；日志写失败不能使已发送消息自动重试。
        await PushSubscription.updateOne({ _id: claim._id, sendToken: claim.sendToken, sendState: 'pending' }, sendSettlement(claim, result, today));
        if (result.success) stats.success += 1;
        else if (result.outcome === 'unknown') stats.unknown += 1;
        else stats.failed += 1;

        await PushLog.create({
          userId: user._id,
          openid: sub.openid,
          templateId,
          type: 'daily_fortune',
          // 记下真正发出去的 data 和运势关键字段，方便和 GET /api/fortune/daily 对账
          content: {
            data,
            fortune: {
              date: fortune.date,
              score: fortune.score,
              level: fortune.level,
              yi: fortune.yi,
              ji: fortune.ji,
              luckyNumber: fortune.luckyNumber,
              luckyColorName: fortune.luckyColorName,
            },
          },
          status: result.success ? 'success' : result.outcome === 'unknown' ? 'unknown' : 'failed',
          errcode: result.errcode,
          errmsg: result.errmsg,
          pushedAt: new Date(),
        }).catch(error => console.error('推送日志写入失败:', error.message));
      } catch (error) {
        console.error('推送失败:', error.message);
        if (claim) {
          if (result?.errcode === ERRCODE_USER_REFUSED) {
            console.error('43101 结算未完成，需人工核验认领:', {
              subscriptionId: String(claim._id), sendToken: claim.sendToken, errcode: result.errcode, errmsg: result.errmsg,
            });
          }
          // 崩溃/落账失败时仍是 pending；这里的更新也失败时必须保持阻塞。
          const outcome = mustKeepClaimBlocked ? 'unknown' : 'failed';
          await PushSubscription.updateOne({ _id: claim._id, sendToken: claim.sendToken, sendState: 'pending' },
            { $set: { sendState: outcome } }).catch(err => console.error('推送认领结果写入失败:', err.message));
          if (outcome === 'unknown') stats.unknown += 1;
          else stats.failed += 1;
        } else stats.failed += 1;
      }
    }

    return stats;
  }
}

module.exports = new PushService();
