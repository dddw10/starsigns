<template>
  <view class="page-container" :class="themeClass">
    <!-- 装饰性神秘背景球 -->
    <view class="mystic-orb orb-1"></view>
    <view class="mystic-orb orb-2"></view>

    <!-- 1. 选择牌阵 -->
    <view class="spread-selector" v-if="!selectedSpread">
      <text class="section-title">✨ 选择您的塔罗牌阵 ✨</text>
      <view class="spread-list">
        <view class="spread-item" v-for="spread in spreads" :key="spread.id" @click="selectSpread(spread)">
          <text class="spread-name">{{ spread.name }}</text>
          <text class="spread-desc">{{ spread.desc }}</text>
          <text class="spread-cards">🔮 需要抽取 {{ spread.cards }} 张牌</text>
        </view>
      </view>

      <!-- 牌意说明百科入口 -->
      <view class="guide-entrance" @click="showGuide = true">
        <text class="guide-entrance-icon">📖</text>
        <text class="guide-entrance-text">查看 22 张塔罗牌意说明</text>
      </view>
    </view>

    <!-- 2. 选牌过程 -->
    <view class="card-selection" v-else-if="!result">
      <text class="section-title">🔮 默念问题，选择 {{ selectedSpread.cards }} 张牌</text>
      <text class="draw-progress">已选：{{ selectedCards.length }} / {{ selectedSpread.cards }}</text>
      
      <!-- 横向重叠排开的卡牌堆，具有极强仪式感与年轻化视觉 -->
      <scroll-view class="card-deck-scroll" scroll-x="true" show-scrollbar="false" :scroll-left="scrollLeft" scroll-with-animation="true">
        <view class="card-deck">
          <view 
            class="tarot-card-wrapper" 
            v-for="(card, index) in cards" 
            :key="index"
            :style="{ animationDelay: (index * 0.04) + 's' }"
          >
            <view 
              class="tarot-card" 
              :class="{ selected: selectedCards.includes(index), flipped: flippedCards.includes(index) }"
              @click="selectCard(index)"
            >
              <!-- 卡背：紫金星空天体纹路 -->
              <view class="card-front">
                <!-- 选中序号角标（支持自动重新排序 ①，②，③） -->
                <view class="select-badge" v-if="selectedCards.includes(index)">
                  <text class="badge-text">{{ selectedCards.indexOf(index) + 1 }}</text>
                </view>
                <view class="front-pattern">
                  <text class="moon-symbol">🌙</text>
                  <text class="stars-symbol">✨</text>
                </view>
              </view>
              <!-- 卡面：复古金色边框与纸张底色 -->
              <view class="card-back" :class="{ 'is-reversed': cardInfoMap[index]?.reversed }">
                <view class="card-back-border">
                  <text class="card-icon">{{ cardInfoMap[index]?.icon || '🔮' }}</text>
                  <text class="card-name">{{ cardInfoMap[index]?.name || '解密中...' }}</text>
                  <text class="card-dir-tag">{{ cardInfoMap[index]?.reversed ? '逆位' : '正位' }}</text>
                </view>
              </view>
            </view>
          </view>
        </view>
      </scroll-view>

      <button class="gold-btn" @click="drawCards" :disabled="selectedCards.length !== selectedSpread.cards || isAnimating">
        {{ isAnimating ? '正在开启命运牌阵...' : '揭晓占卜结果' }}
      </button>
    </view>

    <!-- 3. 结果展现 -->
    <view class="result-section" v-else>
      <text class="section-title">✨ 命运之轮已然显现 ✨</text>
      
      <view class="drawn-cards">
        <view class="drawn-card" v-for="(card, index) in drawnCards" :key="index">
          <text class="position">{{ selectedSpread.id === 'three' ? ['过去', '现在', '未来'][index] : (selectedSpread.id === 'single' ? '今日解答' : `第 ${index+1} 牌位`) }}</text>
          <view class="card-frame" :class="{ reversed: card.reversed }">
            <view class="card-inner-border">
              <text class="card-icon-large">{{ card.icon }}</text>
              <text class="card-name-text">{{ card.name }}</text>
              <text class="card-state-tag">{{ card.reversed ? '逆位' : '正位' }}</text>
            </view>
          </view>
          <text class="card-meaning">{{ card.meaning }}</text>
        </view>
      </view>

      <view class="overall-reading">
        <text class="reading-title">🌟 牌阵综合解读</text>
        <text class="reading-text">{{ overallReading }}</text>
      </view>

      <view class="action-btns">
        <button class="action-btn share" @click="share">分享与保存海报</button>
        <button class="action-btn reset-btn" @click="reset">重新占卜</button>
      </view>
    </view>

    <!-- 4. 塔罗牌意百科弹窗 (Bottom Drawer) -->
    <view class="guide-modal" v-if="showGuide" @click="showGuide = false">
      <view class="guide-content" @click.stop>
        <view class="guide-header">
          <text class="guide-title">✨ 大阿尔卡纳牌意百科 ✨</text>
          <text class="guide-close" @click="showGuide = false">✕</text>
        </view>
        
        <scroll-view class="guide-scroll" scroll-y="true">
          <view class="guide-intro">
            <text class="intro-text">大阿尔卡纳 (Major Arcana) 共 22 张，象征人生不同的成长阶段与灵魂旅程。正位表示能量顺畅发挥，逆位表示能量受阻、过度或需要反思。</text>
          </view>
          
          <view class="guide-card-list">
            <view class="guide-card-item" v-for="(card, index) in cards" :key="index">
              <view class="guide-card-info">
                <text class="guide-card-icon">{{ card.icon }}</text>
                <text class="guide-card-name">{{ card.name }}</text>
                <text class="guide-card-keyword">{{ card.meaning }}</text>
              </view>
              
              <view class="guide-card-body">
                <view class="meaning-box positive">
                  <text class="meaning-title">🟢 正位能量指引</text>
                  <text class="meaning-desc">{{ getPositiveDesc(card.name) }}</text>
                </view>
                <view class="meaning-box negative">
                  <text class="meaning-title">🔴 逆位警示反思</text>
                  <text class="meaning-desc">{{ getNegativeDesc(card.name) }}</text>
                </view>
              </view>
            </view>
          </view>
        </scroll-view>
      </view>
    </view>

    <view class="disclaimer">
      <text>塔罗牌占卜仅供娱乐参考，不构成任何决策建议</text>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { doTarotDrawApi } from '@/api/fortune'
