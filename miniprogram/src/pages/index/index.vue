<template>
  <view class="page-container" :class="themeClass">
    <view class="header">
      <view class="greeting">
        <view class="title-row">
          <text class="title">今日运势</text>
          <button 
            class="checkin-btn" 
            :class="{ checked: hasCheckedIn }" 
            @click="handleCheckIn"
          >
            {{ hasCheckedIn ? '已签到' : '签到 +1次' }}
          </button>
        </view>
        <text class="date">{{ todayDate }}</text>
      </view>
      <ThemeSwitcher />
    </view>

    <!-- 情况 A：已设置生辰八字，显示个性化运势 -->
    <view class="fortune-card" v-if="hasBirthInfo" @click="openBirthDrawer">
      <view class="card-header">
        <text class="card-title">专属运势 ({{ todayFortune.score }}分 - {{ todayFortune.levelName }})</text>
        <view class="rating">
          <text v-for="i in 5" :key="i" class="star">{{ i <= todayFortune.rating ? '★' : '☆' }}</text>
        </view>
      </view>
      
      <view class="fortune-body">
        <view class="fortune-item">
          <text class="label">宜</text>
          <text class="value">{{ todayFortune.yi.join('、') }}</text>
        </view>
        <view class="fortune-item">
          <text class="label">忌</text>
          <text class="value warn">{{ todayFortune.ji.join('、') }}</text>
        </view>
        <view class="advice-section" v-if="todayFortune.overall">
          <text class="advice-label">💡 今日注意事项</text>
          <text class="advice-text">{{ todayFortune.overall }}</text>
        </view>
      </view>

      <view class="card-footer">
        <view class="lucky-item">
          <text class="lucky-label">幸运色</text>
          <text class="lucky-value" :style="{ color: todayFortune.luckyColor }">{{ todayFortune.luckyColorName }}</text>
        </view>
        <view class="lucky-item">
          <text class="lucky-label">幸运数字</text>
          <text class="lucky-value">{{ todayFortune.luckyNumber }}</text>
        </view>
      </view>

      <!-- 快捷推送开关，嵌入卡片底部 -->
      <view class="push-toggle-row" @click.stop>
        <text class="push-toggle-label">🔔 每日 08:00 运势推送提醒</text>
        <switch :checked="pushEnabled" @change="togglePush" color="var(--primary-color, #c41e3a)" style="transform: scale(0.8);" />
      </view>
    </view>

    <!-- 情况 B：未设置生辰八字，显示解锁引导卡片 -->
    <view class="fortune-card empty-state" v-else @click="openBirthDrawer">
      <view class="empty-content">
        <view class="empty-icon">🔮</view>
        <text class="empty-title">查看您的专属每日运势</text>
        <text class="empty-desc">只需配置您的出生日期，系统将根据您的生辰八字精准解析今日宜忌、幸运色及专属避坑建议。</text>
        <button class="setup-btn">一键生成专属运势</button>
      </view>
    </view>

    <!-- 测算功能网格 -->
    <view class="service-grid">
      <view class="service-item" v-for="service in services" :key="service.id" @click="navigateTo(service.page)">
        <view class="service-icon">{{ service.icon }}</view>
        <text class="service-name">{{ service.name }}</text>
        <text class="service-desc">{{ service.desc }}</text>
      </view>
    </view>

    <!-- 订阅提醒横幅 (当用户未开启推送且已设置生日时显示) -->
    <view class="push-banner" v-if="!pushEnabled && hasBirthInfo" @click="goToPushSettings">
      <text class="push-icon">🔔</text>
      <view class="push-info">
        <text class="push-title">每日运势推送已关闭</text>
        <text class="push-desc">点此进入设置，开启每日专属福运推送</text>
      </view>
      <text class="push-arrow">›</text>
    </view>

    <!-- 极简生辰配置模态弹窗 -->
    <view class="modal-mask" v-if="showBirthModal" @click="closeBirthDrawer">
      <view class="modal-container" @click.stop>
        <view class="modal-header">
          <text class="modal-title">快捷配置生辰信息</text>
          <text class="modal-close" @click="closeBirthDrawer">×</text>
        </view>
        <view class="modal-body">
          <view class="modal-form-item">
            <text class="modal-label">出生日期 (公历/阳历)</text>
            <picker mode="date" :value="tempBirthDate" @change="onTempDateChange">
              <view class="modal-picker-value">{{ tempBirthDate || '请点击选择您的出生日期' }}</view>
            </picker>
          </view>
          
          <view class="modal-form-item">
            <text class="modal-label">出生时辰 (选填)</text>
            <picker :range="timeSlots" :range-key="'label'" @change="onTempTimeChange">
              <view class="modal-picker-value">{{ tempSelectedTime?.label || '未知 / 不清楚' }}</view>
            </picker>
          </view>

          <view class="modal-form-item">
            <text class="modal-label">性别</text>
            <view class="modal-gender-group">
              <view class="modal-gender-btn" :class="{ active: tempGender === 'male' }" @click="tempGender = 'male'">男</view>
              <view class="modal-gender-btn" :class="{ active: tempGender === 'female' }" @click="tempGender = 'female'">女</view>
            </view>
          </view>
        </view>
        <view class="modal-footer">
          <button class="modal-submit-btn" @click="saveBirthInfo" :disabled="!tempBirthDate">保存并生成今日运势</button>
        </view>
      </view>
    </view>

    <!-- 悬浮神兽气泡小助手 (支持自由移动拖拽) -->
    <movable-area class="movable-area-container" v-if="isLoggedIn && petData">
      <movable-view 
        class="floating-assistant" 
        :class="{ 'no-bubble': !showAssistantBubble }"
        :style="{ 
          width: showAssistantBubble ? '300rpx' : '90rpx', 
          height: showAssistantBubble ? '220rpx' : '90rpx' 
        }"
        direction="all"
        :x="assistantX"
        :y="assistantY"
        inertia="true"
        damping="20"
        friction="2"
      >
        <view class="assistant-bubble" v-if="showAssistantBubble">
          <text class="bubble-text">{{ getAssistantTooltip() }}</text>
          <text class="bubble-close" @click.stop="showAssistantBubble = false">×</text>
        </view>
        <view class="assistant-pet" :class="{ warning: petData.hunger < 20 || petData.mood < 30 }" @click="goToUserCenter">
          <text class="pet-emoji">{{ getBeastEmoji(petData.type, petData.level) }}</text>
          <view class="warning-badge" v-if="petData.hunger < 20 || petData.mood < 30">❗</view>
          <view class="gift-badge-dot" v-else-if="petData.giftBoxes > 0"></view>
        </view>
      </movable-view>
    </movable-area>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import { useThemeStore } from '@/store/theme'
