<template>
  <view class="page-container" :class="themeClass">
    <view class="mystic-orb orb-1"></view>
    <view class="mystic-orb orb-2"></view>

    <!-- 星座选择区 -->
    <view class="constellation-selector" v-if="!result && !loading">
      <text class="section-title">✨ 选择您的专属星座 ✨</text>
      <view class="constellation-grid">
        <view 
          class="constellation-item" 
          v-for="item in constellations" 
          :key="item.id"
          :class="{ active: selected === item.id }"
          @click="selectConstellation(item)"
        >
          <text class="constellation-icon">{{ item.icon }}</text>
          <text class="constellation-name">{{ item.name }}</text>
          <text class="constellation-date">{{ item.date }}</text>
        </view>
      </view>
    </view>

    <!-- 绘制连线星盘加载动效 -->
    <view class="constellation-loader" v-if="loading">
      <view class="star-sky">
        <view class="star-dot dot-1"></view>
        <view class="star-dot dot-2"></view>
        <view class="star-dot dot-3"></view>
        <view class="star-dot dot-4"></view>
        <view class="star-dot dot-5"></view>
        <view class="star-dot dot-6"></view>
        <view class="constellation-line line-1"></view>
        <view class="constellation-line line-2"></view>
        <view class="constellation-line line-3"></view>
        <view class="constellation-line line-4"></view>
        <view class="constellation-line line-5"></view>
      </view>
      <text class="loader-text">正在勾勒星座星轨，洞察天机...</text>
    </view>

    <!-- 运势结果展示 -->
    <view class="result-section" v-if="result && !loading">
      <view class="result-header">
        <text class="result-title">🌟 {{ result.name }}今日运势详解</text>
        <view class="result-rating">
          <text v-for="i in 5" :key="i" class="star">{{ i <= result.rating ? '★' : '☆' }}</text>
        </view>
      </view>

      <view class="result-card">
        <view class="result-item">
          <text class="result-label">综合运势</text>
          <text class="result-value">{{ result.overall }}</text>
        </view>
        <view class="result-item">
          <text class="result-label">爱情运势</text>
          <text class="result-value">{{ result.love }}</text>
        </view>
        <view class="result-item">
          <text class="result-label">事业运势</text>
          <text class="result-value">{{ result.career }}</text>
        </view>
        <view class="result-item">
          <text class="result-label">财运运势</text>
          <text class="result-value">{{ result.wealth }}</text>
        </view>
        <view class="result-item">
          <text class="result-label">健康运势</text>
          <text class="result-value">{{ result.health }}</text>
        </view>
      </view>

      <view class="lucky-section">
        <view class="lucky-item">
          <text class="lucky-label">今日幸运色</text>
          <view class="lucky-color" :style="{ background: result.luckyColor }"></view>
        </view>
        <view class="lucky-item">
          <text class="lucky-label">幸运数字</text>
          <text class="lucky-value">{{ result.luckyNumber }}</text>
        </view>
        <view class="lucky-item">
          <text class="lucky-label">速配星座</text>
          <text class="lucky-value">{{ result.match }}</text>
        </view>
      </view>

      <!-- 缘分速配百分比星轨仪表盘 -->
      <view class="compatibility-card">
        <view class="compat-header">
          <text class="compat-title">💘 缘分契合度指数</text>
        </view>
        <view class="compat-body">
          <view class="compat-zodiac">
            <text class="zodiac-label">您的星座</text>
            <text class="zodiac-icon">{{ getZodiacIcon(selected) }}</text>
          </view>
          
          <view class="compat-meter">
            <view class="compat-ring">
              <view class="compat-ring-fill" :style="{ width: compatScore + '%' }"></view>
              <text class="compat-score-text">{{ compatScore }}%</text>
            </view>
            <text class="compat-desc">今日与【{{ result.match }}】气场最匹配</text>
          </view>
          
          <view class="compat-zodiac">
            <text class="zodiac-label">速配星座</text>
            <text class="zodiac-icon">{{ getZodiacIconByName(result.match) }}</text>
          </view>
        </view>
      </view>

      <view class="advice-section">
        <text class="advice-title">今日行事指南</text>
        <text class="advice-text">{{ result.advice }}</text>
      </view>

      <view class="action-btns">
        <button class="action-btn share" @click="share">分享与保存海报</button>
        <button class="action-btn reset-btn" @click="reset">重新选择星座</button>
      </view>
    </view>

    <view class="disclaimer">
      <text>本结果基于占星逻辑推算，仅供娱乐参考</text>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { getConstellationFortuneApi } from '@/api/fortune'

