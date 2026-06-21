<template>
  <view class="page-container" :class="themeClass">
    <view class="header">
      <text class="title">推送设置</text>
      <text class="subtitle">开启每日运势推送，不错过每一天的好运</text>
    </view>

    <view class="setting-section">
      <view class="setting-item">
        <view class="setting-info">
          <text class="setting-name">每日运势推送</text>
          <text class="setting-desc">每天收到专属运势提醒</text>
        </view>
        <switch :checked="pushEnabled" @change="togglePush" color="var(--primary-color, #c41e3a)" />
      </view>
    </view>

    <view class="setting-section" v-if="pushEnabled">
      <view class="setting-item">
        <view class="setting-info">
          <text class="setting-name">推送时间</text>
          <text class="setting-desc">选择您希望收到推送的时间</text>
        </view>
        <picker mode="time" :value="pushTime" @change="onTimeChange">
          <text class="setting-value">{{ pushTime }}</text>
        </picker>
      </view>
    </view>

    <view class="type-section" v-if="pushEnabled">
      <text class="section-title">推送类型</text>
      <view class="type-list">
        <view class="type-item" v-for="type in pushTypes" :key="type.id">
          <view class="type-info">
            <text class="type-icon">{{ type.icon }}</text>
            <view class="type-detail">
              <text class="type-name">{{ type.name }}</text>
              <text class="type-desc">{{ type.desc }}</text>
            </view>
          </view>
          <switch :checked="type.enabled" @change="(e) => toggleType(type.id, e)" color="var(--primary-color, #c41e3a)" />
        </view>
      </view>
    </view>

    <view class="preview-section" v-if="pushEnabled && enabledTypes.length > 0">
      <text class="section-title">推送预览</text>
      <view class="preview-card" v-for="type in enabledTypes" :key="type.id" style="margin-bottom: 24rpx;">
        <view class="preview-header">
          <text class="preview-title">{{ type.previewTitle }}</text>
          <text class="preview-date">{{ todayDate }}</text>
        </view>
        
        <!-- 综合运势模板 -->
        <view class="preview-body" v-if="type.id === 'general'">
          <text class="preview-text">宜：签约、出行、学习</text>
          <text class="preview-text">忌：争吵、熬夜、大额消费</text>
          <text class="preview-text">综合运势：★★★★☆</text>
          <text class="preview-text">幸运颜色：红色</text>
          <text class="preview-text">幸运数字：8</text>
        </view>

        <!-- 八字日运模板 -->
        <view class="preview-body" v-else-if="type.id === 'bazi'">
          <text class="preview-text">日主气场：甲木 (喜水木)</text>
          <text class="preview-text">今日吉凶：水木相生，宜进取、求财</text>
          <text class="preview-text">五行开运：宜穿戴青绿色衣饰强化木气</text>
          <text class="preview-text">吉时良辰：午时 (11:00-13:00) 诸事亨通</text>
          <text class="preview-text">命理批注：今日官星当令，宜沉稳务实</text>
        </view>

        <!-- 星座日运模板 -->
        <view class="preview-body" v-else-if="type.id === 'constellation'">
          <text class="preview-text">主星相位：双子座 (Gemini)</text>
          <text class="preview-text">今日表现：★★★★☆ (贵人提携，灵感爆棚)</text>
          <text class="preview-text">开运建议：宜多倾听，保持逻辑理性</text>
          <text class="preview-text">幸运物品：天然水晶 / 浅蓝色服饰</text>
          <text class="preview-text">心境提醒：克制浮躁，细水方能长流</text>
        </view>
      </view>
    </view>

    <view class="info-section">
      <text class="info-title">推送说明</text>
      <text class="info-text">1. 需要授权微信订阅消息权限</text>
      <text class="info-text">2. 每次授权可接收一条推送</text>
      <text class="info-text">3. 可随时在设置中关闭推送</text>
      <text class="info-text">4. 推送内容仅供娱乐参考</text>
    </view>

    <view class="disclaimer">
      <text>本功能仅供娱乐参考，不构成任何决策建议</text>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { usePushStore } from '@/store/push'

const pushStore = usePushStore()

const pushEnabled = computed(() => pushStore.pushEnabled)
const pushTime = computed(() => pushStore.pushTime)

const todayDate = computed(() => {
  const d = new Date()
  return `${d.getMonth() + 1}月${d.getDate()}日`
})

const pushTypes = ref([
  { id: 'general', name: '综合运势', desc: '今日宜忌、运势评分', icon: '🌟', enabled: true },
  { id: 'bazi', name: '八字日运', desc: '基于生辰的五行分析', icon: '📿', enabled: false },
  { id: 'constellation', name: '星座日运', desc: '基于星座的运势', icon: '⭐', enabled: false }
])

const togglePush = async (e) => {
  if (e.detail.value) {
    await pushStore.togglePush(true)
    uni.showToast({ title: pushStore.pushEnabled ? '已开启推送' : '未开启推送', icon: 'none' })
  } else {
    await pushStore.togglePush(false)
    uni.showToast({ title: '已关闭推送', icon: 'none' })
  }
}

const onTimeChange = (e) => {
  pushStore.setPushTime(e.detail.value)
  uni.showToast({ title: `推送时间设为${e.detail.value}`, icon: 'none' })
}

const toggleType = (typeId, e) => {
  const type = pushTypes.value.find(t => t.id === typeId)
  if (type) {
    type.enabled = e.detail.value
    // 同步到 Pinia store
    let storeKey = ''
    if (typeId === 'general') storeKey = 'dailyFortune'
    else if (typeId === 'bazi') storeKey = 'bazi'
    else if (typeId === 'constellation') storeKey = 'constellation'
    
    if (storeKey) {
      pushStore.updatePushType(storeKey, e.detail.value)
    }
  }
}

const enabledTypes = computed(() => {
  return pushTypes.value.filter(t => t.enabled).map(t => {
    let previewTitle = '【今日运势】'
    if (t.id === 'bazi') previewTitle = '【八字日运】'
    if (t.id === 'constellation') previewTitle = '【星座日运】'
    return {
      ...t,
      previewTitle
    }
  })
})

onMounted(() => {
  const storeTypes = pushStore.pushTypes
  pushTypes.value.forEach(t => {
    if (t.id === 'general') {
      t.enabled = storeTypes.dailyFortune ?? true
    } else if (t.id === 'bazi') {
      t.enabled = storeTypes.bazi ?? false
    } else if (t.id === 'constellation') {
      t.enabled = storeTypes.constellation ?? false
    }
  })
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
  border-bottom: 1rpx solid var(--border-color, #f5f5f5);
}

.setting-item:last-child {
  border-bottom: none;
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

.setting-value {
  font-size: 28rpx;
  color: var(--primary-color, #c41e3a);
}

.type-section {
  background: var(--card-bg, #fff);
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
}

.section-title {
  font-size: 28rpx;
  font-weight: bold;
  color: var(--text-primary, #333);
  margin-bottom: 20rpx;
  display: block;
}

.type-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 1rpx solid var(--border-color, #f5f5f5);
}

.type-item:last-child {
  border-bottom: none;
}

.type-info {
  display: flex;
  align-items: center;
}

.type-icon {
  font-size: 40rpx;
  margin-right: 16rpx;
}

.type-name {
  font-size: 28rpx;
  color: var(--text-primary, #333);
  display: block;
}

.type-desc {
  font-size: 22rpx;
  color: var(--text-secondary, #999);
  margin-top: 4rpx;
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
