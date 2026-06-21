<template>
  <view class="page-container" :class="themeClass">
    <view class="header">
      <text class="title">历史记录</text>
    </view>

    <view class="filter-section">
      <view class="filter-item" v-for="filter in filters" :key="filter.id" :class="{ active: currentFilter === filter.id }" @click="currentFilter = filter.id; loadHistory()">
        <text>{{ filter.name }}</text>
      </view>
    </view>

    <view class="history-list" v-if="filteredHistory.length > 0">
      <view class="history-item" v-for="item in filteredHistory" :key="item.id" @click="viewDetail(item)">
        <view class="item-header">
          <text class="item-type">{{ item.typeName }}</text>
          <view class="header-right">
            <text class="item-time">{{ item.time }}</text>
            <view class="delete-icon" @click.stop="deleteItem(item.id)">
              <text class="delete-icon-text">🗑️</text>
            </view>
          </view>
        </view>
        <view class="item-body">
          <text class="item-summary">{{ item.summary }}</text>
        </view>
        <view class="item-footer">
          <text class="item-rating">运势：{{ item.rating }}</text>
          <text class="item-arrow">›</text>
        </view>
      </view>
    </view>

    <view class="empty-state" v-else>
      <text class="empty-icon">📋</text>
      <text class="empty-text">暂无历史记录</text>
      <text class="empty-desc">快去测算一下吧</text>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { getFortuneRecordsApi, deleteFortuneRecordApi } from '@/api/fortune'

const currentFilter = ref('all')
const historyList = ref([])
const loading = ref(false)

const filters = [
  { id: 'all', name: '全部' },
  { id: 'bazi', name: '八字' },
  { id: 'tarot', name: '塔罗' },
  { id: 'name', name: '姓名' },
  { id: 'fengshui', name: '风水' },
  { id: 'face', name: '面相' },
  { id: 'palm', name: '手相' }
]

const typeNameMap = {
  bazi: '生辰八字',
  tarot: '塔罗占卜',
  name: '姓名测算',
  fengshui: '风水分析',
  daily: '每日运势',
  face: '面相分析',
  palm: '手相分析'
}

const filteredHistory = computed(() => {
  if (currentFilter.value === 'all') return historyList.value
  return historyList.value.filter(item => item.type === currentFilter.value)
})

const loadHistory = async () => {
  loading.value = true
  try {
    const params = { page: 1, pageSize: 50 }
    if (currentFilter.value !== 'all') {
      params.type = currentFilter.value
    }
    const res = await getFortuneRecordsApi(params)
    const data = res.data
    historyList.value = (data.records || []).map(record => {
      let rating = '★★★★☆'
      if (record.type === 'daily' && record.dailyFortune?.score) {
        const stars = Math.round(record.dailyFortune.score / 20)
        rating = '★'.repeat(stars) + '☆'.repeat(5 - stars)
      } else if (record.type === 'name' && record.nameAnalysis?.score) {
        const stars = Math.round(record.nameAnalysis.score / 20)
        rating = '★'.repeat(stars) + '☆'.repeat(5 - stars)
      } else if (record.type === 'fengshui' && record.fengshui?.score) {
        const stars = Math.round(record.fengshui.score / 20)
        rating = '★'.repeat(stars) + '☆'.repeat(5 - stars)
      }
      
      let summaryText = '查看详细结果'
      if (record.aiInterpretation) {
        summaryText = record.aiInterpretation
      } else if (record.type === 'tarot' && record.tarot?.overallReading) {
        summaryText = record.tarot.overallReading
      } else if (record.type === 'name' && record.nameAnalysis?.analysis) {
        summaryText = record.nameAnalysis.analysis
      } else if (record.type === 'fengshui' && record.fengshui?.analysis) {
        summaryText = record.fengshui.analysis
      } else if (record.type === 'face' && record.facePalm?.fortune) {
        summaryText = record.facePalm.fortune
      } else if (record.type === 'palm' && record.facePalm?.fortune) {
        summaryText = record.facePalm.fortune
      } else if (record.type === 'daily' && record.dailyFortune?.overall) {
        summaryText = record.dailyFortune.overall
      }

      return {
        id: record._id,
        type: record.type,
        typeName: typeNameMap[record.type] || record.type,
        time: record.createdAt ? record.createdAt.slice(0, 10) : '--',
        summary: summaryText.length > 50 ? summaryText.slice(0, 50) + '...' : summaryText,
        rating
      }
    })
  } catch (err) {
    historyList.value = []
  } finally {
    loading.value = false
  }
}

const viewDetail = (item) => {
  uni.navigateTo({ url: `/pages/result/index?id=${item.id}` })
}

const deleteItem = (id) => {
  uni.showModal({
    title: '提示',
    content: '确定要删除这条记录吗？',
    success: async (res) => {
      if (res.confirm) {
        uni.showLoading({ title: '删除中...' })
        try {
          await deleteFortuneRecordApi(id)
          uni.showToast({ title: '删除成功', icon: 'success' })
          loadHistory()
        } catch (err) {
          uni.showToast({ title: err.message || '删除失败', icon: 'none' })
        } finally {
          uni.hideLoading()
        }
      }
    }
  })
}

onMounted(() => {
  loadHistory()
})
</script>

<style scoped>
.page-container {
  padding: 30rpx;
  background: var(--bg-color, #f5f0e8);
  min-height: 100vh;
}

.title {
  font-size: 40rpx;
  font-weight: bold;
  color: var(--primary-color, #c41e3a);
  display: block;
  margin-bottom: 24rpx;
}

.filter-section {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-bottom: 24rpx;
}

.filter-item {
  padding: 12rpx 24rpx;
  background: var(--card-bg, #fff);
  border-radius: 24rpx;
  font-size: 26rpx;
  color: var(--text-primary, #333);
}

.filter-item.active {
  background: var(--primary-color, #c41e3a);
  color: #fff;
}

.history-item {
  background: var(--card-bg, #fff);
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}

.item-type {
  font-size: 28rpx;
  font-weight: bold;
  color: var(--primary-color, #c41e3a);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.item-time {
  font-size: 24rpx;
  color: var(--text-secondary, #999);
}

.delete-icon {
  padding: 4rpx 8rpx;
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.delete-icon:active {
  opacity: 1;
}

.delete-icon-text {
  font-size: 28rpx;
}

.item-summary {
  font-size: 26rpx;
  color: var(--text-primary, #333);
}

.item-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12rpx;
  padding-top: 12rpx;
  border-top: 1rpx solid var(--border-color, #f5f5f5);
}

.item-rating {
  font-size: 24rpx;
  color: #f39c12;
}

.item-arrow {
  font-size: 28rpx;
  color: var(--text-secondary, #ccc);
}

.empty-state {
  text-align: center;
  padding: 100rpx 0;
}

.empty-icon {
  font-size: 80rpx;
  display: block;
}

.empty-text {
  font-size: 30rpx;
  color: var(--text-primary, #333);
  margin-top: 20rpx;
  display: block;
}

.empty-desc {
  font-size: 26rpx;
  color: var(--text-secondary, #999);
  margin-top: 8rpx;
  display: block;
}
</style>