import { usePushStore } from '@/store/push'
import { useUserStore } from '@/store/user'
import { getDailyFortuneApi } from '@/api/fortune'
import { updateBirthInfoApi, checkInApi } from '@/api/user'
import { getPetStatusApi } from '@/api/pet'
import ThemeSwitcher from '@/components/theme-switcher/ThemeSwitcher.vue'

const themeStore = useThemeStore()
const pushStore = usePushStore()
const userStore = useUserStore()

const isLoggedIn = computed(() => userStore.isLoggedIn)
const petData = ref(null)
const showAssistantBubble = ref(true)
const assistantX = ref(0)
const assistantY = ref(0)

const getBeastEmoji = (type, level) => {
  if (level === 0 || type === 'egg') return '🥚'
  
  if (type === 'qinglong') {
    if (level < 10) return '🐲'
    if (level < 20) return '🐉'
    if (level < 30) return '🦖' // 霸气苍龙
    return '⚡🐲'
  }
  if (type === 'zhuque') {
    if (level < 10) return '🐣'
    if (level < 20) return '🐦'
    if (level < 30) return '🦅'
    return '🔥🦚'
  }
  if (type === 'baihu') {
    if (level < 10) return '🐱'
    if (level < 20) return '🐯'
    if (level < 30) return '🐆'
    return '🐅'
  }
  if (type === 'xuanwu') {
    if (level < 10) return '🐢'
    if (level < 20) return '🐢'
    if (level < 30) return '🐊'
    return '🐲🐢'
  }
  if (type === 'qilin') {
    if (level < 10) return '🦌'
    if (level < 20) return '🐐'
    if (level < 30) return '🦄'
    return '👑🦄'
  }
  return '🐾'
}

