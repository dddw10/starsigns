<template>
  <view class="page-container" :class="themeClass">
    <view class="header">
      <text class="title">会员中心</text>
      <text class="subtitle">开通会员，解锁更多玄学功能</text>
    </view>

    <!-- 当前会员状态 -->
    <view class="vip-card" :class="{ 'vip-active': memberInfo.isMember }">
      <view class="vip-card-bg"></view>
      <view class="vip-info">
        <view class="vip-level-badge">
          <text class="badge-icon">{{ memberInfo.memberLevel === 2 ? '👑' : memberInfo.memberLevel === 1 ? '⭐' : '🔮' }}</text>
          <text class="vip-badge">{{ memberInfo.memberName || '普通用户' }}</text>
        </view>
        <text class="vip-expire" v-if="memberInfo.isMember">
          有效期至 {{ formatDate(memberInfo.memberExpireAt) }}
        </text>
        <text class="vip-expire" v-else>开通会员享受更多权益</text>
      </view>
      <view class="vip-stats">
        <view class="stat-item">
          <text class="stat-value">{{ memberInfo.remaining || 0 }}</text>
          <text class="stat-label">今日剩余</text>
        </view>
        <view class="stat-divider"></view>
        <view class="stat-item">
          <text class="stat-value">{{ memberInfo.fortuneQuota || 0 }}</text>
          <text class="stat-label">付费次数</text>
        </view>
      </view>
    </view>

    <!-- 页面 Tab 切换 -->
    <view class="page-tabs">
      <view class="tab-item" :class="{ active: activeTab === 'plans' }" @click="activeTab = 'plans'">
        <text>开通会员</text>
      </view>
      <view class="tab-item" :class="{ active: activeTab === 'orders' }" @click="activeTab = 'orders'; loadOrders()">
        <text>订单记录</text>
      </view>
    </view>

    <!-- 开通会员 Tab -->
    <view v-if="activeTab === 'plans'">
      <!-- 会员权益 -->
      <view class="benefits-section">
        <text class="section-title">✨ 会员权益</text>
        <view class="benefits-grid">
          <view class="benefit-item" v-for="(benefit, index) in benefits" :key="index">
            <text class="benefit-icon">{{ benefit.icon }}</text>
            <text class="benefit-name">{{ benefit.name }}</text>
            <text class="benefit-desc">{{ benefit.desc }}</text>
            <view class="benefit-lock" v-if="benefit.minLevel > (memberInfo.memberLevel || 0)">
              <text>{{ benefit.minLevel === 2 ? 'SVIP' : 'VIP' }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 选择会员类型 -->
      <view class="member-type-section">
        <text class="section-title">🎯 选择会员类型</text>
        <view class="member-type-tabs">
          <view class="type-tab" :class="{ active: memberType === 'vip' }" @click="switchMemberType('vip')">
            <text class="type-emoji">⭐</text>
            <text class="type-name">VIP会员</text>
            <text class="type-price">¥19.9起</text>
          </view>
          <view class="type-tab svip" :class="{ active: memberType === 'svip' }" @click="switchMemberType('svip')">
            <text class="type-emoji">👑</text>
            <text class="type-name">SVIP会员</text>
            <text class="type-price">¥29.9起</text>
            <view class="type-hot-badge">推荐</view>
          </view>
        </view>
      </view>

      <!-- 选择套餐 -->
      <view class="plan-section">
        <text class="section-title">📦 选择套餐</text>
        <view class="plan-list">
          <view
            class="plan-item"
            v-for="plan in filteredPlans"
            :key="plan.id"
            :class="{ active: selectedPlan === plan.id }"
            @click="selectedPlan = plan.id"
          >
            <text class="plan-duration">{{ plan.duration }}</text>
            <text class="plan-price">¥{{ plan.price }}</text>
            <text class="plan-unit">{{ plan.unit }}</text>
            <view class="plan-discount-tag" v-if="plan.discount">
              <text>{{ plan.discount }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 算命次数包 -->
      <view class="quota-section">
        <text class="section-title">🎲 算命次数包</text>
        <view class="quota-list">
          <view class="quota-item" :class="{ active: selectedPlan === 'quota_5' }" @click="selectedPlan = 'quota_5'">
            <text class="quota-count">5次</text>
            <text class="quota-price">¥4.9</text>
            <text class="quota-unit">0.98元/次</text>
          </view>
        </view>
      </view>

      <button class="pay-btn" @click="handlePay" :disabled="paying">
        <text class="pay-btn-icon">{{ paying ? '⏳' : '🔮' }}</text>
        <text>{{ paying ? '处理中...' : '立即开通' }}</text>
      </button>
    </view>

    <!-- 订单记录 Tab -->
    <view v-if="activeTab === 'orders'" class="orders-section">
      <view v-if="orders.length === 0" class="empty-orders">
        <text class="empty-icon">📋</text>
        <text class="empty-text">暂无订单记录</text>
      </view>
      <view v-else class="order-list">
        <view class="order-item" v-for="order in orders" :key="order.orderNo">
          <view class="order-header">
            <text class="order-name">{{ order.productName }}</text>
            <text class="order-status" :class="'status-' + order.status">{{ getStatusText(order.status) }}</text>
          </view>
          <view class="order-body">
            <text class="order-no">订单号: {{ order.orderNo }}</text>
            <text class="order-amount">¥{{ (order.amount / 100).toFixed(2) }}</text>
          </view>
          <view class="order-footer">
            <text class="order-time">{{ formatDateTime(order.createdAt || order.paidAt) }}</text>
            <text class="order-refund" v-if="order.status === 'paid'" @click="handleRefund(order.orderNo)">申请退款</text>
          </view>
        </view>
      </view>
    </view>

    <view class="disclaimer">
      <text>会员服务为虚拟商品，开通后不支持退款</text>
      <text class="disclaimer-link" @click="showAgreement">会员服务协议</text>
    </view>

    <!-- 太极沙盒模拟支付弹窗 -->
    <view class="taiji-modal-mask" v-if="showSandboxModal" @click="closeSandboxModal">
      <view class="taiji-modal" @click.stop>
        <view class="taiji-modal-header">
          <text class="taiji-modal-title">太极模拟支付</text>
          <text class="taiji-modal-close" @click="closeSandboxModal">✕</text>
        </view>

        <!-- 太极旋转动画 -->
        <view class="taiji-spinner-container">
          <view class="taiji-spinner" :class="{ spinning: sandboxProcessing }">
            <view class="taiji-yin"></view>
            <view class="taiji-yang"></view>
          </view>
        </view>

        <view class="taiji-modal-info">
          <text class="taiji-product-name">{{ sandboxOrder.productName }}</text>
          <text class="taiji-product-price">¥{{ sandboxOrder.displayPrice }}</text>
        </view>

        <view class="taiji-modal-hint">
          <text>🔮 开发测试环境：模拟支付将直接激活权益</text>
        </view>

        <view class="taiji-modal-actions" v-if="!sandboxProcessing">
          <button class="taiji-confirm-btn" @click="confirmSandboxPay">
            <text>☯ 确认支付</text>
          </button>
          <button class="taiji-cancel-btn" @click="closeSandboxModal">
            <text>取消</text>
          </button>
        </view>

        <view class="taiji-processing" v-if="sandboxProcessing">
          <text class="processing-text">{{ processingText }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '@/store/user'
import { getMemberInfo, createOrder, getUserOrders, refundOrder } from './api/member'

const userStore = useUserStore()

const activeTab = ref('plans')
const memberType = ref('vip')
const selectedPlan = ref('vip_monthly')
const memberInfo = ref({})
const paying = ref(false)
const orders = ref([])

// 太极沙盒支付弹窗
const showSandboxModal = ref(false)
const sandboxProcessing = ref(false)
const sandboxOrder = ref({ productName: '', displayPrice: '0.00' })
const processingText = ref('正在连接太极支付通道...')
let pendingOrderCallback = null

// 会员权益
const benefits = [
  { id: 1, name: '每日免费', desc: 'VIP 5次/SVIP 10次', icon: '🎯', minLevel: 1 },
  { id: 2, name: '专属折扣', desc: 'VIP 8折/SVIP 6折', icon: '💰', minLevel: 1 },
  { id: 3, name: '详细解读', desc: '深度分析报告', icon: '📊', minLevel: 1 },
  { id: 4, name: '历史记录', desc: '保存测算记录', icon: '📁', minLevel: 1 },
  { id: 5, name: 'AI深度分析', desc: 'SVIP专属解读', icon: '🤖', minLevel: 2 },
  { id: 6, name: '运势提醒', desc: 'SVIP推送服务', icon: '🔔', minLevel: 2 },
]

// VIP套餐
const vipPlans = [
  { id: 'vip_monthly', type: 'vip', duration: '月卡', price: 19.9, unit: '元/月', discount: '' },
  { id: 'vip_yearly', type: 'vip', duration: '年卡', price: 168, unit: '元/年', discount: '省70.8元' },
]

// SVIP套餐
const svipPlans = [
  { id: 'svip_monthly', type: 'svip', duration: '月卡', price: 29.9, unit: '元/月', discount: '' },
  { id: 'svip_yearly', type: 'svip', duration: '年卡', price: 299, unit: '元/年', discount: '省59.8元' },
]

const filteredPlans = computed(() => {
  return memberType.value === 'vip' ? vipPlans : svipPlans
})

const switchMemberType = (type) => {
  memberType.value = type
  selectedPlan.value = type === 'vip' ? 'vip_monthly' : 'svip_monthly'
}

// 加载会员信息
onMounted(async () => {
  await loadMemberInfo()
})

const loadMemberInfo = async () => {
  try {
    const res = await getMemberInfo()
    if (res.code === 0) {
      memberInfo.value = res.data
    }
  } catch (error) {
    console.error('获取会员信息失败:', error)
  }
}

// 加载订单列表
const loadOrders = async () => {
  try {
    const res = await getUserOrders({ page: 1, pageSize: 20 })
    if (res.code === 0) {
      orders.value = res.data.orders || []
    }
  } catch (error) {
    console.error('获取订单列表失败:', error)
  }
}

// 格式化日期
const formatDate = (date) => {
  if (!date) return ''
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const formatDateTime = (date) => {
  if (!date) return ''
  const d = new Date(date)
  return `${formatDate(date)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const getStatusText = (status) => {
  const map = {
    pending: '待支付',
    paid: '已支付',
    refunding: '退款中',
    refunded: '已退款',
    cancelled: '已取消'
  }
  return map[status] || status
}

// 处理支付
const handlePay = async () => {
  if (paying.value) return

  // 检查登录
  if (!userStore.isLoggedIn) {
    uni.showLoading({ title: '登录中...' })
    const loginRes = await userStore.login()
    uni.hideLoading()
    if (!loginRes.success) {
      uni.showToast({ title: '请先登录', icon: 'none' })
      return
    }
  }

  try {
    paying.value = true

    const productType = selectedPlan.value === 'quota_5' ? 'quota_pack' : selectedPlan.value

    const res = await createOrder({ productType })
    if (res.code === 0) {
      const { orderNo, prepayData, productName, amount } = res.data

      // 判断是否为模拟支付环境
      if (prepayData?.mock) {
        // 打开太极沙盒模拟支付弹窗
        sandboxOrder.value = {
          orderNo,
          productName: productName || '会员服务',
          displayPrice: ((amount || 0) / 100).toFixed(2)
        }

        if (prepayData.mockPaid) {
          // 已自动完成支付（后端 mock 直接标记 paid）
          showSandboxSuccess()
        } else {
          showSandboxModal.value = true
        }
        return
      }

      // #ifdef MP-WECHAT
      // 调起微信原生支付
      uni.requestPayment({
        provider: 'wxpay',
        orderInfo: prepayData,
        timeStamp: prepayData.timeStamp,
        nonceStr: prepayData.nonceStr,
        package: prepayData.package,
        signType: prepayData.signType,
        paySign: prepayData.paySign,
        success: () => {
          uni.showToast({ title: '支付成功', icon: 'success' })
          setTimeout(() => {
            loadMemberInfo()
            userStore.fetchUserInfo()
          }, 1500)
        },
        fail: (payErr) => {
          if (payErr.errMsg !== 'requestPayment:fail cancel') {
            uni.showToast({ title: '支付失败', icon: 'none' })
          }
        }
      })
      // #endif
      // #ifndef MP-WECHAT
      uni.showModal({
        title: '支付提示',
        content: '当前平台暂不支持微信原生支付，请在开发环境启用模拟沙盒支付，或使用小程序端进行真实付款。',
        showCancel: false
      })
      // #endif
    } else {
      uni.showToast({ title: res.message || '创建订单失败', icon: 'none' })
    }
  } catch (error) {
    console.error('支付失败:', error)
    uni.showToast({ title: error.message || '支付失败，请重试', icon: 'none' })
  } finally {
    paying.value = false
  }
}

// 太极沙盒支付动画流程
const showSandboxSuccess = () => {
  showSandboxModal.value = true
  sandboxProcessing.value = true
  processingText.value = '正在连接太极支付通道...'

  setTimeout(() => {
    processingText.value = '☯ 阴阳交汇，能量传递中...'
  }, 600)

  setTimeout(() => {
    processingText.value = '✨ 天机已定，权益已激活！'
  }, 1200)

  setTimeout(() => {
    showSandboxModal.value = false
    sandboxProcessing.value = false
    uni.showToast({ title: '开通成功！', icon: 'success' })
    loadMemberInfo()
    userStore.fetchUserInfo()
  }, 2200)
}

const confirmSandboxPay = () => {
  showSandboxSuccess()
}

const closeSandboxModal = () => {
  if (sandboxProcessing.value) return
  showSandboxModal.value = false
}

// 退款
const handleRefund = (orderNo) => {
  uni.showModal({
    title: '申请退款',
    content: '确定要申请退款吗？退款后相关权益将被撤销。',
    confirmText: '确定退款',
    confirmColor: '#c41e3a',
    success: async (res) => {
      if (res.confirm) {
        try {
          const result = await refundOrder({ orderNo, reason: '用户主动申请退款' })
          if (result.code === 0) {
            uni.showToast({ title: '退款申请已提交', icon: 'success' })
            loadOrders()
          } else {
            uni.showToast({ title: result.message || '退款失败', icon: 'none' })
          }
        } catch (error) {
          uni.showToast({ title: error.message || '退款失败', icon: 'none' })
        }
      }
    }
  })
}

// 显示会员协议
const showAgreement = () => {
  uni.navigateTo({ url: '/pages/legal/index' })
}
</script>

<style scoped>
.page-container {
  padding: 30rpx;
  background: var(--bg-color, #f5f0e8);
  min-height: 100vh;
}

.header {
  margin-bottom: 30rpx;
}

.title {
  font-size: 40rpx;
  font-weight: bold;
  color: var(--primary-color, #c41e3a);
  display: block;
}

.subtitle {
  font-size: 26rpx;
  color: var(--text-secondary, #666);
  margin-top: 8rpx;
  display: block;
}

/* VIP 卡片 */
.vip-card {
  background: linear-gradient(135deg, #2c1810 0%, #4a2820 50%, #2c1810 100%);
  border-radius: 24rpx;
  padding: 36rpx;
  margin-bottom: 24rpx;
  color: #fff;
  position: relative;
  overflow: hidden;
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.15);
}

.vip-card-bg {
  position: absolute;
  top: -30rpx;
  right: -30rpx;
  width: 200rpx;
  height: 200rpx;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(229, 193, 88, 0.15) 0%, transparent 70%);
}

.vip-card.vip-active {
  background: linear-gradient(135deg, #4a2820 0%, #8b4513 50%, #4a2820 100%);
}

.vip-level-badge {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.badge-icon {
  font-size: 40rpx;
}

.vip-badge {
  font-size: 36rpx;
  font-weight: bold;
  color: #e5c158;
}

.vip-expire {
  font-size: 24rpx;
  opacity: 0.8;
  margin-top: 12rpx;
  display: block;
  color: #ddd;
}

.vip-stats {
  display: flex;
  align-items: center;
  margin-top: 24rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid rgba(229, 193, 88, 0.2);
}

.stat-item {
  flex: 1;
  text-align: center;
}

.stat-divider {
  width: 1rpx;
  height: 50rpx;
  background: rgba(229, 193, 88, 0.3);
}

.stat-value {
  font-size: 42rpx;
  font-weight: bold;
  color: #e5c158;
  display: block;
}

.stat-label {
  font-size: 22rpx;
  color: #bbb;
  margin-top: 4rpx;
  display: block;
}

/* Tab 切换 */
.page-tabs {
  display: flex;
  background: var(--card-bg, #fff);
  border-radius: 16rpx;
  margin-bottom: 24rpx;
  overflow: hidden;
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 20rpx;
  font-size: 28rpx;
  color: var(--text-secondary, #999);
  transition: all 0.3s;
}

.tab-item.active {
  color: var(--primary-color, #c41e3a);
  font-weight: bold;
  background: rgba(196, 30, 58, 0.05);
  border-bottom: 4rpx solid var(--primary-color, #c41e3a);
}

/* 权益 */
.section-title {
  font-size: 30rpx;
  font-weight: bold;
  color: var(--text-primary, #333);
  margin-bottom: 16rpx;
  display: block;
}

.benefits-section {
  background: var(--card-bg, #fff);
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
}

.benefits-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.benefit-item {
  width: calc(33.33% - 12rpx);
  text-align: center;
  padding: 20rpx 8rpx;
  background: var(--input-bg, #faf8f4);
  border-radius: 12rpx;
  position: relative;
  overflow: hidden;
}

.benefit-icon {
  font-size: 40rpx;
  display: block;
  margin-bottom: 8rpx;
}

.benefit-name {
  font-size: 24rpx;
  color: var(--text-primary, #333);
  display: block;
  font-weight: bold;
}

.benefit-desc {
  font-size: 20rpx;
  color: var(--text-secondary, #999);
  margin-top: 4rpx;
  display: block;
}

.benefit-lock {
  position: absolute;
  top: 0;
  right: 0;
  background: #e5c158;
  color: #2c1810;
  font-size: 16rpx;
  padding: 2rpx 10rpx;
  border-radius: 0 12rpx 0 8rpx;
  font-weight: bold;
}

/* 会员类型选择 */
.member-type-section {
  background: var(--card-bg, #fff);
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
}

.member-type-tabs {
  display: flex;
  gap: 16rpx;
}

.type-tab {
  flex: 1;
  text-align: center;
  padding: 24rpx 16rpx;
  background: var(--input-bg, #faf8f4);
  border-radius: 16rpx;
  border: 3rpx solid transparent;
  transition: all 0.3s;
  position: relative;
}

.type-tab.active {
  border-color: #e5c158;
  background: rgba(229, 193, 88, 0.08);
  box-shadow: 0 4rpx 16rpx rgba(229, 193, 88, 0.2);
}

.type-tab.svip.active {
  border-color: var(--primary-color, #c41e3a);
  background: rgba(196, 30, 58, 0.05);
  box-shadow: 0 4rpx 16rpx rgba(196, 30, 58, 0.15);
}

.type-emoji {
  font-size: 48rpx;
  display: block;
  margin-bottom: 8rpx;
}

.type-name {
  font-size: 28rpx;
  font-weight: bold;
  color: var(--text-primary, #333);
  display: block;
}

.type-price {
  font-size: 22rpx;
  color: var(--text-secondary, #999);
  margin-top: 4rpx;
  display: block;
}

.type-hot-badge {
  position: absolute;
  top: -2rpx;
  right: -2rpx;
  background: linear-gradient(135deg, #c41e3a, #e74c3c);
  color: #fff;
  font-size: 18rpx;
  padding: 4rpx 16rpx;
  border-radius: 0 16rpx 0 12rpx;
  font-weight: bold;
}

/* 套餐选择 */
.plan-section {
  background: var(--card-bg, #fff);
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
}

.plan-list {
  display: flex;
  gap: 16rpx;
}

.plan-item {
  flex: 1;
  text-align: center;
  padding: 28rpx 16rpx;
  background: var(--input-bg, #faf8f4);
  border-radius: 16rpx;
  border: 3rpx solid transparent;
  transition: all 0.3s;
  position: relative;
}

.plan-item.active {
  border-color: var(--primary-color, #c41e3a);
  background: rgba(196, 30, 58, 0.05);
}

.plan-duration {
  font-size: 26rpx;
  color: var(--text-primary, #333);
  display: block;
}

.plan-price {
  font-size: 40rpx;
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

.plan-discount-tag {
  background: linear-gradient(135deg, #e74c3c, #c0392b);
  color: #fff;
  font-size: 18rpx;
  padding: 4rpx 12rpx;
  border-radius: 20rpx;
  margin-top: 8rpx;
  display: inline-block;
}

/* 次数包 */
.quota-section {
  background: var(--card-bg, #fff);
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
}

.quota-item {
  text-align: center;
  padding: 24rpx;
  background: var(--input-bg, #faf8f4);
  border-radius: 16rpx;
  border: 3rpx solid transparent;
  transition: all 0.3s;
}

.quota-item.active {
  border-color: var(--primary-color, #c41e3a);
  background: rgba(196, 30, 58, 0.05);
}

.quota-count {
  font-size: 36rpx;
  font-weight: bold;
  color: var(--text-primary, #333);
  display: block;
}

.quota-price {
  font-size: 32rpx;
  font-weight: bold;
  color: var(--primary-color, #c41e3a);
  margin-top: 4rpx;
  display: block;
}

.quota-unit {
  font-size: 22rpx;
  color: var(--text-secondary, #999);
  display: block;
}

/* 支付按钮 */
.pay-btn {
  width: 100%;
  height: 96rpx;
  line-height: 96rpx;
  background: linear-gradient(135deg, #c41e3a, #a01530);
  color: #fff;
  font-size: 34rpx;
  font-weight: bold;
  border-radius: 48rpx;
  margin-bottom: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  box-shadow: 0 8rpx 24rpx rgba(196, 30, 58, 0.3);
}

.pay-btn[disabled] {
  opacity: 0.5;
  box-shadow: none;
}

.pay-btn-icon {
  font-size: 32rpx;
}

/* 订单记录 */
.orders-section {
  min-height: 300rpx;
}

.empty-orders {
  text-align: center;
  padding: 80rpx 0;
}

.empty-icon {
  font-size: 80rpx;
  display: block;
  margin-bottom: 16rpx;
}

.empty-text {
  font-size: 28rpx;
  color: var(--text-secondary, #999);
}

.order-item {
  background: var(--card-bg, #fff);
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
}

.order-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}

.order-name {
  font-size: 28rpx;
  font-weight: bold;
  color: var(--text-primary, #333);
}

.order-status {
  font-size: 24rpx;
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
}

.status-paid {
  background: rgba(46, 204, 113, 0.1);
  color: #27ae60;
}

.status-pending {
  background: rgba(241, 196, 15, 0.1);
  color: #f39c12;
}

.status-refunding {
  background: rgba(231, 76, 60, 0.1);
  color: #e74c3c;
}

.status-refunded {
  background: rgba(149, 165, 166, 0.1);
  color: #95a5a6;
}

.status-cancelled {
  background: rgba(149, 165, 166, 0.1);
  color: #95a5a6;
}

.order-body {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.order-no {
  font-size: 22rpx;
  color: var(--text-secondary, #999);
}

.order-amount {
  font-size: 30rpx;
  font-weight: bold;
  color: var(--primary-color, #c41e3a);
}

.order-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12rpx;
  padding-top: 12rpx;
  border-top: 1rpx solid var(--border-color, #f0f0f0);
}

.order-time {
  font-size: 22rpx;
  color: var(--text-secondary, #999);
}

.order-refund {
  font-size: 24rpx;
  color: #e74c3c;
  padding: 4rpx 16rpx;
  border: 1rpx solid #e74c3c;
  border-radius: 20rpx;
}

/* 免责声明 */
.disclaimer {
  text-align: center;
  padding: 20rpx;
  font-size: 22rpx;
  color: var(--text-secondary, #999);
}

.disclaimer-link {
  color: var(--primary-color, #c41e3a);
  margin-left: 8rpx;
}

/* ============ 太极沙盒模拟支付弹窗 ============ */
.taiji-modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.65);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.taiji-modal {
  width: 600rpx;
  background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
  border-radius: 32rpx;
  padding: 40rpx;
  position: relative;
  border: 2rpx solid rgba(229, 193, 88, 0.3);
  box-shadow: 0 20rpx 60rpx rgba(0, 0, 0, 0.5), inset 0 1rpx 0 rgba(229, 193, 88, 0.15);
}

.taiji-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30rpx;
}

.taiji-modal-title {
  font-size: 34rpx;
  font-weight: bold;
  color: #e5c158;
}

.taiji-modal-close {
  font-size: 32rpx;
  color: rgba(255, 255, 255, 0.5);
  padding: 8rpx;
}

/* 太极旋转动画 */
.taiji-spinner-container {
  display: flex;
  justify-content: center;
  margin: 30rpx 0;
}

.taiji-spinner {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  background: linear-gradient(to bottom, #fff 50%, #000 50%);
  position: relative;
  transition: transform 0.3s;
}

.taiji-spinner.spinning {
  animation: taijiSpin 1.5s linear infinite;
}

.taiji-yin,
.taiji-yang {
  position: absolute;
  width: 60rpx;
  height: 60rpx;
  border-radius: 50%;
  top: 50%;
  transform: translateY(-50%);
}

.taiji-yin {
  left: 0;
  background: #fff;
}

.taiji-yin::after {
  content: '';
  position: absolute;
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: #000;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.taiji-yang {
  right: 0;
  background: #000;
}

.taiji-yang::after {
  content: '';
  position: absolute;
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: #fff;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

@keyframes taijiSpin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.taiji-modal-info {
  text-align: center;
  margin-bottom: 20rpx;
}

.taiji-product-name {
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.9);
  display: block;
}

.taiji-product-price {
  font-size: 48rpx;
  font-weight: bold;
  color: #e5c158;
  margin-top: 8rpx;
  display: block;
}

.taiji-modal-hint {
  text-align: center;
  padding: 16rpx;
  background: rgba(229, 193, 88, 0.08);
  border-radius: 12rpx;
  margin-bottom: 30rpx;
}

.taiji-modal-hint text {
  font-size: 22rpx;
  color: rgba(229, 193, 88, 0.8);
}

.taiji-modal-actions {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.taiji-confirm-btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  background: linear-gradient(135deg, #e5c158, #d4a843);
  color: #1a1a2e;
  font-size: 32rpx;
  font-weight: bold;
  border-radius: 44rpx;
  box-shadow: 0 6rpx 20rpx rgba(229, 193, 88, 0.35);
}

.taiji-cancel-btn {
  width: 100%;
  height: 80rpx;
  line-height: 80rpx;
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  font-size: 28rpx;
  border-radius: 40rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.15);
}

.taiji-processing {
  text-align: center;
  padding: 20rpx 0;
}

.processing-text {
  font-size: 26rpx;
  color: #e5c158;
  animation: processingPulse 1.2s ease-in-out infinite;
}

@keyframes processingPulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}
</style>
