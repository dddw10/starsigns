<template>
  <view class="page-container" :class="themeClass">
    <view class="mystic-orb orb-1"></view>
    <view class="mystic-orb orb-2"></view>

    <!-- Tab 切换 -->
    <view class="tab-container" v-if="!result && !loading">
      <view class="tab-item" :class="{ active: activeTab === 'single' }" @click="switchTab('single')">单人姓名测算</view>
      <view class="tab-item" :class="{ active: activeTab === 'match' }" @click="switchTab('match')">双人姓名配对</view>
    </view>

    <!-- 输入表单 -->
    <view class="form-section" v-if="!result && !loading">
      <text class="section-title">
        {{ activeTab === 'single' ? '✨ 姓名天命测算 ✨' : '☯️ 双人姓名契合度配对 ☯️' }}
      </text>
      
      <!-- 情况A：单人常用姓名 -->
      <view class="memory-section" v-if="activeTab === 'single' && commonNameList && commonNameList.length > 0">
        <text class="memory-label">💡 常用姓名一键填入：</text>
        <view class="memory-list">
          <view class="memory-chip" v-for="(item, index) in commonNameList" :key="index" @click="fillForm(item)">
            <text class="chip-text">{{ item.name }} ({{ item.gender === 'male' ? '男' : '女' }})</text>
            <text class="chip-close" @click.stop="deleteMemory(index)">×</text>
          </view>
        </view>
      </view>

      <!-- 情况B：双人常用配对 -->
      <view class="memory-section" v-if="activeTab === 'match' && commonNameMatchList && commonNameMatchList.length > 0">
        <text class="memory-label">💡 常用配对一键填入：</text>
        <view class="memory-list">
          <view class="memory-chip" v-for="(item, index) in commonNameMatchList" :key="index" @click="fillMatchForm(item)">
            <text class="chip-text">{{ item.name1 }} ❤ {{ item.name2 }}</text>
            <text class="chip-close" @click.stop="deleteMatchMemory(index)">×</text>
          </view>
        </view>
      </view>

      <!-- 模式1：单人表单 -->
      <view v-if="activeTab === 'single'">
        <view class="form-item">
          <text class="label">测算姓名</text>
          <input class="input" v-model="name" placeholder="请输入真实姓名（2-4字）" placeholder-style="color:#6d658c;" maxlength="10" />
        </view>

        <view class="form-item">
          <text class="label">性别</text>
          <view class="gender-group">
            <view class="gender-btn" :class="{ active: gender === 'male' }" @click="gender = 'male'">乾造 (男)</view>
            <view class="gender-btn" :class="{ active: gender === 'female' }" @click="gender = 'female'">坤造 (女)</view>
          </view>
        </view>
      </view>

      <!-- 模式2：双人表单 -->
      <view v-else>
        <view class="form-item">
          <text class="label">您的姓名</text>
          <input class="input" v-model="name1" placeholder="请输入您的姓名" placeholder-style="color:#6d658c;" maxlength="10" />
        </view>

        <view class="form-item">
          <text class="label">您的性别</text>
          <view class="gender-group">
            <view class="gender-btn" :class="{ active: gender1 === 'male' }" @click="gender1 = 'male'">乾造 (男)</view>
            <view class="gender-btn" :class="{ active: gender1 === 'female' }" @click="gender1 = 'female'">坤造 (女)</view>
          </view>
        </view>

        <view class="form-item">
          <text class="label">对方姓名</text>
          <input class="input" v-model="name2" placeholder="请输入对方姓名" placeholder-style="color:#6d658c;" maxlength="10" />
        </view>

        <view class="form-item">
          <text class="label">对方性别</text>
          <view class="gender-group">
            <view class="gender-btn" :class="{ active: gender2 === 'male' }" @click="gender2 = 'male'">乾造 (男)</view>
            <view class="gender-btn" :class="{ active: gender2 === 'female' }" @click="gender2 = 'female'">坤造 (女)</view>
          </view>
        </view>

        <view class="form-item">
          <text class="label">关系性质</text>
          <view class="gender-group">
            <view class="gender-btn" :class="{ active: relationType === 'love' }" @click="relationType = 'love'">💖 姻缘恋爱</view>
            <view class="gender-btn" :class="{ active: relationType === 'business' }" @click="relationType = 'business'">💰 合伙求财</view>
            <view class="gender-btn" :class="{ active: relationType === 'friend' }" @click="relationType = 'friend'">🤝 知己知彼</view>
          </view>
        </view>
      </view>

    </view>

    <button class="submit-btn" @click="calculate" :disabled="!canSubmit" v-if="!result && !loading">
      {{ activeTab === 'single' ? '开始推演姓名格局' : '测算姓名配对契合' }}
    </button>

    <!-- 计算中等待状态 -->
    <view class="calculating-state" v-if="loading">
      <view class="bagua-icon"></view>
      <text class="calculating-text">
        {{ activeTab === 'single' ? '正在排定天格人格，窥算运势格位...' : '正在拨动太极两仪，测算双方配对磁场...' }}
      </text>
    </view>

    <!-- 测算结果：卷轴展开动效 -->
    <view class="result-section" v-if="result && !loading">
      <text class="section-title">📜 {{ result.isMatch ? '双人天命契合报告' : '姓名推演吉凶法卷' }} 📜</text>
      
      <view class="scroll-wrapper">
        <view class="scroll-handle left"></view>
        <view class="scroll-body">
          <view class="scroll-inner-border">
            
            <!-- 情况A：单人报告 -->
            <view v-if="!result.isMatch">
              <text class="scroll-section-title">💡 姓名格局五格（点击查阅解析）</text>
              <view class="wuge-grid">
                <view class="wuge-item" @click="clickWuge('tiange')">
                  <text class="wuge-label">天格 (祖荫)</text>
                  <text class="wuge-value">{{ result.tiange }}</text>
                  <text class="wuge-tip">查看 ℹ️</text>
                </view>
                <view class="wuge-item" @click="clickWuge('renge')">
                  <text class="wuge-label">人格 (主运)</text>
                  <text class="wuge-value">{{ result.renge }}</text>
                  <text class="wuge-tip">查看 ℹ️</text>
                </view>
                <view class="wuge-item" @click="clickWuge('dige')">
                  <text class="wuge-label">地格 (前运)</text>
                  <text class="wuge-value">{{ result.dige }}</text>
                  <text class="wuge-tip">查看 ℹ️</text>
                </view>
                <view class="wuge-item" @click="clickWuge('waige')">
                  <text class="wuge-label">外格 (副运)</text>
                  <text class="wuge-value">{{ result.waige }}</text>
                  <text class="wuge-tip">查看 ℹ️</text>
                </view>
                <view class="wuge-item" @click="clickWuge('zongge')">
                  <text class="wuge-label">总格 (后运)</text>
                  <text class="wuge-value">{{ result.zongge }}</text>
                  <text class="wuge-tip">查看 ℹ️</text>
                </view>
              </view>

              <view class="result-divider"></view>

              <view class="interpretation-area">
                <text class="scroll-section-title">📖 五格命理总批</text>
                <text class="interpretation-text">{{ result.analysis }}</text>
              </view>

              <view class="result-divider"></view>

              <view class="lucky-grid">
                <view class="lucky-box">
                  <text class="lucky-label">格局幸运色</text>
                  <text class="lucky-val-name" :style="{ color: result.luckyColor }">{{ result.luckyColorName }}</text>
                </view>
                <view class="lucky-box">
                  <text class="lucky-label">格局幸运数</text>
                  <text class="lucky-val-num">{{ result.luckyNumber }}</text>
                </view>
              </view>
            </view>

            <!-- 情况B：双人匹配报告 -->
            <view v-else>
              <view class="match-score-card">
                <text class="match-score-label">契合度评分</text>
                <text class="match-score-num">{{ result.score }}分</text>
                <view class="match-stars">
                  <text v-for="i in 5" :key="i" class="star">{{ i <= result.rating ? '★' : '☆' }}</text>
                </view>
              </view>

              <view class="result-divider"></view>

              <!-- 双方基础气场 -->
              <view class="match-names-row">
                <view class="match-name-box">
                  <text class="match-n">{{ result.name1 }}</text>
                  <text class="match-e" :style="{ color: result.color1 }">五行属{{ result.wuxing1 }}</text>
                </view>
                <view class="match-heart-icon">
                  {{ result.relationType === 'love' ? '💖' : result.relationType === 'business' ? '🤝' : '✨' }}
                </view>
                <view class="match-name-box">
                  <text class="match-n">{{ result.name2 }}</text>
                  <text class="match-e" :style="{ color: result.color2 }">五行属{{ result.wuxing2 }}</text>
                </view>
              </view>

              <view class="result-divider"></view>

              <view class="interpretation-area">
                <text class="scroll-section-title">🔮 天命五行生克总批</text>
                <text class="interpretation-text">{{ result.analysis }}</text>
              </view>
            </view>

          </view>
        </view>
        <view class="scroll-handle right"></view>
      </view>

      <view class="action-btns">
        <button class="action-btn share" @click="share">分享与保存海报</button>
        <button class="action-btn reset-btn" @click="reset">重新测算姓名</button>
      </view>
    </view>

    <!-- 五格科普气泡弹窗 -->
    <view class="wuge-modal" v-if="showWugeModal" @click="showWugeModal = false">
      <view class="wuge-dialog" @click.stop>
        <view class="wuge-dialog-header">
          <text class="wuge-dialog-title">🔮 {{ wugeModalTitle }}</text>
          <text class="wuge-dialog-close" @click="showWugeModal = false">✕</text>
        </view>
        <view class="wuge-dialog-body">
          <text class="wuge-dialog-text">{{ wugeModalDesc }}</text>
        </view>
      </view>
    </view>

    <view class="disclaimer">
      <text>本结果基于数理配对与姓名五格法则剖析，仅供娱乐参考</text>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { nameAnalysisApi, nameMatchApi } from '@/api/fortune'