const selected = ref(null)
const result = ref(null)
const loading = ref(false)
const compatScore = ref(90)

const constellations = [
  { id: 'aries', name: '白羊座', icon: '♈', date: '3.21-4.19' },
  { id: 'taurus', name: '金牛座', icon: '♉', date: '4.20-5.20' },
  { id: 'gemini', name: '双子座', icon: '♊', date: '5.21-6.21' },
  { id: 'cancer', name: '巨蟹座', icon: '♋', date: '6.22-7.22' },
  { id: 'leo', name: '狮子座', icon: '♌', date: '7.23-8.22' },
  { id: 'virgo', name: '处女座', icon: '♍', date: '8.23-9.22' },
  { id: 'libra', name: '天秤座', icon: '♎', date: '9.23-10.23' },
  { id: 'scorpio', name: '天蝎座', icon: '♏', date: '10.24-11.22' },
  { id: 'sagittarius', name: '射手座', icon: '♐', date: '11.23-12.21' },
  { id: 'capricorn', name: '摩羯座', icon: '♑', date: '12.22-1.19' },
  { id: 'aquarius', name: '水瓶座', icon: '♒', date: '1.20-2.18' },
  { id: 'pisces', name: '双鱼座', icon: '♓', date: '2.19-3.20' }
]

const getZodiacIcon = (id) => {
  const z = constellations.find(c => c.id === id)
  return z ? z.icon : '✨'
}

const getZodiacIconByName = (name) => {
  const z = constellations.find(c => c.name === name)
  return z ? z.icon : '✨'
}

const selectConstellation = (item) => {
  selected.value = item.id
  generateResult(item)
}

