const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    // 微信 openid
    openid: {
      type: String,
      sparse: true,
      unique: true,
      index: true,
    },

    // 微信 unionid
    unionid: {
      type: String,
      sparse: true,
    },

    // 账号（用于 H5 登录）
    username: {
      type: String,
      sparse: true,
      unique: true,
    },

    // 密码（用于 H5 登录）
    password: {
      type: String,
    },

    // 用户昵称
    nickname: {
      type: String,
      default: '',
    },

    // 用户头像
    avatar: {
      type: String,
      default: '',
    },

    // 性别 0-未知 1-男 2-女
    gender: {
      type: Number,
      default: 0,
    },

    // 手机号
    phone: {
      type: String,
      default: '',
    },

    // 生辰八字
    birthInfo: {
      // 阳历日期
      solarDate: { type: String },
      // 农历日期
      lunarDate: { type: String },
      // 出生时辰
      birthTime: { type: String },
      // 年柱
      yearGanZhi: { type: String },
      // 月柱
      monthGanZhi: { type: String },
      // 日柱
      dayGanZhi: { type: String },
      // 时柱
      hourGanZhi: { type: String },
      // 五行
      wuxing: {
        metal: { type: Number, default: 0 },
        wood: { type: Number, default: 0 },
        water: { type: Number, default: 0 },
        fire: { type: Number, default: 0 },
        earth: { type: Number, default: 0 },
      },
    },


    // 订阅消息授权状态
    subscribeAccepted: {
      type: Boolean,
      default: false,
    },

    // 推送偏好设置
    pushSettings: {
      pushEnabled: { type: Boolean, default: false },
      pushTime: { type: String, default: '00:00' },
      pushTypes: {
        dailyFortune: { type: Boolean, default: true },
        general: { type: Boolean, default: true },
        constellation: { type: Boolean, default: false },
        tarot: { type: Boolean, default: false },
        bazi: { type: Boolean, default: false },
      },
    },

    // 最后登录时间
    lastLoginAt: {
      type: Date,
      default: Date.now,
    },

    // 上次签到时间
    lastCheckInAt: {
      type: Date,
      default: null,
    },

    // 注册时间
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
userSchema.index({ openid: 1 }, { sparse: true });
userSchema.index({ unionid: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ username: 1 }, { unique: true, sparse: true });

const User = mongoose.model('User', userSchema);

module.exports = User;
