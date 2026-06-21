const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema(
  {
    // 用户 ID (可以为空，支持匿名反馈)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      index: true,
    },

    // 反馈类型
    type: {
      type: String,
      enum: ['bug', 'suggestion', 'other'],
      default: 'suggestion',
      required: true,
      index: true,
    },

    // 反馈内容
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },

    // 联系方式 (微信/手机/邮箱)
    contact: {
      type: String,
      trim: true,
      maxlength: 100,
    },

    // 反馈状态: pending-待处理 processed-已处理
    status: {
      type: String,
      enum: ['pending', 'processed'],
      default: 'pending',
      index: true,
    },

    // 官方回复内容
    replyContent: {
      type: String,
      default: '',
      trim: true,
      maxlength: 1000,
    },

    // 回复时间
    replyAt: {
      type: Date,
      default: null,
    },

    // 是否已发放采纳奖励额度
    rewardGranted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

feedbackSchema.index({ createdAt: -1 });

const Feedback = mongoose.model('Feedback', feedbackSchema);

module.exports = Feedback;