const getAssistantTooltip = () => {
  if (!petData.value) return ''
  if (petData.value.hunger < 20) return '您的神兽快饿扁了 🥺，快去喂喂它！'
  if (petData.value.mood < 30) return '神兽心情很差 🥺，快去抚摸互动！'
  if (petData.value.giftBoxes > 0) return `您有 ${petData.value.giftBoxes} 个气运福袋待开启 🎁！`
  return '神兽正在默默为您的今日气场祈福 ✨'
}

const goToUserCenter = () => {
  uni.switchTab({ url: '/pages/user/index' })
}

const loadPetStatus = async () => {
  if (!isLoggedIn.value) return
  try {
    const res = await getPetStatusApi()
    if (res.code === 0) {
      petData.value = res.data
    }
  } catch (e) {
    console.error('首页加载神兽状态失败:', e)
  }
}

onShow(() => {
  if (isLoggedIn.value) {
    loadPetStatus()
  }
})

const pushEnabled = computed(() => pushStore.pushEnabled)

// 判断是否已配置生辰八字
const hasBirthInfo = computed(() => {
  return !!(userStore.userInfo && userStore.userInfo.birthInfo && userStore.userInfo.birthInfo.solarDate)
})

// 计算是否已签到
const hasCheckedIn = computed(() => {
  if (!userStore.userInfo || !userStore.userInfo.lastCheckInAt) return false
  const getLocalDateString = (date) => {
    if (!date) return ''
    const d = typeof date === 'string' ? new Date(date) : date
    const localTime = new Date(d.getTime() + 8 * 60 * 60 * 1000)
    return localTime.toISOString().slice(0, 10)
  }
  const todayStr = getLocalDateString(new Date())
  const lastCheckInStr = getLocalDateString(userStore.userInfo.lastCheckInAt)
  return todayStr === lastCheckInStr
})

const todayDate = computed(() => {
  const d = new Date()
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
})

const todayFortune = ref({
  score: 80,
  levelName: '不错',
  rating: 4,
  yi: ['签约', '出行', '学习', '建群'],
  ji: ['争吵', '熬夜', '过度消费'],
  luckyColor: '#c41e3a',
  luckyColorName: '红色',
  luckyNumber: 8,
  overall: ''
})

const services = [
  { id: 'bazi', name: '生辰八字', desc: '命理分析', icon: '📿', page: '/pages/bazi/index' },
  { id: 'constellation', name: '星座运势', desc: '每日运程', icon: '⭐', page: '/pages/constellation/index' },
  { id: 'tarot', name: '塔罗占卜', desc: '命运指引', icon: '🃏', page: '/pages/tarot/index' },
  { id: 'name', name: '姓名测算', desc: '五格分析', icon: '📝', page: '/pages/name/index' },
  { id: 'fengshui', name: '风水分析', desc: '居家办公', icon: '🏠', page: '/pages/fengshui/index' },
  { id: 'face', name: '面相手相', desc: 'AI识别', icon: '👁', page: '/pages/face/index' },
  { id: 'chat', name: 'AI命理大师', desc: '实时解惑', icon: '🔮', page: '/pages/chat/index' }
]

// 弹窗配置变量
const showBirthModal = ref(false)
const tempBirthDate = ref('')
const tempSelectedTime = ref(null)
const tempGender = ref('male')

