<template>
  <view class="page-container" :class="themeClass">
    <view class="header">
      <view class="greeting">
        <view class="title-row">
          <text class="title">今日能量</text>
          <button 
            v-if="!hasCheckedIn"
            class="checkin-btn" 
            @click="handleCheckIn"
          >
            每日签到
          </button>
        </view>
        <text class="date">{{ todayDate }}</text>
      </view>
      <ThemeSwitcher />
    </view>

    <!-- 情况 A：已设置生日密码，显示个性化运势 -->
    <view class="fortune-card" v-if="hasBirthInfo" @click="openBirthDrawer">
      <view class="card-header">
        <text class="card-title">专属灵感 ({{ todayFortune.score }}分 - {{ todayFortune.levelName }})</text>
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

      <!-- 快捷推送开关，嵌入卡片底部。
           置灰的 switch 不会派发 change，点下去屏幕上什么都不会发生，
           所以这一行自己接住那次点击、把「为什么按不动」说出来 -->
      <view class="push-toggle-row" @click.stop="onPushRowTap">
        <text class="push-toggle-label">{{ pushToggleLabel }}</text>
        <switch :checked="pushSwitchOn" :disabled="!pushConfigured" @change="togglePush" color="var(--primary-color, #c41e3a)" style="transform: scale(0.8);" />
      </view>
    </view>

    <!-- 情况 B：未设置生日密码，显示解锁引导卡片 -->
    <view class="fortune-card empty-state" v-else @click="openBirthDrawer">
      <view class="empty-content">
        <view class="empty-icon">🔮</view>
        <text class="empty-title">查看您的专属每日灵感</text>
        <text class="empty-desc">只需配置您的出生日期，系统将根据您的生日密码精准解析今日宜忌、幸运色及专属避坑建议。</text>
        <button class="setup-btn">一键生成专属灵感</button>
      </view>
    </view>

    <!-- 测算功能网格 -->
    <view class="service-grid">
      <view class="service-item" v-for="service in activeServices" :key="service.id" @click="navigateTo(service.page)">
        <view class="service-icon">{{ service.icon }}</view>
        <text class="service-name">{{ service.name }}</text>
        <text class="service-desc">{{ service.desc }}</text>
      </view>
    </view>

    <!-- 订阅提醒横幅：授权次数用完（含从未授权）时出现。
         微信一次性订阅是「授权一次发一条」，用完就必须重新授权，
         这条横幅是重新授权的入口，所以它必须跟着服务端的 remainingQuota 回来 -->
    <view class="push-banner" v-if="showPushBanner" @click="goToPushSettings">
      <text class="push-icon">🔔</text>
      <view class="push-info">
        <text class="push-title">{{ pushBannerTitle }}</text>
        <text class="push-desc">{{ pushBannerDesc }}</text>
      </view>
      <text class="push-arrow">›</text>
    </view>

    <!-- #ifdef H5 -->
    <view class="icp-footer">
      <a href="https://beian.miit.gov.cn/" target="_blank" class="icp-link">粤ICP备2025416691号</a>
    </view>
    <!-- #endif -->

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
            <text class="modal-label">出生时辰</text>
            <picker :range="timeSlots" :range-key="'label'" @change="onTempTimeChange">
              <view class="modal-picker-value">{{ tempSelectedTime?.label || '请选择时辰（决定时柱）' }}</view>
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
          <button class="modal-submit-btn" @click="saveBirthInfo" :disabled="!tempBirthDate || !tempSelectedTime">保存并生成今日能量</button>
        </view>
      </view>
    </view>

    <!-- 悬浮神兽气泡小助手 (支持自由移动拖拽，带贴边、闲置半透明、气泡自适应、震动反馈) -->
    <movable-area class="movable-area-container" v-if="isLoggedIn && petData">
      <movable-view 
        class="floating-assistant" 
        :class="{ 'no-bubble': !showAssistantBubble, 'is-on-left': isOnLeft, 'is-idle': isIdle }"
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
        @change="onAssistantChange"
        @touchstart="onAssistantStart"
        @touchend="onAssistantEnd"
      >
        <view class="assistant-bubble" v-if="showAssistantBubble">
          <text class="bubble-text">{{ getAssistantTooltip() }}</text>
          <text class="bubble-close" @click.stop="closeBubble">×</text>
        </view>
        <view class="assistant-pet" :class="{ warning: petData.hunger < 20 || petData.mood < 30 }" @click="goToUserCenter">
          <text class="pet-emoji">{{ getBeastEmoji(petData.type, petData.level) }}</text>
          <view class="warning-badge" v-if="petData.hunger < 20 || petData.mood < 30">❗</view>
          <view class="gift-badge-dot" v-else-if="petData.giftBoxes > 0"></view>
        </view>
      </movable-view>
    </movable-area>

    <!-- 微信隐私指引授权弹窗 -->
    <PrivacyPopup />

    <!-- 微信手机号一键绑定弹窗 (仅在微信小程序端有效，完全拦截首页交互) -->
    <!-- #ifdef MP-WEIXIN -->
    <view class="bind-phone-container" v-if="showBindPhoneModal">
      <view class="bind-phone-body">
        <view class="bind-phone-icon">📱</view>
        <view class="bind-phone-title">绑定手机号码</view>
        <view class="bind-phone-desc">为了您的账号安全以及提供更好的生日密码分析，请完成手机号码一键绑定。</view>
        <view class="bind-phone-agreement">
          <checkbox-group @change="onAgreementChange">
            <label class="agreement-label">
              <checkbox value="agree" :checked="agreementChecked" color="var(--primary-color, #c41e3a)" style="transform: scale(0.75);" />
              <text class="agreement-text">我已阅读并同意</text>
            </label>
          </checkbox-group>
          <text class="agreement-link" @click="openPrivacyContract">《今日星能量用户隐私保护指引》</text>
        </view>
        <button 
          class="bind-phone-submit-btn" 
          open-type="getPhoneNumber" 
          @getphonenumber="onGetPhoneNumber"
          :disabled="!agreementChecked"
        >
          本机号码一键绑定
        </button>
      </view>
    </view>
    <!-- #endif -->
  </view>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import { useThemeStore } from '@/store/theme'
