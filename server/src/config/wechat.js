// 微信小程序配置
// 本项目已无支付功能，所以这里没有商户号/证书相关配置；
// 订阅消息也只用得到「每日运势」一个模板。
const { parseFieldMapping } = require('../services/push/templateMapping');

// 占位值（.env.example 里的 your_xxx）一律按「没配」算
const realValue = (raw) => {
  const text = String(raw || '').trim();
  return !text || /^your_/i.test(text) ? '' : text;
};

// 模板参数映射在模块加载时就解析：写错了要在启动时报错，
// 而不是等到每天 08:30 推送那一刻被微信以 47003 拒收。
// 对齐 middleware/auth.js 里 JWT_SECRET 占位值在 require 期抛错的既有做法。
const dailyFortuneFields = parseFieldMapping(process.env.WECHAT_TPL_DAILY_FORTUNE_FIELDS);

module.exports = {
  // 小程序 AppID
  appId: process.env.WECHAT_APP_ID || 'your_app_id',

  // 小程序 AppSecret
  appSecret: process.env.WECHAT_APP_SECRET || 'your_app_secret',

  // 订阅消息模板 ID
  templates: {
    // 每日运势推送模板。留空则推送整体跳过，不会去调微信接口
    dailyFortune: realValue(process.env.WECHAT_TPL_DAILY_FORTUNE),
    // 该模板的参数映射，格式见 templateMapping.js 与 .env.example
    dailyFortuneFields,
  },

  // 推送要真的发出去，模板 ID 和字段映射必须同时配齐：
  // 只有模板 ID 会得到一条空 data（微信按 47003 拒收），只有映射则无处可发。
  hasPushTemplate() {
    return Boolean(this.templates.dailyFortune) && this.templates.dailyFortuneFields.length > 0;
  },

  // 凭证是否齐全（占位值一律按没配算）。
  // 少一个 jscode2session 就换不出 openid，小程序登录只能失败或降级，
  // 而降级会按一次性 code 造用户，等于每次冷启动换一个人——所以这个判断是登录链路的开关
  hasCredentials() {
    return Boolean(
      this.appId &&
      this.appSecret &&
      this.appId !== 'your_app_id' &&
      this.appSecret !== 'your_app_secret'
    );
  },

  // 微信 API 基础地址
  apiBase: 'https://api.weixin.qq.com',

  // 获取 access_token 地址
  getAccessTokenUrl(appId, appSecret) {
    return `${this.apiBase}/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`;
  },

  getJsCodeSessionUrl(appId, appSecret, code) {
    return `${this.apiBase}/sns/jscode2session?appid=${appId}&secret=${appSecret}&js_code=${code}&grant_type=authorization_code`;
  },

  // 发送订阅消息地址
  get sendMessageUrl() {
    return `${this.apiBase}/cgi-bin/message/subscribe/send`;
  },
};
