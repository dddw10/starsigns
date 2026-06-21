<template>
  <page-meta :page-style="'overflow:' + (isDrawerOrPopupOpen ? 'hidden' : 'visible')"></page-meta>
  <view class="page-container" :class="themeClass">
    <view class="mystic-orb orb-1"></view>
    <view class="mystic-orb orb-2"></view>

    <!-- 用户头部 -->
    <view class="user-header">
      <view class="avatar-section">
        <image class="avatar" :src="userInfo.avatar || '/static/default-avatar.png'" mode="aspectFill"></image>
        <view class="user-info">
          <text class="nickname">{{ userInfo.nickname || '未登录' }}</text>
          <view class="badge-row">
            <text class="vip-badge" v-if="userInfo.vipLevel">VIP {{ userInfo.vipLevel }}</text>
            <text class="xian-badge" v-if="isLoggedIn">{{ xianTitle }}</text>
          </view>
        </view>
      </view>
      <button class="login-btn" v-if="!isLoggedIn" @click="login">微信登录</button>
    </view>

    <!-- 运势守护神兽卡片 (登录后展示) -->
    <view class="guardian-card" v-if="isLoggedIn && petData">
      <view class="guardian-header-wrap">
        <view class="title-wrap">
          <text class="guardian-title">☯️ 气运守护神兽</text>
          <text class="guardian-level">Lv.{{ petData.level }}{{ petData.level >= 30 ? '' : '/30' }} ({{ getStageName(petData.level) }})</text>
        </view>
        <view class="rename-btn" @click="startRename">
          <text class="beast-name">{{ petData.name || '神秘神兽' }}</text>
          <text class="rename-icon">✏️</text>
        </view>
      </view>
      
      <view class="guardian-body">
        <view class="beast-avatar-wrap" :class="[petData.type, getStageClass(petData.level)]">
          <view class="aura-particles" v-if="petData.type !== 'egg'"></view>
          <text class="beast-emoji">{{ getBeastEmoji(petData.type, petData.level) }}</text>
        </view>
        
        <view class="beast-status-col">
          <!-- 经验值条 -->
          <view class="status-bar-item">
            <text class="status-label">灵气</text>
            <view class="bar-outer">
              <view class="bar-inner exp-bar" :style="{ width: expPercent + '%' }"></view>
            </view>
            <text class="status-num">{{ petData.exp }}/{{ getLevelMaxExp(petData.level) }}</text>
          </view>
          
          <!-- 饱食度条 -->
          <view class="status-bar-item">
            <text class="status-label">饱食</text>
            <view class="bar-outer">
              <view class="bar-inner hunger-bar" :class="{ low: petData.hunger < 20 }" :style="{ width: petData.hunger + '%' }"></view>
            </view>
            <text class="status-num">{{ petData.hunger }}/100</text>
          </view>

          <!-- 心情值条 -->
          <view class="status-bar-item">
            <text class="status-label">心情</text>
            <view class="bar-outer">
              <view class="bar-inner mood-bar" :class="{ low: petData.mood < 30 }" :style="{ width: petData.mood + '%' }"></view>
            </view>
            <text class="status-num">{{ petData.mood }}/100</text>
          </view>
        </view>
      </view>

      <view class="beast-buff-desc" v-if="petData.type !== 'egg'">
        <text class="buff-icon">✨</text>
        <text class="buff-text">{{ getBeastBuffDesc(petData.type, petData.level) }}</text>
      </view>

      <view class="beast-words">
        <text class="words-bubble">💬 {{ getBeastWords(petData) }}</text>
      </view>

      <!-- 交互操作按钮区 -->
      <view class="beast-actions">
        <button class="beast-btn feed" @click="showFeedDrawer = true">🌾 喂食</button>
        <button class="beast-btn stroke" @click="onInteractPet">🫳 抚摸</button>
        <button class="beast-btn gift" :class="{ active: petData.giftBoxes > 0 }" @click="onOpenGiftBox">
          🎁 福袋 <text class="gift-badge" v-if="petData.giftBoxes > 0">{{ petData.giftBoxes }}</text>
        </button>
      </view>

    </view>

    <!-- 测算统计 -->
    <view class="stats-section">
      <view class="stat-item">
        <text class="stat-value">{{ userInfo.totalUsage || 0 }}</text>
        <text class="stat-label">总测算数</text>
      </view>
      <view class="stat-item">
        <text class="stat-value">{{ userInfo.fortuneQuota || 0 }}</text>
        <text class="stat-label">剩余次数</text>
      </view>
      <view class="stat-item" @click="navigateTo('/pages/history/index')">
        <text class="stat-value">{{ historyCount }}</text>
        <text class="stat-label">历史底簿</text>
      </view>
    </view>

    <!-- 菜单选项 -->
    <view class="menu-section">
      <view class="menu-item" @click="navigateTo('/pages/history/index')">
        <text class="menu-icon">📋</text>
        <text class="menu-name">历史记录底簿</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @click="navigateTo('/pages/vip/index')">
        <text class="menu-icon">👑</text>
        <text class="menu-name">会员中心</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @click="navigateTo('/pages/push-settings/index')">
        <text class="menu-icon">🔔</text>
        <text class="menu-name">每日气运推送设置</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @click="toggleTheme">
        <text class="menu-icon">🎨</text>
        <text class="menu-name">道法主题切换</text>
        <text class="menu-value">{{ themeName }}</text>
        <text class="menu-arrow">›</text>
      </view>
    </view>

    <view class="menu-section">
      <view class="menu-item" @click="showAbout">
        <text class="menu-icon">ℹ️</text>
        <text class="menu-name">关于我们</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @click="showFeedback">
        <text class="menu-icon">💬</text>
        <text class="menu-name">意见反馈</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item admin-menu-item" v-if="userInfo.memberLevel >= 2" @click="showAdminPanel">
        <text class="menu-icon">🛡️</text>
        <text class="menu-name">管理端：意见反馈处理</text>
        <text class="menu-arrow">›</text>
      </view>
    </view>

    <view class="disclaimer">
      <text>本小程序测算仅供趣味娱乐，切勿过度迷信</text>
    </view>

    <!-- 喂食抽屉面板 -->
    <view class="feed-drawer" v-if="showFeedDrawer" @click="showFeedDrawer = false">
      <view class="feed-content" @click.stop>
        <view class="feed-header">
          <text class="feed-title">🌾 仙家神兽粮仓 🌾</text>
          <text class="feed-close" @click="showFeedDrawer = false">✕</text>
        </view>
        <scroll-view class="feed-scroll-view" scroll-y>
          <view class="feed-items-grid">
            <view class="feed-item-card" v-for="(item, key) in foodItems" :key="key">
              <text class="food-icon">{{ item.icon }}</text>
              <view class="food-detail">
                <view class="food-name-row">
                  <text class="food-name">{{ item.name }}</text>
                  <text class="food-stock">库存: {{ petData.inventory[key] || 0 }}</text>
                </view>
                <text class="food-effect">饱食度+{{ item.hunger }} 灵气+{{ item.exp }}</text>
              </view>
              <button 
                class="feed-action-btn" 
                :disabled="!(petData.inventory[key] > 0)" 
                @click="onFeedPet(key)"
              >投喂</button>
            </view>
          </view>
        </scroll-view>
      </view>
    </view>

    <!-- 意见反馈弹窗 -->
    <view class="feedback-modal" v-if="showFeedbackPopup" @click="showFeedbackPopup = false">
      <view class="feedback-content-card" @click.stop>
        <view class="feedback-header">
          <text class="feedback-title">🔮 意见反馈 🔮</text>
          <text class="feedback-close" @click="showFeedbackPopup = false">✕</text>
        </view>
        
        <!-- 反馈 Tab 选择器 -->
        <view class="feedback-tabs">
          <view class="feedback-tab" :class="{ active: feedbackTab === 'submit' }" @click="setFeedbackTab('submit')">提交反馈</view>
          <view class="feedback-tab" :class="{ active: feedbackTab === 'history' }" @click="setFeedbackTab('history')">反馈历史</view>
        </view>

        <view class="feedback-body">
          <block v-if="feedbackTab === 'submit'">
            <text class="feedback-label">反馈类型</text>
            <view class="feedback-type-group">
              <view class="feedback-type-btn" :class="{ active: feedbackType === 'suggestion' }" @click="feedbackType = 'suggestion'">🔮 建议</view>
              <view class="feedback-type-btn" :class="{ active: feedbackType === 'bug' }" @click="feedbackType = 'bug'">🐛 缺陷</view>
              <view class="feedback-type-btn" :class="{ active: feedbackType === 'other' }" @click="feedbackType = 'other'">✨ 其他</view>
            </view>

            <text class="feedback-label">反馈内容</text>
            <textarea 
              class="feedback-textarea" 
              v-model="feedbackContent" 
              placeholder="请填写您遇到的问题，或想要增加的测算功能..." 
              placeholder-style="color: var(--text-secondary, #999);"
              maxlength="500"
            />
            <text class="word-counter">{{ feedbackContent.length }}/500</text>

            <text class="feedback-label">联系方式 (选填)</text>
            <input 
              class="feedback-input" 
              v-model="feedbackContact" 
              placeholder="微信、手机号或邮箱，方便与您沟通" 
              placeholder-style="color: var(--text-secondary, #999);"
              maxlength="100"
            />

            <button class="feedback-submit-btn" :disabled="!feedbackContent.trim()" @click="submitFeedback">
              提交反馈
            </button>
          </block>

          <block v-else>
            <scroll-view class="feedback-history-scroll" scroll-y>
              <view v-if="userFeedbackList.length === 0" class="no-feedback-tips">
                <text>您还没有提交过反馈记录哦~</text>
              </view>
              <view v-else class="feedback-history-list">
                <view class="feedback-history-item" v-for="item in userFeedbackList" :key="item._id">
                  <view class="history-item-header">
                    <text class="history-type-tag" :class="item.type">{{ getFeedbackTypeName(item.type) }}</text>
                    <text class="history-time">{{ formatTime(item.createdAt) }}</text>
                  </view>
                  <text class="history-content">{{ item.content }}</text>
                  <view class="history-contact-row" v-if="item.contact">
                    <text class="contact-label">联系方式:</text>
                    <text class="contact-val">{{ item.contact }}</text>
                  </view>
                  
                  <view class="history-reply-box" v-if="item.status === 'processed'">
                    <view class="reply-header">
                      <text class="reply-tag">☯️ 天师回复:</text>
                      <text class="reply-time">{{ formatTime(item.replyAt) }}</text>
                    </view>
                    <text class="reply-text">{{ item.replyContent || '您提交的意见已采纳！' }}</text>
                    <view class="reply-bonus-granted" v-if="item.rewardGranted">
                      <text class="bonus-icon">🎁</text>
                      <text class="bonus-text">此反馈已被采纳，奖励 3 次免费测算额度已充入您的账户！</text>
                    </view>
                  </view>
                  <view class="history-pending-box" v-else>
                    <text class="pending-tag">⏳ 等待天师开示...</text>
                  </view>
                </view>
              </view>
            </scroll-view>
          </block>
        </view>
      </view>
    </view>

    <!-- 管理端意见反馈处理弹窗 -->
    <view class="admin-feedback-modal" v-if="showAdminFeedbackPopup" @click="showAdminFeedbackPopup = false">
      <view class="admin-feedback-card" @click.stop>
        <view class="admin-feedback-header">
          <text class="admin-feedback-title">🛡️ 反馈控制中心 (Admin)</text>
          <text class="admin-feedback-close" @click="showAdminFeedbackPopup = false">✕</text>
        </view>
        
        <!-- 过滤选择区 -->
        <view class="admin-filter-bar">
          <picker @change="onAdminStatusFilterChange" :value="adminStatusIndex" :range="adminStatusOptions">
            <view class="filter-picker">
              状态: <text class="picker-value">{{ adminStatusOptions[adminStatusIndex] }}</text>
            </view>
          </picker>
          <picker @change="onAdminTypeFilterChange" :value="adminTypeIndex" :range="adminTypeOptions">
            <view class="filter-picker">
              类型: <text class="picker-value">{{ adminTypeOptions[adminTypeIndex] }}</text>
            </view>
          </picker>
        </view>

        <view class="admin-feedback-body">
          <scroll-view class="admin-feedback-scroll" scroll-y>
            <view v-if="adminFeedbackList.length === 0" class="no-feedback-tips">
              <text>暂无符合条件的反馈数据</text>
            </view>
            <view v-else class="admin-list-container">
              <view class="admin-feedback-item" v-for="item in adminFeedbackList" :key="item._id">
                <view class="admin-item-header">
                  <view class="user-profile">
                    <image class="admin-user-avatar" :src="item.userId?.avatar || '/static/default-avatar.png'" mode="aspectFill"></image>
                    <view class="admin-user-name-col">
                      <text class="admin-user-name">{{ item.userId?.nickname || '匿名用户' }}</text>
                      <text class="admin-user-vip" v-if="item.userId?.memberLevel">VIP {{ item.userId.memberLevel }}</text>
                    </view>
                  </view>
                  <text class="history-type-tag" :class="item.type">{{ getFeedbackTypeName(item.type) }}</text>
                </view>
                
                <text class="admin-feedback-text">{{ item.content }}</text>
                
                <view class="admin-contact-row" v-if="item.contact">
                  <text class="contact-label">联系方式:</text>
                  <text class="contact-val">{{ item.contact }}</text>
                </view>
                <text class="admin-item-time">{{ formatTime(item.createdAt) }}</text>

                <!-- 回复及采纳状态 -->
                <view class="admin-reply-status-section">
                  <view class="admin-replied-box" v-if="item.status === 'processed'">
                    <text class="reply-status-label">已处理</text>
                    <text class="reply-status-text">回复: {{ item.replyContent }}</text>
                    <text class="reply-status-bonus" v-if="item.rewardGranted">🎁 已赠送 3 次额度</text>
                  </view>
                  <view class="admin-pending-action" v-else>
                    <button class="admin-action-btn-reply" @click="openReplyDialog(item)">
                      ✍️ 批示回复并采纳
                    </button>
                  </view>
                </view>
              </view>
            </view>
          </scroll-view>
        </view>
      </view>
    </view>

    <!-- 管理员批复输入弹窗 -->
    <view class="reply-modal" v-if="showReplyModal" @click="showReplyModal = false">
      <view class="reply-card" @click.stop>
        <view class="reply-header">
          <text class="reply-title">✍️ 天师开示批复</text>
          <text class="reply-close" @click="showReplyModal = false">✕</text>
        </view>
        <view class="reply-body">
          <view class="feedback-preview-box">
            <text class="preview-title">反馈原件:</text>
            <text class="preview-content">{{ selectedFeedbackForReply?.content }}</text>
          </view>
          <text class="reply-label">批复回复 (此操作将同步为用户赠送 3 次测算额度)</text>
          <textarea 
            class="reply-textarea" 
            v-model="replyText" 
            placeholder="请输入官方批复指导意见，例如：已修复该问题 / 建议已采纳，感谢您的支持..." 
            maxlength="300"
          />
          <button class="reply-submit-btn" :disabled="!replyText.trim()" @click="submitReply">
            发送回复并赠礼
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useThemeStore } from '@/store/theme'
import { useUserStore } from '@/store/user'
import { getFortuneRecordsApi } from '@/api/fortune'
import {
  getPetStatusApi,
  feedPetApi,
  interactPetApi,
  renamePetApi,
  drawPetRewardApi
} from '@/api/pet'
import {
  submitFeedbackApi,
  getUserFeedbackListApi,
  getAdminFeedbackListApi,
  replyFeedbackApi
} from '@/api/user'

