<template>
  <view class="page-container" :class="themeClass">
    <view class="mystic-orb orb-1"></view>
    <view class="mystic-orb orb-2"></view>

    <!-- 朝向格局表单 -->
    <view class="form-section" v-if="!result && !loading">
      <text class="section-title">✨ 家宅气场堪舆 ✨</text>
      
      <!-- 常用风水格局 -->
      <view class="memory-section" v-if="commonFengshuiList && commonFengshuiList.length > 0">
        <text class="memory-label">💡 常用格局一键填入：</text>
        <view class="memory-list">
          <view class="memory-chip" v-for="(item, index) in commonFengshuiList" :key="index" @click="fillForm(item)">
            <text class="chip-text">{{ item.selectedHouseType }} · {{ item.selectedDirection.split(' ')[0] }}</text>
            <text class="chip-close" @click.stop="deleteMemory(index)">×</text>
          </view>
        </view>
      </view>

      <view class="form-item">
        <text class="label">房屋格局/类型</text>
        <picker :range="houseTypes" @change="onHouseTypeChange">
          <view class="picker-value">{{ selectedHouseType || '请选择房屋类型' }}</view>
        </picker>
      </view>

      <view class="form-item">
        <text class="label">房屋坐向朝向</text>
        <picker :range="directions" @change="onDirectionChange">
          <view class="picker-value">{{ selectedDirection || '请选择家宅朝向方位' }}</view>
        </picker>
      </view>

      <view class="form-item">
        <text class="label">空间主要用途</text>
        <view class="gender-group">
          <view class="gender-btn" :class="{ active: purpose === 'live' }" @click="purpose = 'live'">居家休养</view>
          <view class="gender-btn" :class="{ active: purpose === 'office' }" @click="purpose = 'office'">求财办公</view>
          <view class="gender-btn" :class="{ active: purpose === 'shop' }" @click="purpose = 'shop'">商号开张</view>
        </view>
      </view>
    </view>

    <button class="submit-btn" @click="analyze" :disabled="!canSubmit" v-if="!result && !loading">
      拨动罗盘·开启勘舆
    </button>

    <!-- 罗盘寻龙定位动画状态 -->
    <view class="calculating-state" v-if="loading">
      <view class="luopan-box">
        <view class="luopan-plate" :style="{ transform: 'rotate(' + compassRotation + 'deg)' }">
          <text class="luopan-bagua">☯️</text>
          <text class="luopan-ring ring-1">乾 坎 艮 震</text>
          <text class="luopan-ring ring-2">巽 离 坤 兑</text>
        </view>
        <view class="luopan-needle"></view>
      </view>
      <text class="calculating-text">罗盘飞针寻龙定位，正在排布九宫气场...</text>
    </view>

    <!-- 堪舆结果展示 -->
    <view class="result-section" v-if="result && !loading">
      <text class="section-title">📜 阳宅九宫气场天书 📜</text>
      
      <view class="rating-card">
        <text class="rating-label">气场福泽评级</text>
        <view class="rating-stars">
          <text v-for="i in 5" :key="i" class="star">{{ i <= result.rating ? '★' : '☆' }}</text>
        </view>
      </view>

      <!-- 九宫飞星空间吉凶格位图 -->
      <view class="analysis-card">
        <text class="card-title">☯️ 家宅九宫飞星格局图</text>
        <text class="palace-intro">根据您的朝向【{{ selectedDirection }}】，排定如下吉凶气场：</text>
        
        <view class="palace-grid">
          <view 
            class="palace-cell" 
            v-for="(cell, index) in result.ninePalaceGrid" 
            :key="index"
            :class="cell.type"
          >
            <text class="cell-name">{{ cell.name }}</text>
            <text class="cell-star">{{ cell.star }}</text>
            <text class="cell-role">{{ cell.role }}</text>
            <text class="cell-advice">{{ cell.advice }}</text>
          </view>
        </view>
      </view>

      <view class="analysis-card">
        <text class="card-title">📖 山水气运批注</text>
        <text class="analysis-text">{{ result.directionAnalysis }}</text>
      </view>

      <view class="analysis-card" v-if="result.suggestions && result.suggestions.length > 0">
        <text class="card-title">💡 风水调理调侯策</text>
        <view class="suggestion-list">
          <view class="suggestion-item" v-for="(item, index) in result.suggestions" :key="index">
            <text class="suggestion-icon">{{ item.icon }}</text>
            <text class="suggestion-text">{{ item.text }}</text>
          </view>
        </view>
      </view>

      <view class="action-btns">
        <button class="action-btn share" @click="share">分享与保存海报</button>
        <button class="action-btn reset-btn" @click="reset">重新推演风水</button>
      </view>
    </view>

    <view class="disclaimer">
      <text>风水学说仅供布局陈设参考，请理性对待</text>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { fengshuiAnalysisApi } from '@/api/fortune'
