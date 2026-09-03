<template>
  <view class="page-container" :class="themeClass">
    <view class="header">
      <text class="title">运势提醒</text>
      <text class="subtitle">每次授权可收到一条，可多次授权累积</text>
    </view>

    <view class="setting-section">
      <view class="setting-item">
        <view class="setting-info">
          <text class="setting-name">每日运势提醒</text>
          <text class="setting-desc">{{ switchDesc }}</text>
        </view>
        <switch
          :checked="switchOn"
          :disabled="!configured || loading"
          @change="onToggle"
          color="var(--primary-color, #c41e3a)"
        />
      </view>
    </view>

    <!-- 加载失败 ≠ 没开启：分开画，并且给一个真的能点的重试 -->
    <view class="status-card error" v-if="loadError">
      <text class="status-text">推送状态没能加载出来：{{ loadError }}</text>
      <view class="retry-btn" @click="reload">
        <text class="retry-btn-text">重新加载</text>
      </view>
    </view>

    <view class="status-card" v-else-if="loading">
      <text class="status-text">正在读取提醒状态...</text>
    </view>

    <view class="status-card" v-else-if="!configured">
      <text class="status-text">服务端还没配置订阅消息模板，暂时无法开启提醒。</text>
    </view>

    <view class="status-card" v-else-if="pushEnabled">
      <text class="status-text">还可收到 {{ remainingQuota }} 条提醒，每天 {{ pushTimeLabel }}（北京时间）推送。</text>
      <text class="status-sub" v-if="expireLabel">有效期至 {{ expireLabel }}</text>
      <text class="status-sub" v-if="lastPushDate">上次推送：{{ lastPushDate }}</text>
    </view>

    <view class="status-card" v-else>
      <text class="status-text">当前没有待发送的提醒。打开上面的开关再授权一次即可。</text>
    </view>

    <view class="preview-section" v-if="configured">
      <text class="section-title">推送预览</text>
      <view class="preview-card">
        <view class="preview-header">
          <text class="preview-title">【今日运势】</text>
          <text class="preview-date">{{ todayDate }}</text>
        </view>
        <view class="preview-body">
          <text class="preview-text">宜：聚餐会友 团队建设</text>
          <text class="preview-text">忌：独自决断 意气之争</text>
          <text class="preview-text">综合运势：79 分</text>
          <text class="preview-text">幸运颜色：金色</text>
        </view>
        <text class="preview-note">实际字段取决于微信后台模板的参数配置</text>
      </view>
    </view>

    <view class="info-section">
      <text class="info-title">推送说明</text>
      <text class="info-text">1. 需要在微信弹窗中明确同意订阅</text>
      <text class="info-text">2. 微信规定每次同意只能收到一条，勾选弹窗里的「总是保持以上选择」可以免去重复弹窗</text>
      <text class="info-text">3. 想连续几天都收到，就多授权几次，最多累积 {{ maxQuota }} 条</text>
      <text class="info-text">4. 推送时间固定为每天 {{ pushTimeLabel }}（北京时间），内容与小程序里的每日运势一致</text>
      <text class="info-text">5. 需要先填写生辰，否则没有可推送的运势</text>
      <text class="info-text">6. 推送内容仅供娱乐参考</text>
    </view>

    <view class="disclaimer">
      <text>本功能仅供娱乐参考，不构成任何决策建议</text>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { usePushStore } from '@/store/push'

const pushStore = usePushStore()

const pushEnabled = computed(() => pushStore.pushEnabled)
const remainingQuota = computed(() => pushStore.remainingQuota)
const maxQuota = computed(() => pushStore.maxQuota)
const pushTimeLabel = computed(() => pushStore.pushTimeLabel)
const configured = computed(() => pushStore.configured)
const loading = computed(() => pushStore.loading)
const loadError = computed(() => pushStore.loadError)
const lastPushDate = computed(() => pushStore.lastPushDate)

// switch 的 checked 必须绑一个本地 ref：小程序的 switch 点下去就自己变了，
// 失败时只有改这个本地值才能把它弹回去（绑 computed 是弹不回来的）
const switchOn = ref(false)
watch(pushEnabled, (val) => { switchOn.value = val }, { immediate: true })