import { useUserStore } from '@/store/user'

const userStore = useUserStore()
const selectedSpread = ref(null)
const selectedCards = ref([])
const flippedCards = ref([])
const cardInfoMap = ref({})
const isAnimating = ref(false)
const scrollLeft = ref(0)

// 塔罗占卜玄学声效资源 (Royalty-free)
const AUDIO_URLS = {
  shuffle: 'https://assets.mixkit.co/active_storage/sfx/2014/2014-84.wav', // 纸牌洗牌摩擦声
  select: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-84.wav',  // 选中卡牌水滴钟声
  reveal: 'https://assets.mixkit.co/active_storage/sfx/2019/2019-84.wav'   // 揭晓结果空灵大磬重音
}

let audioCtxMap = {}

const initAudio = () => {
  try {
    Object.keys(AUDIO_URLS).forEach(key => {
      const ctx = uni.createInnerAudioContext()
      ctx.src = AUDIO_URLS[key]
      ctx.volume = 0.5
      audioCtxMap[key] = ctx
    })
  } catch (e) {
    console.warn('音频系统初始化失败:', e.message)
  }
}

const playSound = (type) => {
  try {
    const ctx = audioCtxMap[type]
    if (ctx) {
      ctx.stop()
      ctx.play()
    }
  } catch (e) {
    console.warn('音频播放异常:', e.message)
  }
}

const destroyAudio = () => {
  try {
    Object.keys(audioCtxMap).forEach(key => {
      audioCtxMap[key].destroy()
    })
    audioCtxMap = {}
  } catch (e) {}
}

onMounted(() => {
  initAudio()
})

onUnmounted(() => {
  destroyAudio()
})
const result = ref(false)
const drawnCards = ref([])
const overallReading = ref('')
const loading = ref(false)

// 牌意百科显示开关
const showGuide = ref(false)

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms))

const spreads = [
  { id: 'single', name: '单牌测算', desc: '用于快速指引心中疑惑，了解今日综合状况', cards: 1 },
  { id: 'three', name: '时间流牌阵', desc: '展现关于问题的“过去”、“现在”与“未来”的发展脉络', cards: 3 },
  { id: 'celtic', name: '五星指引牌阵', desc: '全维度深刻解剖目前面临的阻碍、环境状况与最终结果', cards: 5 }
]