import { usePushStore } from '@/store/push'
import { useUserStore } from '@/store/user'
import { getDailyFortuneApi } from '@/api/fortune'
import { updateBirthInfoApi, checkInApi, bindPhoneApi } from '@/api/user'
import { getPetStatusApi } from '@/api/pet'
import ThemeSwitcher from '@/components/theme-switcher/ThemeSwitcher.vue'
import PrivacyPopup from '@/components/PrivacyPopup.vue'

const themeStore = useThemeStore()
const pushStore = usePushStore()
const userStore = useUserStore()

const isLoggedIn = computed(() => userStore.isLoggedIn)
const petData = ref(null)
const showAssistantBubble = ref(true)
const assistantX = ref(0)
const assistantY = ref(0)

// 悬浮助手交互优化状态
const isOnLeft = ref(false)
const isIdle = ref(false)
const isDragging = ref(false)
let currentX = 0
let currentY = 0
let idleTimer = null

// 悬浮助手只需要窗口宽高：uni.getSystemInfoSync() 已废弃且每次调用都是一次同步桥接，
// 拖拽过程中会被反复触发，这里换成 getWindowInfo 并缓存一份
let windowInfoCache = null

function getWindowSize() {
  if (windowInfoCache) return windowInfoCache
  const info = typeof uni.getWindowInfo === 'function'
    ? uni.getWindowInfo()
    : uni.getSystemInfoSync()
  windowInfoCache = {
    windowWidth: info.windowWidth || 375,
    windowHeight: info.windowHeight || 667
  }
  return windowInfoCache
}

// H5 下窗口是可以被拖动改变的，尺寸变了就把缓存丢掉
if (typeof uni.onWindowResize === 'function') {
  uni.onWindowResize(() => {
    windowInfoCache = null
  })
}
let bubbleTimer = null

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
  if (petData.value.giftBoxes > 0) return `您有 ${petData.value.giftBoxes} 个星能福袋待开启 🎁！`
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

// 关闭气泡（带防跳动位移补偿）
const closeBubble = () => {
  if (!showAssistantBubble.value) return
  
  try {
    const screenWidth = getWindowSize().windowWidth

    // 垂直位移补偿：气泡在上方，占 130rpx 高度差
    const offsetY = (130 * screenWidth) / 750
    assistantY.value += offsetY
    
    // 水平位移补偿：当在右侧贴边时，气泡向左展开导致容器多出 210rpx 宽度差，需右移补偿
    if (!isOnLeft.value) {
      const offsetX = (210 * screenWidth) / 750
      assistantX.value += offsetX
    }
  } catch (err) {
    console.error('closeBubble position adjustment failed:', err)
  }
  
  showAssistantBubble.value = false
}

