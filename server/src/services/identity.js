// 来源只能由完成认证的服务端路径写入，旧身份缺少来源时不推断为微信。
function canReceiveWechatPush(user) {
  return !!user && user.authSource === 'wechat'
    && typeof user.openid === 'string' && !!user.openid.trim();
}

module.exports = { canReceiveWechatPush };