import { useUserStore } from '@/store/user'

const userStore = useUserStore()

const houseTypes = ['公寓住宅', '独栋别墅', '四合平房', '商务写字楼', '临街商铺']
const directions = ['坐北朝南 (坎宅)', '坐南朝北 (离宅)', '坐东朝西 (震宅)', '坐西朝东 (兑宅)', '坐东北朝西南 (艮宅)', '坐西南朝东北 (坤宅)', '坐西北朝东南 (乾宅)', '坐东南朝西北 (巽宅)']

const selectedHouseType = ref('')
const selectedDirection = ref('')
const purpose = ref('live')
const result = ref(null)
const loading = ref(false)

const commonFengshuiList = ref([])

onMounted(() => {
  // 读取上次输入
  const lastInput = uni.getStorageSync('last_fengshui_input')
  if (lastInput) {
    selectedHouseType.value = lastInput.selectedHouseType || ''
    selectedDirection.value = lastInput.selectedDirection || ''
    purpose.value = lastInput.purpose || 'live'
  }

  // 读取常用列表
  const common = uni.getStorageSync('common_fengshui_inputs')
  if (common) {
    commonFengshuiList.value = common
  }
})

const fillForm = (item) => {
  selectedHouseType.value = item.selectedHouseType
  selectedDirection.value = item.selectedDirection
  purpose.value = item.purpose || 'live'
  uni.showToast({ title: '已回填格局', icon: 'none' })
}

const deleteMemory = (index) => {
  commonFengshuiList.value.splice(index, 1)
  uni.setStorageSync('common_fengshui_inputs', commonFengshuiList.value)
  uni.showToast({ title: '已删除常用', icon: 'none' })
}

// 罗盘偏转度数
const compassRotation = ref(0)

const directionAngles = {
  '北朝南': 180,
  '南朝北': 0,
  '东朝西': 270,
  '西朝东': 90,
  '东北朝西南': 225,
  '西南朝东北': 45,
  '西北朝东南': 135,
  '东南朝西北': 315
}

const canSubmit = computed(() => selectedHouseType.value && selectedDirection.value && !loading.value)

const onHouseTypeChange = (e) => {
  selectedHouseType.value = houseTypes[e.detail.value]
}

const onDirectionChange = (e) => {
  selectedDirection.value = directions[e.detail.value]
}

const getNinePalaceData = (dir) => {
  const isSouth = dir.includes('南')
  const isEast = dir.includes('东')
  const isWest = dir.includes('西')
  const isNorth = dir.includes('北')

  return [
    { name: '巽宫 (东南)', star: '四绿木星', role: '文昌位', type: 'good', advice: '书台宜置，可摆文昌塔催旺学业。' },
    { name: '离宫 (正南)', star: '九紫火星', role: isSouth ? '煞气位' : '喜庆位', type: isSouth ? 'bad' : 'good', advice: isSouth ? '正值岁破，宜挂金铃化煞，忌动土。' : '宜挂中国结，开窗迎光，催旺姻缘。' },
    { name: '坤宫 (西南)', star: '二黑土星', role: '病符位', type: 'bad', advice: '主疾病晦气，忌红黄二色，宜置铜葫芦。' },
    { name: '震宫 (正东)', star: '三碧木星', role: isEast ? '是非位' : '官禄位', type: isEast ? 'bad' : 'good', advice: isEast ? '易招口舌官非，宜铺红色地毯化解。' : '利文官晋升，宜摆放金属饰物。' },
    { name: '中宫 (中央)', star: '五黄土星', role: '五黄大煞', type: 'bad', advice: '极凶之位，忌动土杂乱，宜置安忍水或六帝钱。' },
    { name: '兑宫 (正西)', star: '七赤金星', role: isWest ? '旺财位' : '偏财位', type: 'good', advice: '宜置金蟾、鱼缸或流水盆景催财。' },
    { name: '艮宫 (东北)', star: '八白土星', role: '正财星', type: 'good', advice: '当运财位，宜保持整洁明亮，置聚宝盆。' },
    { name: '坎宫 (正北)', star: '一白水星', role: isNorth ? '桃花位' : '人缘位', type: 'good', advice: '主社交财缘，宜插绿植鲜花，忌堆放杂物。' },
    { name: '乾宫 (西北)', star: '六白金星', role: '偏官驿马', type: 'good', advice: '利武职变动出差，宜摆铜马，忌堆放鞋履。' }
  ]
}

