<template>
  <view class="page-container" :class="themeClass">
    <view class="header">
      <text class="title">关于我们</text>
    </view>
    
    <view class="logo-section">
      <image class="logo" :src="logoSrc" mode="aspectFit"></image>
      <text class="app-name">算命小程序</text>
      <text class="version">版本 1.0.0</text>
    </view>
    
    <view class="menu-section">
      <view class="menu-item" @click="navigateTo('/pages/agreement/index')">
        <text class="menu-label">用户协议</text>
        <text class="menu-arrow">></text>
      </view>
      <view class="menu-item" @click="navigateTo('/pages/privacy/index')">
        <text class="menu-label">隐私政策</text>
        <text class="menu-arrow">></text>
      </view>
      <view class="menu-item" @click="navigateTo('/pages/disclaimer/index')">
        <text class="menu-label">免责声明</text>
        <text class="menu-arrow">></text>
      </view>
    </view>
    
    <view class="info-section">
      <view class="info-item">
        <text class="info-label">客服邮箱</text>
        <text class="info-value">support@example.com</text>
      </view>
      <view class="info-item">
        <text class="info-label">客服微信</text>
        <text class="info-value">example_service</text>
      </view>
    </view>
    
    <view class="copyright">
      <text class="copyright-text">© 2024 算命小程序 版权所有</text>
      <text class="copyright-text">本小程序仅供娱乐参考</text>
      <!-- #ifdef H5 -->
      <view class="icp-container">
        <a href="https://beian.miit.gov.cn/" target="_blank" class="icp-link">粤ICP备2025416691号</a>
      </view>
      <!-- #endif -->
    </view>
  </view>
</template>

<script setup>
const logoSrc = '/static/logo.png'

const navigateTo = (url) => {
  uni.navigateTo({ url })
}
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

.logo-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60rpx 0;
  background: var(--card-bg, #fff);
  border-radius: 16rpx;
  margin-bottom: 24rpx;
}

.logo {
  width: 160rpx;
  height: 160rpx;
  border-radius: 32rpx;
  margin-bottom: 24rpx;
}

.app-name {
  font-size: 36rpx;
  font-weight: bold;
  color: var(--text-primary, #333);
  margin-bottom: 8rpx;
}

.version {
  font-size: 26rpx;
  color: var(--text-secondary, #999);
}

.menu-section {
  background: var(--card-bg, #fff);
  border-radius: 16rpx;
  margin-bottom: 24rpx;
  overflow: hidden;
}

.menu-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 30rpx;
  border-bottom: 1rpx solid var(--border-color, #f5f5f5);
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-label {
  font-size: 30rpx;
  color: var(--text-primary, #333);
}

.menu-arrow {
  font-size: 28rpx;
  color: var(--text-secondary, #999);
}

.info-section {
  background: var(--card-bg, #fff);
  border-radius: 16rpx;
  padding: 30rpx;
  margin-bottom: 24rpx;
}

.info-item {
  display: flex;
  justify-content: space-between;
  padding: 16rpx 0;
}

.info-label {
  font-size: 28rpx;
  color: var(--text-secondary, #666);
}

.info-value {
  font-size: 28rpx;
  color: var(--text-primary, #333);
}

.copyright {
  text-align: center;
  padding: 40rpx 0;
}

.copyright-text {
  font-size: 24rpx;
  color: var(--text-secondary, #999);
  display: block;
  margin-bottom: 8rpx;
}

.icp-container {
  margin-top: 12rpx;
}

.icp-link {
  font-size: 24rpx;
  color: var(--text-secondary, #999);
  text-decoration: none;
  transition: color 0.3s;
}

.icp-link:hover {
  color: var(--primary-color, #c41e3a);
}
</style>
