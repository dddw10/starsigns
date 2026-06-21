<template>
  <view class="push-subscribe" v-if="visible">
    <view class="modal-mask" @click="close"></view>
    <view class="modal-content">
      <text class="modal-title">开启每日推送</text>
      <text class="modal-desc">每天收到专属运势提醒，不错过每一天的好运</text>
      
      <view class="preview-card">
        <text class="preview-title">【今日运势】</text>
        <text class="preview-text">宜：签约、出行</text>
        <text class="preview-text">忌：争吵、熬夜</text>
        <text class="preview-text">综合运势：★★★★☆</text>
      </view>

      <view class="btn-group">
        <button class="btn cancel" @click="close">暂不开启</button>
        <button class="btn confirm" @click="subscribe">立即开启</button>
      </view>
    </view>
  </view>
</template>

<script setup>
const props = defineProps({
  visible: { type: Boolean, default: false }
})

const emit = defineEmits(['close', 'subscribe'])

const close = () => {
  emit('close')
}

const subscribe = () => {
  // #ifdef MP-WECHAT
  uni.requestSubscribeMessage({
    tmplIds: ['your_template_id_here'],
    success: () => {
      emit('subscribe')
      uni.showToast({ title: '开启成功', icon: 'success' })
    },
    fail: () => {
      uni.showToast({ title: '授权失败，请在设置中开启', icon: 'none' })
    }
  })
  // #endif
  // #ifndef MP-WECHAT
  emit('subscribe')
  uni.showToast({ title: '开启成功', icon: 'success' })
  // #endif
}
</script>

<style scoped>
.push-subscribe {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 999;
}

.modal-mask {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
}

.modal-content {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--card-bg, #fff);
  border-radius: 24rpx 24rpx 0 0;
  padding: 40rpx;
}

.modal-title {
  font-size: 36rpx;
  font-weight: bold;
  color: var(--text-primary, #333);
  display: block;
  text-align: center;
  margin-bottom: 16rpx;
}

.modal-desc {
  font-size: 26rpx;
  color: var(--text-secondary, #666);
  display: block;
  text-align: center;
  margin-bottom: 24rpx;
}

.preview-card {
  background: var(--input-bg, #f5f5f5);
  border-radius: 12rpx;
  padding: 20rpx;
  margin-bottom: 30rpx;
}

.preview-title {
  font-size: 28rpx;
  font-weight: bold;
  color: var(--primary-color, #c41e3a);
  display: block;
  margin-bottom: 12rpx;
}

.preview-text {
  font-size: 26rpx;
  color: var(--text-primary, #333);
  line-height: 1.6;
  display: block;
}

.btn-group {
  display: flex;
  gap: 20rpx;
}

.btn {
  flex: 1;
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 44rpx;
  font-size: 30rpx;
}

.btn.cancel {
  background: var(--input-bg, #f5f5f5);
  color: var(--text-primary, #333);
}

.btn.confirm {
  background: var(--primary-color, #c41e3a);
  color: #fff;
}
</style>