const themeStore = useThemeStore()
const userStore = useUserStore()

const isLoggedIn = computed(() => userStore.isLoggedIn)
const userInfo = computed(() => userStore.userInfo || {})
const historyCount = ref(0)

const themeName = computed(() => {
  const names = { chinese: '中国风', modern: '现代简约', dark: '神秘暗黑', cute: '卡通可爱' }
  return names[themeStore.currentTheme] || '中国风'
})

// 依据测算次数动态授予修真称号，增加留存趣味性
const xianTitle = computed(() => {
  if (!isLoggedIn.value) return '凡人'
  const count = historyCount.value
  if (count === 0) return '凡人'
  if (count <= 2) return '寻道学者'
  if (count <= 5) return '见习天师'
  if (count <= 8) return '金丹居士'
  return '飞升真仙'
})

// 神兽数据相关
const petData = ref(null)
const showFeedDrawer = ref(false)

// 反馈及管理后台相关状态
const showFeedbackPopup = ref(false)
const feedbackTab = ref('submit') // 'submit' or 'history'
const feedbackType = ref('suggestion')
const feedbackContent = ref('')
const feedbackContact = ref('')
const userFeedbackList = ref([])

// 管理端状态
const showAdminFeedbackPopup = ref(false)
const adminFeedbackList = ref([])
const adminStatusIndex = ref(0)
const adminStatusOptions = ['全部状态', '待处理', '已处理']
const adminStatusValues = ['all', 'pending', 'processed']

const adminTypeIndex = ref(0)
const adminTypeOptions = ['全部类型', '建议', '缺陷', '其他']
const adminTypeValues = ['all', 'suggestion', 'bug', 'other']

const showReplyModal = ref(false)
const selectedFeedbackForReply = ref(null)
const replyText = ref('')

// 监听抽屉或反馈弹窗打开状态，打开时隐藏原生TabBar，关闭时恢复，防止遮挡或点击穿透
const isDrawerOrPopupOpen = computed(() => 
  showFeedDrawer.value || 
  showFeedbackPopup.value || 
  showAdminFeedbackPopup.value || 
  showReplyModal.value
)
watch(isDrawerOrPopupOpen, (val) => {
  if (val) {
    uni.hideTabBar()
  } else {
    uni.showTabBar()
  }
})