// 打开气泡（带防跳动位移补偿）
const openBubble = () => {
  if (showAssistantBubble.value) return
  
  try {
    const screenWidth = getWindowSize().windowWidth

    // 垂直位移还原
    const offsetY = (130 * screenWidth) / 750
    assistantY.value -= offsetY
    
    // 水平位移还原
    if (!isOnLeft.value) {
      const offsetX = (210 * screenWidth) / 750
      assistantX.value -= offsetX
    }
  } catch (err) {
    console.error('openBubble position adjustment failed:', err)
  }
  
  showAssistantBubble.value = true
  startBubbleTimer()
}

// 开启气泡自动折叠定时器
const startBubbleTimer = () => {
  if (bubbleTimer) clearTimeout(bubbleTimer)
  bubbleTimer = setTimeout(() => {
    closeBubble()
  }, 6000) // 6秒后自动收起气泡
}

// 重置闲置状态与定时器
const resetIdleTimer = () => {
  isIdle.value = false
  if (idleTimer) clearTimeout(idleTimer)
  if (!isDragging.value) {
    idleTimer = setTimeout(() => {
      isIdle.value = true
    }, 4000) // 4秒无交互自动半透明
  }
}

// 触摸/拖拽开始
const onAssistantStart = () => {
  isDragging.value = true
  isIdle.value = false
  if (idleTimer) clearTimeout(idleTimer)
  // 拖拽前关闭气泡，避免挡住屏幕
  closeBubble()
}

// 拖拽位置改变
const onAssistantChange = (e) => {
  if (e.detail.source === 'touch') {
    currentX = e.detail.x
    currentY = e.detail.y
  }
}

// 拖拽结束：自动吸附边缘、震动反馈
const onAssistantEnd = () => {
  isDragging.value = false
  
  try {
    const screenWidth = getWindowSize().windowWidth
    // 此时气泡必已关闭，使用 90rpx = 45px 图标大小
    const assistantWidth = 45
    const middle = screenWidth / 2
    const centerX = currentX + assistantWidth / 2
    
    let targetX = 0
    if (centerX < middle) {
      targetX = 10 // 吸附到左侧，留出10px边距
      isOnLeft.value = true
    } else {
      targetX = screenWidth - assistantWidth - 10 // 吸附到右侧，留出10px边距
      isOnLeft.value = false
    }
    
    // 同步最后坐标并设置吸附目标值以触发uni-app动画
    assistantX.value = currentX
    assistantY.value = currentY
    
    setTimeout(() => {
      assistantX.value = targetX
      // #ifdef MP-WEIXIN
      uni.vibrateShort({ type: 'light' })
      // #endif
    }, 50)
  } catch (err) {
    console.error('Snap calculation failed:', err)
  }
  
  resetIdleTimer()
}

onShow(() => {
  // 推送发出后配额就少一条，从微信「设置-订阅消息」改过授权也一样：
  // 回到首页必须重新拉一次，否则横幅和「剩 N 次」都是旧的
  if (isLoggedIn.value) {
    pushStore.refresh()
    loadPetStatus()
    // 进入时若未展示，则以气泡形式展开，并开启折叠定时
    if (!showAssistantBubble.value) {
      openBubble()
    } else {
      startBubbleTimer()
    }
    resetIdleTimer()
  }
})

// 推送状态一律以服务端为准：pushEnabled 只是「还有没有配额」的结论，
// 不再是 localStorage 里那个永远为 true 的布尔值
const pushEnabled = computed(() => pushStore.pushEnabled)
const pushConfigured = computed(() => pushStore.configured)
const pushRemainingQuota = computed(() => pushStore.remainingQuota)
const pushTimeLabel = computed(() => pushStore.pushTimeLabel)

// switch 的 checked 必须绑本地 ref：小程序的 switch 点下去就自己变了，
// 失败时只有改这个本地值才能把它弹回去
const pushSwitchOn = ref(false)
watch(pushEnabled, (val) => { pushSwitchOn.value = val }, { immediate: true })

const pushToggleLabel = computed(() => {
  if (!pushConfigured.value) return '🔔 每日运势提醒（暂未开放）'
  if (pushRemainingQuota.value > 0) {
    return `🔔 每日 ${pushTimeLabel.value} 运势提醒（剩 ${pushRemainingQuota.value} 次）`
  }
  return `🔔 每日 ${pushTimeLabel.value} 运势提醒`
})

