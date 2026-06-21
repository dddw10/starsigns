<template>
  <view class="pay-dialog" v-if="visible">
    <view class="modal-mask" @click="close"></view>
    <view class="modal-content">
      <text class="modal-title">开通会员</text>
      
      <view class="plan-list">
        <view class="plan-item" v-for="plan in plans" :key="plan.id" :class="{ active: selectedPlan === plan.id }" @click="selectedPlan = plan.id">
          <text class="plan-name">{{ plan.name }}</text>
          <text class="plan-price">¥{{ plan.price }}</text>
          <text class="plan-unit">{{ plan.unit }}</text>
        </view>
      </view>

      <view class="btn-group">
        <button class="btn cancel" @click="close">取消</button>
        <button class="btn confirm" @click="pay">立即支付</button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false }
})

const emit = defineEmits(['close', 'pay'])

const selectedPlan = ref('month')

const plans = [
  { id: 'month', name: '月卡', price: 19.9, unit: '元/月' },
  { id: 'quarter', name: '季卡', price: 49.9, unit: '元/季' },
  { id: 'year', name: '年卡', price: 168, unit: '元/年' }
]

const close = () => {
  emit('close')
}

const pay = () => {
  emit('pay', selectedPlan.value)
}
</script>

<style scoped>
.pay-dialog {
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
  margin-bottom: 30rpx;
}

.plan-list {
  display: flex;
  gap: 16rpx;
  margin-bottom: 30rpx;
}

.plan-item {
  flex: 1;
  text-align: center;
  padding: 24rpx 16rpx;
  background: var(--input-bg, #f5f5f5);
  border-radius: 12rpx;
  border: 2rpx solid transparent;
}

.plan-item.active {
  border-color: var(--primary-color, #c41e3a);
  background: rgba(196, 30, 58, 0.05);
}

.plan-name {
  font-size: 26rpx;
  color: var(--text-primary, #333);
  display: block;
}

.plan-price {
  font-size: 32rpx;
  font-weight: bold;
  color: var(--primary-color, #c41e3a);
  margin-top: 8rpx;
  display: block;
}

.plan-unit {
  font-size: 22rpx;
  color: var(--text-secondary, #999);
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