const switchDesc = computed(() => {
  if (!configured.value) return '服务端尚未配置，暂不可用'
  if (pushEnabled.value) return `每天 ${pushTimeLabel.value} 推送，还可收到 ${remainingQuota.value} 条`
  return `开启后每天 ${pushTimeLabel.value} 推送一条`
})

const expireLabel = computed(() => {
  if (!pushStore.expireAt) return ''
  const text = String(pushStore.expireAt)
  return text.length >= 10 ? text.slice(0, 10) : text
})

const todayDate = computed(() => {
  const d = new Date()
  return `${d.getMonth() + 1}月${d.getDate()}日`
})

const onToggle = async (e) => {
  const next = e.detail.value
  // showLoading 和 showToast 共用同一个原生浮层：提示必须排在 hideLoading 之后
  let toast = null
  uni.showLoading({ title: next ? '订阅中...' : '关闭中...' })
  try {
    const result = await pushStore.togglePush(next)
    if (result.ok) {
      switchOn.value = next
      toast = { title: result.reason || '已保存', icon: 'none' }
    } else {
      // 失败要回弹，否则屏幕上写着「已开启」而实际没有
      switchOn.value = pushStore.pushEnabled
      toast = { title: result.reason || '操作失败', icon: 'none' }
    }
  } catch (err) {
    switchOn.value = pushStore.pushEnabled
    toast = { title: err?.message || '操作失败，请稍后重试', icon: 'none' }
  } finally {
    uni.hideLoading()
  }
  if (toast) uni.showToast(toast)
}

const reload = () => pushStore.refresh()

onMounted(() => {
  pushStore.initFromStorage()
  pushStore.refresh()
})

// 从微信「设置-订阅消息」改过授权、或推送已经发出之后回到这一页，状态要跟着变
onShow(() => {
  pushStore.refresh()
})
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

.setting-section {
  background: var(--card-bg, #fff);
  border-radius: 16rpx;
  margin-bottom: 24rpx;
  overflow: hidden;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 28rpx 24rpx;
}

.setting-name {
  font-size: 30rpx;
  color: var(--text-primary, #333);
  display: block;
}

.setting-desc {
  font-size: 24rpx;
  color: var(--text-secondary, #999);
  margin-top: 6rpx;
  display: block;
}

.status-card {
  background: var(--card-bg, #fff);
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
}

.status-card.error {
  border-left: 6rpx solid #e67e22;
}

.status-text {
  font-size: 26rpx;
  color: var(--text-primary, #333);
  line-height: 1.7;
  display: block;
}

.status-sub {
  font-size: 24rpx;
  color: var(--text-secondary, #999);
  margin-top: 8rpx;
  display: block;
}

.retry-btn {
  display: inline-block;
  margin-top: 20rpx;
  padding: 12rpx 40rpx;
  border-radius: 40rpx;
  background: var(--primary-color, #c41e3a);
}

.retry-btn-text {
  font-size: 26rpx;
  color: #fff;
}

.section-title {
  font-size: 28rpx;
  font-weight: bold;
  color: var(--text-primary, #333);
  margin-bottom: 20rpx;
  display: block;
}

.preview-section {
  background: var(--card-bg, #fff);
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
}

.preview-card {
  background: var(--input-bg, #f5f5f5);
  border-radius: 12rpx;
  padding: 20rpx;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 16rpx;
}

.preview-title {
  font-size: 28rpx;
  font-weight: bold;
  color: var(--primary-color, #c41e3a);
}

.preview-date {
  font-size: 24rpx;
  color: var(--text-secondary, #666);
}

.preview-text {
  font-size: 26rpx;
  color: var(--text-primary, #333);
  line-height: 1.8;
  display: block;
}

.preview-note {
  font-size: 22rpx;
  color: var(--text-secondary, #999);
  margin-top: 12rpx;
  display: block;
}

.info-section {
  background: var(--card-bg, #fff);
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
}

.info-title {
  font-size: 28rpx;
  font-weight: bold;
  color: var(--text-primary, #333);
  margin-bottom: 16rpx;
  display: block;
}

.info-text {
  font-size: 24rpx;
  color: var(--text-secondary, #666);
  line-height: 1.8;
  display: block;
}

.disclaimer {
  text-align: center;
  padding: 20rpx;
  font-size: 22rpx;
  color: var(--text-secondary, #999);
}
</style>

