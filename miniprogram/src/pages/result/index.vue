<template>
  <view class="page-container" :class="themeClass">
    <view class="loading-state" v-if="loading">
      <view class="spinner"></view>
      <text class="loading-text">正在解读天机，请稍候...</text>
    </view>

    <view class="result-card" v-else-if="result">
      <view class="card-header">
        <text class="result-type">{{ result.typeName }}</text>
        <text class="result-time">测算时间：{{ result.time }}</text>
      </view>

      <view class="card-body">
        <!-- 评分区：八字除外（八字用吉凶强弱表示，不显示星级），其他都显示 -->
        <view class="rating-section" v-if="result.type !== 'bazi'">
          <text class="rating-label">{{ result.type === 'name' || result.type === 'fengshui' || result.type === 'daily' ? '测算得分：' + (result.score || 80) + '分' : '运势综合评分' }}</text>
          <view class="rating-stars">
            <text v-for="i in 5" :key="i" class="star">{{ i <= result.rating ? '★' : '☆' }}</text>
          </view>
        </view>

        <!-- 1. 八字排盘专属视图 -->
        <view class="bazi-result-section" v-if="result.type === 'bazi'">
          <text class="section-title">乾坤八字命盘</text>
          <view class="bazi-grid">
            <view class="bazi-item" v-for="(item, index) in result.baziGrid" :key="index">
              <text class="bazi-label">{{ item.label }}</text>
              <text class="bazi-value">{{ item.value }}</text>
            </view>
          </view>

          <view class="analysis-sub-section">
            <text class="section-title">五行力量分布</text>
            <view class="wuxing-chart">
              <view class="wuxing-item" v-for="(item, index) in result.wuxingChart" :key="index">
                <text class="wuxing-name">{{ item.name }}</text>
                <view class="wuxing-bar">
                  <view class="wuxing-fill" :style="{ width: (item.count * 20) + '%', background: item.color }"></view>
                </view>
                <text class="wuxing-count">{{ item.count }}</text>
              </view>
            </view>
          </view>
        </view>

        <!-- 2. 塔罗占卜专属视图 -->
        <view class="tarot-result-section" v-if="result.type === 'tarot'">
          <text class="section-title">选定塔罗牌阵：{{ result.spreadType }}</text>
          <view class="tarot-card-list">
            <view class="tarot-card-item" v-for="(card, index) in result.cards" :key="index">
              <view class="tarot-card-info">
                <text class="tarot-card-name">🔮 {{ card.name }} ({{ card.isReversed ? '逆位' : '正位' }})</text>
                <text class="tarot-card-position">牌位：{{ card.position }}</text>
              </view>
              <text class="tarot-card-desc">{{ card.interpretation }}</text>
            </view>
          </view>
        </view>

        <!-- 3. 姓名测算专属视图 -->
        <view class="name-result-section" v-if="result.type === 'name'">
          <view class="name-info-grid">
            <view class="info-item">
              <text class="info-label">测算姓名</text>
              <text class="info-value name-highlight">{{ result.name }}</text>
            </view>
            <view class="info-item">
              <text class="info-label">繁体笔画</text>
              <text class="info-value">{{ result.strokeCount }} 画</text>
            </view>
            <view class="info-item">
              <text class="info-label">五行属性</text>
              <text class="info-value">{{ result.fiveElement }}</text>
            </view>
            <view class="info-item">
              <text class="info-label">三才配置</text>
              <text class="info-value">{{ result.threeTalent }}</text>
            </view>
          </view>
        </view>

        <!-- 4. 风水分析专属视图 -->
        <view class="fengshui-result-section" v-if="result.type === 'fengshui'">
          <view class="fengshui-info-grid">
            <view class="info-item">
              <text class="info-label">房屋朝向</text>
              <text class="info-value">{{ result.direction }}</text>
            </view>
            <view class="info-item">
              <text class="info-label">户型格局</text>
              <text class="info-value">{{ result.layout }}</text>
            </view>
          </view>
        </view>

        <!-- 5. 面相手相专属视图 -->
        <view class="facepalm-result-section" v-if="result.type === 'face' || result.type === 'palm'">
          <view class="feature-tag-card">
            <text class="feature-tag-title">👁️ {{ result.featureTitle }}</text>
            <text class="feature-tag-content">{{ result.features }}</text>
          </view>
          
          <view class="analysis-section" v-if="result.personality">
            <text class="section-title">性格特征剖析</text>
            <text class="analysis-text">{{ result.personality }}</text>
          </view>
        </view>

        <!-- 6. 每日运势专属视图 -->
        <view class="daily-result-section" v-if="result.type === 'daily'">
          <view class="daily-grid">
            <view class="daily-grid-item">
              <text class="daily-grid-title">💼 事业运势</text>
              <text class="daily-grid-desc">{{ result.dailyDetail.career }}</text>
            </view>
            <view class="daily-grid-item">
              <text class="daily-grid-title">💰 财富运势</text>
              <text class="daily-grid-desc">{{ result.dailyDetail.wealth }}</text>
            </view>
            <view class="daily-grid-item">
              <text class="daily-grid-title">❤️ 感情运势</text>
              <text class="daily-grid-desc">{{ result.dailyDetail.love }}</text>
            </view>
            <view class="daily-grid-item">
              <text class="daily-grid-title">🍏 健康运势</text>
              <text class="daily-grid-desc">{{ result.dailyDetail.health }}</text>
            </view>
          </view>

          <view class="lucky-section" v-if="result.dailyDetail.luckyColor">
            <view class="lucky-item">
              <text class="lucky-label">今日幸运色</text>
              <view class="lucky-color" :style="{ background: result.dailyDetail.luckyColor }"></view>
            </view>
            <view class="lucky-item">
              <text class="lucky-label">今日幸运数字</text>
              <text class="lucky-value">{{ result.dailyDetail.luckyNumber }}</text>
            </view>
          </view>
        </view>

        <!-- 通用解读/分析结果展示（若有） -->
        <view class="analysis-section" v-if="result.analysis">
          <text class="section-title">{{ result.type === 'tarot' ? '牌阵综合解读' : (result.type === 'face' || result.type === 'palm' ? '运势流年解析' : '测算分析详批') }}</text>
          <text class="analysis-text">{{ result.analysis }}</text>
        </view>

        <!-- 风水专用的额外建议 -->
        <view class="advice-section" v-if="result.type === 'fengshui' && result.suggestions && result.suggestions.length > 0">
          <text class="advice-title">风水调理建议</text>
          <view class="suggestion-list">
            <text class="suggestion-item" v-for="(sug, idx) in result.suggestions" :key="idx">📍 {{ sug }}</text>
          </view>
        </view>
      </view>
    </view>

    <view class="empty-state" v-else>
      <text class="empty-icon">⚠️</text>
      <text class="empty-text">未能获取到测算结果</text>
      <text class="empty-desc" @click="navigateTo('/pages/index/index')">返回首页</text>
    </view>

    <view class="action-section" v-if="result">
      <button class="action-btn primary" @click="share">分享给好友</button>
      <button class="action-btn secondary" @click="saveImage">保存海报</button>
    </view>

    <view class="more-section" v-if="result">
      <text class="more-title">更多功能</text>
      <view class="more-list">
        <view class="more-item" @click="navigateTo('/pages/history/index')">
          <text class="more-icon">📋</text>
          <text class="more-name">查看我的历史记录</text>
          <text class="more-arrow">›</text>
        </view>
        <view class="more-item" @click="navigateTo('/pages/push-settings/index')">
          <text class="more-icon">🔔</text>
          <text class="more-name">开启每日运势推送</text>
          <text class="more-arrow">›</text>
        </view>
      </view>
    </view>

    <view class="disclaimer">
      <text>本结果仅供娱乐参考，不构成任何决策建议</text>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getFortuneRecordApi, shareFortuneRecordApi } from '@/api/fortune'