const cards = [
  { name: '愚者', icon: '🃏', meaning: '新的开始，冒险精神' },
  { name: '魔术师', icon: '🪄', meaning: '创造力，技能展现' },
  { name: '女祭司', icon: '📖', meaning: '直觉，内在智慧' },
  { name: '女皇', icon: '👑', meaning: '丰收，母性关怀' },
  { name: '皇帝', icon: '🎖️', meaning: '权威，稳定结构' },
  { name: '教皇', icon: '⛪', meaning: '传统，精神指导' },
  { name: '恋人', icon: '💞', meaning: '爱情，选择抉择' },
  { name: '战车', icon: '🛡️', meaning: '胜利，意志力' },
  { name: '力量', icon: '🦁', meaning: '勇气，内在力量' },
  { name: '隐士', icon: '⏳', meaning: '内省，寻求真理' },
  { name: '命运之轮', icon: '🎡', meaning: '转折，命运循环' },
  { name: '正义', icon: '⚖️', meaning: '公正，因果报应' },
  { name: '倒吊人', icon: '⚓', meaning: '牺牲，换位思考' },
  { name: '死神', icon: '💀', meaning: '结束，蜕变重生' },
  { name: '节制', icon: '🏺', meaning: '平衡，净化沟通' },
  { name: '恶魔', icon: '😈', meaning: '欲望，物质束缚' },
  { name: '塔', icon: '⚡', meaning: '骤变，打破幻象' },
  { name: '星星', icon: '⭐', meaning: '希望，精神指引' },
  { name: '月亮', icon: '🌙', meaning: '不安，潜意识梦境' },
  { name: '太阳', icon: '☀️', meaning: '活力，成功喜悦' },
  { name: '审判', icon: '🔔', meaning: '审视，重大觉醒' },
  { name: '世界', icon: '🌍', meaning: '圆满，旅程终点' }
]

// 详细牌面意义映射
const cardMeaningsDetail = {
  '愚者': { positive: '新的开始、冒险精神、无限可能、纯真无邪。非常适合开启全新计划。', negative: '轻率鲁莽、不负责任、逃避现实、缺乏准备。需格外注意脚下陷阱。' },
  '魔术师': { positive: '万事俱备、创造力爆发、技能纯熟、强执行力。利于向世人展现才华。', negative: '虚伪欺骗、才华被滥用、能力不足、操纵他人。需提防身边的甜言蜜语。' },
  '女祭司': { positive: '直觉敏锐、内在智慧、静观其变、潜意识指引。建议以静制动，倾听内心。', negative: '情绪压抑、冷漠孤僻、肤浅急躁、流言蜚语。需理智审视直觉，勿胡思乱想。' },
  '女皇': { positive: '丰饶富足、自然滋养、母性关怀、物质与艺术享受。代表收获与极佳好运。', negative: '骄奢放逸、占有欲过度、创造力枯竭、家庭矛盾。需适度理财，忌过度控制。' },
  '皇帝': { positive: '坚强意志、社会秩序、稳定基石、控制与理性。适合建立规则与主导大局。', negative: '专制暴政、意志力软弱、控制欲过强、权力流失。需多倾听他人建议。' },
  '教皇': { positive: '精神指引、遵守传统、良师益友、结盟与坚守。宜遵循既定轨道，寻求合作。', negative: '教条主义、叛逆固执、打破常规、虚假指引。需保持独立思考，防偏听偏信。' },
  '恋人': { positive: '和谐关系、甜蜜恋情、意气相投、重要抉择。代表顺从真心的选择。', negative: '关系破裂、冷战隔阂、面临诱惑、错误决定。需审视契约与彼此的信任度。' },
  '战车': { positive: '意志力胜出、勇敢前行、掌控局面、战胜困难。只要坚持到底必获胜利。', negative: '失控受阻、方向混乱、情绪失衡、急功近利。建议暂停行动，重新规划方向。' },
  '力量': { positive: '以柔克刚、内在勇气、坚韧自律、包容万物。用爱与耐心可以轻松化解危机。', negative: '软弱无力、情绪失控、滥用暴力、丧失信心。需静心，重新唤醒内心潜能。' },
  '隐士': { positive: '内省沉淀、寻求真理、导师指引、独处反思。目前适合静心策划，切忌急躁。', negative: '孤僻自闭、盲目摸索、拒绝建议、错失良机。建议适度与外界建立健康的连接。' },
  '命运之轮': { positive: '转折点出现、顺应天命、幸运降临、契机到来。代表运势正逐步迈入上升期。', negative: '坏运气干扰、抗拒改变、错失良机、盲目投机。需稳住心态，相信否极泰来。' },
  '正义': { positive: '公正裁决、真诚诚实、因果平衡、理性评估。代表公平交易与清正的原则。', negative: '遭遇不公、偏见偏袒、逃避责任、法律纠纷。需反思自己是否存在偏激立场。' },
  '倒吊人': { positive: '甘愿牺牲、换位思考、以退为进、精神觉醒。停滞中正孕育着新的觉醒。', negative: '徒劳无功、抗拒妥协、挣扎停滞、精神受挫。需要打破僵局，换个角度看世界。' },
  '死神': { positive: '旧事物的终结、斩断执念、蜕变重生、开启新纪元。旧的不去，新的不来。', negative: '苟延残喘、害怕改变、拒绝放手、停滞不前。需勇敢舍弃没有价值的过去。' },
  '节制': { positive: '调和平衡、顺畅沟通、健康净化、中庸之道。代表合作顺利、身心感到放松愉悦。', negative: '失去平衡、沟通障碍、欲望失控、过度消耗。需要调整生活作息和情绪状态。' },
  '恶魔': { positive: '物质诱惑、本能渴望、激情四射、商业资产。有利于理财投资与勇敢争取目标。', negative: '精神觉醒、斩断束缚、摆脱成瘾、重获自由。是走出黑暗与不良嗜好的转折期。' },
  '塔': { positive: '打破幻象、剧烈变革、重塑自我、拨云见日。危机正是重塑命运的起点。', negative: '摩擦不断、小灾小难、抗拒重建、风雨飘摇。建议坦然接受变故，提前避雷。' },
  '星星': { positive: '希望降临、精神疗愈、灵感泉涌、前途光明。坚信信念会带来美满的明天。', negative: '失望气馁、不切实际、才华枯竭、悲观沮丧。需要调整心态，重新找寻微光。' },
  '月亮': { positive: '潜意识波动、第六感敏锐、艺术创作力。在迷雾未散前，建议谨慎慢行。', negative: '迷茫消散、直觉觉醒、揭穿谎言、走出困境。代表迷雾散去，看清未来真相。' },
  '太阳': { positive: '成功与荣耀、精力充沛、喜悦纯真、前程似锦。最阳光、最幸运的时刻已来临。', negative: '短暂阴云、虚荣骄傲、精力受挫、目标延迟。虽有小挫折但终究会破茧成蝶。' },
  '审判': { positive: '重获新生、重大觉醒、做回自我、因果清算。聆听心底深处神圣的召唤。', negative: '执迷不悟、推迟决定、害怕面对、错失转折。需斩断犹豫，直面关键改变。' },
  '世界': { positive: '圆满完结、旅程终点、全球视野、心想事成。达到了完美的阶段性里程碑。', negative: '美中不足、半途而废、无法完结、拖延停滞。离成功只差一步，需坚持走完。' }
}