const timeSlots = [
  { label: '未知 / 不清楚', value: '未知' },
  { label: '子时 (23:00-01:00)', value: '子时' },
  { label: '丑时 (01:00-03:00)', value: '丑时' },
  { label: '寅时 (03:00-05:00)', value: '寅时' },
  { label: '卯时 (05:00-07:00)', value: '卯时' },
  { label: '辰时 (07:00-09:00)', value: '辰时' },
  { label: '巳时 (09:00-11:00)', value: '巳时' },
  { label: '午时 (11:00-13:00)', value: '午时' },
  { label: '未时 (13:00-15:00)', value: '未时' },
  { label: '申时 (15:00-17:00)', value: '申时' },
  { label: '酉时 (17:00-19:00)', value: '酉时' },
  { label: '戌时 (19:00-21:00)', value: '戌时' },
  { label: '亥时 (21:00-23:00)', value: '亥时' }
]

const navigateTo = (url) => {
  uni.navigateTo({ url })
}

const goToPushSettings = () => {
  uni.navigateTo({ url: '/pages/push-settings/index' })
}

// 每日签到
const handleCheckIn = async () => {
  if (hasCheckedIn.value) {
    uni.showToast({ title: '今天已经签到过啦！', icon: 'none' })
    return
  }

  // 若用户未登录，自动发起登录
  if (!userStore.isLoggedIn) {
    uni.showLoading({ title: '自动登录中...' })
    try {
      const loginRes = await userStore.login()
      if (!loginRes.success) {
        throw new Error(loginRes.message || '快捷登录失败')
      }
    } catch (err) {
      uni.showToast({ title: err.message || '登录失败，请手动登录', icon: 'none' })
      return
    } finally {
      uni.hideLoading()
    }
  }

  uni.showLoading({ title: '签到中...' })
  try {
    const res = await checkInApi()
    if (res.code === 0) {
      uni.showToast({ title: '签到成功，免费次数+1！', icon: 'success' })
      await userStore.fetchUserInfo()
    } else {
      uni.showToast({ title: res.message || '签到失败', icon: 'none' })
    }
  } catch (err) {
    uni.showToast({ title: err.message || '网络错误，请稍后重试', icon: 'none' })
  } finally {
    uni.hideLoading()
  }
}

// 开启或关闭每日运势提醒
const togglePush = async (e) => {
  const value = e.detail.value
  uni.showLoading({ title: '同步中...' })
  try {
    await pushStore.togglePush(value)
    uni.showToast({
      title: pushStore.pushEnabled ? '已成功开启每日提醒' : '已关闭提醒',
      icon: 'none'
    })
  } catch (err) {
    uni.showToast({ title: '设置推送失败，请重试', icon: 'none' })
  } finally {
    uni.hideLoading()
  }
}

// 弹出快捷设置抽屉
const openBirthDrawer = () => {
  const info = userStore.userInfo?.birthInfo || {}
  tempBirthDate.value = info.solarDate || ''
  tempSelectedTime.value = timeSlots.find(t => t.value === info.birthTime) || timeSlots[0]
  tempGender.value = userStore.userInfo?.gender === 2 ? 'female' : 'male'
  showBirthModal.value = true
}

const closeBirthDrawer = () => {
  showBirthModal.value = false
}

const onTempDateChange = (e) => {
  tempBirthDate.value = e.detail.value
}

const onTempTimeChange = (e) => {
  tempSelectedTime.value = timeSlots[e.detail.value]
}

// 保存生辰信息（包含未登录状态自动登录）
const saveBirthInfo = async () => {
  if (!tempBirthDate.value) return
  
  uni.showLoading({ title: '保存并分析中...' })
  try {
    // 若未登录，先静默登录
    if (!userStore.isLoggedIn) {
      const loginRes = await userStore.login()
      if (!loginRes.success) {
        throw new Error(loginRes.message || '微信快捷登录失败，请重试')
      }
    }
    
    // 更新生辰八字
    const res = await updateBirthInfoApi({
      solarDate: tempBirthDate.value,
      birthTime: tempSelectedTime.value?.value || '未知',
      gender: tempGender.value
    })
    
    if (res.code === 0) {
      uni.showToast({ title: '专属运势生成成功', icon: 'success' })
      await userStore.fetchUserInfo()
      showBirthModal.value = false
      await loadDailyFortune()
    } else {
      uni.showToast({ title: res.message || '配置失败', icon: 'none' })
    }
  } catch (err) {
    uni.showToast({ title: err.message || '操作失败', icon: 'none' })
  } finally {
    uni.hideLoading()
  }
}

