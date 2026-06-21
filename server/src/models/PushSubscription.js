const mongoose = require('mongoose');

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

    // 订阅时间
    subscribedAt: {
      type: Date,
      default: Date.now,
    },

    // 到期时间
    expireAt: {
      type: Date,
      default: function () {
        // 默认订阅有效期为 30 天
        return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      },
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
  }
);

// 索引
pushSubscriptionSchema.index({ openid: 1, templateId: 1 });
pushSubscriptionSchema.index({ status: 1, expireAt: 1 });
pushSubscriptionSchema.index({ userId: 1, status: 1 });

const PushSubscription = mongoose.model('PushSubscription', pushSubscriptionSchema);

module.exports = PushSubscription;
