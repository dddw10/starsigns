const mongoose = require('mongoose');

const fortuneSchema = new mongoose.Schema(
  {
    // 用户 ID
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // 算命类型
    type: {
      type: String,
      enum: ['bazi', 'daily', 'tarot', 'name', 'fengshui', 'face', 'palm', 'nameMatch', 'baziMatch'],
      required: true,
      index: true,
    },

    // 八字算命数据
    bazi: {
      // 输入参数
      input: {
        solarDate: String,
        lunarDate: String,
        birthTime: String,
        gender: String,
      },
      // 八字结果
      result: {
        yearGanZhi: String,
        monthGanZhi: String,
        dayGanZhi: String,
        hourGanZhi: String,
        wuxing: {
          metal: Number,
          wood: Number,
          water: Number,
          fire: Number,
          earth: Number,
        },
        dayMaster: String,
        strongOrWeak: String,
        favorableElements: [String],
        unfavorableElements: [String],
      },
    },

    // 每日运势数据
    dailyFortune: {
      date: String,
      score: Number,
      overall: String,
      career: String,
      wealth: String,
      love: String,
      health: String,
      luckyNumber: Number,
      luckyColor: String,
    },

    // 塔罗牌数据
    tarot: {
      spreadType: String,
      cards: [
        {
          name: String,
          position: String,
          isReversed: Boolean,
          interpretation: String,
        },
      ],
      overallReading: String,
    },

    // 姓名测算数据
    nameAnalysis: {
      name: String,
      strokeCount: Number,
      fiveElement: String,
      threeTalent: String,
      score: Number,
      analysis: String,
    },

    // 姓名配对数据
    nameMatch: {
      name1: String,
      name2: String,
      relationType: String,
      score: Number,
      analysis: String,
    },

    // 八字合婚数据
    baziMatch: {
      name1: String,
      solarDate1: String,
      birthTime1: String,
      gender1: String,
      name2: String,
      solarDate2: String,
      birthTime2: String,
      gender2: String,
      relationType: String,
      score: Number,
      analysis: String,
    },

    // 风水分析数据
    fengshui: {
      direction: String,
      layout: String,
      score: Number,
      analysis: String,
      suggestions: [String],
    },

    // 面相手相数据
    facePalm: {
      type: { type: String }, // 'face' or 'palm'
      featureTitle: String,
      features: String,
      fortune: String,
      personality: String,
    },

    // AI 解读结果
    aiInterpretation: {
      type: String,
      default: '',
    },

    // 是否为付费内容
    isPaid: {
      type: Boolean,
      default: false,
    },

    // 支付订单号
    orderId: {
      type: String,
      default: '',
    },

    // 分享次数
    shareCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// 索引
fortuneSchema.index({ userId: 1, type: 1 });
fortuneSchema.index({ createdAt: -1 });
fortuneSchema.index({ orderId: 1 });

const Fortune = mongoose.model('Fortune', fortuneSchema);

module.exports = Fortune;