const loading = ref(false)
const recordId = ref('')
const result = ref(null)

const typeNameMap = {
  bazi: '生辰八字',
  tarot: '塔罗占卜',
  name: '姓名测算',
  fengshui: '风水分析',
  daily: '每日运势',
  face: '面相分析',
  palm: '手相分析'
}

const fetchRecord = async (id) => {
  loading.value = true
  try {
    const res = await getFortuneRecordApi(id)
    const data = res.data
    if (!data) {
      uni.showToast({ title: '记录不存在', icon: 'none' })
      return
    }

    const type = data.type
    const typeName = typeNameMap[type] || type
    const time = data.createdAt ? data.createdAt.replace('T', ' ').slice(0, 19) : '--'

    let parsedResult = {
      id: data._id,
      type,
      typeName,
      time,
      rating: 4,
    }

    if (type === 'bazi') {
      const bazi = data.bazi || {}
      const baziRes = bazi.result || {}
      const wuxingData = baziRes.wuxing || {}

      const wuxingNames = { metal: '金', wood: '木', water: '水', fire: '火', earth: '土' }
      const wuxingColors = { metal: '#f1c40f', wood: '#27ae60', water: '#3498db', fire: '#e74c3c', earth: '#8b4513' }

      parsedResult.baziGrid = [
        { label: '年柱', value: baziRes.yearGanZhi || '--' },
        { label: '月柱', value: baziRes.monthGanZhi || '--' },
        { label: '日柱', value: baziRes.dayGanZhi || '--' },
        { label: '时柱', value: baziRes.hourGanZhi || '--' }
      ]

      parsedResult.wuxingChart = Object.keys(wuxingNames).map(k => ({
        name: wuxingNames[k],
        count: wuxingData[k] || 0,
        color: wuxingColors[k]
      }))

      parsedResult.analysis = data.aiInterpretation || '分析完成'
      parsedResult.inputInfo = bazi.input || {}
    } else if (type === 'tarot') {
      const tarot = data.tarot || {}
      parsedResult.spreadType = tarot.spreadType || '单牌占卜'
      parsedResult.cards = (tarot.cards || []).map(c => ({
        name: c.name,
        position: c.position,
        isReversed: c.isReversed,
        interpretation: c.interpretation
      }))
      parsedResult.analysis = tarot.overallReading || ''
    } else if (type === 'name') {
      const nameAnalysis = data.nameAnalysis || {}
      parsedResult.name = nameAnalysis.name || ''
      parsedResult.strokeCount = nameAnalysis.strokeCount || 0
      parsedResult.fiveElement = nameAnalysis.fiveElement || ''
      parsedResult.threeTalent = nameAnalysis.threeTalent || ''
      parsedResult.score = nameAnalysis.score || 0
      parsedResult.rating = Math.max(1, Math.min(5, Math.round((nameAnalysis.score || 80) / 20)))
      parsedResult.analysis = nameAnalysis.analysis || ''
    } else if (type === 'fengshui') {
      const fengshui = data.fengshui || {}
      parsedResult.layout = fengshui.layout || ''
      parsedResult.direction = fengshui.direction || ''
      parsedResult.score = fengshui.score || 0
      parsedResult.rating = Math.max(1, Math.min(5, Math.round((fengshui.score || 80) / 20)))
      parsedResult.analysis = fengshui.analysis || ''
      parsedResult.suggestions = fengshui.suggestions || []
    } else if (type === 'face' || type === 'palm') {
      const facePalm = data.facePalm || {}
      parsedResult.featureTitle = facePalm.featureTitle || (type === 'face' ? '面相特征' : '手相特征')
      parsedResult.features = facePalm.features || ''
      parsedResult.fortune = facePalm.fortune || ''
      parsedResult.personality = facePalm.personality || ''
      parsedResult.analysis = facePalm.fortune || ''
    } else if (type === 'daily') {
      const daily = data.dailyFortune || {}
      parsedResult.score = daily.score || 80
      parsedResult.rating = Math.max(1, Math.min(5, Math.round((daily.score || 80) / 20)))
      parsedResult.analysis = daily.overall || ''
      parsedResult.dailyDetail = {
        career: daily.career || '',
        wealth: daily.wealth || '',
        love: daily.love || '',
        health: daily.health || '',
        luckyNumber: daily.luckyNumber || 8,
        luckyColor: daily.luckyColor || '#c41e3a'
      }
    }

    result.value = parsedResult
  } catch (err) {
    uni.showToast({ title: err.message || '加载详情失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

onLoad((options) => {
  if (options.id) {
    recordId.value = options.id
    fetchRecord(options.id)
  } else {
    uni.showToast({ title: '未能获取测算记录标识', icon: 'none' })
  }
})

const share = async () => {
  if (result.value?.id) {
    try {
      await shareFortuneRecordApi(result.value.id)
    } catch (e) {}
  }
  uni.showToast({ title: '分享链接已复制，去微信发送吧！', icon: 'success' })
}

const saveImage = () => {
  uni.showLoading({ title: '正在合成精美海报...' })
  setTimeout(() => {
    uni.hideLoading()
    uni.showToast({ title: '海报已保存至相册', icon: 'success' })
  }, 1200)
}

const navigateTo = (url) => {
  uni.navigateTo({ url })
}
</script>

<style scoped>
.page-container {
  padding: 30rpx;
  background: var(--bg-color, #f5f0e8);
  min-height: 100vh;
}

.loading-state {
  text-align: center;
  padding: 150rpx 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24rpx;
}

.spinner {
  width: 60rpx;
  height: 60rpx;
  border: 6rpx solid rgba(196, 30, 58, 0.1);
  border-top-color: var(--primary-color, #c41e3a);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  font-size: 28rpx;
  color: var(--text-secondary, #999);
}

.result-card {
  background: var(--card-bg, #fff);
  border-radius: 20rpx;
  overflow: hidden;
  margin-bottom: 30rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.05);
}

.card-header {
  background: linear-gradient(135deg, var(--primary-color, #c41e3a), #e74c3c);
  padding: 30rpx;
  color: #fff;
}

.result-type {
  font-size: 38rpx;
  font-weight: bold;
  display: block;
}

.result-time {
  font-size: 24rpx;
  opacity: 0.9;
  margin-top: 8rpx;
  display: block;
}

.card-body {
  padding: 30rpx;
}

.rating-section {
  text-align: center;
  margin-bottom: 30rpx;
  padding-bottom: 20rpx;
  border-bottom: 1rpx dashed var(--border-color, #eae5da);
}

.rating-label {
  font-size: 28rpx;
  color: var(--text-primary, #333);
  display: block;
  margin-bottom: 12rpx;
}

.star {
  font-size: 44rpx;
  color: #f39c12;
  margin: 0 4rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: bold;
  color: var(--primary-color, #c41e3a);
  margin-bottom: 16rpx;
  display: block;
  border-left: 6rpx solid var(--primary-color, #c41e3a);
  padding-left: 16rpx;
}

.analysis-section {
  margin-top: 30rpx;
  margin-bottom: 24rpx;
}

.analysis-text {
  font-size: 28rpx;
  color: var(--text-primary, #333);
  line-height: 1.8;
  display: block;
  background: #faf7f2;
  padding: 20rpx;
  border-radius: 12rpx;
  border: 1rpx solid #f0e9dc;
}

/* 八字排盘 */
.bazi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16rpx;
  margin-bottom: 30rpx;
  margin-top: 10rpx;
}

.bazi-item {
  text-align: center;
  padding: 16rpx;
  background: var(--input-bg, #f5f5f5);
  border-radius: 12rpx;
}

.bazi-label {
  font-size: 22rpx;
  color: var(--text-secondary, #999);
  display: block;
}

.bazi-value {
  font-size: 32rpx;
  font-weight: bold;
  color: var(--primary-color, #c41e3a);
  margin-top: 8rpx;
  display: block;
}

/* 五行图表 */
.wuxing-chart {
  padding: 16rpx 0;
  margin-bottom: 24rpx;
}

.wuxing-item {
  display: flex;
  align-items: center;
  margin-bottom: 16rpx;
}

.wuxing-name {
  width: 60rpx;
  font-size: 26rpx;
  color: var(--text-primary, #333);
}

.wuxing-bar {
  flex: 1;
  height: 24rpx;
  background: var(--input-bg, #f5f5f5);
  border-radius: 12rpx;
  margin: 0 16rpx;
  overflow: hidden;
}

.wuxing-fill {
  height: 100%;
  border-radius: 12rpx;
  transition: width 0.5s ease-out;
}

.wuxing-count {
  width: 40rpx;
  font-size: 26rpx;
  color: var(--text-primary, #333);
  text-align: right;
}

/* 塔罗牌列表 */
.tarot-card-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  margin-bottom: 30rpx;
  margin-top: 10rpx;
}

.tarot-card-item {
  background: var(--input-bg, #f9f6f0);
  border-left: 6rpx solid var(--primary-color, #c41e3a);
  padding: 20rpx;
  border-radius: 8rpx;
}

.tarot-card-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8rpx;
}

.tarot-card-name {
  font-size: 28rpx;
  font-weight: bold;
  color: var(--text-primary, #333);
}

.tarot-card-position {
  font-size: 24rpx;
  color: var(--text-secondary, #999);
}

.tarot-card-desc {
  font-size: 26rpx;
  color: var(--text-primary, #555);
  line-height: 1.6;
}

/* 姓名与风水网格 */
.name-info-grid, .fengshui-info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20rpx;
  margin-bottom: 30rpx;
  margin-top: 10rpx;
}

.info-item {
  background: var(--input-bg, #f5f5f5);
  padding: 20rpx;
  border-radius: 12rpx;
  text-align: center;
}

.info-label {
  font-size: 24rpx;
  color: var(--text-secondary, #999);
  display: block;
  margin-bottom: 8rpx;
}

.info-value {
  font-size: 30rpx;
  font-weight: bold;
  color: var(--text-primary, #333);
}

.name-highlight {
  color: var(--primary-color, #c41e3a);
  font-size: 34rpx;
}

/* 面相/手相特征卡片 */
.feature-tag-card {
  background: linear-gradient(135deg, #fdf6ec, #faeccd);
  border: 1rpx solid #f5dab1;
  padding: 24rpx;
  border-radius: 16rpx;
  margin-bottom: 30rpx;
}

.feature-tag-title {
  font-size: 28rpx;
  font-weight: bold;
  color: #b88230;
  display: block;
  margin-bottom: 12rpx;
}

.feature-tag-content {
  font-size: 26rpx;
  color: #666;
  line-height: 1.6;
}

/* 每日运势 */
.daily-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20rpx;
  margin-bottom: 30rpx;
  margin-top: 10rpx;
}

.daily-grid-item {
  background: var(--input-bg, #f9f6f0);
  padding: 20rpx;
  border-radius: 12rpx;
  border: 1rpx solid var(--border-color, #eae5da);
}

.daily-grid-title {
  font-size: 26rpx;
  font-weight: bold;
  color: var(--primary-color, #c41e3a);
  margin-bottom: 10rpx;
  display: block;
}

.daily-grid-desc {
  font-size: 24rpx;
  color: var(--text-primary, #555);
  line-height: 1.5;
}

.lucky-section {
  display: flex;
  justify-content: space-around;
  padding: 20rpx;
  background: var(--input-bg, #f5f5f5);
  border-radius: 12rpx;
  margin-bottom: 24rpx;
}

.lucky-item {
  text-align: center;
}

.lucky-label {
  font-size: 22rpx;
  color: var(--text-secondary, #999);
  display: block;
}

.lucky-color {
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  margin: 8rpx auto;
}

.lucky-value {
  font-size: 32rpx;
  font-weight: bold;
  color: var(--text-primary, #333);
  margin-top: 8rpx;
  display: block;
}

/* 建议与建议项目 */
.advice-section {
  padding: 20rpx;
  background: var(--input-bg, #f5f5f5);
  border-radius: 12rpx;
  margin-top: 20rpx;
}

.advice-title {
  font-size: 28rpx;
  font-weight: bold;
  color: var(--primary-color, #c41e3a);
  margin-bottom: 12rpx;
  display: block;
}

.suggestion-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.suggestion-item {
  font-size: 26rpx;
  color: var(--text-primary, #333);
  line-height: 1.5;
}

/* 操作区域 */
.action-section {
  display: flex;
  gap: 20rpx;
  margin-bottom: 30rpx;
}

.action-btn {
  flex: 1;
  height: 88rpx;
  line-height: 88rpx;
  font-size: 30rpx;
  border-radius: 44rpx;
}

.action-btn.primary {
  background: var(--primary-color, #c41e3a);
  color: #fff;
}

.action-btn.secondary {
  background: var(--card-bg, #fff);
  color: var(--primary-color, #c41e3a);
  border: 2rpx solid var(--primary-color, #c41e3a);
}

.more-section {
  background: var(--card-bg, #fff);
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 30rpx;
}

.more-title {
  font-size: 28rpx;
  font-weight: bold;
  color: var(--text-primary, #333);
  margin-bottom: 16rpx;
  display: block;
}

.more-item {
  display: flex;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 1rpx solid var(--border-color, #f5f5f5);
}

.more-item:last-child {
  border-bottom: none;
}

.more-icon {
  font-size: 36rpx;
  margin-right: 16rpx;
}

.more-name {
  flex: 1;
  font-size: 28rpx;
  color: var(--text-primary, #333);
}

.more-arrow {
  font-size: 28rpx;
  color: var(--text-secondary, #ccc);
}

.disclaimer {
  text-align: center;
  padding: 20rpx;
  font-size: 22rpx;
  color: var(--text-secondary, #999);
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
  font-size: 28rpx;
  color: var(--primary-color, #c41e3a);
  margin-top: 16rpx;
  display: block;
  text-decoration: underline;
}
</style>
