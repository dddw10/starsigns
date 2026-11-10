const mongoose = require('mongoose');

// 订阅有效期（天）。模型默认值和 pushService 都用这一个常量——
// 以前模型写 30 天、subscribe() 的更新分支写 24 小时，同一条记录两种寿命。
const SUBSCRIPTION_TTL_DAYS = 30;

const ttlFromNow = () => new Date(Date.now() + SUBSCRIPTION_TTL_DAYS * 24 * 60 * 60 * 1000);

const pushSubscriptionSchema = new mongoose.Schema(
  {
    // 用户 ID
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // 微信 openid
    openid: {
      type: String,
      required: true,
      index: true,
    },

    // 订阅的模板 ID
    templateId: {
      type: String,
      required: true,
    },

    // 订阅状态
    status: {
      type: String,
      enum: ['active', 'inactive', 'expired'],
      default: 'active',
    },

    // 剩余可发送次数：每次用户授权 +1，每次成功发送 -1。
    // 微信一次性订阅消息「一次授权只能发一条」，所以能不能发看的是这个余额，
    // 而不是 status——旧代码发完就把 status 置 inactive，客户端却无从得知。
    remainingQuota: {
      type: Number,
      default: 0,
      min: 0,
    },

    // 最近一次成功发送对应的北京日期（YYYY-MM-DD），用于当日去重。
    // 普通任务同时检查成功日期和认领日期；并发安全由 sendToken 条件认领保证。
    lastPushDate: {
      type: String,
      default: '',
    },

    // pending/unknown 没有自动过期；取消和重新授权也不能解除未决投递。
    sendState: { type: String, enum: ['idle', 'pending', 'success', 'failed', 'unknown'], default: 'idle' },
    sendToken: { type: String, default: '' },
    lastAttemptDate: { type: String, default: '' },
    claimedAt: { type: Date, default: null },
    cancelEpoch: { type: Number, default: 0 },
    authEpoch: { type: Number, default: 0 },

    // 订阅时间
    subscribedAt: {
      type: Date,
      default: Date.now,
    },

    // 到期时间
    expireAt: {
      type: Date,
      default: ttlFromNow,
    },

    // 最后推送时间
    lastPushAt: {
      type: Date,
      default: null,
    },

    // 推送次数
    pushCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    // 唯一索引只能由停写后的显式迁移建立，启动不能隐式迁移旧数据。
    autoIndex: false,
    autoCreate: false,
  }
);

// 索引
pushSubscriptionSchema.index({ userId: 1, templateId: 1 }, { unique: true });
pushSubscriptionSchema.index({ openid: 1, templateId: 1 });
pushSubscriptionSchema.index({ status: 1, expireAt: 1 });
pushSubscriptionSchema.index({ userId: 1, status: 1 });
// triggerDailyPush() 的查询条件：active + 有余额 + 未过期
pushSubscriptionSchema.index({ status: 1, remainingQuota: 1, expireAt: 1 });

const PushSubscription = mongoose.model('PushSubscription', pushSubscriptionSchema);

module.exports = PushSubscription;
module.exports.SUBSCRIPTION_TTL_DAYS = SUBSCRIPTION_TTL_DAYS;
module.exports.ttlFromNow = ttlFromNow;

module.exports.hasUniqueSubscriptionIndex = (indexes) => indexes.some(index =>
  index.unique === true && !index.partialFilterExpression && !index.sparse &&
  Object.keys(index.key).length === 2 && index.key.userId === 1 && index.key.templateId === 1);