const showPushBanner = computed(
  () => pushConfigured.value && hasBirthInfo.value && pushRemainingQuota.value === 0
)

// 「已暂停」和「未开启」是两件事：授权用完或过期后 pushEnabled 变回 false，
// 但用户其实是想收的。分开说才是实话
const pushBannerTitle = computed(() =>
  pushStore.intended ? '每日提醒已暂停' : '每日运势提醒未开启'
)

const pushBannerDesc = computed(() => {
  if (!pushStore.intended) {
    return `点此开启，每天 ${pushTimeLabel.value}（北京时间）收到当日运势`
  }
  return pushStore.lastPushDate
    ? `上次推送 ${pushStore.lastPushDate}，点此再授权一次继续接收`
    : `授权次数已用完，点此再授权一次恢复提醒`
})

const agreementChecked = ref(false)

const showBindPhoneModal = computed(() => {
  return false
})

const onAgreementChange = (e) => {
  agreementChecked.value = e.detail.value.includes('agree')
}

const openPrivacyContract = () => {
  // #ifdef MP-WEIXIN
  if (wx.openPrivacyContract) {
    wx.openPrivacyContract({
      fail: (err) => {
        uni.showToast({
          title: '打开隐私协议失败，请稍后重试',
          icon: 'none'
        })
        console.error('openPrivacyContract fail', err)
      }
    })
  } else {
    uni.showModal({
      title: '提示',
      content: '请更新微信版本后查看隐私指引。',
      showCancel: false
    })
  }
  // #endif
}

const onGetPhoneNumber = async (e) => {
  if (!e.detail.code) {
    console.log('获取手机号失败信息:', e.detail)
    const errMsg = e.detail.errMsg || ''
    // 检测是否为个人主体无权限、测试号无权限或环境限制
    if (errMsg.includes('no permission') || errMsg.includes('fail_user_deny') || errMsg.includes('fail:no permission') || errMsg.includes('fail')) {
      uni.showModal({
        title: '主体权限提示',
        content: '当前小程序 AppID 无“微信获取手机号”权限（个人主体或测试号不支持该官方接口）。是否使用模拟手机号一键绑定进行测试？',
        success: async (res) => {
          if (res.confirm) {
            // showLoading 和 showToast 共用一个原生浮层：提示必须排在 hideLoading 之后，
            // 否则绑定成功/失败的提示都会被 hideLoading 一起收走，用户什么反馈都看不到
            let toast = null
            uni.showLoading({ title: '正在模拟绑定...' })
            try {
              const bindRes = await bindPhoneApi({ code: 'mock-phone-code' })
              if (bindRes.code === 0) {
                toast = { title: '模拟绑定成功', icon: 'success' }
                await userStore.fetchUserInfo()
              } else {
                toast = { title: bindRes.message || '绑定失败', icon: 'none' }
              }
            } catch (err) {
              toast = { title: err.message || '绑定请求失败', icon: 'none' }
            } finally {
              uni.hideLoading()
            }
            if (toast) uni.showToast(toast)
          }
        }
      })
      return
    }

    uni.showToast({
      title: '您已拒绝授权获取手机号',
      icon: 'none'
    })
    return
  }

  // 同上：提示排在 hideLoading 之后，否则绑定结果会被静默吞掉
  let toast = null
  uni.showLoading({ title: '正在绑定手机号...' })
  try {
    const res = await bindPhoneApi({ code: e.detail.code })
    if (res.code === 0) {
      toast = { title: '手机号绑定成功', icon: 'success' }
      await userStore.fetchUserInfo()
    } else {
      toast = { title: res.message || '绑定失败，请重试', icon: 'none' }
    }
  } catch (err) {
    toast = { title: err.message || '绑定请求失败，请重试', icon: 'none' }
  } finally {
    uni.hideLoading()
  }
  if (toast) uni.showToast(toast)
}

