<template>
  <view class="privacy-popup-mask" v-if="showPopup">
    <view class="privacy-popup-box">
      <view class="privacy-title">用户隐私保护提示</view>
      
      <view class="privacy-content">
        感谢您使用今日星能量！在您使用本小程序服务之前，请仔细阅读并同意
        <text class="privacy-link" @tap="openPrivacyContract">《今日星能量小程序用户隐私保护指引》</text>。
        我们会根据您的授权来收集出生日期信息、照片等必要信息，以便为您提供更精准的性格分析与每日灵感服务。如您同意该指引，请点击“同意”开始使用。
        <view class="privacy-date">更新日期：2026年6月23日</view>
      </view>
      
      <view class="privacy-btn-group">
        <button class="btn-refuse" @tap="handleRefuse">拒绝</button>
        <button 
          class="btn-agree" 
          open-type="agreePrivacyAuthorization" 
          @agreeprivacyauthorization="handleAgree"
        >同意</button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const showPopup = ref(false)
let resolvePrivacyAuthorization = null

const openPrivacyContract = () => {
  // #ifdef MP-WEIXIN
  if (wx.openPrivacyContract) {
    wx.openPrivacyContract({
      fail: (err) => {
        uni.showToast({
          title: '打开隐私协议失败，请稍后重试',
          icon: 'none'
        })
        console.error('openPrivacyContract fail', err)
      }
    })
  } else {
    uni.showModal({
      title: '提示',
      content: '请更新微信版本后查看隐私指引。',
      showCancel: false
    })
  }
  // #endif
}

const handleAgree = (e) => {
  console.log('用户同意了隐私协议', e)
  showPopup.value = false
  if (resolvePrivacyAuthorization) {
    resolvePrivacyAuthorization({
      buttonId: 'agree-btn',
      event: 'agree'
    })
    resolvePrivacyAuthorization = null
  }
}

const handleRefuse = () => {
  console.log('用户拒绝了隐私协议')
  showPopup.value = false
  if (resolvePrivacyAuthorization) {
    resolvePrivacyAuthorization({
      event: 'disagree'
    })
    resolvePrivacyAuthorization = null
  }
  // 提示用户并退出或限制使用
  uni.showToast({
    title: '您拒绝了隐私协议，部分功能可能无法正常使用',
    icon: 'none',
    duration: 3000
  })
}

onMounted(() => {
  // 监听隐私授权事件
  // #ifdef MP-WEIXIN
  if (wx.onNeedPrivacyAuthorization) {
    wx.onNeedPrivacyAuthorization((resolve, eventInfo) => {
      console.log('触发微信隐私协议授权弹窗', eventInfo)
      showPopup.value = true
      resolvePrivacyAuthorization = resolve
    })
  }
  // #endif
})
</script>

<style scoped>
.privacy-popup-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 999999;
  background-color: rgba(0, 0, 0, 0.65);
  display: flex;
  justify-content: center;
  align-items: center;
  backdrop-filter: blur(10rpx);
}

.privacy-popup-box {
  width: 80%;
  max-width: 600rpx;
  background: var(--bg-secondary, #1a1a24);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 24rpx;
  padding: 40rpx;
  box-shadow: 0 20rpx 50rpx rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  color: var(--text-primary, #ffffff);
}

.privacy-title {
  font-size: 36rpx;
  font-weight: bold;
  text-align: center;
  margin-bottom: 30rpx;
  color: var(--primary-color, #ffaa00);
}

.privacy-content {
  font-size: 28rpx;
  line-height: 1.6;
  color: var(--text-secondary, #b0b0c5);
  margin-bottom: 40rpx;
}

.privacy-link {
  color: var(--primary-color, #ffaa00);
  text-decoration: underline;
  display: inline;
}

.privacy-btn-group {
  display: flex;
  justify-content: space-between;
  gap: 20rpx;
}

.btn-refuse {
  flex: 1;
  height: 88rpx;
  line-height: 88rpx;
  text-align: center;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 44rpx;
  color: var(--text-secondary, #b0b0c5);
  font-size: 30rpx;
}

.btn-agree {
  flex: 1;
  height: 88rpx;
  line-height: 88rpx;
  text-align: center;
  background: linear-gradient(135deg, var(--primary-color, #ffaa00) 0%, #ff5500 100%);
  border-radius: 44rpx;
  color: #ffffff;
  font-size: 30rpx;
  font-weight: bold;
  border: none;
}

.btn-agree::after, .btn-refuse::after {
  border: none;
}

.privacy-date {
  font-size: 22rpx;
  color: var(--text-secondary, #b0b0c5);
  margin-top: 20rpx;
  text-align: right;
}
</style>
