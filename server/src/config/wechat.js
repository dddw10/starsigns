// 微信小程序配置
// 本项目已无支付功能，所以这里没有商户号/证书相关配置；
// 订阅消息也只用得到「每日运势」一个模板。
module.exports = {
  // 小程序 AppID
  appId: process.env.WECHAT_APP_ID || 'your_app_id',

  // 小程序 AppSecret
  appSecret: process.env.WECHAT_APP_SECRET || 'your_app_secret',

  // 订阅消息模板 ID
  templates: {
    // 每日运势推送模板。留空则推送整体跳过，不会去调微信接口
    dailyFortune: process.env.WECHAT_TPL_DAILY_FORTUNE || '',
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