// 判断是否已配置生日密码
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
  { id: 'bazi', name: '生日密码', desc: '性格分析', icon: '📿', page: '/pages/bazi/index' },
  { id: 'constellation', name: '星座能量', desc: '每日灵感', icon: '⭐', page: '/pages/constellation/index' },
  { id: 'tarot', name: '灵感卡牌', desc: '灵感启发', icon: '🃏', page: '/pages/tarot/index' },
  { id: 'name', name: '姓名测算', desc: '五格分析', icon: '📝', page: '/pages/name/index' },
  { id: 'fengshui', name: '空间美学', desc: '居家办公', icon: '🏠', page: '/pages/fengshui/index' },
  { id: 'face', name: 'AI颜值测试', desc: 'AI识别', icon: '👁', page: '/pages/face/index' },
  { id: 'chat', name: 'AI性格分析师', desc: '实时解惑', icon: '🔮', page: '/pages/chat/index' }
]

const auditMode = computed(() => userStore.auditMode)

const activeServices = computed(() => {
  if (auditMode.value) {
    // 审核模式下只展示“星座能量”和“空间美学”这两个完全符合个人主体合规要求的板块
    return services.filter(s => s.id === 'constellation' || s.id === 'fengshui')
  }
  return services
})

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
    let loginToast = null
    try {
      const loginRes = await userStore.login()
      if (!loginRes.success) {
        loginToast = { title: loginRes.message || '快捷登录失败', icon: 'none' }
      }
    } catch (err) {
      loginToast = { title: err.message || '登录失败，请手动登录', icon: 'none' }
    } finally {
      uni.hideLoading()
    }
    // loading 和 toast 共用同一个原生浮层，提示必须排在 hideLoading 之后
    if (loginToast) {
      uni.showToast(loginToast)
      return
    }
  }

  uni.showLoading({ title: '签到中...' })
  let toast = null
  try {
    const res = await checkInApi()
    if (res.code === 0) {
      toast = { title: '签到成功！', icon: 'success' }
      await userStore.fetchUserInfo()
    } else {
      toast = { title: res.message || '签到失败', icon: 'none' }
    }
  } catch (err) {
    toast = { title: err.message || '网络错误，请稍后重试', icon: 'none' }
  } finally {
    uni.hideLoading()
  }
  if (toast) uni.showToast(toast)
}

// 开启或关闭每日运势提醒。togglePush 返回 { ok, reason }，
// 失败必须把 switch 弹回去——否则屏幕上写着「已开启」而实际没有
const togglePush = async (e) => {
  const value = e.detail.value
  // showLoading 和 showToast 共用同一个原生浮层：提示必须排在 hideLoading 之后
  let toast = null
  uni.showLoading({ title: value ? '订阅中...' : '关闭中...' })
  try {
    const result = await pushStore.togglePush(value)
    if (result.ok) {
      pushSwitchOn.value = value
      toast = { title: result.reason || '已保存', icon: 'none' }
    } else {
      pushSwitchOn.value = pushStore.pushEnabled
      toast = { title: result.reason || '操作失败', icon: 'none' }
    }
  } catch (err) {
    pushSwitchOn.value = pushStore.pushEnabled
    toast = { title: err?.message || '设置推送失败，请重试', icon: 'none' }
  } finally {
    uni.hideLoading()
  }
  if (toast) uni.showToast(toast)
}

// 开关置灰时点上去毫无反应——那就等于屏幕上摆着一个按不动的按钮。
// 这里把原因说出来，并顺手重拉一次配置：上一次很可能只是网络抖动
// （启动早期会出现「读取推送配置失败: 网络请求失败」，之后 configured 一直是 false）。
// 只在置灰时才提示，配齐后这一行不抢 switch 自己的 change 事件。
const onPushRowTap = () => {
  if (pushConfigured.value) return
  uni.showToast({
    title: pushStore.loadError
      ? `推送状态没能加载出来：${pushStore.loadError}`
      : '服务端还没配好订阅消息模板，暂时无法开启',
    icon: 'none',
    duration: 2500
  })
  pushStore.refresh()
}