const getPositiveDesc = (name) => {
  return cardMeaningsDetail[name]?.positive || '代表平稳与向好的能量指引。'
}

const getNegativeDesc = (name) => {
  return cardMeaningsDetail[name]?.negative || '提示注意调整心态，预防潜在风险。'
}

const selectSpread = (spread) => {
  selectedSpread.value = spread
  playSound('shuffle') // 播放纸牌洗牌摩擦音效
  
  // 触发卡片滚动预览动效：先往右滚动，再平滑回滚到最左侧
  scrollLeft.value = 400
  setTimeout(() => {
    scrollLeft.value = 0
  }, 300)
}

const selectCard = (index) => {
  if (isAnimating.value) return
  const isSelected = selectedCards.value.includes(index)
  if (isSelected) {
    selectedCards.value = selectedCards.value.filter(i => i !== index)
    playSound('select')
  } else {
    if (selectedCards.value.length < selectedSpread.value.cards) {
      selectedCards.value.push(index)
      playSound('select') // 播放选牌水滴钟声音效
    } else {
      // 自动取消最早选取的卡牌，加入新选取的卡牌 (实现“自动取消上一张卡片的选取”效果)
      selectedCards.value.shift()
      selectedCards.value.push(index)
      playSound('select')
    }
  }
}

