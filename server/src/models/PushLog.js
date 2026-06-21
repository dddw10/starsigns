const mongoose = require('mongoose');

const pushLogSchema = new mongoose.Schema(
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
    },

    // 模板 ID
    templateId: {
      type: String,
      required: true,
    },

    // 推送类型
    type: {
      type: String,
      enum: ['daily_fortune', 'fortune_result', 'order_status', 'system'],
      required: true,
    },

    // 推送内容
    content: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // 推送状态
    status: {
      type: String,
      enum: ['pending', 'success', 'failed'],
      default: 'pending',
      index: true,
    },

    // 微信返回的错误码
    errcode: {
      type: Number,
      default: 0,
    },

    // 微信返回的错误信息
    errmsg: {
      type: String,
      default: '',
    },

    // 推送时间
    pushedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// 索引
pushLogSchema.index({ userId: 1, type: 1 });
pushLogSchema.index({ status: 1, pushedAt: 1 });
pushLogSchema.index({ createdAt: -1 });

const PushLog = mongoose.model('PushLog', pushLogSchema);

module.exports = PushLog;
