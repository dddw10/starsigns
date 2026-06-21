<template>
  <view class="page-container" :class="themeClass">
    <view class="header">
      <text class="title">隐私政策</text>
      <text class="update-time">更新时间：2024年1月1日</text>
    </view>
    
    <view class="content-section">
      <view class="section">
        <text class="section-title">引言</text>
        <text class="section-content">
          欢迎使用"算命小程序"（以下简称"本小程序"）。我们非常重视用户的隐私保护。本隐私政策旨在向您说明我们如何收集、使用、存储和保护您的个人信息。
        </text>
      </view>
      
      <view class="section">
        <text class="section-title">一、我们收集的信息</text>
        <text class="section-content">在您使用本小程序服务时，我们可能会收集以下信息：</text>
        <text class="section-content">1. 微信登录信息：微信OpenID、UnionID、昵称、头像</text>
        <text class="section-content">2. 设备信息：设备型号、操作系统版本</text>
        <text class="section-content">3. 使用信息：您使用本小程序的功能记录、查询记录</text>
        <text class="section-content">4. 支付信息：订单信息、支付状态（不存储银行卡等敏感信息）</text>
        <text class="section-content">5. 生辰信息：您主动填写的出生日期、时间（用于八字分析）</text>
      </view>
      
      <view class="section">
        <text class="section-title">二、我们如何使用信息</text>
        <text class="section-content">我们收集的信息将用于：</text>
        <text class="section-content">1. 提供、维护和改进本小程序的服务</text>
        <text class="section-content">2. 为您提供个性化的命理分析服务</text>
        <text class="section-content">3. 处理您的订单和支付</text>
        <text class="section-content">4. 发送服务通知和推送消息（经您授权）</text>
        <text class="section-content">5. 预防和处理欺诈、安全问题</text>
        <text class="section-content">6. 遵守法律法规要求</text>
      </view>
      
      <view class="section">
        <text class="section-title">三、信息存储与保护</text>
        <text class="section-content">
          1. 您的信息存储在中国境内的服务器上，不会跨境传输。
        </text>
        <text class="section-content">
          2. 我们采用业界标准的安全技术和措施来保护您的个人信息，包括数据加密、访问控制等。
        </text>
        <text class="section-content">
          3. 我们仅在实现服务目的所必要的期限内保留您的个人信息。
        </text>
      </view>
      
      <view class="section">
        <text class="section-title">四、信息共享</text>
        <text class="section-content">
          1. 未经您的同意，我们不会向任何第三方共享您的个人信息。
        </text>
        <text class="section-content">
          2. 以下情况除外：
        </text>
        <text class="section-content">   - 获得您的明确同意</text>
        <text class="section-content">   - 根据法律法规要求或政府主管部门的要求</text>
        <text class="section-content">   - 为保护本小程序、用户或公众的权利、财产或安全</text>
      </view>
      
      <view class="section">
        <text class="section-title">五、您的权利</text>
        <text class="section-content">您有权：</text>
        <text class="section-content">1. 访问、更正您的个人信息</text>
        <text class="section-content">2. 删除您的个人信息</text>
        <text class="section-content">3. 撤回您的同意</text>
        <text class="section-content">4. 注销您的账号</text>
        <text class="section-content">如需行使上述权利，请联系我们的客服。</text>
      </view>
      
      <view class="section">
        <text class="section-title">六、未成年人保护</text>
        <text class="section-content">
          1. 本小程序不面向未满18周岁的未成年人提供服务。
        </text>
        <text class="section-content">
          2. 如我们发现在未获得可验证的监护人同意的情况下收集了未成年人的个人信息，我们将设法尽快删除相关信息。
        </text>
      </view>
      
      <view class="section">
        <text class="section-title">七、政策更新</text>
        <text class="section-content">
          我们可能会适时更新本隐私政策。更新后的政策将在本小程序内公布。请您定期查阅。
        </text>
      </view>
      
      <view class="section">
        <text class="section-title">八、联系我们</text>
        <text class="section-content">
          如您对本隐私政策有任何疑问、意见或建议，请通过以下方式联系我们：
        </text>
        <text class="section-content">客服邮箱：support@example.com</text>
        <text class="section-content">客服微信：example_service</text>
      </view>
    </view>
  </view>
</template>

<script setup>
</script>

<style scoped>
.page-container {
  min-height: 100vh;
  background: var(--bg-color, #f5f0e8);
  padding: 30rpx;
}

.header {
  margin-bottom: 30rpx;
}

.title {
  font-size: 36rpx;
  font-weight: bold;
  color: var(--primary-color, #c41e3a);
  display: block;
}

.update-time {
  font-size: 24rpx;
  color: var(--text-secondary, #999);
  margin-top: 8rpx;
  display: block;
}

.content-section {
  background: var(--card-bg, #fff);
  border-radius: 16rpx;
  padding: 30rpx;
}

.section {
  margin-bottom: 30rpx;
}

.section-title {
  font-size: 28rpx;
  font-weight: bold;
  color: var(--text-primary, #333);
  margin-bottom: 12rpx;
  display: block;
}

.section-content {
  font-size: 26rpx;
  color: var(--text-secondary, #666);
  line-height: 1.8;
  margin-bottom: 8rpx;
  display: block;
}
</style>