const loadDailyFortune = async () => {
  try {
    const res = await getDailyFortuneApi()
    const data = res.data
    if (data) {
      const levelMap = {
        excellent: '大吉',
        good: '吉',
        normal: '平',
        bad: '凶',
        terrible: '大凶'
      }
      todayFortune.value = {
        score: data.score || 80,
        levelName: levelMap[data.level] || '平',
        rating: data.rating || 4,
        yi: data.yi || ['签约', '出行'],
        ji: data.ji || ['争吵', '熬夜'],
        luckyColor: data.luckyColor || '#c41e3a',
        luckyColorName: data.luckyColorName || '红色',
        luckyNumber: data.luckyNumber || 8,
        overall: data.overall || ''
      }
    }
  } catch (err) {
    console.log('使用默认运势数据:', err)
  }
}

onPullDownRefresh(async () => {
  try {
    const promises = [loadDailyFortune()]
    if (isLoggedIn.value) {
      promises.push(loadPetStatus())
    }
    await Promise.all(promises)
  } catch (e) {
    console.error('下拉刷新失败:', e)
  } finally {
    setTimeout(() => {
      uni.stopPullDownRefresh()
    }, 100)
  }
})

onMounted(() => {
  loadDailyFortune()
  // 计算神兽初始右下角位置 (避开底部 tabbar 且支持拖拽)
  try {
    const sys = uni.getSystemInfoSync()
    const assistantWidth = 150 // 300rpx in px
    const assistantHeight = 120 // 240rpx in px
    // 初始距离右侧 15px，距离底端 110px (避开 50px tabbar + 内容)
    assistantX.value = sys.windowWidth - assistantWidth - 15
    assistantY.value = sys.windowHeight - assistantHeight - 110
  } catch (e) {
    assistantX.value = 200
    assistantY.value = 450
  }
})
</script>