const foodItems = {
  coarseGrass: { name: '粗粮仙草', icon: '🌿', hunger: 10, exp: 10 },
  morningDew: { name: '晨露琼浆', icon: '💧', hunger: 30, exp: 40 },
  wuguPill: { name: '五谷朱砂丹', icon: '🔥', hunger: 60, exp: 90 },
  taijiPeach: { name: '太极蟠桃', icon: '🍑', hunger: 100, exp: 200 }
}

const expPercent = computed(() => {
  if (!petData.value) return 0
  const max = getLevelMaxExp(petData.value.level)
  return Math.min(100, (petData.value.exp / max) * 100)
})

function getLevelMaxExp(level) {
  return 100 * level * level
}

function getStageName(level) {
  if (level <= 0) return '封印态'
  if (level < 10) return '幼兽期'
  if (level < 20) return '灵兽期'
  if (level < 30) return '仙兽期'
  return '极境神兽 (已封神)'
}

function getStageClass(level) {
  if (level <= 0) return 'stage-egg'
  if (level < 10) return 'stage-young'
  if (level < 20) return 'stage-spiritual'
  if (level < 30) return 'stage-immortal'
  return 'stage-divine'
}

function getBeastEmoji(type, level) {
  if (level === 0 || type === 'egg') return '🥚'
  
  if (type === 'qinglong') {
    if (level < 10) return '🐲' // 幼龙首
    if (level < 20) return '🐉' // 游渊青龙
    if (level < 30) return '🦖' // 霸气苍龙
    return '⚡🐲' // 混沌神龙
  }
  if (type === 'zhuque') {
    if (level < 10) return '🐣' // 雀雏
    if (level < 20) return '🐦' // 灵雀
    if (level < 30) return '🦅' // 烈羽飞鹰
    return '🔥🦚' // 九天朱雀
  }
  if (type === 'baihu') {
    if (level < 10) return '🐱' // 奶猫
    if (level < 20) return '🐯' // 猛虎头
    if (level < 30) return '🐆' // 金钱豹
    return '🐅' // 震山白虎
  }
  if (type === 'xuanwu') {
    if (level < 10) return '🐢' // 灵龟仔
    if (level < 20) return '🐢' // 旋甲龟
    if (level < 30) return '🐊' // 冥鳄兽
    return '🐲🐢' // 玄武神明
  }
  if (type === 'qilin') {
    if (level < 10) return '🦌' // 幼麟鹿
    if (level < 20) return '🐐' // 独角仙兽
    if (level < 30) return '🦄' // 飞天麒麟
    return '👑🦄' // 万兽至尊
  }
  return '🐾'
}

function getBeastBuffDesc(type, level) {
  const buffs = {
    egg: '生命能量积蓄中...',
    qinglong: `乾坤木灵：学业/事业运测算额外获得灵气`,
    zhuque: `烈焰离火：姻缘运契合度上限提升 5%`,
    baihu: `庚金太白：每日有 10% 概率触发偏财宝箱`,
    xuanwu: `北冥玄冥：守护神兽饱食度流失减慢 20%`,
    qilin: `祥瑞福泽：福袋金色奖励掉率提升 2%`
  }
  return buffs[type] || '加成激活中...'
}

function getBeastWords(pet) {
  if (pet.type === 'egg') {
    return '咕噜咕噜... 蛋里好像有什么祥瑞生灵正在孕育，填写我的生辰排盘即可孵化哦！'
  }
  if (pet.hunger < 20) {
    return '主人... 我肚子饿得咕咕叫，没力气帮你推算今日气场了，快给我喂点好吃的 🥺'
  }
  if (pet.mood < 30) {
    return '呜呜，主人好久都没摸摸我了，今天的心情跌入谷底，感觉运势都暗淡了 😭'
  }
  
  const words = {
    qinglong: '青龙主木，代表生机勃勃。主人，今天你的事业学业方向贵人气象极佳哦！',
    zhuque: '离火离火，朱雀展翅。我感受到今天南方有融融暖气，桃花指数拉满！',
    baihu: '西方白虎，庚金锐气。看我帮你撕碎今天所有的霉运和是非阻碍！',
    xuanwu: '玄水护体，太极阴阳。家宅安宁最重要，主人记得作息规律哦~',
    qilin: '瑞兽踏祥云，乾坤如意。主人今天各方气运平稳上行，百无禁忌！'
  }
  return words[pet.type] || '守护气运，伴您左右！'
}

// 加载神兽状态
const loadPetStatus = async () => {
  if (!isLoggedIn.value) {
    petData.value = null
    return
  }
  try {
    const res = await getPetStatusApi()
    if (res.code === 0) {
      petData.value = res.data
    }
  } catch (e) {
    console.error('获取神兽状态失败:', e)
  }
}

// 投喂神兽
const onFeedPet = async (itemType) => {
  try {
    const res = await feedPetApi(itemType)
    if (res.code === 0) {
      petData.value = res.data.pet
      uni.showToast({ title: `成功投喂，饱食度+${res.data.addedHunger}`, icon: 'success' })
      if (res.data.didLevelUp) {
        uni.showModal({
          title: '🌟 神兽境界突破 🌟',
          content: `恭喜！您的神兽升级到了 Lv.${res.data.pet.level}！\n并获得了一个【八卦福袋】奖励！`,
          showCancel: false
        })
      }
    }
  } catch (e) {
    uni.showToast({ title: e.message || '投喂失败', icon: 'none' })
  }
}

// 抚摸神兽
const onInteractPet = async () => {
  try {
    const res = await interactPetApi()
    if (res.code === 0) {
      petData.value = res.data.pet
      uni.showToast({ title: '摸摸头，心情值 +10！', icon: 'none' })
      if (res.data.didLevelUp) {
        uni.showModal({
          title: '🌟 神兽境界突破 🌟',
          content: `恭喜！您的神兽升级到了 Lv.${res.data.pet.level}！\n并获得了一个【八卦福袋】奖励！`,
          showCancel: false
        })
      }
    }
  } catch (e) {
    uni.showToast({ title: e.message || '抚摸失败', icon: 'none' })
  }
}

// 修改昵称
const startRename = () => {
  uni.showModal({
    title: '自定义神兽尊名',
    editable: true,
    placeholderText: '请输入昵称(10字内)',
    success: async (res) => {
      if (res.confirm && res.content) {
        try {
          const apiRes = await renamePetApi(res.content)
          if (apiRes.code === 0) {
            petData.value = apiRes.data
            uni.showToast({ title: '已赐名', icon: 'success' })
          }
        } catch (e) {
          uni.showToast({ title: e.message || '赐名失败', icon: 'none' })
        }
      }
    }
  })
}

// 开启福袋
const onOpenGiftBox = async () => {
  if (!petData.value) return
  if (petData.value.giftBoxes <= 0) {
    uni.showToast({
      title: '暂无八卦福袋，每日签到或进行运势测算可获得哦~',
      icon: 'none'
    })
    return
  }
  uni.showLoading({ title: '开福袋中...' })
  try {
    const res = await drawPetRewardApi()
    if (res.code === 0) {
      petData.value = res.data.pet
      uni.hideLoading()
      uni.showModal({
        title: `🎁 获得：${res.data.rewardName}`,
        content: res.data.rewardDesc,
        showCancel: false
      })
      await userStore.fetchUserInfo() // 刷新VIP状态等
    }
  } catch (e) {
    uni.hideLoading()
    uni.showToast({ title: e.message || '开启福袋失败', icon: 'none' })
  }
}

const loadStats = async () => {
  if (!isLoggedIn.value) {
    historyCount.value = 0
    return
  }
  try {
    const res = await getFortuneRecordsApi({ page: 1, pageSize: 1 })
    if (res.code === 0 && res.data) {
      historyCount.value = res.data.total || 0
    }
  } catch (e) {
    console.error('加载历史记录失败:', e)
  }
}

onShow(() => {
  if (userStore.isLoggedIn) {
    userStore.fetchUserInfo()
    loadStats()
    loadPetStatus()
  }
  // 确保切回该页面时原生 TabBar 显示，防止状态异常
  uni.showTabBar()
  showFeedDrawer.value = false
})

const login = async () => {
  const result = await userStore.login()
  if (result.success) {
    uni.showToast({ title: '已开悟登录', icon: 'success' })
    loadStats()
    loadPetStatus()
  } else {
    uni.showToast({ title: result.message || '登录失败', icon: 'none' })
  }
}

const navigateTo = (url) => {
  uni.navigateTo({ url })
}

const toggleTheme = () => {
  const themes = ['chinese', 'modern', 'dark', 'cute']
  const currentIndex = themes.indexOf(themeStore.currentTheme)
  const nextIndex = (currentIndex + 1) % themes.length
  themeStore.setTheme(themes[nextIndex])
  uni.showToast({ title: `已切换为${themeName.value}`, icon: 'none' })
}

const showAbout = () => {
  uni.showModal({
    title: '关于算命大师',
    content: '阳阴八字、玄学堪舆、塔罗星象。本小程序所有批注结果由智能命理解析引擎生成，仅供娱乐与行事参考，祝您顺风顺水。',
    showCancel: false
  })
}

