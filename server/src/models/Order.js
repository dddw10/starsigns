const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    // 订单号
    orderNo: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // 用户 ID
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // 商品类型
    productType: {
      type: String,
      enum: [
        'fortune_bazi',
        'fortune_tarot',
        'fortune_name',
        'fortune_fengshui',
        'member_monthly',
        'member_yearly',
        'vip_monthly',
        'vip_yearly',
        'svip_monthly',
        'svip_yearly',
        'quota_pack',
      ],
      required: true,
    },

    // 商品名称
    productName: {
      type: String,
      required: true,
    },

    // 订单金额（单位：分）
    amount: {
      type: Number,
      required: true,
    },

    // 实际支付金额（单位：分）
    actualAmount: {
      type: Number,
      default: 0,
    },

    // 支付状态
    status: {
      type: String,
      enum: ['pending', 'paid', 'refunding', 'refunded', 'cancelled', 'expired'],
      default: 'pending',
      index: true,
    },

    // 支付方式
    payMethod: {
      type: String,
      enum: ['wechat', 'balance'],
      default: 'wechat',
    },

    // 微信支付交易号
    transactionId: {
      type: String,
      default: '',
    },

    // 微信预支付 ID
    prepayId: {
      type: String,
      default: '',
    },

    // 支付时间
    paidAt: {
      type: Date,
      default: null,
    },

    // 退款时间
    refundedAt: {
      type: Date,
      default: null,
    },

    // 退款原因
    refundReason: {
      type: String,
      default: '',
    },

    // 关联的算命记录 ID
    fortuneId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Fortune',
      default: null,
    },

    // 附加数据
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // 订单过期时间
    expireAt: {
      type: Date,
      default: function () {
        return new Date(Date.now() + 30 * 60 * 1000); // 30 分钟后过期
      },
    },
  },
  {
    timestamps: true,
  }
);

// 索引
orderSchema.index({ userId: 1, status: 1 });
orderSchema.index({ orderNo: 1 });
orderSchema.index({ transactionId: 1 });
orderSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

// 方法：生成订单号
orderSchema.statics.generateOrderNo = function () {
  const now = new Date();
  const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const dateStr = beijingTime.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  return `FM${dateStr}${random}`;
};

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
