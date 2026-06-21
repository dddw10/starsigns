const mongoose = require('mongoose');

const historySchema = new mongoose.Schema(
  {
    // 用户 ID
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // 操作类型
    action: {
      type: String,
      enum: ['view', 'share', 'favorite', 'comment'],
      required: true,
      index: true,
    },

    // 资源类型
    resourceType: {
      type: String,
      enum: ['fortune', 'article', 'product'],
      required: true,
    },

    // 资源 ID
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    // 操作详情
    detail: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // 操作时间
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// 索引
historySchema.index({ userId: 1, action: 1 });
historySchema.index({ userId: 1, resourceType: 1, resourceId: 1 });
historySchema.index({ createdAt: -1 });

const History = mongoose.model('History', historySchema);

module.exports = History;
