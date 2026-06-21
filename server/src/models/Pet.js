const mongoose = require('mongoose');

const petSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    // 自定义昵称
    name: {
      type: String,
      default: '',
    },
    // 神兽类型: egg(封印蛋), qinglong(青龙), zhuque(朱雀), baihu(白虎), xuanwu(玄武), qilin(麒麟)
    type: {
      type: String,
      enum: ['egg', 'qinglong', 'zhuque', 'baihu', 'xuanwu', 'qilin'],
      default: 'egg',
    },
    // 等级
    level: {
      type: Number,
      default: 1,
    },
    // 当前级灵气经验值
    exp: {
      type: Number,
      default: 0,
    },
    // 饱食度 0-100
    hunger: {
      type: Number,
      default: 100,
    },
    // 心情值 0-100
    mood: {
      type: Number,
      default: 100,
    },
    // 饲料道具仓库
    inventory: {
      coarseGrass: { type: Number, default: 1 },  // 粗粮仙草 (+10饱食度, +10 EXP)
      morningDew: { type: Number, default: 0 },   // 晨露琼浆 (+30饱食度, +40 EXP)
      wuguPill: { type: Number, default: 0 },     // 五谷朱砂丹 (+60饱食度, +90 EXP)
      taijiPeach: { type: Number, default: 0 },    // 太极蟠桃 (+100饱食度, +200 EXP)
    },
    // 累计获得灵气值
    totalExpEarned: {
      type: Number,
      default: 0,
    },
    // 待开的福袋数量
    giftBoxes: {
      type: Number,
      default: 0,
    },
    // 今日抚摸互动次数
    dailyInteractCount: {
      type: Number,
      default: 0,
    },
    // 上次喂食时间
    lastFedAt: {
      type: Date,
      default: Date.now,
    },
    // 上次互动时间 (摸摸头)
    lastInteractedAt: {
      type: Date,
      default: Date.now,
    },
    // 上次扣除自然流逝时间
    lastDecayAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// 索引定义
petSchema.index({ userId: 1 });

const Pet = mongoose.model('Pet', petSchema);

module.exports = Pet;
