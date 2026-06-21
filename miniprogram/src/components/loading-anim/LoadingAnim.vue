<template>
  <view class="loading-anim" v-if="visible">
    <view class="loading-content">
      <view class="loading-spinner">
        <view class="spinner-ring" v-for="i in 3" :key="i" :style="{ animationDelay: (i - 1) * 0.2 + 's' }"></view>
      </view>
      <text class="loading-text">{{ text }}</text>
    </view>
  </view>
</template>

<script setup>
defineProps({
  visible: { type: Boolean, default: false },
  text: { type: String, default: '正在测算中...' }
})
</script>

<style scoped>
.loading-anim {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.loading-content {
  text-align: center;
}

.loading-spinner {
  width: 120rpx;
  height: 120rpx;
  position: relative;
  margin: 0 auto 24rpx;
}

.spinner-ring {
  position: absolute;
  width: 100%;
  height: 100%;
  border: 4rpx solid transparent;
  border-top-color: var(--primary-color, #c41e3a);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  font-size: 28rpx;
  color: #fff;
}
</style>