import { useUserStore } from '@/store/user'

const userStore = useUserStore()
const activeTab = ref('single')

// 单人测算状态
const name = ref('')
const gender = ref('male')
const commonNameList = ref([])

// 双人配对状态
const name1 = ref('')
const gender1 = ref('male')
const name2 = ref('')
const gender2 = ref('female')
const relationType = ref('love')
const commonNameMatchList = ref([])

const result = ref(null)
const loading = ref(false)

const share = () => {
  if (!result.value) return
  const query = {
    type: result.value.isMatch ? 'nameMatch' : 'name',
    title: result.value.isMatch ? '姓名配对契合报告' : '姓名吉凶分析法卷',
    name: result.value.isMatch ? `${result.value.name1} 与 ${result.value.name2}` : result.value.name,
    score: result.value.isMatch ? result.value.score : 85,
    analysis: result.value.analysis || ''
  }
  uni.navigateTo({
    url: `/pages/share/index?type=${query.type}&title=${encodeURIComponent(query.title)}&name=${encodeURIComponent(query.name)}&score=${query.score}&analysis=${encodeURIComponent(query.analysis)}`
  })
}

onMounted(() => {
  // 读取上次单人测算输入
  const lastInput = uni.getStorageSync('last_name_input')
  if (lastInput) {
    name.value = lastInput.name || ''
    gender.value = lastInput.gender || 'male'
  }

  // 读取单人常用记录
  const common = uni.getStorageSync('common_name_inputs')
  if (common) {
    commonNameList.value = common
  }

  // 读取上次双人配对输入
  const lastMatchInput = uni.getStorageSync('last_name_match_input')
  if (lastMatchInput) {
    name1.value = lastMatchInput.name1 || ''
    gender1.value = lastMatchInput.gender1 || 'male'
    name2.value = lastMatchInput.name2 || ''
    gender2.value = lastMatchInput.gender2 || 'female'
    relationType.value = lastMatchInput.relationType || 'love'
  }

  // 读取双人常用记录
  const commonMatch = uni.getStorageSync('common_name_match_inputs')
  if (commonMatch) {
    commonNameMatchList.value = commonMatch
  }
})