// 弹出快捷设置抽屉
const openBirthDrawer = () => {
  const info = userStore.userInfo?.birthInfo || {}
  tempBirthDate.value = info.solarDate || ''
  // 认不出就留空让用户自己选，别默认成 timeSlots[0]（子时）——那等于替用户编一个时柱
  tempSelectedTime.value = timeSlots.find(t => t.value === info.birthTime) || null
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
  // 时辰是四柱里的时柱，服务端只认十二时辰。以前这里会传「未知」，
  // 被 validator 拒成 400（更早的版本则静默按子时排盘，结果是错的）
  if (!tempSelectedTime.value) {
    uni.showToast({ title: '请先选择出生时辰', icon: 'none' })
    return
  }

  uni.showLoading({ title: '保存并分析中...' })
  let toast = null
  try {
    // 若未登录，先静默登录
    if (!userStore.isLoggedIn) {
      const loginRes = await userStore.login()
      if (!loginRes.success) {
        throw new Error(loginRes.message || '微信快捷登录失败，请重试')
      }
    }

    // 更新生日密码
    const res = await updateBirthInfoApi({
      solarDate: tempBirthDate.value,
      birthTime: tempSelectedTime.value.value,
      gender: tempGender.value
    })

    if (res.code === 0) {
      toast = { title: '专属灵感生成成功', icon: 'success' }
      await userStore.fetchUserInfo()
      showBirthModal.value = false
      await loadDailyFortune()
    } else {
      toast = { title: res.message || '配置失败', icon: 'none' }
    }
  } catch (err) {
    toast = { title: err.message || '操作失败', icon: 'none' }
  } finally {
    uni.hideLoading()
  }
  // loading 和 toast 共用同一个原生浮层，提示必须排在 hideLoading 之后，
  // 否则 finally 里的 hideLoading 会把刚弹出来的提示一起关掉
  if (toast) uni.showToast(toast)
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
  // 本地快照只为首屏先画点东西，权威状态靠 refresh() 从服务端拿
  pushStore.initFromStorage()
  // 模板 ID 必须在用户点开关**之前**就在手上：
  // wx.requestSubscribeMessage 要求由用户点击触发，中间夹一次网络请求容易被判失败
  pushStore.ensureConfig()
  if (isLoggedIn.value) {
    pushStore.refresh()
  }
  // 计算神兽初始右下角位置 (避开底部 tabbar 且支持拖拽)
  try {
    const { windowWidth, windowHeight } = getWindowSize()
    const assistantWidth = 150 // 300rpx in px
    const assistantHeight = 120 // 240rpx in px
    // 初始距离右侧 15px，距离底端 110px (避开 50px tabbar + 内容)
    assistantX.value = windowWidth - assistantWidth - 15
    assistantY.value = windowHeight - assistantHeight - 110
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
  transition: opacity 0.3s ease;
}

.floating-assistant.is-on-left {
  align-items: flex-start;
}

.floating-assistant.is-idle {
  opacity: 0.45;
}

.floating-assistant.is-idle:active {
  opacity: 1;
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

.icp-footer {
  text-align: center;
  padding: 40rpx 0;
  margin-top: 20rpx;
  width: 100%;
}
.icp-link {
  font-size: 24rpx;
  color: var(--text-secondary, #999);
  text-decoration: none;
  transition: color 0.3s;
}
.icp-link:hover {
  color: var(--primary-color, #c41e3a);
}

/* 微信一键绑定手机号弹窗样式 */
.bind-phone-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(15rpx);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 99999;
}

.bind-phone-body {
  width: 80%;
  max-width: 600rpx;
  background: var(--card-bg, #fff);
  border-radius: 30rpx;
  padding: 50rpx 40rpx;
  box-shadow: 0 20rpx 50rpx rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.bind-phone-icon {
  font-size: 88rpx;
  margin-bottom: 30rpx;
}

.bind-phone-title {
  font-size: 36rpx;
  font-weight: bold;
  color: var(--text-primary, #333);
  margin-bottom: 20rpx;
}

.bind-phone-desc {
  font-size: 26rpx;
  color: var(--text-secondary, #666);
  line-height: 1.6;
  margin-bottom: 40rpx;
}

.bind-phone-agreement {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  font-size: 22rpx;
  color: var(--text-secondary, #666);
  margin-bottom: 40rpx;
  gap: 4rpx;
}

.agreement-label {
  display: flex;
  align-items: center;
}

.agreement-link {
  color: var(--primary-color, #c41e3a);
  text-decoration: underline;
  display: inline;
}

.bind-phone-submit-btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  background: var(--primary-color, #c41e3a);
  color: #fff;
  font-size: 30rpx;
  font-weight: bold;
  border-radius: 44rpx;
  box-shadow: 0 6rpx 16rpx rgba(196, 30, 58, 0.2);
  border: none;
}

.bind-phone-submit-btn[disabled] {
  opacity: 0.5;
  box-shadow: none;
}
.bind-phone-submit-btn::after {
  border: none;
}
</style>