const drawCards = async () => {
  if (selectedCards.value.length !== selectedSpread.value.cards || isAnimating.value) return
  loading.value = true
  isAnimating.value = true
  
  try {
    if (!userStore.isLoggedIn) {
      uni.showLoading({ title: '登录中...' })
      const loginRes = await userStore.login()
      uni.hideLoading()
      if (!loginRes.success) {
        throw new Error(loginRes.message || '快捷登录失败')
      }
    }

    const res = await doTarotDrawApi({
      spreadType: selectedSpread.value.id
    })
    
    if (res.code !== 0) {
      throw new Error(res.message || '占卜失败')
    }

    const data = res.data
    const serverCards = data.cards || []

    drawnCards.value = serverCards.map((card) => {
      const matched = cards.find(c => c.name === card.name) || { icon: '🔮' }
      return {
        name: card.name || '神秘牌',
        icon: matched.icon,
        reversed: card.isReversed || false,
        meaning: card.interpretation || ''
      }
    })

    overallReading.value = data.overallReading || '命运之牌已定，静观其变。'

    selectedCards.value.forEach((cardIdx, i) => {
      const serverCard = drawnCards.value[i]
      if (serverCard) {
        cardInfoMap.value[cardIdx] = {
          name: serverCard.name,
          icon: serverCard.icon,
          reversed: serverCard.reversed
        }
      }
    })

    flippedCards.value = []
    for (let i = 0; i < selectedCards.value.length; i++) {
      await wait(300)
      flippedCards.value.push(selectedCards.value[i])
      playSound('select') // 翻开每张牌时发出水滴钟声
    }

    await wait(1200)
    playSound('reveal') // 最终揭晓时播放大磬重音，震撼空灵
    result.value = true
    
    await userStore.fetchUserInfo()
  } catch (err) {
    uni.showToast({ title: err.message || '占卜失败', icon: 'none' })
    isAnimating.value = false
  } finally {
    loading.value = false
  }
}

const share = () => {
  if (drawnCards.value.length === 0) return
  const cardsText = drawnCards.value.map(c => `· ${c.name} (${c.reversed ? '逆位' : '正位'}): ${c.meaning}`).join('\n')
  const query = {
    type: 'tarot',
    title: `${selectedSpread.value?.name || '塔罗牌'}占卜法卷`,
    name: '占卜信士',
    score: 92,
    analysis: `【牌阵抽选】\n${cardsText}\n\n【综合解读】\n${overallReading.value}`
  }
  uni.navigateTo({
    url: `/pages/share/index?type=${query.type}&title=${encodeURIComponent(query.title)}&name=${encodeURIComponent(query.name)}&score=${query.score}&analysis=${encodeURIComponent(query.analysis)}`
  })
}