const analyze = async () => {
  if (!canSubmit.value) return
  loading.value = true
  
  // 模拟风水寻龙定穴动画延迟
  const directionKey = selectedDirection.value.split(' ')[0].replace('坐', '').replace('朝', '')
  const targetAngle = directionAngles[directionKey] || 0
  
  // 罗盘高速转动 4 圈后，停在指向偏角
  compassRotation.value = 1440 - targetAngle 
  
  await new Promise(resolve => setTimeout(resolve, 2000))

  try {
    // 自动登录
    if (!userStore.isLoggedIn) {
      const loginRes = await userStore.login()
      if (!loginRes.success) {
        throw new Error(loginRes.message || '快捷登录失败')
      }
    }

    const res = await fengshuiAnalysisApi({
      direction: directionKey,
      layout: selectedHouseType.value
    })
    
    if (res.code !== 0) {
      throw new Error(res.message || '分析失败')
    }

    // 保存至本地存储 (上一次使用与常用列表)
    const currentInput = {
      selectedHouseType: selectedHouseType.value,
      selectedDirection: selectedDirection.value,
      purpose: purpose.value
    }
    uni.setStorageSync('last_fengshui_input', currentInput)

    // 更新常用列表 (去重并限制最近3个)
    const list = [...commonFengshuiList.value]
    const existIndex = list.findIndex(item => 
      item.selectedHouseType === currentInput.selectedHouseType && 
      item.selectedDirection === currentInput.selectedDirection &&
      item.purpose === currentInput.purpose
    )
    if (existIndex !== -1) {
      list.splice(existIndex, 1)
    }
    list.unshift(currentInput)
    if (list.length > 3) {
      list.pop()
    }
    commonFengshuiList.value = list
    uni.setStorageSync('common_fengshui_inputs', list)

    const data = res.data
    const suggestions = (data.suggestions || []).map(s => {
      let icon = '💡'
      if (s.includes('财') || s.includes('金')) icon = '💰'
      else if (s.includes('花') || s.includes('木') || s.includes('绿')) icon = '🌿'
      else if (s.includes('水') || s.includes('鱼')) icon = '💧'
      else if (s.includes('红') || s.includes('火') || s.includes('灯')) icon = '🔥'
      return { icon, text: s }
    })

    result.value = {
      rating: Math.max(1, Math.min(5, Math.ceil((data.score || 80) / 20))),
      directionAnalysis: data.analysis || '分析完成',
      suggestions: suggestions.length > 0 ? suggestions : [
        { icon: '🌿', text: '家宅东南角宜摆放宽叶常绿植物催旺文昌。' },
        { icon: '💰', text: '正财位位于东北，宜放置聚宝盆积聚财源。' }
      ],
      ninePalaceGrid: getNinePalaceData(selectedDirection.value)
    }

    await userStore.fetchUserInfo()
  } catch (err) {
    uni.showToast({ title: err.message || '堪舆失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

const share = () => {
  if (!result.value) return
  const query = {
    type: 'fengshui',
    title: '家宅八卦堪舆法卷',
    name: '本命信士',
    score: result.value.rating * 20,
    analysis: `【家宅坐向】\n${selectedHouseType.value} · ${selectedDirection.value}\n\n【山水气运批注】\n${result.value.directionAnalysis}\n\n【调理开运建议】\n${result.value.suggestions.map(s => s.icon + s.text).join('\n')}`
  }
  uni.navigateTo({
    url: `/pages/share/index?type=${query.type}&title=${encodeURIComponent(query.title)}&name=${encodeURIComponent(query.name)}&score=${query.score}&analysis=${encodeURIComponent(query.analysis)}`
  })
}

const reset = () => {
  result.value = null
  selectedHouseType.value = ''
  selectedDirection.value = ''
  compassRotation.value = 0
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
.page-container.theme-chinese {
  background: linear-gradient(135deg, #161012, #241416, #161012);
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
  background: var(--primary-color, #c41e3a);
  top: -100rpx;
  left: -200rpx;
}
.theme-chinese .orb-1 {
  background: #c41e3a;
}
.orb-2 {
  width: 600rpx;
  height: 600rpx;
  background: var(--secondary-color, #aa7c11);
  bottom: -100rpx;
  right: -250rpx;
}
.theme-chinese .orb-2 {
  background: #aa7c11;
}

.section-title {
  font-size: 34rpx;
  font-weight: bold;
  color: var(--primary-color, #c41e3a);
  margin-bottom: 40rpx;
  display: block;
  text-align: center;
  position: relative;
  z-index: 1;
}
.theme-chinese .section-title {
  color: #e5c158;
  text-shadow: 0 2rpx 10rpx rgba(229, 193, 88, 0.2);
}

/* 输入表单 */
.form-section {
  background: var(--card-bg, #fff);
  border: 2rpx solid var(--border-color, #eee);
  border-radius: 24rpx;
  padding: 40rpx 30rpx;
  margin-bottom: 40rpx;
  position: relative;
  z-index: 1;
  box-shadow: 0 8rpx 32rpx var(--card-shadow, rgba(0, 0, 0, 0.05));
}
.theme-chinese .form-section {
  background: rgba(30, 20, 22, 0.6);
  border: 2rpx solid #6b1d28;
  backdrop-filter: blur(10px);
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.3);
}

.form-item {
  margin-bottom: 30rpx;
}

.label {
  font-size: 28rpx;
  color: var(--text-color, #333);
  margin-bottom: 16rpx;
  display: block;
  font-weight: 500;
}
.theme-chinese .label {
  color: #e5c158;
}

.picker-value {
  padding: 24rpx;
  background: var(--bg-color, #f8f8f8);
  border: 1rpx solid var(--border-color, #eee);
  border-radius: 16rpx;
  font-size: 28rpx;
  color: var(--text-color, #333);
}
.theme-chinese .picker-value {
  background: rgba(14, 11, 12, 0.6);
  border: 1rpx solid #5a353b;
  color: #fff;
}

.gender-group {
  display: flex;
  gap: 16rpx;
}

.gender-btn {
  flex: 1;
  padding: 24rpx;
  text-align: center;
  background: var(--bg-color, #f8f8f8);
  border: 1rpx solid var(--border-color, #eee);
  border-radius: 16rpx;
  font-size: 28rpx;
  color: var(--text-secondary, #666);
  transition: all 0.2s;
}
.theme-chinese .gender-btn {
  background: rgba(14, 11, 12, 0.6);
  border: 1rpx solid #5a353b;
  color: #a69ebd;
}

.gender-btn.active {
  background: var(--primary-color, #c41e3a);
  border-color: var(--primary-color, #c41e3a);
  color: #fff;
}
.theme-chinese .gender-btn.active {
  background: rgba(196, 30, 58, 0.2);
  border-color: #c41e3a;
  color: #fff;
  box-shadow: 0 0 15rpx rgba(196, 30, 58, 0.3);
}

.submit-btn {
  width: 100%;
  height: 96rpx;
  line-height: 96rpx;
  background: var(--primary-color, #c41e3a);
  color: #fff;
  font-size: 32rpx;
  font-weight: bold;
  border-radius: 48rpx;
  box-shadow: 0 6rpx 20rpx var(--card-shadow, rgba(196, 30, 58, 0.2));
  position: relative;
  z-index: 1;
  border: none;
}
.theme-chinese .submit-btn {
  background: linear-gradient(135deg, #c41e3a, #990f26);
  box-shadow: 0 6rpx 20rpx rgba(196, 30, 58, 0.4);
}

.submit-btn[disabled] {
  opacity: 0.5;
  box-shadow: none;
}
.theme-chinese .submit-btn[disabled] {
  background: #3a2a2c;
  color: #726062;
  box-shadow: none;
  opacity: 0.6;
}

/* 罗盘寻龙动画 */
.calculating-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 100rpx 0;
  gap: 40rpx;
  position: relative;
  z-index: 1;
}

.luopan-box {
  width: 320rpx;
  height: 320rpx;
  position: relative;
  margin: 30rpx auto;
}

.luopan-plate {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: radial-gradient(circle, #8a640f 15%, #aa7c11 40%, #5c430a 75%, #1e1503 100%);
  border: 8rpx double #e5c158;
  position: relative;
  transition: transform 2s cubic-bezier(0.2, 0.8, 0.2, 1);
  box-shadow: 0 0 35rpx rgba(229, 193, 88, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.luopan-bagua {
  font-size: 72rpx;
  color: #e5c158;
  filter: drop-shadow(0 0 8rpx rgba(229, 193, 88, 0.8));
}

.luopan-ring {
  position: absolute;
  color: rgba(229, 193, 88, 0.7);
  font-size: 16rpx;
  font-weight: bold;
  letter-spacing: 24rpx;
  width: 90%;
  height: 90%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 1rpx dashed rgba(229, 193, 88, 0.3);
}

.ring-1 {
  transform: rotate(0deg);
}

.ring-2 {
  transform: rotate(45deg);
  width: 75%;
  height: 75%;
  font-size: 14rpx;
  letter-spacing: 18rpx;
}

.luopan-needle {
  position: absolute;
  top: 10%;
  left: 50%;
  width: 4rpx;
  height: 80%;
  background: #c41e3a;
  transform: translateX(-50%);
  box-shadow: 0 0 10rpx rgba(196, 30, 58, 0.8);
  pointer-events: none;
  z-index: 5;
}

.luopan-needle::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 20rpx;
  height: 20rpx;
  background: #e5c158;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  border: 2rpx solid #161012;
}

.calculating-text {
  font-size: 26rpx;
  color: var(--text-secondary, #666);
}
.theme-chinese .calculating-text {
  color: #a69ebd;
}

/* 堪舆结果 */
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
.theme-chinese .result-section {
  background: rgba(30, 24, 52, 0.6);
  border: 2rpx solid #6b1d28;
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.3);
}

.rating-card {
  text-align: center;
  padding: 24rpx;
  background: var(--bg-secondary, #fafafa);
  border: 1rpx solid var(--border-color, #eee);
  border-radius: 16rpx;
  margin-bottom: 30rpx;
}
.theme-chinese .rating-card {
  background: rgba(14, 11, 22, 0.4);
  border: 1rpx solid #322b4f;
}

.rating-label {
  font-size: 28rpx;
  color: var(--text-secondary, #666);
  display: block;
  margin-bottom: 12rpx;
}
.theme-chinese .rating-label {
  color: #a69ebd;
}

.star {
  font-size: 44rpx;
  color: #f39c12;
  margin: 0 4rpx;
}

.analysis-card {
  margin-bottom: 30rpx;
}

.card-title {
  font-size: 30rpx;
  font-weight: bold;
  color: var(--primary-color, #c41e3a);
  margin-bottom: 16rpx;
  display: block;
  border-left: 6rpx solid var(--primary-color, #c41e3a);
  padding-left: 16rpx;
}
.theme-chinese .card-title {
  color: #e5c158;
  border-left: 6rpx solid #e5c158;
}

.palace-intro {
  font-size: 24rpx;
  color: var(--text-secondary, #666);
  margin-bottom: 20rpx;
  display: block;
}
.theme-chinese .palace-intro {
  color: #a69ebd;
}

.analysis-text {
  font-size: 26rpx;
  color: var(--text-color, #333);
  line-height: 1.8;
  display: block;
  background: var(--bg-secondary, #fafafa);
  padding: 20rpx;
  border-radius: 12rpx;
  border: 1rpx solid var(--border-color, #eee);
}
.theme-chinese .analysis-text {
  color: #e2dcf0;
  background: rgba(14, 11, 22, 0.3);
  border: 1rpx solid #322b4f;
}

/* 九宫飞星图 */
.palace-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12rpx;
  margin-top: 10rpx;
}

.palace-cell {
  background: var(--bg-secondary, #fafafa);
  border: 1rpx solid var(--border-color, #eee);
  border-radius: 12rpx;
  padding: 16rpx 10rpx;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-sizing: border-box;
}
.theme-chinese .palace-cell {
  background: rgba(30, 24, 52, 0.8);
  border: 1rpx solid #4a3e72;
}

.palace-cell.good {
  background: rgba(46, 204, 113, 0.08);
  border-color: rgba(46, 204, 113, 0.3);
}

.palace-cell.good .cell-role {
  color: #2ecc71;
}

.palace-cell.bad {
  background: rgba(231, 76, 60, 0.08);
  border-color: rgba(231, 76, 60, 0.3);
}

.palace-cell.bad .cell-role {
  color: #e74c3c;
}

.cell-name {
  font-size: 20rpx;
  color: var(--text-secondary, #666);
}
.theme-chinese .cell-name {
  color: #a69ebd;
}

.cell-star {
  font-size: 18rpx;
  color: var(--text-light, #999);
  margin-top: 4rpx;
}
.theme-chinese .cell-star {
  color: #887fa3;
}

.cell-role {
  font-size: 24rpx;
  font-weight: bold;
  color: var(--primary-color, #c41e3a);
  margin-top: 8rpx;
}
.theme-chinese .cell-role {
  color: #e5c158;
}

.cell-advice {
  font-size: 16rpx;
  color: var(--text-secondary, #666);
  margin-top: 10rpx;
  line-height: 1.3;
  display: block;
}
.theme-chinese .cell-advice {
  color: #a69ebd;
}

/* 建议列表 */
.suggestion-list {
  padding: 16rpx;
  background: var(--bg-secondary, #fafafa);
  border: 1rpx solid var(--border-color, #eee);
  border-radius: 16rpx;
}
.theme-chinese .suggestion-list {
  background: rgba(14, 11, 22, 0.4);
  border: 1rpx solid #322b4f;
}

.suggestion-item {
  display: flex;
  align-items: center;
  padding: 16rpx 0;
  border-bottom: 1rpx dashed var(--border-color, #eee);
}
.theme-chinese .suggestion-item {
  border-bottom: 1rpx dashed #322b4f;
}

.suggestion-item:last-child {
  border-bottom: none;
}

.suggestion-icon {
  font-size: 36rpx;
  margin-right: 16rpx;
}

.suggestion-text {
  font-size: 26rpx;
  color: var(--text-color, #333);
  flex: 1;
}
.theme-chinese .suggestion-text {
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
  height: 96rpx;
  line-height: 96rpx;
  border-radius: 48rpx;
  font-size: 28rpx;
  border: none;
  text-align: center;
}

.action-btn.share {
  background: var(--primary-color, #c41e3a);
  color: #fff;
}

.theme-chinese .action-btn.share {
  background: linear-gradient(135deg, #a887e6, #7952c4);
  color: #fff;
}

.action-btn.reset-btn {
  background: var(--bg-secondary, #f5f5f5);
  color: var(--text-color, #333);
  border: 2rpx solid var(--border-color, #eee);
}

.theme-chinese .action-btn.reset-btn {
  background: rgba(50, 40, 85, 0.5);
  color: #e2dcf0;
  border: 2rpx solid #4a3e72;
}

.disclaimer {
  text-align: center;
  padding: 20rpx;
  font-size: 22rpx;
  color: var(--text-light, #bdc3c7);
  position: relative;
  z-index: 1;
}
.theme-chinese .disclaimer {
  color: #887fa3;
}

/* 常用风水记忆胶囊 */
.memory-section {
  margin-top: 10rpx;
  margin-bottom: 24rpx;
  padding-bottom: 16rpx;
  border-bottom: 1rpx dashed var(--border-color, #eee);
}
.theme-chinese .memory-section {
  border-bottom: 1rpx dashed #6b1d28;
}

.memory-label {
  font-size: 22rpx;
  color: var(--text-secondary, #666);
  margin-bottom: 12rpx;
  display: block;
}
.theme-chinese .memory-label {
  color: #a69ebd;
}

.memory-list {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.memory-chip {
  display: flex;
  align-items: center;
  background: var(--input-bg, #f0f0f0);
  border-radius: 30rpx;
  padding: 6rpx 20rpx;
  gap: 10rpx;
}
.theme-chinese .memory-chip {
  background: rgba(255, 255, 255, 0.06);
  border: 1rpx solid rgba(255, 255, 255, 0.1);
}

.chip-text {
  font-size: 22rpx;
  color: var(--text-color, #555);
}
.theme-chinese .chip-text {
  color: #e2dcf0;
}

.chip-close {
  font-size: 26rpx;
  color: var(--text-secondary, #999);
  font-weight: bold;
}
.theme-chinese .chip-close {
  color: #887fa3;
}
</style>