<style scoped>
.page-container {
  padding: 20rpx 30rpx;
  background: var(--bg-color, #f5f0e8);
  min-height: 100vh;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30rpx;
}

.title {
  font-size: 40rpx;
  font-weight: bold;
  color: var(--primary-color, #c41e3a);
}

.title-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.checkin-btn {
  margin: 0;
  padding: 6rpx 20rpx;
  background: linear-gradient(135deg, #f1c40f, #f39c12);
  color: #fff;
  font-size: 20rpx;
  font-weight: bold;
  border-radius: 30rpx;
  line-height: 1.6;
  box-shadow: 0 4rpx 10rpx rgba(243, 156, 18, 0.3);
  border: none;
}

.checkin-btn.checked {
  background: #bdc3c7;
  color: #7f8c8d;
  box-shadow: none;
}

.date {
  font-size: 24rpx;
  color: var(--text-secondary, #666);
  margin-top: 8rpx;
}

.fortune-card {
  background: var(--card-bg, #fff);
  border-radius: 20rpx;
  padding: 30rpx;
  margin-bottom: 30rpx;
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.08);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.card-title {
  font-size: 32rpx;
  font-weight: bold;
  color: var(--text-primary, #333);
}

.star {
  font-size: 36rpx;
  color: #f39c12;
}

.fortune-item {
  display: flex;
  margin-bottom: 16rpx;
}

.label {
  width: 60rpx;
  font-size: 28rpx;
  font-weight: bold;
  color: var(--primary-color, #c41e3a);
}

.value {
  flex: 1;
  font-size: 28rpx;
  color: var(--text-primary, #333);
}

.value.warn {
  color: #999;
}

.card-footer {
  display: flex;
  justify-content: space-around;
  margin-top: 20rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid var(--border-color, #eee);
}

.lucky-item {
  text-align: center;
}

.lucky-label {
  font-size: 24rpx;
  color: var(--text-secondary, #666);
  display: block;
}

.lucky-value {
  font-size: 32rpx;
  font-weight: bold;
  margin-top: 8rpx;
}

.service-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20rpx;
  margin-bottom: 30rpx;
}

.service-item {
  background: var(--card-bg, #fff);
  border-radius: 16rpx;
  padding: 24rpx 16rpx;
  text-align: center;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06);
}

.service-icon {
  font-size: 48rpx;
  margin-bottom: 12rpx;
}

.service-name {
  font-size: 28rpx;
  font-weight: bold;
  color: var(--text-primary, #333);
  display: block;
}

.service-desc {
  font-size: 22rpx;
  color: var(--text-secondary, #999);
  margin-top: 6rpx;
  display: block;
}

.push-banner {
  display: flex;
  align-items: center;
  background: linear-gradient(135deg, var(--primary-color, #c41e3a), #e74c3c);
  border-radius: 16rpx;
  padding: 24rpx 30rpx;
  color: #fff;
}

.push-icon {
  font-size: 40rpx;
  margin-right: 20rpx;
}

.push-info {
  flex: 1;
}

.push-title {
  font-size: 28rpx;
  font-weight: bold;
  display: block;
}

.push-desc {
  font-size: 22rpx;
  opacity: 0.9;
  margin-top: 4rpx;
  display: block;
}

.push-arrow {
  font-size: 36rpx;
}

/* 专属建议与注意事项样式 */
.advice-section {
  margin-top: 20rpx;
  padding: 16rpx 20rpx;
  background: var(--input-bg, #fcfaf6);
  border-radius: 12rpx;
  border-left: 6rpx solid var(--primary-color, #c41e3a);
}

.advice-label {
  font-size: 24rpx;
  font-weight: bold;
  color: var(--primary-color, #c41e3a);
  display: block;
  margin-bottom: 6rpx;
}

.advice-text {
  font-size: 26rpx;
  color: var(--text-primary, #444);
  line-height: 1.6;
  display: block;
}

/* 卡片内部推送行 */
.push-toggle-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 24rpx;
  padding-top: 20rpx;
  border-top: 1rpx dashed var(--border-color, #eee);
}

.push-toggle-label {
  font-size: 24rpx;
  color: var(--text-secondary, #666);
}

/* 空状态样式 */
.empty-state {
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.empty-state:active {
  transform: scale(0.98);
}

.empty-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40rpx 20rpx;
  text-align: center;
}

.empty-icon {
  font-size: 80rpx;
  margin-bottom: 24rpx;
  animation: bounce 2s infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10rpx); }
}

.empty-title {
  font-size: 32rpx;
  font-weight: bold;
  color: var(--text-primary, #333);
  margin-bottom: 16rpx;
}

.empty-desc {
  font-size: 26rpx;
  color: var(--text-secondary, #666);
  line-height: 1.6;
  margin-bottom: 36rpx;
}

.setup-btn {
  background: var(--primary-color, #c41e3a);
  color: #fff;
  font-size: 28rpx;
  font-weight: bold;
  padding: 16rpx 60rpx;
  border-radius: 40rpx;
  box-shadow: 0 6rpx 16rpx rgba(196, 30, 58, 0.2);
}

/* 模态框/弹窗样式 */
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: flex-end;
  z-index: 999;
}

.modal-container {
  width: 100%;
  background: var(--card-bg, #fff);
  border-radius: 32rpx 32rpx 0 0;
  padding: 40rpx 30rpx;
  box-sizing: border-box;
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 36rpx;
}

.modal-title {
  font-size: 32rpx;
  font-weight: bold;
  color: var(--text-primary, #333);
}

.modal-close {
  font-size: 44rpx;
  color: var(--text-secondary, #999);
  padding: 10rpx;
}

.modal-body {
  margin-bottom: 40rpx;
}

.modal-form-item {
  margin-bottom: 30rpx;
}

.modal-label {
  font-size: 26rpx;
  color: var(--text-secondary, #666);
  margin-bottom: 16rpx;
  display: block;
}

.modal-picker-value {
  padding: 24rpx 20rpx;
  background: var(--input-bg, #f5f5f5);
  border-radius: 16rpx;
  font-size: 28rpx;
  color: var(--text-primary, #333);
}

.modal-gender-group {
  display: flex;
  gap: 20rpx;
}

.modal-gender-btn {
  flex: 1;
  padding: 20rpx 0;
  text-align: center;
  background: var(--input-bg, #f5f5f5);
  border-radius: 16rpx;
  font-size: 28rpx;
  color: var(--text-primary, #333);
}

.modal-gender-btn.active {
  background: var(--primary-color, #c41e3a);
  color: #fff;
  font-weight: bold;
}

.modal-footer {
  padding-bottom: env(safe-area-inset-bottom);
}

.modal-submit-btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  background: var(--primary-color, #c41e3a);
  color: #fff;
  font-size: 30rpx;
  font-weight: bold;
  border-radius: 44rpx;
  box-shadow: 0 6rpx 16rpx rgba(196, 30, 58, 0.2);
}

.modal-submit-btn[disabled] {
  opacity: 0.5;
  box-shadow: none;
}

/* 悬浮神兽气泡小助手 */
.movable-area-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
  z-index: 99;
}

.floating-assistant {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  pointer-events: auto;
}

.assistant-bubble {
  background: var(--card-bg, #fff);
  border: 2rpx solid var(--border-color, #eee);
  box-shadow: 0 4rpx 16rpx var(--card-shadow, rgba(0,0,0,0.08));
  padding: 12rpx 20rpx;
  border-radius: 20rpx;
  margin-bottom: 16rpx;
  position: relative;
  max-width: 300rpx;
  animation: bounceBubble 2s infinite ease-in-out;
}
.theme-chinese .assistant-bubble {
  background: rgba(30, 20, 22, 0.95);
  border: 1rpx solid #e5c158;
  color: #fff;
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.3);
}

.bubble-text {
  font-size: 20rpx;
  line-height: 1.4;
  color: var(--text-color, #333);
}
.theme-chinese .bubble-text {
  color: #eae6f3;
}

.bubble-close {
  position: absolute;
  top: -10rpx;
  right: -10rpx;
  width: 30rpx;
  height: 30rpx;
  line-height: 26rpx;
  text-align: center;
  background: var(--input-bg, #eee);
  border-radius: 50%;
  font-size: 20rpx;
  color: var(--text-secondary, #666);
}
.theme-chinese .bubble-close {
  background: #3e282c;
  color: #e5c158;
}

.assistant-pet {
  width: 90rpx;
  height: 90rpx;
  border-radius: 50%;
  background: var(--card-bg, #fff);
  border: 2rpx solid var(--secondary-color, #e5c158);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6rpx 20rpx var(--card-shadow, rgba(229, 193, 88, 0.15));
  position: relative;
}
.theme-chinese .assistant-pet {
  background: rgba(30, 20, 22, 0.9);
  border: 2rpx solid #e5c158;
}

.assistant-pet.warning {
  animation: alarmShake 1.5s infinite ease-in-out;
  border-color: #e74c3c;
}

.pet-emoji {
  font-size: 50rpx;
}

.warning-badge {
  position: absolute;
  top: 0;
  right: 0;
  width: 32rpx;
  height: 32rpx;
  line-height: 32rpx;
  text-align: center;
  background: #e74c3c;
  color: #fff;
  border-radius: 50%;
  font-size: 18rpx;
  font-weight: bold;
}

.gift-badge-dot {
  position: absolute;
  top: 6rpx;
  right: 6rpx;
  width: 16rpx;
  height: 16rpx;
  background: #f1c40f;
  border-radius: 50%;
  border: 2rpx solid #fff;
}

@keyframes bounceBubble {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8rpx); }
}

@keyframes alarmShake {
  0%, 100% { transform: rotate(0); }
  25% { transform: rotate(-8deg); }
  75% { transform: rotate(8deg); }
}
</style>