const reset = () => {
  selectedSpread.value = null
  selectedCards.value = []
  flippedCards.value = []
  cardInfoMap.value = {}
  isAnimating.value = false
  result.value = false
  drawnCards.value = []
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
  background: var(--primary-color, #8e44ad);
  top: -100rpx;
  left: -200rpx;
}
.orb-2 {
  width: 600rpx;
  height: 600rpx;
  background: var(--secondary-color, #2980b9);
  bottom: -100rpx;
  right: -250rpx;
}

/* 标题 */
.section-title {
  font-size: 34rpx;
  font-weight: bold;
  color: var(--primary-color, #8e44ad);
  margin-top: 10rpx;
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

/* 牌阵选择 */
.spread-list {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  position: relative;
  z-index: 1;
}

.spread-item {
  background: var(--card-bg, #fff);
  border: 2rpx solid var(--border-color, #eee);
  border-radius: 20rpx;
  padding: 30rpx;
  box-shadow: 0 8rpx 32rpx var(--card-shadow, rgba(0, 0, 0, 0.05));
  transition: all 0.3s;
}
.theme-dark .spread-item {
  background: rgba(30, 24, 52, 0.6);
  border: 2rpx solid #4a3e72;
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
}

.spread-item:active {
  background: var(--bg-secondary, #fafafa);
  border-color: var(--primary-color, #8e44ad);
}
.theme-dark .spread-item:active {
  border-color: #e5c158;
  background: rgba(45, 36, 78, 0.8);
}

.spread-name {
  font-size: 32rpx;
  font-weight: bold;
  color: var(--text-color, #333333);
  display: block;
}
.theme-dark .spread-name {
  color: #f1f0f5;
}

.spread-desc {
  font-size: 26rpx;
  color: var(--text-secondary, #666666);
  margin-top: 10rpx;
  display: block;
  line-height: 1.4;
}
.theme-dark .spread-desc {
  color: #a69ebd;
}

.spread-cards {
  font-size: 24rpx;
  color: var(--primary-color, #8e44ad);
  margin-top: 12rpx;
  display: block;
  font-weight: 500;
}
.theme-dark .spread-cards {
  color: #e5c158;
}

/* 百科入口 */
.guide-entrance {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  margin: 40rpx auto 10rpx;
  padding: 16rpx 40rpx;
  background: var(--bg-secondary, #f5f5f5);
  border: 2rpx solid var(--primary-color, #8e44ad);
  border-radius: 40rpx;
  width: fit-content;
  box-shadow: 0 4rpx 12rpx var(--card-shadow, rgba(0, 0, 0, 0.05));
  cursor: pointer;
  position: relative;
  z-index: 2;
}
.theme-dark .guide-entrance {
  background: rgba(229, 193, 88, 0.15);
  border: 2rpx solid #e5c158;
  box-shadow: 0 4rpx 12rpx rgba(229, 193, 88, 0.2);
}

.guide-entrance:active {
  opacity: 0.8;
}
.theme-dark .guide-entrance:active {
  background: rgba(229, 193, 88, 0.3);
}

.guide-entrance-icon {
  font-size: 32rpx;
}

.guide-entrance-text {
  font-size: 26rpx;
  color: var(--primary-color, #8e44ad);
  font-weight: bold;
}
.theme-dark .guide-entrance-text {
  color: #e5c158;
}

/* 卡牌选择区 */
.card-selection {
  position: relative;
  z-index: 1;
  text-align: center;
}

.draw-progress {
  font-size: 26rpx;
  color: #a69ebd;
  margin-bottom: 40rpx;
  display: block;
}

.card-deck-scroll {
  width: 100%;
  height: 350rpx; /* Explicit height to accommodate card translation and badges */
  white-space: nowrap;
  margin-bottom: 50rpx;
  box-sizing: border-box;
}

.card-deck {
  display: inline-flex;
  padding: 60rpx 40rpx 40rpx 20rpx; /* Increased top padding to prevent selected card and badge from being clipped by the scroll container */
  perspective: 1000rpx; /* 激活 3D 景深视距，使选牌翻滚具有立体空间弧度 */
}

/* 塔罗牌外层包装：执行入场滚动/扇形展开动画 */
.tarot-card-wrapper {
  margin-right: -30rpx; /* 把重叠外边距移到外层 wrapper */
  position: relative;
  transform-style: preserve-3d;
  animation: cardRollIn 0.8s cubic-bezier(0.25, 0.8, 0.25, 1) both;
}

/* 塔罗牌样式 */
.tarot-card {
  width: 150rpx;
  height: 240rpx;
  position: relative;
  transform-style: preserve-3d;
  transition: transform 0.5s cubic-bezier(0.25, 0.8, 0.25, 1);
  will-change: transform;
  border-radius: 16rpx;
  box-shadow: 0 6rpx 16rpx rgba(0,0,0,0.4);
}

.tarot-card.selected {
  transform: translateY(-40rpx) scale(1.05);
  z-index: 15; /* 确保悬起的牌永远处于最高层级，解决遮挡问题 */
  box-shadow: 0 12rpx 30rpx var(--card-shadow, rgba(229, 193, 88, 0.6)), 0 0 15rpx var(--card-shadow, rgba(229, 193, 88, 0.4));
}
.theme-dark .tarot-card.selected {
  box-shadow: 0 12rpx 30rpx rgba(229, 193, 88, 0.8), 0 0 20rpx rgba(229, 193, 88, 0.6);
}

.tarot-card.flipped {
  transform: rotateY(180deg);
}

.tarot-card.selected.flipped {
  transform: translateY(-40rpx) scale(1.05) rotateY(180deg);
}

.card-front, .card-back {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 16rpx;
  backface-visibility: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

/* 卡背：紫金星空天体纹路 */
.card-front {
  background: var(--bg-secondary, #1c1535);
  border: 4rpx solid var(--border-color, #c5a963);
  transition: border-color 0.3s, box-shadow 0.3s;
}
.theme-dark .card-front {
  background: linear-gradient(135deg, #1c1535, #2f2555);
  border: 4rpx solid #c5a963;
}
.theme-chinese .card-front {
  background: linear-gradient(135deg, #c41e3a, #990f26);
  border: 4rpx solid #e5c158;
}

/* 选中卡牌的前置卡背发光与边框加粗 */
.tarot-card.selected .card-front {
  border-color: var(--primary-color, #e5c158);
  box-shadow: 0 0 20rpx var(--card-shadow, rgba(229, 193, 88, 0.4));
}
.theme-dark .tarot-card.selected .card-front {
  border-color: #e5c158;
  box-shadow: 0 0 20rpx rgba(229, 193, 88, 0.8);
}

.front-pattern {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
}

.moon-symbol {
  font-size: 54rpx;
  color: var(--primary-color, #e5c158);
  filter: drop-shadow(0 0 8rpx var(--card-shadow, rgba(229, 193, 88, 0.3)));
}
.theme-dark .moon-symbol {
  color: #e5c158;
  filter: drop-shadow(0 0 8rpx rgba(229, 193, 88, 0.5));
}

.stars-symbol {
  font-size: 24rpx;
  color: var(--primary-color, #e5c158);
  animation: pulse 1.5s infinite alternate;
}
.theme-dark .stars-symbol {
  color: #e5c158;
}

/* 角标定位 */
.select-badge {
  position: absolute;
  top: -12rpx;
  right: -12rpx;
  width: 44rpx;
  height: 44rpx;
  background: var(--primary-color, #e5c158);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 10rpx var(--card-shadow, rgba(229, 193, 88, 0.4));
  z-index: 20;
  animation: badgeBounce 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
}
.theme-dark .select-badge {
  background: linear-gradient(135deg, #e5c158, #c59828);
  box-shadow: 0 0 10rpx rgba(229, 193, 88, 0.8);
}

.badge-text {
  font-size: 24rpx;
  font-weight: bold;
  color: #fff;
}
.theme-dark .badge-text {
  color: #1e1503;
}

@keyframes pulse {
  from { opacity: 0.4; }
  to { opacity: 1; }
}

/* 卡面：古朴羊皮纸 */
.card-back {
  background: var(--card-bg, #fff);
  border: 4rpx solid var(--border-color, #eee);
  transform: rotateY(180deg);
}
.theme-dark .card-back {
  background: linear-gradient(135deg, #1c1535, #2f2555);
  border-color: #4a3e72;
}
.theme-chinese .card-back {
  background: linear-gradient(135deg, #fdf8eb, #f3eacf);
  border-color: #aa7c11;
}

.card-back-border {
  width: 90%;
  height: 90%;
  border: 2rpx dashed var(--border-color, #eee);
  border-radius: 10rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 8rpx;
  box-sizing: border-box;
}
.theme-dark .card-back-border {
  border-color: #322b4f;
}
.theme-chinese .card-back-border {
  border-color: #d5c295;
}

.card-icon {
  font-size: 48rpx;
  margin-bottom: 8rpx;
}

.card-name {
  font-size: 22rpx;
  font-weight: bold;
  color: var(--text-color, #333333);
  text-align: center;
  line-height: 1.2;
}
.theme-dark .card-name {
  color: #e2dcf0;
}
.theme-chinese .card-name {
  color: #3e2723;
}

.card-dir-tag {
  font-size: 16rpx;
  margin-top: 8rpx;
  padding: 2rpx 8rpx;
  background: var(--primary-color, #e5c158);
  color: #fff;
  border-radius: 4rpx;
}
.theme-dark .card-dir-tag {
  background: #aa7c11;
}
.theme-chinese .card-dir-tag {
  background: #aa7c11;
}

.card-back.is-reversed .card-icon {
  transform: rotate(180deg);
}

.card-back.is-reversed .card-dir-tag {
  background: var(--error-color, #c41e3a);
}
.theme-dark .card-back.is-reversed .card-dir-tag {
  background: #c41e3a;
}
.theme-chinese .card-back.is-reversed .card-dir-tag {
  background: #c41e3a;
}

/* 按钮 */
.gold-btn {
  width: 100%;
  height: 96rpx;
  line-height: 96rpx;
  background: var(--primary-color, #8e44ad);
  color: #fff;
  font-weight: bold;
  font-size: 32rpx;
  border-radius: 48rpx;
  border: none;
  box-shadow: 0 6rpx 20rpx rgba(229, 193, 88, 0.4);
  margin-top: 20rpx;
}

.gold-btn[disabled] {
  background: #4a4235;
  color: #7a705e;
  box-shadow: none;
  opacity: 0.6;
}

/* 结果区 */
.result-section {
  position: relative;
  z-index: 1;
}

.drawn-cards {
  display: flex;
  gap: 20rpx;
  margin-bottom: 40rpx;
  justify-content: center;
  perspective: 1000rpx; /* 激活 3D 景深视距，使结果牌阵显示更具空间立体层次 */
}

.drawn-card {
  flex: 1;
  max-width: 200rpx;
  text-align: center;
}

.position {
  font-size: 24rpx;
  font-weight: 500;
  color: #e5c158;
  margin-bottom: 16rpx;
  display: block;
}

/* 结果大卡片 */
.card-frame {
  background: linear-gradient(135deg, #fdf8eb, #f3eacf);
  border: 4rpx solid #aa7c11;
  border-radius: 16rpx;
  aspect-ratio: 2/3.2;
  box-shadow: 0 8rpx 20rpx rgba(0,0,0,0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16rpx;
}

.card-inner-border {
  width: 90%;
  height: 92%;
  border: 2rpx dashed #d5c295;
  border-radius: 10rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 10rpx;
  box-sizing: border-box;
}

.card-frame.reversed .card-icon-large {
  transform: rotate(180deg);
}

.card-icon-large {
  font-size: 64rpx;
  margin-bottom: 12rpx;
}

.card-name-text {
  font-size: 26rpx;
  font-weight: bold;
  color: #3e2723;
  display: block;
}

.card-state-tag {
  font-size: 18rpx;
  margin-top: 8rpx;
  padding: 4rpx 12rpx;
  border-radius: 6rpx;
  background: #aa7c11;
  color: #fff;
}

.card-frame.reversed .card-state-tag {
  background: #c41e3a;
}

.card-meaning {
  font-size: 22rpx;
  color: #a69ebd;
  line-height: 1.5;
  display: block;
  padding: 0 8rpx;
}

/* 综合解读 */
.overall-reading {
  background: rgba(30, 24, 52, 0.7);
  border: 2rpx solid #e5c158;
  border-radius: 20rpx;
  padding: 30rpx;
  margin-bottom: 40rpx;
  box-shadow: 0 4rpx 20rpx rgba(229, 193, 88, 0.1);
}

.reading-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #e5c158;
  margin-bottom: 16rpx;
  display: block;
}

.reading-text {
  font-size: 28rpx;
  color: #e2dcf0;
  line-height: 1.8;
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
  background: linear-gradient(135deg, #a887e6, #7952c4);
  color: #fff;
}
.action-btn.share:active {
  opacity: 0.9;
}

.action-btn.reset-btn {
  background: rgba(50, 40, 85, 0.5);
  color: #e2dcf0;
  border: 2rpx solid #4a3e72;
}

.action-btn.reset-btn:active {
  background: rgba(70, 56, 119, 0.7);
}

/* 百科弹窗样式 */
.guide-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(10, 8, 20, 0.85);
  backdrop-filter: blur(10px);
  z-index: 999;
  display: flex;
  align-items: flex-end;
}

.guide-content {
  width: 100%;
  height: 80vh;
  background: #161224;
  border-top: 4rpx solid #e5c158;
  border-radius: 40rpx 40rpx 0 0;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  padding: 40rpx 30rpx;
  position: relative;
}

.guide-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30rpx;
  border-bottom: 2rpx solid #322b4f;
  padding-bottom: 20rpx;
}

.guide-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #e5c158;
}

.guide-close {
  font-size: 36rpx;
  color: #887fa3;
  padding: 10rpx;
}

.guide-scroll {
  flex: 1;
  overflow-y: auto;
}

.guide-intro {
  margin-bottom: 30rpx;
  background: rgba(229, 193, 88, 0.05);
  border-left: 6rpx solid #e5c158;
  padding: 16rpx 20rpx;
  border-radius: 0 12rpx 12rpx 0;
}

.intro-text {
  font-size: 24rpx;
  color: #a69ebd;
  line-height: 1.6;
}

.guide-card-list {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.guide-card-item {
  background: rgba(30, 24, 52, 0.5);
  border: 2rpx solid rgba(229, 193, 88, 0.15);
  border-radius: 20rpx;
  padding: 24rpx;
}

.guide-card-info {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 20rpx;
}

.guide-card-icon {
  font-size: 44rpx;
}

.guide-card-name {
  font-size: 30rpx;
  font-weight: bold;
  color: #e5c158;
}

.guide-card-keyword {
  font-size: 24rpx;
  color: #a69ebd;
  margin-left: auto;
}

.guide-card-body {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.meaning-box {
  padding: 16rpx 20rpx;
  border-radius: 12rpx;
  font-size: 24rpx;
  line-height: 1.5;
}

.meaning-box.positive {
  background: rgba(46, 204, 113, 0.08);
  border: 1rpx solid rgba(46, 204, 113, 0.2);
  color: #2ecc71;
}

.meaning-box.negative {
  background: rgba(231, 76, 60, 0.08);
  border: 1rpx solid rgba(231, 76, 60, 0.2);
  color: #e74c3c;
}

.meaning-title {
  font-weight: bold;
  display: block;
  margin-bottom: 8rpx;
}

.meaning-desc {
  color: #e2dcf0;
}

.disclaimer {
  text-align: center;
  padding: 20rpx;
  font-size: 22rpx;
  color: #887fa3;
}

@keyframes cardRollIn {
  0% {
    opacity: 0;
    transform: translateX(600rpx) rotate(120deg) scale(0.8);
  }
  100% {
    opacity: 1;
    transform: translateX(0) rotate(0deg) scale(1);
  }
}

@keyframes badgeBounce {
  0% { transform: scale(0); }
  70% { transform: scale(1.2); }
  100% { transform: scale(1); }
}
</style>