const showFeedback = () => {
  if (!isLoggedIn.value) {
    uni.showToast({ title: '请先登录后再提交反馈', icon: 'none' })
    return
  }
  feedbackTab.value = 'submit'
  feedbackType.value = 'suggestion'
  feedbackContent.value = ''
  feedbackContact.value = ''
  showFeedbackPopup.value = true
}

const setFeedbackTab = async (tab) => {
  feedbackTab.value = tab
  if (tab === 'history') {
    await loadUserFeedbackHistory()
  }
}

const loadUserFeedbackHistory = async () => {
  if (!isLoggedIn.value) return
  uni.showLoading({ title: '加载中...' })
  try {
    const res = await getUserFeedbackListApi({ page: 1, pageSize: 50 })
    if (res.code === 0 && res.data) {
      userFeedbackList.value = res.data.list || []
    }
  } catch (e) {
    uni.showToast({ title: e.message || '加载历史反馈失败', icon: 'none' })
  } finally {
    uni.hideLoading()
  }
}

const submitFeedback = async () => {
  if (!feedbackContent.value.trim()) {
    uni.showToast({ title: '反馈内容不能为空', icon: 'none' })
    return
  }
  uni.showLoading({ title: '正在提交反馈...' })
  try {
    const res = await submitFeedbackApi({
      type: feedbackType.value,
      content: feedbackContent.value.trim(),
      contact: feedbackContact.value.trim() || undefined
    })
    if (res.code === 0) {
      uni.showToast({ title: '反馈提交成功，多谢支持！', icon: 'success' })
      showFeedbackPopup.value = false
    } else {
      uni.showToast({ title: res.message || '提交失败', icon: 'none' })
    }
  } catch (err) {
    uni.showToast({ title: err.message || '提交异常', icon: 'none' })
  } finally {
    uni.hideLoading()
  }
}

// 管理端操作方法
const showAdminPanel = async () => {
  adminStatusIndex.value = 0
  adminTypeIndex.value = 0
  showAdminFeedbackPopup.value = true
  await loadAdminFeedbacks()
}

const loadAdminFeedbacks = async () => {
  uni.showLoading({ title: '拉取反馈中...' })
  try {
    const params = { page: 1, pageSize: 100 }
    const statusVal = adminStatusValues[adminStatusIndex.value]
    const typeVal = adminTypeValues[adminTypeIndex.value]
    if (statusVal !== 'all') params.status = statusVal
    if (typeVal !== 'all') params.type = typeVal
    
    const res = await getAdminFeedbackListApi(params)
    if (res.code === 0 && res.data) {
      adminFeedbackList.value = res.data.list || []
    }
  } catch (e) {
    uni.showToast({ title: e.message || '拉取数据失败', icon: 'none' })
  } finally {
    uni.hideLoading()
  }
}

const onAdminStatusFilterChange = (e) => {
  adminStatusIndex.value = e.detail.value
  loadAdminFeedbacks()
}

const onAdminTypeFilterChange = (e) => {
  adminTypeIndex.value = e.detail.value
  loadAdminFeedbacks()
}

const openReplyDialog = (item) => {
  selectedFeedbackForReply.value = item
  replyText.value = ''
  showReplyModal.value = true
}

const submitReply = async () => {
  if (!replyText.value.trim()) {
    uni.showToast({ title: '请输入回复内容', icon: 'none' })
    return
  }
  uni.showLoading({ title: '正在回复并赠礼...' })
  try {
    const res = await replyFeedbackApi(selectedFeedbackForReply.value._id, {
      replyContent: replyText.value.trim()
    })
    if (res.code === 0) {
      uni.showToast({ title: res.message || '已成功回复并采纳！', icon: 'success' })
      showReplyModal.value = false
      await loadAdminFeedbacks()
      // 重新载入当前用户信息（额度更新）
      await userStore.fetchUserInfo()
    } else {
      uni.showToast({ title: res.message || '回复失败', icon: 'none' })
    }
  } catch (e) {
    uni.showToast({ title: e.message || '回复异常', icon: 'none' })
  } finally {
    uni.hideLoading()
  }
}

// 辅助转换与格式化方法
const getFeedbackTypeName = (type) => {
  const names = { suggestion: '建议', bug: '缺陷', other: '其他' }
  return names[type] || '反馈'
}