const fillForm = (item) => {
  name.value = item.name
  gender.value = item.gender
  uni.showToast({ title: '已回填姓名', icon: 'none' })
}

const deleteMemory = (index) => {
  commonNameList.value.splice(index, 1)
  uni.setStorageSync('common_name_inputs', commonNameList.value)
  uni.showToast({ title: '已删除常用', icon: 'none' })
}

const fillMatchForm = (item) => {
  name1.value = item.name1
  gender1.value = item.gender1 || 'male'
  name2.value = item.name2
  gender2.value = item.gender2 || 'female'
  relationType.value = item.relationType || 'love'
  uni.showToast({ title: '已回填配对姓名', icon: 'none' })
}

const deleteMatchMemory = (index) => {
  commonNameMatchList.value.splice(index, 1)
  uni.setStorageSync('common_name_match_inputs', commonNameMatchList.value)
  uni.showToast({ title: '已删除常用', icon: 'none' })
}

// 五格科普弹窗
const showWugeModal = ref(false)
const wugeModalTitle = ref('')
const wugeModalDesc = ref('')

const wugeInfo = {
  tiange: { name: '天格 (先天运势)', desc: '天格由姓氏笔画决定，代表双亲、长辈、祖先对自己的早期家庭影响。在社会交往中常体现为长辈的助力、领导贵人的照拂。' },
  renge: { name: '人格 (核心自我)', desc: '人格是姓名的中坚，代表自我意识、体质、核心才华与基础命格，管辖36岁至45岁的中年阶段，影响一生名誉、事业与最终成就。' },
  dige: { name: '地格 (青年运势)', desc: '地格代表配偶、子女、家庭环境及38岁以前的青年期生活。主宰前半生的运气、与爱人子女的关系。' },
  waige: { name: '外格 (社交网络)', desc: '外格代表社交关系、朋友圈、外在阻力与助力。主宰中年的社交状态、同辈友谊以及出门在外的贵人运势。' },
  zongge: { name: '总格 (晚年结局)', desc: '总格代表一生的总结、后半生的综合运势，主管48岁以后的晚年运程。影响晚景的安乐、资产的厚度与最终的事业归宿。' }
}

