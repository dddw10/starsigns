<template>
  <view class="page-container" :class="themeClass">
    <view class="header">
      <text class="title">免责声明</text>
    </view>
    
    <view class="content-section">
      <view class="notice-box">
        <text class="notice-icon">⚠️</text>
        <text class="notice-text">本小程序提供的所有内容仅供娱乐参考，不构成任何建议</text>
      </view>
      
      <view class="section">
        <text class="section-title">1. 服务说明</text>
        <text class="section-content">
          本小程序是一款娱乐性质的命理分析工具，所提供的八字分析、星座运势、塔罗牌占卜、姓名测算、风水分析等功能，均基于传统命理学理论和算法生成，仅供用户娱乐参考。
        </text>
      </view>
      
      <view class="section">
        <text class="section-title">2. 免责声明</text>
        <text class="section-content">
          (1) 本小程序所提供的所有分析结果、解读内容、建议信息等，均不构成任何形式的承诺、保证或建议，用户不应将其作为决策依据。
        </text>
        <text class="section-content">
          (2) 用户因使用或依赖本小程序所提供的内容而产生的任何直接或间接损失，本小程序不承担任何责任。
        </text>
        <text class="section-content">
          (3) 本小程序不对分析结果的准确性、完整性、时效性做出任何明示或暗示的保证。
        </text>
      </view>
      
      <view class="section">
        <text class="section-title">3. 用户须知</text>
        <text class="section-content">
          (1) 请用户以科学理性的态度看待本小程序所提供的内容，切勿沉迷其中。
        </text>
        <text class="section-content">
          (2) 本小程序不接受未成年人使用，如您未满18周岁，请勿使用本小程序。
        </text>
        <text class="section-content">
          (3) 本小程序不提供任何形式的预测服务，包括但不限于：预测未来、改变命运、算命改运等。
        </text>
      </view>
      
      <view class="section">
        <text class="section-title">4. 付费服务</text>
        <text class="section-content">
          (1) 本小程序提供的付费服务为虚拟商品，一经开通，不支持退款。
        </text>
        <text class="section-content">
          (2) 用户在购买前应仔细阅读服务内容，确认无误后再进行购买。
        </text>
        <text class="section-content">
          (3) 如遇支付问题，请及时联系客服处理。
        </text>
      </view>
      
      <view class="section">
        <text class="section-title">5. 内容规范</text>
        <text class="section-content">
          (1) 本小程序严禁发布、传播违法违规内容。
        </text>
        <text class="section-content">
          (2) 用户在使用过程中应遵守国家法律法规和社会公德。
        </text>
        <text class="section-content">
          (3) 如发现违规内容，本小程序有权立即删除并封禁相关账号。
        </text>
      </view>
      
      <view class="disclaimer-footer">
        <text class="footer-text">本声明最终解释权归本小程序所有</text>
        <text class="footer-text">如有疑问，请联系客服</text>
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
}

.content-section {
  background: var(--card-bg, #fff);
  border-radius: 16rpx;
  padding: 30rpx;
}

.notice-box {
  background: #fff3cd;
  border-radius: 12rpx;
  padding: 24rpx;
  display: flex;
  align-items: center;
  margin-bottom: 30rpx;
}

.notice-icon {
  font-size: 40rpx;
  margin-right: 16rpx;
}

.notice-text {
  font-size: 26rpx;
  color: #856404;
  flex: 1;
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
  margin-bottom: 12rpx;
  display: block;
}

.disclaimer-footer {
  margin-top: 40rpx;
  padding-top: 30rpx;
  border-top: 1rpx solid var(--border-color, #f5f5f5);
  text-align: center;
}

.footer-text {
  font-size: 24rpx;
  color: var(--text-secondary, #999);
  display: block;
  margin-bottom: 8rpx;
}
</style>