const formatTime = (timeStr) => {
  if (!timeStr) return ''
  const date = new Date(timeStr)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${hh}:${mm}`
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

.user-header {
  background: var(--card-bg, #fff);
  border: 2rpx solid var(--border-color, #eee);
  border-radius: 24rpx;
  padding: 40rpx 30rpx;
  margin-bottom: 24rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: relative;
  z-index: 1;
  box-shadow: 0 4rpx 16rpx var(--card-shadow, rgba(0,0,0,0.05));
}
.theme-chinese .user-header {
  background: rgba(30, 20, 22, 0.6);
  border: 2rpx solid #6b1d28;
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.3);
}

.avatar-section {
  display: flex;
  align-items: center;
}

.avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  margin-right: 24rpx;
  border: 4rpx solid var(--secondary-color, #e5c158);
  box-shadow: 0 0 15rpx var(--card-shadow, rgba(229, 193, 88, 0.2));
}
.theme-chinese .avatar {
  border: 4rpx solid #e5c158;
  box-shadow: 0 0 15rpx rgba(229, 193, 88, 0.4);
}

.nickname {
  font-size: 34rpx;
  font-weight: bold;
  color: var(--text-color, #333333);
  display: block;
}
.theme-chinese .nickname {
  color: #fff;
}

.badge-row {
  display: flex;
  gap: 12rpx;
  margin-top: 10rpx;
}

.vip-badge {
  font-size: 20rpx;
  color: #161012;
  background: #e5c158;
  padding: 4rpx 14rpx;
  border-radius: 20rpx;
  font-weight: bold;
}

.xian-badge {
  font-size: 20rpx;
  color: #e5c158;
  background: rgba(229, 193, 88, 0.15);
  border: 1rpx solid #e5c158;
  padding: 2rpx 14rpx;
  border-radius: 20rpx;
  font-weight: bold;
  box-shadow: 0 0 8rpx rgba(229, 193, 88, 0.3);
}

.login-btn {
  background: var(--primary-color, #c41e3a);
  color: #fff;
  font-size: 26rpx;
  font-weight: bold;
  padding: 12rpx 36rpx;
  border-radius: 36rpx;
  border: none;
  box-shadow: 0 4rpx 12rpx var(--card-shadow, rgba(196, 30, 58, 0.2));
}
.theme-chinese .login-btn {
  background: linear-gradient(135deg, #c41e3a, #990f26);
  box-shadow: 0 4rpx 12rpx rgba(196, 30, 58, 0.4);
}

/* ==================== 气运神兽专属精美卡片 ==================== */
.guardian-card {
  background: var(--card-bg, #ffffff);
  border: 2rpx solid var(--border-color, #f0f0f0);
  border-radius: 32rpx;
  padding: 32rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 10rpx 35rpx var(--card-shadow, rgba(99, 102, 241, 0.05));
  position: relative;
  overflow: hidden;
  z-index: 1;
}

/* 中国风主题下的卡片微调：古风玄色玉石质感 */
.theme-chinese .guardian-card {
  background: linear-gradient(135deg, #1b1113 0%, #281417 100%);
  border: 2rpx solid #c8a261;
  box-shadow: 0 10rpx 40rpx rgba(153, 15, 38, 0.25), inset 0 0 16rpx rgba(200, 162, 97, 0.1);
}

/* 暗黑主题下的卡片微调：星空深渊霓虹质感 */
.theme-dark .guardian-card {
  background: linear-gradient(135deg, #0e0a1c 0%, #17102e 100%);
  border: 2rpx solid #7c3aed;
  box-shadow: 0 10rpx 40rpx rgba(124, 58, 237, 0.3);
}

.guardian-header-wrap {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
  border-bottom: 1rpx dashed var(--border-color, rgba(0,0,0,0.06));
  padding-bottom: 18rpx;
}
.theme-chinese .guardian-header-wrap {
  border-bottom: 1rpx dashed rgba(200, 162, 97, 0.25);
}
.theme-dark .guardian-header-wrap {
  border-bottom: 1rpx dashed rgba(124, 58, 237, 0.25);
}

.title-wrap {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.guardian-title {
  font-size: 24rpx;
  color: var(--text-secondary, #666);
  font-weight: 500;
}
.theme-chinese .guardian-title {
  color: #a69ebd;
}
.theme-dark .guardian-title {
  color: #a1a1aa;
}

.guardian-level {
  font-size: 22rpx;
  color: var(--primary-color, #c41e3a);
  font-weight: bold;
}
.theme-chinese .guardian-level {
  color: #e5c158;
  text-shadow: 0 0 8rpx rgba(229, 193, 88, 0.4);
}
.theme-dark .guardian-level {
  color: #a78bfa;
}

.rename-btn {
  display: flex;
  align-items: center;
  background: var(--input-bg, #f8f8f8);
  padding: 8rpx 20rpx;
  border-radius: 24rpx;
  border: 1rpx solid transparent;
  transition: all 0.2s ease;
}
.theme-chinese .rename-btn {
  background: rgba(200, 162, 97, 0.12);
  border: 1rpx solid rgba(200, 162, 97, 0.3);
}
.theme-dark .rename-btn {
  background: rgba(124, 58, 237, 0.15);
  border: 1rpx solid rgba(124, 58, 237, 0.3);
}

.beast-name {
  font-size: 26rpx;
  font-weight: bold;
  color: var(--secondary-color, #e5c158);
  margin-right: 8rpx;
}
.theme-chinese .beast-name {
  color: #e5c158;
}
.theme-dark .beast-name {
  color: #fbbf24;
}

.rename-icon {
  font-size: 22rpx;
}

.guardian-body {
  display: flex;
  align-items: center;
  gap: 32rpx;
  margin-bottom: 24rpx;
}

/* 动感神兽魔法台座 */
.beast-avatar-wrap {
  width: 140rpx;
  height: 140rpx;
  background: radial-gradient(circle, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.08) 100%);
  border: 3rpx solid var(--border-color, #e2e8f0);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  box-shadow: 0 8rpx 20rpx rgba(0,0,0,0.03);
}

/* 基于神兽类型的特色发光属性 */
.beast-avatar-wrap.egg {
  background: radial-gradient(circle, rgba(149, 165, 166, 0.15) 0%, rgba(149, 165, 166, 0.05) 70%);
  border-color: #95a5a6;
}
.beast-avatar-wrap.qinglong {
  background: radial-gradient(circle, rgba(46, 204, 113, 0.25) 0%, rgba(46, 204, 113, 0.02) 75%);
  border-color: #2ecc71;
  box-shadow: 0 0 18rpx rgba(46, 204, 113, 0.3);
}
.beast-avatar-wrap.zhuque {
  background: radial-gradient(circle, rgba(231, 76, 60, 0.25) 0%, rgba(231, 76, 60, 0.02) 75%);
  border-color: #e74c3c;
  box-shadow: 0 0 18rpx rgba(231, 76, 60, 0.4);
}
.beast-avatar-wrap.baihu {
  background: radial-gradient(circle, rgba(189, 195, 199, 0.25) 0%, rgba(189, 195, 199, 0.02) 75%);
  border-color: #bdc3c7;
  box-shadow: 0 0 18rpx rgba(189, 195, 199, 0.2);
}
.beast-avatar-wrap.xuanwu {
  background: radial-gradient(circle, rgba(52, 152, 219, 0.25) 0%, rgba(52, 152, 219, 0.02) 75%);
  border-color: #3498db;
  box-shadow: 0 0 18rpx rgba(52, 152, 219, 0.3);
}
.beast-avatar-wrap.qilin {
  background: radial-gradient(circle, rgba(241, 196, 15, 0.3) 0%, rgba(241, 196, 15, 0.02) 75%);
  border-color: #f1c40f;
  box-shadow: 0 0 20rpx rgba(241, 196, 15, 0.5);
}

.beast-emoji {
  font-size: 74rpx;
  z-index: 2;
}

/* 粒子波动光圈 */
.aura-particles {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  border-radius: 50%;
  border: 4rpx solid transparent;
  border-top-color: var(--secondary-color, #e5c158);
  border-bottom-color: var(--primary-color, #c41e3a);
  animation: rotateAura 5s linear infinite;
  z-index: 1;
}
.theme-chinese .aura-particles {
  border-top-color: #e5c158;
  border-bottom-color: #c41e3a;
}
.theme-dark .aura-particles {
  border-top-color: #a78bfa;
  border-bottom-color: #fbbf24;
}

@keyframes rotateAura {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.beast-status-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.status-bar-item {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.status-label {
  font-size: 22rpx;
  color: var(--text-secondary, #666);
  width: 50rpx;
  font-weight: 500;
}
.theme-chinese .status-label {
  color: #a69ebd;
}
.theme-dark .status-label {
  color: #a1a1aa;
}

.bar-outer {
  flex: 1;
  height: 18rpx;
  background: var(--input-bg, #f0f0f0);
  border-radius: 9rpx;
  overflow: hidden;
  box-shadow: inset 0 2rpx 6rpx rgba(0,0,0,0.06);
}
.theme-chinese .bar-outer {
  background: #1e1315;
}
.theme-dark .bar-outer {
  background: #110c22;
}

.bar-inner {
  height: 100%;
  border-radius: 9rpx;
  transition: width 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
  position: relative;
  background-size: 40rpx 40rpx;
}

/* 玻璃高光反光特效 */
.bar-inner::after {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; height: 35%;
  background: rgba(255, 255, 255, 0.15);
  border-top-left-radius: 9rpx;
  border-top-right-radius: 9rpx;
}

.exp-bar {
  background: linear-gradient(90deg, #8a2be2, #4a00e0);
}
.theme-chinese .exp-bar {
  background: linear-gradient(90deg, #9b59b6, #e5c158);
}
.theme-dark .exp-bar {
  background: linear-gradient(90deg, #7c3aed, #a78bfa);
}

.hunger-bar {
  background: linear-gradient(90deg, #11998e, #38ef7d);
}
.hunger-bar.low {
  background: linear-gradient(90deg, #f857a6, #ff5858);
}

.mood-bar {
  background: linear-gradient(90deg, #ff8008, #ffc837);
}
.mood-bar.low {
  background: linear-gradient(90deg, #ee0979, #ff6a00);
}

.status-num {
  font-size: 20rpx;
  color: var(--text-secondary, #999);
  width: 90rpx;
  text-align: right;
  font-family: monospace;
}
.theme-chinese .status-num {
  color: #887fa3;
}
.theme-dark .status-num {
  color: #71717a;
}

.beast-buff-desc {
  background: var(--input-bg, #f9f9f9);
  border-radius: 16rpx;
  padding: 14rpx 24rpx;
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 20rpx;
  border: 1rpx solid transparent;
}
.theme-chinese .beast-buff-desc {
  background: rgba(200, 162, 97, 0.08);
  border: 1rpx solid rgba(200, 162, 97, 0.15);
}
.theme-dark .beast-buff-desc {
  background: rgba(124, 58, 237, 0.08);
  border: 1rpx solid rgba(124, 58, 237, 0.15);
}

.buff-icon {
  font-size: 26rpx;
}

.buff-text {
  font-size: 22rpx;
  color: var(--primary-color, #c41e3a);
  font-weight: bold;
}
.theme-chinese .buff-text {
  color: #e5c158;
}
.theme-dark .buff-text {
  color: #a78bfa;
}

.beast-words {
  margin-bottom: 24rpx;
}

/* 经典RPG文字对话气泡框，自带指向头像的三角形小尾巴 */
.words-bubble {
  font-size: 24rpx;
  color: var(--text-color, #475569);
  line-height: 1.6;
  background: var(--input-bg, #f1f5f9);
  padding: 20rpx 28rpx;
  border-radius: 18rpx;
  display: block;
  position: relative;
  box-shadow: 0 4rpx 10rpx rgba(0,0,0,0.02);
}
.theme-chinese .words-bubble {
  background: rgba(255, 255, 255, 0.05);
  color: #eae6f3;
  border: 1rpx solid rgba(255, 255, 255, 0.05);
}
.theme-dark .words-bubble {
  background: rgba(255, 255, 255, 0.06);
  color: #f4f4f5;
  border: 1rpx solid rgba(255,255,255,0.05);
}

.words-bubble::before {
  content: '';
  position: absolute;
  left: 56rpx;
  top: -16rpx;
  border-width: 0 16rpx 16rpx 16rpx;
  border-style: solid;
  border-color: transparent transparent var(--input-bg, #f1f5f9) transparent;
}
.theme-chinese .words-bubble::before {
  border-color: transparent transparent rgba(30, 20, 22, 0.9) transparent;
}
.theme-dark .words-bubble::before {
  border-color: transparent transparent rgba(23, 16, 46, 0.9) transparent;
}

.beast-actions {
  display: flex;
  gap: 20rpx;
}

.beast-btn {
  flex: 1;
  height: 72rpx;
  line-height: 72rpx;
  font-size: 26rpx;
  border-radius: 36rpx;
  background: var(--input-bg, #e2e8f0);
  color: var(--text-color, #334155);
  font-weight: bold;
  border: none;
  box-shadow: 0 4rpx 10rpx rgba(0,0,0,0.04);
}
.theme-chinese .beast-btn {
  background: rgba(255, 255, 255, 0.08);
  color: #e2dcf0;
  border: 1rpx solid rgba(255, 255, 255, 0.1);
  box-shadow: none;
}
.theme-dark .beast-btn {
  background: rgba(255, 255, 255, 0.08);
  color: #f4f4f5;
  border: 1rpx solid rgba(255, 255, 255, 0.1);
  box-shadow: none;
}

.beast-btn.feed {
  background: var(--primary-color, #c41e3a);
  color: #ffffff;
  box-shadow: 0 6rpx 16rpx var(--card-shadow, rgba(196, 30, 58, 0.3));
}
.theme-chinese .beast-btn.feed {
  background: linear-gradient(135deg, #c41e3a, #990f26);
  border: none;
  box-shadow: 0 6rpx 16rpx rgba(196, 30, 58, 0.4);
}
.theme-dark .beast-btn.feed {
  background: linear-gradient(135deg, #7c3aed, #4c1d95);
  border: none;
  box-shadow: 0 6rpx 16rpx rgba(124, 58, 237, 0.4);
}

.beast-btn.gift.active {
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  color: #1c0f00;
  animation: pulse 1.5s infinite;
  box-shadow: 0 6rpx 16rpx rgba(245, 158, 11, 0.4);
}
@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.04); }
  100% { transform: scale(1); }
}

.gift-badge {
  background: #ef4444;
  color: #ffffff;
  border-radius: 50%;
  padding: 2rpx 12rpx;
  font-size: 18rpx;
  margin-left: 8rpx;
  box-shadow: 0 2rpx 6rpx rgba(0,0,0,0.15);
}

/* ==================== 仙家神兽粮仓抽屉 ==================== */
.feed-drawer {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  z-index: 999;
  display: flex;
  align-items: flex-end;
  backdrop-filter: blur(12rpx);
}

.feed-content {
  width: 100%;
  background: var(--card-bg, #ffffff);
  border-top-left-radius: 40rpx;
  border-top-right-radius: 40rpx;
  padding: 44rpx 36rpx;
  box-sizing: border-box;
  box-shadow: 0 -10rpx 40rpx rgba(0,0,0,0.25);
  animation: slideUp 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}
@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
.theme-chinese .feed-content {
  background: #1c1113;
  border-top: 3rpx solid #c8a261;
}
.theme-dark .feed-content {
  background: #0d091b;
  border-top: 3rpx solid #7c3aed;
}

.feed-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 36rpx;
}

.feed-title {
  font-size: 34rpx;
  font-weight: bold;
  color: var(--primary-color, #c41e3a);
  letter-spacing: 2rpx;
}
.theme-chinese .feed-title {
  color: #e5c158;
}
.theme-dark .feed-title {
  color: #a78bfa;
}

.feed-close {
  font-size: 40rpx;
  color: var(--text-secondary, #94a3b8);
  padding: 10rpx;
}

.feed-scroll-view {
  max-height: 55vh;
}

.feed-items-grid {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  padding-bottom: 30rpx;
}

/* 仙家法宝仓库卡片 */
.feed-item-card {
  display: flex;
  align-items: center;
  gap: 28rpx;
  background: var(--input-bg, #f8fafc);
  padding: 24rpx;
  border-radius: 24rpx;
  border: 1rpx solid var(--border-color, #f1f5f9);
}
.theme-chinese .feed-item-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1rpx solid rgba(200, 162, 97, 0.15);
}
.theme-dark .feed-item-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1rpx solid rgba(124, 58, 237, 0.15);
}

/* 道具盘座设计 */
.food-icon {
  width: 96rpx;
  height: 96rpx;
  line-height: 96rpx;
  text-align: center;
  font-size: 54rpx;
  background: #ffffff;
  border: 2rpx solid var(--border-color, #e2e8f0);
  border-radius: 20rpx;
  flex-shrink: 0;
  box-shadow: 0 4rpx 10rpx rgba(0,0,0,0.03);
}
.theme-chinese .food-icon {
  background: rgba(30, 20, 22, 0.6);
  border: 2rpx solid rgba(200, 162, 97, 0.3);
}
.theme-dark .food-icon {
  background: rgba(13, 9, 27, 0.6);
  border: 2rpx solid rgba(124, 58, 237, 0.3);
}

.food-detail {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.food-name-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.food-name {
  font-size: 28rpx;
  font-weight: bold;
  color: var(--text-color, #1e293b);
}
.theme-chinese .food-name {
  color: #e2dcf0;
}
.theme-dark .food-name {
  color: #f4f4f5;
}

.food-stock {
  font-size: 22rpx;
  color: var(--text-secondary, #64748b);
  background: var(--bg-secondary, #f1f5f9);
  padding: 2rpx 12rpx;
  border-radius: 12rpx;
  font-weight: 500;
}
.theme-chinese .food-stock {
  background: rgba(200, 162, 97, 0.15);
  color: #e5c158;
}
.theme-dark .food-stock {
  background: rgba(124, 58, 237, 0.2);
  color: #a78bfa;
}

.food-effect {
  font-size: 22rpx;
  color: var(--primary-color, #c41e3a);
  font-weight: bold;
}
.theme-chinese .food-effect {
  color: #e5c158;
}
.theme-dark .food-effect {
  color: #fbbf24;
}

.feed-action-btn {
  height: 64rpx;
  line-height: 64rpx;
  font-size: 24rpx;
  border-radius: 32rpx;
  background: var(--primary-color, #c41e3a);
  color: #ffffff;
  padding: 0 32rpx;
  font-weight: bold;
  border: none;
  box-shadow: 0 4rpx 12rpx var(--card-shadow, rgba(196, 30, 58, 0.25));
}
.feed-action-btn[disabled] {
  opacity: 0.45;
  background: #cbd5e1;
  box-shadow: none;
  color: #94a3b8;
}
.theme-chinese .feed-action-btn {
  background: linear-gradient(135deg, #c41e3a, #990f26);
}
.theme-chinese .feed-action-btn[disabled] {
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.2);
  border: 1rpx solid rgba(255, 255, 255, 0.05);
}
.theme-dark .feed-action-btn {
  background: linear-gradient(135deg, #7c3aed, #4c1d95);
}
.theme-dark .feed-action-btn[disabled] {
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.2);
  border: 1rpx solid rgba(255, 255, 255, 0.05);
}

/* 统计区域 */
.stats-section {
  display: flex;
  background: var(--card-bg, #fff);
  border: 2rpx solid var(--border-color, #eee);
  border-radius: 24rpx;
  padding: 28rpx;
  margin-bottom: 24rpx;
  position: relative;
  z-index: 1;
  box-shadow: 0 4rpx 16rpx var(--card-shadow, rgba(0,0,0,0.05));
}
.theme-chinese .stats-section {
  background: rgba(30, 20, 22, 0.6);
  border: 2rpx solid #6b1d28;
  box-shadow: none;
}

.stat-item {
  flex: 1;
  text-align: center;
}

.stat-value {
  font-size: 38rpx;
  font-weight: bold;
  color: var(--secondary-color, #aa7c11);
  display: block;
  text-shadow: 0 0 8rpx var(--card-shadow, rgba(229, 193, 88, 0.1));
}
.theme-chinese .stat-value {
  color: #e5c158;
  text-shadow: 0 0 8rpx rgba(229, 193, 88, 0.2);
}

.stat-label {
  font-size: 24rpx;
  color: var(--text-secondary, #666);
  margin-top: 8rpx;
  display: block;
}
.theme-chinese .stat-label {
  color: #a69ebd;
}

/* 列表菜单 */
.menu-section {
  background: var(--card-bg, #fff);
  border: 2rpx solid var(--border-color, #eee);
  border-radius: 24rpx;
  margin-bottom: 24rpx;
  overflow: hidden;
  position: relative;
  z-index: 1;
  box-shadow: 0 4rpx 16rpx var(--card-shadow, rgba(0,0,0,0.05));
}
.theme-chinese .menu-section {
  background: rgba(30, 20, 22, 0.6);
  border: 2rpx solid #6b1d28;
  box-shadow: none;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 30rpx 24rpx;
  border-bottom: 1rpx solid var(--border-color, #eee);
}
.theme-chinese .menu-item {
  border-bottom: 1rpx solid #321f22;
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-icon {
  font-size: 38rpx;
  margin-right: 20rpx;
}

.menu-name {
  flex: 1;
  font-size: 28rpx;
  color: var(--text-color, #333333);
}
.theme-chinese .menu-name {
  color: #e2dcf0;
}

.menu-value {
  font-size: 26rpx;
  color: var(--text-secondary, #666);
  margin-right: 12rpx;
}
.theme-chinese .menu-value {
  color: #a69ebd;
}

.menu-arrow {
  font-size: 32rpx;
  color: var(--text-light, #bdc3c7);
}
.theme-chinese .menu-arrow {
  color: #887fa3;
}

.disclaimer {
  text-align: center;
  padding: 30rpx;
  font-size: 22rpx;
  color: var(--text-light, #bdc3c7);
  position: relative;
  z-index: 1;
}
.theme-chinese .disclaimer {
  color: #887fa3;
}

/* 意见反馈模态弹窗 */
.feedback-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(8px);
}

.feedback-content-card {
  width: 85%;
  background: var(--card-bg, #ffffff);
  border-radius: var(--border-radius-lg, 24rpx);
  border: 2rpx solid var(--border-color, #eee);
  box-shadow: 0 10rpx 40rpx rgba(0, 0, 0, 0.15);
  overflow: hidden;
  animation: modalScaleIn 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}
.theme-chinese .feedback-content-card {
  background: rgba(30, 20, 22, 0.95);
  border: 2rpx solid #6b1d28;
  box-shadow: 0 10rpx 50rpx rgba(0, 0, 0, 0.5);
}

@keyframes modalScaleIn {
  from { transform: scale(0.9); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.feedback-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 30rpx 24rpx;
  border-bottom: 2rpx solid var(--border-color, #eee);
}
.theme-chinese .feedback-header {
  border-bottom: 2rpx solid #3e282c;
}

.feedback-title {
  font-size: 30rpx;
  font-weight: bold;
  color: var(--primary-color, #c41e3a);
}
.theme-chinese .feedback-title {
  color: #e5c158;
}

.feedback-close {
  font-size: 32rpx;
  color: var(--text-light, #bdc3c7);
  padding: 0 12rpx;
}
.theme-chinese .feedback-close {
  color: #887fa3;
}

.feedback-body {
  padding: 30rpx 24rpx;
}

.feedback-label {
  font-size: 24rpx;
  color: var(--text-secondary, #666);
  margin-bottom: 12rpx;
  display: block;
}
.theme-chinese .feedback-label {
  color: #a69ebd;
}

.feedback-type-group {
  display: flex;
  gap: 16rpx;
  margin-bottom: 24rpx;
}

.feedback-type-btn {
  flex: 1;
  padding: 16rpx 0;
  text-align: center;
  font-size: 24rpx;
  background: var(--bg-color, #f8f8f8);
  border-radius: 12rpx;
  border: 2rpx solid var(--border-color, #eee);
  color: var(--text-color, #333);
  transition: all 0.2s;
}
.theme-chinese .feedback-type-btn {
  background: rgba(14, 11, 12, 0.6);
  border: 1rpx solid #5a353b;
  color: #a69ebd;
}

.feedback-type-btn.active {
  background: var(--primary-color, #c41e3a);
  color: #fff;
  border-color: var(--primary-color, #c41e3a);
}
.theme-chinese .feedback-type-btn.active {
  background: rgba(196, 30, 58, 0.2);
  border-color: #c41e3a;
  color: #fff;
  box-shadow: 0 0 15rpx rgba(196, 30, 58, 0.3);
}

.feedback-textarea {
  width: 100%;
  height: 200rpx;
  background: var(--bg-color, #f8f8f8);
  border: 2rpx solid var(--border-color, #eee);
  border-radius: 12rpx;
  padding: 16rpx;
  font-size: 26rpx;
  color: var(--text-color, #333);
  box-sizing: border-box;
}
.theme-chinese .feedback-textarea {
  background: rgba(14, 11, 12, 0.6);
  border: 1rpx solid #5a353b;
  color: #fff;
}

.word-counter {
  font-size: 20rpx;
  color: var(--text-light, #bdc3c7);
  text-align: right;
  display: block;
  margin-top: 6rpx;
  margin-bottom: 24rpx;
}
.theme-chinese .word-counter {
  color: #887fa3;
}

.feedback-input {
  width: 100%;
  height: 80rpx;
  background: var(--bg-color, #f8f8f8);
  border: 2rpx solid var(--border-color, #eee);
  border-radius: 12rpx;
  padding: 0 16rpx;
  font-size: 26rpx;
  color: var(--text-color, #333);
  box-sizing: border-box;
  margin-bottom: 30rpx;
}
.theme-chinese .feedback-input {
  background: rgba(14, 11, 12, 0.6);
  border: 1rpx solid #5a353b;
  color: #fff;
}

.feedback-submit-btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  background: var(--primary-color, #c41e3a);
  color: #fff;
  font-size: 28rpx;
  font-weight: bold;
  border-radius: 44rpx;
  border: none;
  box-shadow: 0 6rpx 20rpx var(--card-shadow, rgba(196, 30, 58, 0.3));
}
.feedback-submit-btn[disabled] {
  opacity: 0.5;
  box-shadow: none;
}
.theme-chinese .feedback-submit-btn {
  background: linear-gradient(135deg, #c41e3a, #990f26);
  box-shadow: 0 6rpx 20rpx rgba(196, 30, 58, 0.4);
}
.theme-chinese .feedback-submit-btn[disabled] {
  background: #3a2a2c;
  color: #726062;
  box-shadow: none;
  opacity: 0.6;
}

/* 基于阶段的进化台座特效 */
.beast-avatar-wrap.stage-egg {
  border-width: 3rpx;
}
.beast-avatar-wrap.stage-young {
  border-width: 3rpx;
  animation: youngFloat 3s infinite ease-in-out;
}
.beast-avatar-wrap.stage-spiritual {
  border-width: 4rpx;
  animation: youngFloat 2.5s infinite ease-in-out;
}
.beast-avatar-wrap.stage-immortal {
  border-width: 5rpx;
  animation: immortalPulse 2s infinite ease-in-out;
}
.beast-avatar-wrap.stage-divine {
  border-width: 6rpx;
  border-color: #f1c40f !important; /* 黄金边框 */
  box-shadow: 0 0 35rpx #f1c40f, inset 0 0 16rpx rgba(241,196,15,0.3) !important;
  animation: divineRotatePulse 1.5s infinite ease-in-out;
}

@keyframes youngFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4rpx); }
}

@keyframes immortalPulse {
  0%, 100% { transform: translateY(0) scale(1); box-shadow: 0 0 24rpx var(--secondary-color, rgba(229,193,88,0.4)); }
  50% { transform: translateY(-6rpx) scale(1.03); box-shadow: 0 0 32rpx var(--secondary-color, rgba(229,193,88,0.6)); }
}

@keyframes divineRotatePulse {
  0%, 100% { transform: translateY(0) scale(1); box-shadow: 0 0 35rpx #f1c40f, 0 0 15rpx rgba(241,196,15,0.4); }
  50% { transform: translateY(-8rpx) scale(1.06); box-shadow: 0 0 50rpx #f1c40f, 0 0 25rpx #e67e22; }
}

/* ==================== 意见反馈 Tab 样式 ==================== */
.feedback-tabs {
  display: flex;
  border-bottom: 2rpx solid var(--border-color, #eee);
  background: var(--bg-color, #f9f9f9);
}
.theme-chinese .feedback-tabs {
  border-bottom: 2rpx solid #3e282c;
  background: rgba(20, 14, 16, 0.5);
}
.feedback-tab {
  flex: 1;
  text-align: center;
  padding: 24rpx 0;
  font-size: 26rpx;
  color: var(--text-secondary, #666);
  position: relative;
  font-weight: bold;
}
.theme-chinese .feedback-tab {
  color: #a69ebd;
}
.feedback-tab.active {
  color: var(--primary-color, #c41e3a);
}
.theme-chinese .feedback-tab.active {
  color: #e5c158;
}
.feedback-tab.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 60rpx;
  height: 4rpx;
  background: var(--primary-color, #c41e3a);
  border-radius: 2rpx;
}
.theme-chinese .feedback-tab.active::after {
  background: #e5c158;
}

/* ==================== 反馈历史列表 ==================== */
.feedback-history-scroll {
  max-height: 70vh;
  box-sizing: border-box;
}
.no-feedback-tips {
  padding: 80rpx 0;
  text-align: center;
  font-size: 26rpx;
  color: var(--text-light, #bdc3c7);
}
.theme-chinese .no-feedback-tips {
  color: #887fa3;
}
.feedback-history-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  padding: 10rpx 0;
}
.feedback-history-item {
  background: var(--bg-color, #f9f9f9);
  border: 1rpx solid var(--border-color, #eee);
  border-radius: 16rpx;
  padding: 20rpx;
}
.theme-chinese .feedback-history-item {
  background: rgba(14, 11, 12, 0.4);
  border: 1rpx solid #3e282c;
}
.history-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}
.history-type-tag {
  font-size: 20rpx;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  font-weight: bold;
}
.history-type-tag.suggestion {
  background: rgba(52, 152, 219, 0.15);
  color: #3498db;
}
.history-type-tag.bug {
  background: rgba(231, 76, 60, 0.15);
  color: #e74c60;
}
.history-type-tag.other {
  background: rgba(155, 89, 182, 0.15);
  color: #9b59b6;
}
.history-time {
  font-size: 20rpx;
  color: var(--text-light, #999);
}
.theme-chinese .history-time {
  color: #887fa3;
}
.history-content {
  font-size: 24rpx;
  color: var(--text-color, #333);
  line-height: 1.5;
  display: block;
}
.theme-chinese .history-content {
  color: #e2dcf0;
}
.history-contact-row {
  margin-top: 10rpx;
  font-size: 20rpx;
}
.contact-label {
  color: var(--text-light, #999);
  margin-right: 8rpx;
}
.theme-chinese .contact-label {
  color: #887fa3;
}
.contact-val {
  color: var(--text-secondary, #666);
}
.theme-chinese .contact-val {
  color: #a69ebd;
}

.history-reply-box {
  margin-top: 20rpx;
  background: rgba(46, 204, 113, 0.08);
  border: 1rpx solid rgba(46, 204, 113, 0.2);
  border-radius: 12rpx;
  padding: 16rpx;
}
.theme-chinese .history-reply-box {
  background: rgba(46, 204, 113, 0.05);
  border: 1rpx solid #1e5f35;
}
.reply-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8rpx;
}
.reply-tag {
  font-size: 22rpx;
  font-weight: bold;
  color: #2ec471;
}
.reply-time {
  font-size: 18rpx;
  color: #999;
}
.theme-chinese .reply-time {
  color: #887fa3;
}
.reply-text {
  font-size: 22rpx;
  color: var(--text-color, #333);
  line-height: 1.4;
  display: block;
}
.theme-chinese .reply-text {
  color: #e2dcf0;
}
.reply-bonus-granted {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-top: 12rpx;
  padding-top: 8rpx;
  border-top: 1px dashed rgba(46, 204, 113, 0.2);
}
.bonus-icon {
  font-size: 24rpx;
}
.bonus-text {
  font-size: 18rpx;
  color: #e67e22;
  font-weight: bold;
}

.history-pending-box {
  margin-top: 16rpx;
  text-align: right;
}
.pending-tag {
  font-size: 20rpx;
  color: #e67e22;
  font-style: italic;
}

/* ==================== 管理端面板 ==================== */
.admin-menu-item {
  border-top: 2rpx dashed var(--border-color, #eee);
  margin-top: 10rpx;
  padding-top: 20rpx;
}
.theme-chinese .admin-menu-item {
  border-top: 2rpx dashed rgba(200, 162, 97, 0.25);
}

.admin-feedback-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(8px);
}
.admin-feedback-card {
  width: 90%;
  height: 85vh;
  background: var(--card-bg, #ffffff);
  border-radius: 24rpx;
  border: 2rpx solid var(--border-color, #eee);
  box-shadow: 0 10rpx 40rpx rgba(0, 0, 0, 0.25);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.theme-chinese .admin-feedback-card {
  background: rgba(22, 16, 18, 0.98);
  border: 2rpx solid #c8a261;
}

.admin-feedback-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 30rpx 24rpx;
  border-bottom: 2rpx solid var(--border-color, #eee);
  flex-shrink: 0;
}
.theme-chinese .admin-feedback-header {
  border-bottom: 2rpx solid #c8a261;
}
.admin-feedback-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #e5c158;
}
.admin-feedback-close {
  font-size: 32rpx;
  color: #bdc3c7;
  padding: 0 12rpx;
}

.admin-filter-bar {
  display: flex;
  justify-content: space-around;
  padding: 16rpx 20rpx;
  background: var(--bg-color, #f4f4f4);
  border-bottom: 1rpx solid var(--border-color, #eee);
  flex-shrink: 0;
}
.theme-chinese .admin-filter-bar {
  background: rgba(30, 20, 22, 0.8);
  border-bottom: 1rpx solid #3e282c;
}
.filter-picker {
  font-size: 24rpx;
  color: var(--text-secondary, #666);
}
.theme-chinese .filter-picker {
  color: #a69ebd;
}
.picker-value {
  font-weight: bold;
  color: var(--primary-color, #c41e3a);
  margin-left: 8rpx;
}
.theme-chinese .picker-value {
  color: #e5c158;
}

.admin-feedback-body {
  flex: 1;
  overflow: hidden;
  padding: 20rpx;
  box-sizing: border-box;
}
.admin-feedback-scroll {
  height: 100%;
}
.admin-list-container {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}
.admin-feedback-item {
  background: var(--bg-color, #f9f9f9);
  border: 1rpx solid var(--border-color, #eee);
  border-radius: 16rpx;
  padding: 24rpx;
}
.theme-chinese .admin-feedback-item {
  background: rgba(14, 11, 12, 0.6);
  border: 1rpx solid #3e282c;
}
.admin-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}
.user-profile {
  display: flex;
  align-items: center;
  gap: 16rpx;
}
.admin-user-avatar {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  border: 2rpx solid #e5c158;
}
.admin-user-name-col {
  display: flex;
  flex-direction: column;
}
.admin-user-name {
  font-size: 24rpx;
  font-weight: bold;
  color: var(--text-color, #333);
}
.theme-chinese .admin-user-name {
  color: #e2dcf0;
}
.admin-user-vip {
  font-size: 16rpx;
  background: #e5c158;
  color: #161012;
  padding: 2rpx 8rpx;
  border-radius: 6rpx;
  width: fit-content;
  font-weight: bold;
}
.admin-feedback-text {
  font-size: 24rpx;
  color: var(--text-color, #333);
  line-height: 1.5;
  display: block;
  margin-bottom: 12rpx;
}
.theme-chinese .admin-feedback-text {
  color: #fff;
}
.admin-contact-row {
  font-size: 20rpx;
  margin-bottom: 12rpx;
}
.admin-item-time {
  font-size: 18rpx;
  color: #999;
  display: block;
  text-align: right;
  margin-bottom: 16rpx;
}

.admin-reply-status-section {
  border-top: 1rpx dashed var(--border-color, rgba(0,0,0,0.1));
  padding-top: 16rpx;
}
.theme-chinese .admin-reply-status-section {
  border-top: 1rpx dashed rgba(200, 162, 97, 0.2);
}
.admin-replied-box {
  background: rgba(46, 204, 113, 0.06);
  border-radius: 12rpx;
  padding: 16rpx;
}
.reply-status-label {
  font-size: 20rpx;
  color: #2ec471;
  font-weight: bold;
  display: block;
  margin-bottom: 4rpx;
}
.reply-status-text {
  font-size: 22rpx;
  color: var(--text-secondary, #666);
}
.theme-chinese .reply-status-text {
  color: #a69ebd;
}
.reply-status-bonus {
  font-size: 18rpx;
  color: #e67e22;
  font-weight: bold;
  display: block;
  margin-top: 8rpx;
}
.admin-action-btn-reply {
  width: 100%;
  height: 64rpx;
  line-height: 64rpx;
  background: #e5c158;
  color: #161012;
  font-size: 22rpx;
  font-weight: bold;
  border-radius: 32rpx;
  border: none;
}

/* ==================== 批复输入窗 ==================== */
.reply-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;
  backdrop-filter: blur(8px);
}
.reply-card {
  width: 85%;
  background: var(--card-bg, #ffffff);
  border-radius: 24rpx;
  border: 2rpx solid var(--border-color, #eee);
  box-shadow: 0 10rpx 40rpx rgba(0, 0, 0, 0.2);
  overflow: hidden;
}
.theme-chinese .reply-card {
  background: rgba(30, 20, 22, 0.98);
  border: 2rpx solid #c8a261;
}
.reply-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx;
  border-bottom: 2rpx solid var(--border-color, #eee);
}
.theme-chinese .reply-header {
  border-bottom: 2rpx solid #c8a261;
}
.reply-title {
  font-size: 28rpx;
  font-weight: bold;
  color: var(--primary-color, #c41e3a);
}
.theme-chinese .reply-title {
  color: #e5c158;
}
.reply-close {
  font-size: 28rpx;
  color: #bdc3c7;
  padding: 0 12rpx;
}
.reply-body {
  padding: 24rpx;
}
.feedback-preview-box {
  background: var(--bg-color, #f5f5f5);
  border-radius: 12rpx;
  padding: 16rpx;
  margin-bottom: 20rpx;
}
.theme-chinese .feedback-preview-box {
  background: rgba(14, 11, 12, 0.8);
}
.preview-title {
  font-size: 20rpx;
  color: #999;
  display: block;
}
.preview-content {
  font-size: 22rpx;
  color: var(--text-secondary, #666);
  line-height: 1.4;
}
.theme-chinese .preview-content {
  color: #a69ebd;
}
.reply-label {
  font-size: 22rpx;
  color: var(--text-secondary, #666);
  margin-bottom: 12rpx;
  display: block;
}
.theme-chinese .reply-label {
  color: #a69ebd;
}
.reply-textarea {
  width: 100%;
  height: 160rpx;
  background: var(--bg-color, #f8f8f8);
  border: 2rpx solid var(--border-color, #eee);
  border-radius: 12rpx;
  padding: 16rpx;
  font-size: 24rpx;
  color: var(--text-color, #333);
  box-sizing: border-box;
  margin-bottom: 24rpx;
}
.theme-chinese .reply-textarea {
  background: rgba(14, 11, 12, 0.6);
  border: 1rpx solid #5a353b;
  color: #fff;
}
.reply-submit-btn {
  width: 100%;
  height: 80rpx;
  line-height: 80rpx;
  background: var(--primary-color, #c41e3a);
  color: #fff;
  font-size: 26rpx;
  font-weight: bold;
  border-radius: 40rpx;
  border: none;
}
.theme-chinese .reply-submit-btn {
  background: linear-gradient(135deg, #c41e3a, #990f26);
  box-shadow: 0 6rpx 20rpx rgba(196, 30, 58, 0.4);
}
</style>