const canSubmit = computed(() => {
  if (loading.value) return false
  if (activeTab.value === 'single') {
    return name.value && name.value.trim().length >= 2 && name.value.trim().length <= 4
  } else {
    return name1.value && name1.value.trim().length >= 2 && name1.value.trim().length <= 4 &&
           name2.value && name2.value.trim().length >= 2 && name2.value.trim().length <= 4
  }
})

const calculate = async () => {
  if (!canSubmit.value) return
  loading.value = true
  
  // 模拟道家排盘延时
  await new Promise(resolve => setTimeout(resolve, 1500))

  try {
    // 自动快捷登录
    if (!userStore.isLoggedIn) {
      const loginRes = await userStore.login()
      if (!loginRes.success) {
        throw new Error(loginRes.message || '快捷登录失败')
      }
    }

    if (activeTab.value === 'single') {
      const res = await nameAnalysisApi({ 
        name: name.value.trim(),
        gender: gender.value
      })
      
      if (res.code !== 0) {
        throw new Error(res.message || '测算失败')
      }

      // 保存至本地存储 (上一次使用与常用列表)
      const currentInput = {
        name: name.value.trim(),
        gender: gender.value
      }
      uni.setStorageSync('last_name_input', currentInput)

      // 更新常用列表 (去重并限制最近3个)
      const list = [...commonNameList.value]
      const existIndex = list.findIndex(item => 
        item.name === currentInput.name && 
        item.gender === currentInput.gender
      )
      if (existIndex !== -1) {
        list.splice(existIndex, 1)
      }
      list.unshift(currentInput)
      if (list.length > 3) {
        list.pop()
      }
      commonNameList.value = list
      uni.setStorageSync('common_name_inputs', list)

      const data = res.data
      const wuge = data.wuge || {}
      const wuxingNames = { metal: '金', wood: '木', water: '水', fire: '火', earth: '土' }
      const colorMap = { metal: '#f1c40f', wood: '#27ae60', water: '#3498db', fire: '#e74c3c', earth: '#a0522d' }

      result.value = {
        isMatch: false,
        tiange: `${wuge.tianGe || '--'}`,
        renge: `${wuge.renGe || '--'}`,
        dige: `${wuge.diGe || '--'}`,
        waige: `${wuge.waiGe || '--'}`,
        zongge: `${wuge.zongGe || '--'}`,
        analysis: data.analysis || '分析完成',
        luckyColor: colorMap[data.fiveElement] || '#3498db',
        luckyColorName: wuxingNames[data.fiveElement] || '木性青色',
        luckyNumber: (data.score || 75) % 9 + 1
      }
    } else {
      // 双人配对模式
      const res = await nameMatchApi({
        name1: name1.value.trim(),
        name2: name2.value.trim(),
        relationType: relationType.value
      })

      if (res.code !== 0) {
        throw new Error(res.message || '配对测算失败')
      }

      const currentInput = {
        name1: name1.value.trim(),
        gender1: gender1.value,
        name2: name2.value.trim(),
        gender2: gender2.value,
        relationType: relationType.value
      }
      uni.setStorageSync('last_name_match_input', currentInput)

      // 更新双人常用列表
      const list = [...commonNameMatchList.value]
      const existIndex = list.findIndex(item => 
        item.name1 === currentInput.name1 && 
        item.name2 === currentInput.name2
      )
      if (existIndex !== -1) {
        list.splice(existIndex, 1)
      }
      list.unshift(currentInput)
      if (list.length > 3) {
        list.pop()
      }
      commonNameMatchList.value = list
      uni.setStorageSync('common_name_match_inputs', list)

      const data = res.data
      const wuxingNames = { metal: '金', wood: '木', water: '水', fire: '火', earth: '土' }
      const colorMap = { metal: '#f1c40f', wood: '#27ae60', water: '#3498db', fire: '#e74c3c', earth: '#a0522d' }

      result.value = {
        isMatch: true,
        name1: data.name1,
        name2: data.name2,
        wuxing1: wuxingNames[data.wuxing1] || '土',
        wuxing2: wuxingNames[data.wuxing2] || '土',
        color1: colorMap[data.wuxing1] || '#a0522d',
        color2: colorMap[data.wuxing2] || '#a0522d',
        relationType: data.relationType,
        score: data.score || 75,
        rating: data.rating || 3,
        analysis: data.analysis || '契合度批注完成'
      }
    }

    await userStore.fetchUserInfo()
  } catch (err) {
    uni.showToast({ title: err.message || '推演失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

const clickWuge = (type) => {
  const info = wugeInfo[type]
  if (info) {
    wugeModalTitle.value = info.name
    wugeModalDesc.value = info.desc
    showWugeModal.value = true
  }
}

const reset = () => {
  result.value = null
  // 根据当前 activeTab 重置对应输入框，保留非当前的输入，提升体验
  if (activeTab.value === 'single') {
    name.value = ''
  } else {
    name1.value = ''
    name2.value = ''
  }
}

const switchTab = (tab) => {
  activeTab.value = tab
  result.value = null
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

.input {
  padding: 24rpx;
  background: var(--bg-color, #f8f8f8);
  border: 1rpx solid var(--border-color, #eee);
  border-radius: 16rpx;
  font-size: 28rpx;
  color: var(--text-color, #333);
}
.theme-chinese .input {
  background: rgba(14, 11, 12, 0.6);
  border: 1rpx solid #5a353b;
  color: #fff;
}

.gender-group {
  display: flex;
  gap: 20rpx;
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

/* 计算中状态 */
.calculating-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 150rpx 0;
  gap: 40rpx;
  position: relative;
  z-index: 1;
}

.bagua-icon {
  width: 120rpx;
  height: 120rpx;
  border: 4rpx solid var(--secondary-color, #e5c158);
  border-radius: 50%;
  background: repeating-conic-gradient(from 0deg, var(--bg-color, #161012) 0deg 90deg, var(--secondary-color, #e5c158) 90deg 180deg);
  box-shadow: 0 0 20rpx var(--card-shadow, rgba(229, 193, 88, 0.4));
  animation: rotateBagua 2s linear infinite;
}
.theme-chinese .bagua-icon {
  border: 4rpx solid #e5c158;
  background: repeating-conic-gradient(from 0deg, #161012 0deg 90deg, #e5c158 90deg 180deg);
  box-shadow: 0 0 20rpx rgba(229, 193, 88, 0.6);
}

@keyframes rotateBagua {
  to { transform: rotate(360deg); }
}

.calculating-text {
  font-size: 26rpx;
  color: var(--text-secondary, #666);
}
.theme-chinese .calculating-text {
  color: #a69ebd;
}

/* 天书卷轴展开动画 */
.scroll-wrapper {
  position: relative;
  width: 100%;
  overflow: hidden;
  margin-bottom: 40rpx;
  display: flex;
  justify-content: center;
  z-index: 1;
}

.scroll-handle {
  position: absolute;
  top: 0;
  width: 16rpx;
  height: 100%;
  background: linear-gradient(to right, var(--primary-dark, #8a640f), var(--secondary-light, #e5c158), var(--primary-dark, #8a640f));
  border-radius: 8rpx;
  z-index: 10;
  box-shadow: 0 4rpx 12rpx var(--card-shadow, rgba(0,0,0,0.2));
}
.theme-chinese .scroll-handle {
  background: linear-gradient(to right, #8a640f, #e5c158, #8a640f);
  box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.5);
}

.scroll-handle.left {
  left: 50%;
  transform: translateX(-50%);
  animation: rollLeft 1.2s cubic-bezier(0.25, 0.8, 0.25, 1) forwards;
}

.scroll-handle.right {
  right: 50%;
  transform: translateX(50%);
  animation: rollRight 1.2s cubic-bezier(0.25, 0.8, 0.25, 1) forwards;
}

.scroll-body {
  width: 100%;
  background: var(--card-bg, #fff);
  border: 2rpx solid var(--border-color, #eee);
  box-sizing: border-box;
  border-radius: 12rpx;
  transform: scaleX(0);
  transform-origin: center center;
  animation: bodyUnfold 1.2s cubic-bezier(0.25, 0.8, 0.25, 1) forwards;
  padding: 30rpx;
  box-shadow: inset 0 0 40rpx var(--card-shadow, rgba(0,0,0,0.05));
}
.theme-chinese .scroll-body {
  background: linear-gradient(135deg, #fdf8eb, #f3eacf);
  border: 2rpx solid #aa7c11;
  box-shadow: inset 0 0 40rpx rgba(138, 100, 15, 0.15);
}

.scroll-inner-border {
  width: 100%;
  border: 2rpx dashed var(--border-color, #eee);
  border-radius: 8rpx;
  padding: 20rpx;
  box-sizing: border-box;
}
.theme-chinese .scroll-inner-border {
  border: 2rpx dashed #d5c295;
}

@keyframes rollLeft {
  to { left: 0rpx; transform: translateX(0); }
}

@keyframes rollRight {
  to { right: 0rpx; transform: translateX(0); }
}

@keyframes bodyUnfold {
  to { transform: scaleX(1); }
}

.scroll-section-title {
  font-size: 26rpx;
  font-weight: bold;
  color: var(--text-color, #333);
  display: block;
  margin-bottom: 20rpx;
  text-align: center;
}
.theme-chinese .scroll-section-title {
  color: #3e2723;
}

/* 五格网格 */
.wuge-grid {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.wuge-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--bg-secondary, #fafafa);
  border: 1rpx solid var(--border-color, #eee);
  padding: 16rpx 24rpx;
  border-radius: 8rpx;
  cursor: pointer;
  transition: background 0.2s;
}
.theme-chinese .wuge-item {
  background: rgba(138, 100, 15, 0.05);
  border: 1rpx solid rgba(138, 100, 15, 0.15);
}

.wuge-item:active {
  background: var(--border-light, #eee);
}
.theme-chinese .wuge-item:active {
  background: rgba(138, 100, 15, 0.15);
}

.wuge-label {
  font-size: 26rpx;
  color: var(--text-color, #333);
  font-weight: 500;
}
.theme-chinese .wuge-label {
  color: #5d4037;
}

.wuge-value {
  font-size: 28rpx;
  font-weight: bold;
  color: var(--primary-color, #c41e3a);
}
.theme-chinese .wuge-value {
  color: #a71d2a;
}

.wuge-tip {
  font-size: 20rpx;
  color: var(--text-secondary, #666);
}
.theme-chinese .wuge-tip {
  color: #8d6e63;
}

.result-divider {
  height: 2rpx;
  background: var(--border-color, #eee);
  margin: 30rpx 0;
  border-bottom: 1rpx dashed var(--border-light, #eee);
}
.theme-chinese .result-divider {
  background: #d5c295;
  border-bottom: 1rpx dashed rgba(138, 100, 15, 0.3);
}

/* 总批解析 */
.interpretation-area {
  margin-top: 10rpx;
}

.interpretation-text {
  font-size: 26rpx;
  color: var(--text-color, #333);
  line-height: 1.8;
  display: block;
  text-align: justify;
}
.theme-chinese .interpretation-text {
  color: #3e2723;
}

/* 幸运信息 */
.lucky-grid {
  display: flex;
  gap: 20rpx;
}

.lucky-box {
  flex: 1;
  background: var(--bg-secondary, #fafafa);
  border: 1rpx solid var(--border-color, #eee);
  padding: 20rpx;
  border-radius: 8rpx;
  text-align: center;
}
.theme-chinese .lucky-box {
  background: rgba(138, 100, 15, 0.05);
  border: 1rpx solid rgba(138, 100, 15, 0.15);
}

.lucky-label {
  font-size: 22rpx;
  color: var(--text-secondary, #666);
  display: block;
  margin-bottom: 8rpx;
}
.theme-chinese .lucky-label {
  color: #795548;
}

.lucky-val-name {
  font-size: 28rpx;
  font-weight: bold;
}

.lucky-val-num {
  font-size: 30rpx;
  font-weight: bold;
  color: var(--text-color, #333);
}
.theme-chinese .lucky-val-num {
  color: #3e2723;
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

/* 五格弹窗 */
.wuge-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(10, 8, 12, 0.6);
  backdrop-filter: blur(8px);
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 50rpx;
  box-sizing: border-box;
}

.wuge-dialog {
  width: 100%;
  max-width: 600rpx;
  background: var(--card-bg, #fff);
  border: 4rpx solid var(--primary-color, #c41e3a);
  border-radius: 24rpx;
  padding: 30rpx;
  box-shadow: 0 10rpx 30rpx var(--card-shadow, rgba(0, 0, 0, 0.15));
}
.theme-chinese .wuge-dialog {
  background: linear-gradient(135deg, #fdf8eb, #f3eacf);
  border: 4rpx solid #aa7c11;
  box-shadow: 0 10rpx 30rpx rgba(0, 0, 0, 0.5);
}

.wuge-dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2rpx dashed var(--border-color, #eee);
  padding-bottom: 16rpx;
  margin-bottom: 20rpx;
}
.theme-chinese .wuge-dialog-header {
  border-bottom: 2rpx dashed #d5c295;
}

.wuge-dialog-title {
  font-size: 30rpx;
  font-weight: bold;
  color: var(--primary-color, #c41e3a);
}
.theme-chinese .wuge-dialog-title {
  color: #a71d2a;
}

.wuge-dialog-close {
  font-size: 36rpx;
  color: var(--text-secondary, #666);
  padding: 10rpx;
}
.theme-chinese .wuge-dialog-close {
  color: #8d6e63;
}

.wuge-dialog-text {
  font-size: 26rpx;
  color: var(--text-color, #333);
  line-height: 1.7;
  display: block;
}
.theme-chinese .wuge-dialog-text {
  color: #3e2723;
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

/* 常用姓名记忆胶囊 */
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

/* Tab 切换 */
.tab-container {
  display: flex;
  background: var(--card-bg, #fff);
  border: 2rpx solid var(--border-color, #eee);
  border-radius: 20rpx;
  margin-bottom: 24rpx;
  overflow: hidden;
  position: relative;
  z-index: 1;
  box-shadow: 0 4rpx 16rpx var(--card-shadow, rgba(0,0,0,0.05));
}
.theme-chinese .tab-container {
  background: rgba(30, 20, 22, 0.6);
  border: 2rpx solid #6b1d28;
  box-shadow: none;
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 24rpx 0;
  font-size: 28rpx;
  font-weight: bold;
  color: var(--text-secondary, #666);
  transition: all 0.2s;
}
.theme-chinese .tab-item {
  color: #a69ebd;
}

.tab-item.active {
  background: var(--primary-color, #c41e3a);
  color: #fff;
}
.theme-chinese .tab-item.active {
  background: linear-gradient(135deg, #c41e3a, #990f26);
  color: #fff;
  box-shadow: 0 0 15rpx rgba(196, 30, 58, 0.3);
}

/* 配对得分卡 */
.match-score-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20rpx 0;
}

.match-score-label {
  font-size: 24rpx;
  color: #8a640f;
  margin-bottom: 8rpx;
}

.match-score-num {
  font-size: 72rpx;
  font-weight: 900;
  color: #c41e3a;
  text-shadow: 0 4rpx 10rpx rgba(196, 30, 58, 0.15);
}

.match-stars {
  margin-top: 10rpx;
}

/* 双方名字布局 */
.match-names-row {
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 24rpx 0;
}

.match-name-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.match-n {
  font-size: 34rpx;
  font-weight: bold;
  color: #1a0f00;
}

.match-e {
  font-size: 24rpx;
  margin-top: 8rpx;
  font-weight: 500;
}

.match-heart-icon {
  font-size: 50rpx;
  animation: heartBeat 1.2s infinite;
}

@keyframes heartBeat {
  0% { transform: scale(1); }
  50% { transform: scale(1.15); }
  100% { transform: scale(1); }
}
</style>
