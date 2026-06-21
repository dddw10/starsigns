// 微信小程序配置
module.exports = {
  // 小程序 AppID
  appId: process.env.WECHAT_APP_ID || 'your_app_id',

  // 小程序 AppSecret
  appSecret: process.env.WECHAT_APP_SECRET || 'your_app_secret',

  // 微信支付商户号
  mchId: process.env.WECHAT_MCH_ID || 'your_mch_id',

  // 微信支付 API 密钥
  apiKey: process.env.WECHAT_API_KEY || 'your_api_key',

  // 微信支付证书路径
  certPath: process.env.WECHAT_CERT_PATH || './certs/apiclient_cert.pem',
  keyPath: process.env.WECHAT_KEY_PATH || './certs/apiclient_key.pem',

  // 订阅消息模板 ID
  templates: {
    // 每日运势推送模板
    dailyFortune: process.env.WECHAT_TPL_DAILY_FORTUNE || 'tpl_daily_fortune',
    // 算命结果通知模板
    fortuneResult: process.env.WECHAT_TPL_FORTUNE_RESULT || 'tpl_fortune_result',
    // 订单状态变更模板
    orderStatus: process.env.WECHAT_TPL_ORDER_STATUS || 'tpl_order_status',
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
