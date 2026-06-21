<template>
  <view class="result-card">
    <view class="card-header">
      <text class="card-title">{{ title }}</text>
      <view class="card-rating" v-if="rating">
        <text v-for="i in 5" :key="i" class="star">{{ i <= rating ? '★' : '☆' }}</text>
      </view>
    </view>
    
    <view class="card-body">
      <slot></slot>
    </view>

    <view class="card-footer" v-if="$slots.footer">
      <slot name="footer"></slot>
    </view>
  </view>
</template>

<script setup>
defineProps({
  title: { type: String, default: '' },
  rating: { type: Number, default: 0 }
})
</script>

<style scoped>
.result-card {
  background: var(--card-bg, #fff);
  border-radius: 20rpx;
  overflow: hidden;
  margin-bottom: 24rpx;
}

.card-header {
  padding: 24rpx;
  border-bottom: 1rpx solid var(--border-color, #f5f5f5);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title {
  font-size: 30rpx;
  font-weight: bold;
  color: var(--primary-color, #c41e3a);
}

.star {
  font-size: 28rpx;
  color: #f39c12;
}

.card-body {
  padding: 24rpx;
}

.card-footer {
  padding: 16rpx 24rpx;
  background: var(--input-bg, #f5f5f5);
}
</style>