const generateResult = async (item) => {
  loading.value = true
  result.value = null
  
  // 模拟星轨连线绘制的仪式感延时
  await new Promise(resolve => setTimeout(resolve, 1500))

  try {
    const res = await getConstellationFortuneApi(item.id)
    const data = res.data
    
    // 依据两个星座的字符和算出一个固定的契合指数
    const scoreSeed = item.name.charCodeAt(0) + (data.match || '天秤座').charCodeAt(0)
    compatScore.value = 80 + (scoreSeed % 19)

    result.value = {
      name: data.name || item.name,
      rating: data.rating || 4,
      overall: data.overall || '今日综合运势平稳。',
      love: data.love || '感情运势平稳。',
      career: data.career || '事业运势良好。',
      wealth: data.wealth || '财运平稳。',
      health: data.health || '健康运势良好。',
      luckyColor: data.luckyColor || '#e74c3c',
      luckyNumber: data.luckyNumber || 7,
      match: data.match || '天秤座',
      advice: data.advice || '保持积极心态，把握机会。'
    }
  } catch (err) {
    uni.showToast({ title: err.message || '获取运势失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

const share = () => {
  if (!result.value) return
  const query = {
    type: 'constellation',
    title: `${result.value.name}今日运势详解`,
    name: '星曜信士',
    score: result.value.rating * 20,
    analysis: `【运势星盘】\n综合运势: ${result.value.overall}\n感情运势: ${result.value.love}\n事业运势: ${result.value.career}\n财运运势: ${result.value.wealth}\n健康运势: ${result.value.health}\n\n【速配开运】\n幸运数字: ${result.value.luckyNumber}\n速配星座: ${result.value.match}\n\n【行事批语】\n${result.value.advice}`
  }
  uni.navigateTo({
    url: `/pages/share/index?type=${query.type}&title=${encodeURIComponent(query.title)}&name=${encodeURIComponent(query.name)}&score=${query.score}&analysis=${encodeURIComponent(query.analysis)}`
  })
}

const reset = () => {
  result.value = null
  selected.value = null
}
</script>

<style scoped>
.page-container {
  padding: 30rpx;
  background: var(--bg-color, #f8f8f8);
  min-height: 100vh;
  color: var(--text-color, #333333);
  position: relative;
  overflow-x: hidden;
}
.page-container.theme-dark {
  background: linear-gradient(135deg, #0e0b16, #161224, #211c38);
  color: #e2dcf0;
}

/* 装饰性神秘背景球 */
.mystic-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(120rpx);
  opacity: 0.15;
  pointer-events: none;
  z-index: 0;
}
.orb-1 {
  width: 500rpx;
  height: 500rpx;
  background: var(--primary-color, #9b59b6);
  top: -100rpx;
  left: -200rpx;
}
.orb-2 {
  width: 600rpx;
  height: 600rpx;
  background: var(--secondary-color, #3498db);
  bottom: -100rpx;
  right: -250rpx;
}

.section-title {
  font-size: 34rpx;
  font-weight: bold;
  color: var(--primary-color, #9b59b6);
  margin-bottom: 30rpx;
  display: block;
  text-align: center;
  position: relative;
  z-index: 1;
}
.theme-dark .section-title {
  color: #e5c158;
  text-shadow: 0 2rpx 10rpx rgba(229, 193, 88, 0.2);
}

/* 星座网格 */
.constellation-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20rpx;
  margin-bottom: 30rpx;
  position: relative;
  z-index: 1;
}

.constellation-item {
  background: var(--card-bg, #fff);
  border: 2rpx solid var(--border-color, #eee);
  border-radius: 20rpx;
  padding: 24rpx 10rpx;
  text-align: center;
  box-shadow: 0 4rpx 16rpx var(--card-shadow, rgba(0,0,0,0.05));
  transition: all 0.2s;
}
.theme-dark .constellation-item {
  background: rgba(30, 24, 52, 0.6);
  border: 2rpx solid #4a3e72;
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.2);
}

.constellation-item.active {
  background: var(--bg-secondary, #f0f0f5);
  border-color: var(--primary-color, #9b59b6);
  box-shadow: 0 0 15rpx var(--card-shadow, rgba(155, 89, 182, 0.2));
}
.theme-dark .constellation-item.active {
  background: rgba(229, 193, 88, 0.25);
  border-color: #e5c158;
  box-shadow: 0 0 15rpx rgba(229, 193, 88, 0.4);
}

.constellation-icon {
  font-size: 64rpx;
  display: block;
  filter: drop-shadow(0 0 10rpx var(--card-shadow, rgba(155, 89, 182, 0.2)));
}
.theme-dark .constellation-icon {
  filter: drop-shadow(0 0 10rpx rgba(229, 193, 88, 0.4));
}

.constellation-name {
  font-size: 28rpx;
  font-weight: bold;
  margin-top: 12rpx;
  display: block;
  color: var(--text-color, #333333);
}
.theme-dark .constellation-name {
  color: #f1f0f5;
}

.constellation-date {
  font-size: 20rpx;
  color: var(--text-secondary, #666666);
  margin-top: 6rpx;
  display: block;
}
.theme-dark .constellation-date {
  color: #a69ebd;
}



/* 连线绘制加载动效 */
.constellation-loader {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 150rpx 0;
  gap: 40rpx;
  position: relative;
  z-index: 1;
}

.star-sky {
  width: 200rpx;
  height: 200rpx;
  position: relative;
}

.star-dot {
  position: absolute;
  width: 12rpx;
  height: 12rpx;
  background: var(--primary-color, #9b59b6);
  border-radius: 50%;
  box-shadow: 0 0 15rpx var(--primary-color, #9b59b6);
  animation: twinkle 1s infinite alternate;
}
.theme-dark .star-dot {
  background: #e5c158;
  box-shadow: 0 0 15rpx #e5c158;
}

.dot-1 { top: 20rpx; left: 100rpx; }
.dot-2 { top: 80rpx; left: 40rpx; }
.dot-3 { top: 80rpx; left: 160rpx; }
.dot-4 { top: 140rpx; left: 60rpx; }
.dot-5 { top: 140rpx; left: 140rpx; }
.dot-6 { top: 180rpx; left: 100rpx; }

.constellation-line {
  position: absolute;
  background: var(--primary-light, #bb8fce);
  height: 2rpx;
  transform-origin: left center;
  animation: drawLine 1.2s cubic-bezier(0.25, 0.8, 0.25, 1) forwards;
}
.theme-dark .constellation-line {
  background: rgba(229, 193, 88, 0.5);
}

.line-1 { top: 26rpx; left: 106rpx; width: 70rpx; transform: rotate(135deg); }
.line-2 { top: 26rpx; left: 106rpx; width: 70rpx; transform: rotate(45deg); }
.line-3 { top: 86rpx; left: 46rpx; width: 100rpx; transform: rotate(37deg); }
.line-4 { top: 86rpx; left: 166rpx; width: 100rpx; transform: rotate(143deg); }
.line-5 { top: 146rpx; left: 66rpx; width: 85rpx; transform: rotate(-30deg); }

@keyframes drawLine {
  from { width: 0; }
}
@keyframes twinkle {
  from { transform: scale(0.8); opacity: 0.5; }
  to { transform: scale(1.2); opacity: 1; }
}

.loader-text {
  font-size: 26rpx;
  color: var(--text-secondary, #666);
}
.theme-dark .loader-text {
  color: #a69ebd;
}

/* 运势结果 */
.result-section {
  background: var(--card-bg, #fff);
  border: 2rpx solid var(--border-color, #eee);
  border-radius: 24rpx;
  padding: 30rpx;
  margin-bottom: 40rpx;
  box-shadow: 0 8rpx 32rpx var(--card-shadow, rgba(0, 0, 0, 0.05));
  position: relative;
  z-index: 1;
}
.theme-dark .result-section {
  background: rgba(30, 24, 52, 0.6);
  border: 2rpx solid #4a3e72;
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.3);
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30rpx;
  border-bottom: 2rpx solid var(--border-color, #eee);
  padding-bottom: 20rpx;
}
.theme-dark .result-header {
  border-bottom: 2rpx solid #322b4f;
}

.result-title {
  font-size: 32rpx;
  font-weight: bold;
  color: var(--primary-color, #9b59b6);
}
.theme-dark .result-title {
  color: #e5c158;
}

.star {
  font-size: 36rpx;
  color: #f39c12;
  margin-left: 2rpx;
}

.result-card {
  margin-bottom: 30rpx;
}

.result-item {
  display: flex;
  justify-content: space-between;
  padding: 20rpx 0;
  border-bottom: 1rpx solid var(--border-color, #eee);
}
.theme-dark .result-item {
  border-bottom: 1rpx solid #322b4f;
}

.result-label {
  font-size: 28rpx;
  color: var(--text-secondary, #666);
}
.theme-dark .result-label {
  color: #a69ebd;
}

.result-value {
  font-size: 28rpx;
  color: var(--text-color, #333);
  flex: 1;
  text-align: right;
  padding-left: 30rpx;
}
.theme-dark .result-value {
  color: #e2dcf0;
}

.lucky-section {
  display: flex;
  justify-content: space-around;
  padding: 24rpx 0;
  background: var(--bg-secondary, #fafafa);
  border: 1rpx solid var(--border-color, #eee);
  border-radius: 16rpx;
  margin-bottom: 30rpx;
}
.theme-dark .lucky-section {
  background: rgba(14, 11, 22, 0.4);
  border: 1rpx solid #322b4f;
}

.lucky-item {
  text-align: center;
}

.lucky-label {
  font-size: 22rpx;
  color: var(--text-secondary, #666);
  display: block;
}
.theme-dark .lucky-label {
  color: #a69ebd;
}

.lucky-color {
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  margin: 10rpx auto 6rpx;
  box-shadow: 0 0 10rpx var(--card-shadow, rgba(0,0,0,0.1));
}

.lucky-value {
  font-size: 28rpx;
  font-weight: bold;
  color: var(--primary-color, #9b59b6);
  margin-top: 10rpx;
  display: block;
}
.theme-dark .lucky-value {
  color: #e5c158;
}

/* 缘分速配百分比星轨仪表盘 */
.compatibility-card {
  background: var(--bg-secondary, #fafafa);
  border: 1rpx solid var(--border-color, #eee);
  border-radius: 20rpx;
  padding: 24rpx;
  margin-bottom: 30rpx;
}
.theme-dark .compatibility-card {
  background: rgba(14, 11, 22, 0.4);
  border: 1rpx solid rgba(229, 193, 88, 0.3);
}

.compat-header {
  margin-bottom: 16rpx;
}

.compat-title {
  font-size: 26rpx;
  font-weight: bold;
  color: var(--primary-color, #9b59b6);
  display: block;
}
.theme-dark .compat-title {
  color: #e5c158;
}

.compat-body {
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 10rpx 0;
}

.compat-zodiac {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
}

.zodiac-label {
  font-size: 20rpx;
  color: var(--text-secondary, #666666);
}
.theme-dark .zodiac-label {
  color: #a69ebd;
}

.zodiac-icon {
  font-size: 54rpx;
  filter: drop-shadow(0 0 10rpx var(--card-shadow, rgba(155, 89, 182, 0.1)));
}
.theme-dark .zodiac-icon {
  filter: drop-shadow(0 0 10rpx rgba(229, 193, 88, 0.5));
}

.compat-meter {
  flex: 1;
  margin: 0 30rpx;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
}

.compat-ring {
  width: 100%;
  height: 36rpx;
  background: var(--bg-color, #f0f0f5);
  border-radius: 18rpx;
  position: relative;
  overflow: hidden;
  border: 1rpx solid var(--border-color, #eee);
  box-shadow: inset 0 2rpx 6rpx var(--card-shadow, rgba(0,0,0,0.05));
}
.theme-dark .compat-ring {
  background: rgba(255, 255, 255, 0.05);
  border: 1rpx solid rgba(229, 193, 88, 0.2);
  box-shadow: inset 0 2rpx 6rpx rgba(0,0,0,0.5);
}

.compat-ring-fill {
  height: 100%;
  background: linear-gradient(90deg, #ff758c, #ff7eb3);
  border-radius: 18rpx;
  box-shadow: 0 0 10rpx #ff758c;
  transition: width 1s ease-in-out;
}

.compat-score-text {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  line-height: 36rpx;
  font-size: 22rpx;
  font-weight: bold;
  color: #fff;
  text-shadow: 0 2rpx 4rpx rgba(0,0,0,0.5);
}

.compat-desc {
  font-size: 24rpx;
  color: var(--text-secondary, #666666);
}
.theme-dark .compat-desc {
  color: #a69ebd;
}

/* 建议部分 */
.advice-section {
  padding: 24rpx;
  background: var(--bg-secondary, #fafafa);
  border: 1rpx solid var(--border-color, #eee);
  border-radius: 16rpx;
  margin-bottom: 30rpx;
}
.theme-dark .advice-section {
  background: rgba(14, 11, 22, 0.4);
  border: 1rpx solid #322b4f;
}

.advice-title {
  font-size: 28rpx;
  font-weight: bold;
  color: var(--primary-color, #9b59b6);
  margin-bottom: 12rpx;
  display: block;
}
.theme-dark .advice-title {
  color: #e5c158;
}

.advice-text {
  font-size: 26rpx;
  color: var(--text-color, #333);
  line-height: 1.6;
}
.theme-dark .advice-text {
  color: #e2dcf0;
}

/* 重置与分享按钮组 */
.action-btns {
  display: flex;
  gap: 20rpx;
  margin-top: 30rpx;
  width: 100%;
}

.action-btn {
  flex: 1;
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 44rpx;
  font-size: 28rpx;
  border: none;
  text-align: center;
}

.action-btn.share {
  background: var(--primary-color, #9b59b6);
  color: #fff;
}

.theme-dark .action-btn.share {
  background: linear-gradient(135deg, #a887e6, #7952c4);
  color: #fff;
}

.action-btn.reset-btn {
  background: var(--bg-secondary, #f5f5f5);
  color: var(--text-color, #333);
  border: 2rpx solid var(--border-color, #eee);
}

.theme-dark .action-btn.reset-btn {
  background: rgba(50, 40, 85, 0.5);
  color: #e2dcf0;
  border: 2rpx solid #4a3e72;
}

.action-btn.reset-btn:active {
  background: var(--border-light, #eee);
}

.theme-dark .action-btn.reset-btn:active {
  background: rgba(70, 56, 119, 0.7);
}

.disclaimer {
  text-align: center;
  padding: 20rpx;
  font-size: 22rpx;
  color: var(--text-light, #bdc3c7);
  position: relative;
  z-index: 1;
}
.theme-dark .disclaimer {
  color: #887fa3;
}
</style>
