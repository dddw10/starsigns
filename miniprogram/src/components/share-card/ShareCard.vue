<template>
  <view class="share-card" ref="shareCardRef">
    <view class="card-content">
      <view class="card-header">
        <text class="app-name">今日运势</text>
        <text class="share-date">{{ date }}</text>
      </view>

      <view class="card-body">
        <text class="fortune-title">{{ title }}</text>
        <view class="rating">
          <text v-for="i in 5" :key="i" class="star">{{ i <= rating ? '★' : '☆' }}</text>
        </view>
        <text class="analysis-text">{{ content }}</text>
      </view>

      <view class="card-footer">
        <text class="footer-text">扫码测测你的运势</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  title: { type: String, default: '综合运势' },
  rating: { type: Number, default: 4 },
  content: { type: String, default: '' }
})

const date = computed(() => {
  const d = new Date()
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
})
</script>

<style scoped>
.share-card {
  background: linear-gradient(135deg, #c41e3a, #e74c3c);
  border-radius: 20rpx;
  padding: 4rpx;
}

.card-content {
  background: rgba(255,255,255,0.95);
  border-radius: 18rpx;
  overflow: hidden;
}

.card-header {
  padding: 24rpx;
  text-align: center;
}

.app-name {
  font-size: 32rpx;
  font-weight: bold;
  color: #c41e3a;
  display: block;
}

.share-date {
  font-size: 22rpx;
  color: #999;
  margin-top: 8rpx;
  display: block;
}

.card-body {
  padding: 24rpx;
  text-align: center;
}

.fortune-title {
  font-size: 28rpx;
  font-weight: bold;
  color: #333;
  display: block;
  margin-bottom: 12rpx;
}

.star {
  font-size: 32rpx;
  color: #f39c12;
}

.analysis-text {
  font-size: 26rpx;
  color: #666;
  line-height: 1.6;
  margin-top: 16rpx;
  display: block;
}

.card-footer {
  padding: 16rpx;
  background: #f5f5f5;
  text-align: center;
}

.footer-text {
  font-size: 20rpx;
  color: #999;
}
</style>
