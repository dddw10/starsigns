<template>
  <view class="page-container" :class="themeClass">
    
    <!-- Tab 切换 -->
    <view class="tab-container" v-if="!result && !loading">
      <view class="tab-item" :class="{ active: activeTab === 'single' }" @click="switchTab('single')">单人八字排盘</view>
      <view class="tab-item" :class="{ active: activeTab === 'match' }" @click="switchTab('match')">双人八字配对</view>
    </view>

    <!-- 输入表单 -->
    <view class="form-section" v-if="!result && !loading">
      
      <!-- 情况A：单人常用记忆 -->
      <view class="memory-section" v-if="activeTab === 'single' && commonBaziList && commonBaziList.length > 0">
        <text class="memory-label">💡 常用生辰一键填入：</text>
        <view class="memory-list">
          <view class="memory-chip" v-for="(item, index) in commonBaziList" :key="index" @click="fillForm(item)">
            <text class="chip-text">{{ item.birthDate }} ({{ item.gender === 'male' ? '男' : '女' }})</text>
            <text class="chip-close" @click.stop="deleteMemory(index)">×</text>
          </view>
        </view>
      </view>

      <!-- 情况B：双人常用配对 -->
      <view class="memory-section" v-if="activeTab === 'match' && commonBaziMatchList && commonBaziMatchList.length > 0">
        <text class="memory-label">💡 常用生辰合婚一键填入：</text>
        <view class="memory-list">
          <view class="memory-chip" v-for="(item, index) in commonBaziMatchList" :key="index" @click="fillMatchForm(item)">
            <text class="chip-text">{{ item.name1 }} ❤ {{ item.name2 }}</text>
            <text class="chip-close" @click.stop="deleteMatchMemory(index)">×</text>
          </view>
        </view>
      </view>

      <!-- 模式1：单人表单 -->
      <view v-if="activeTab === 'single'">
        <text class="section-title">请输入您的生辰信息</text>
        
        <view class="form-item">
          <text class="label">出生日期</text>
          <picker mode="date" :value="birthDate" @change="onDateChange">
            <view class="picker-value">{{ birthDate || '请选择日期' }}</view>
          </picker>
        </view>

        <view class="form-item">
          <text class="label">出生时辰</text>
          <picker :range="timeSlots" :range-key="'label'" @change="onTimeChange">
            <view class="picker-value">{{ selectedTime?.label || '请选择时辰' }}</view>
          </picker>
        </view>

        <view class="form-item">
          <text class="label">性别</text>
          <view class="gender-group">
            <view class="gender-btn" :class="{ active: gender === 'male' }" @click="gender = 'male'">乾造 (男)</view>
            <view class="gender-btn" :class="{ active: gender === 'female' }" @click="gender = 'female'">坤造 (女)</view>
          </view>
        </view>

        <view class="form-item">
          <text class="label">历法</text>
          <view class="gender-group">
            <view class="gender-btn" :class="{ active: calendar === 'solar' }" @click="calendar = 'solar'">公历</view>
            <view class="gender-btn" :class="{ active: calendar === 'lunar' }" @click="calendar = 'lunar'">农历</view>
          </view>
        </view>
      </view>

      <!-- 模式2：双人表单 -->
      <view v-else>
        <!-- 甲方 -->
        <view class="form-title-sub">🔮 您的生辰格局 🔮</view>
        <view class="form-item">
          <text class="label">您的姓名</text>
          <input class="input" placeholder-class="input-placeholder" v-model="name1" placeholder="请输入您的姓名" maxlength="10" />
        </view>
        <view class="form-item">
          <text class="label">您的公历生日</text>
          <picker mode="date" :value="birthDate1" @change="onDateChange1">
            <view class="picker-value">{{ birthDate1 || '请选择您的公历生日' }}</view>
          </picker>
        </view>
        <view class="form-item">
          <text class="label">您的出生时辰</text>
          <picker :range="timeSlots" :range-key="'label'" @change="onTimeChange1">
            <view class="picker-value">{{ selectedTime1?.label || '请选择您的时辰' }}</view>
          </picker>
        </view>
        <view class="form-item">
          <text class="label">您的性别</text>
          <view class="gender-group">
            <view class="gender-btn" :class="{ active: gender1 === 'male' }" @click="gender1 = 'male'">乾造 (男)</view>
            <view class="gender-btn" :class="{ active: gender1 === 'female' }" @click="gender1 = 'female'">坤造 (女)</view>
          </view>
        </view>

        <view class="result-divider" style="margin: 40rpx 0; border-bottom: 2rpx dashed #eee;"></view>

        <!-- 乙方 -->
        <view class="form-title-sub">🔮 对方的生辰格局 🔮</view>
        <view class="form-item">
          <text class="label">对方姓名</text>
          <input class="input" placeholder-class="input-placeholder" v-model="name2" placeholder="请输入对方姓名" maxlength="10" />
        </view>
        <view class="form-item">
          <text class="label">对方公历生日</text>
          <picker mode="date" :value="birthDate2" @change="onDateChange2">
            <view class="picker-value">{{ birthDate2 || '请选择对方公历生日' }}</view>
          </picker>
        </view>
        <view class="form-item">
          <text class="label">对方出生时辰</text>
          <picker :range="timeSlots" :range-key="'label'" @change="onTimeChange2">
            <view class="picker-value">{{ selectedTime2?.label || '请选择对方时辰' }}</view>
          </picker>
        </view>
        <view class="form-item">
          <text class="label">对方性别</text>
          <view class="gender-group">
            <view class="gender-btn" :class="{ active: gender2 === 'male' }" @click="gender2 = 'male'">乾造 (男)</view>
            <view class="gender-btn" :class="{ active: gender2 === 'female' }" @click="gender2 = 'female'">坤造 (女)</view>
          </view>
        </view>

        <view class="result-divider" style="margin: 40rpx 0; border-bottom: 2rpx dashed #eee;"></view>

        <!-- 关系性质 -->
        <view class="form-item">
          <text class="label">测算目的</text>
          <view class="gender-group">
            <view class="gender-btn" :class="{ active: relationType === 'love' }" @click="relationType = 'love'">💖 姻缘合婚</view>
            <view class="gender-btn" :class="{ active: relationType === 'business' }" @click="relationType = 'business'">💰 合伙求财</view>
          </view>
        </view>
      </view>

    </view>

    <!-- 实时生辰预览卡片 (离线计算下沉) -->
    <view class="live-preview-card" v-if="localBaziPreview && !result && !loading">
      <view class="preview-header">
        <text class="preview-title-icon">☯️</text>
        <text class="preview-title-text">生辰干支即时排演</text>
      </view>
      <view class="preview-body-content" v-if="activeTab === 'single'">
        <view class="preview-row">
          <text class="preview-label-tag">本命生肖:</text>
          <text class="preview-val-tag shengxiao">{{ localBaziPreview.shengXiao }}肖</text>
        </view>
        <view class="preview-row" style="margin-top: 10rpx;">
          <text class="preview-label-tag">排盘干支:</text>
          <text class="preview-val-tag ganzhi">{{ localBaziPreview.gangan }}</text>
        </view>
      </view>
      <view class="preview-body-content" v-else>
        <view class="preview-row">
          <text class="preview-label-tag">{{ name1 || '您' }}的干支:</text>
          <text class="preview-val-tag ganzhi">{{ localBaziPreview.gangan1 }}</text>
        </view>
        <view class="preview-row" style="margin-top: 12rpx;">
          <text class="preview-label-tag">{{ name2 || '对方' }}的干支:</text>
          <text class="preview-val-tag ganzhi">{{ localBaziPreview.gangan2 }}</text>
        </view>
      </view>
    </view>

    <!-- 提交按钮 -->
    <button class="submit-btn" @click="calculate" :disabled="!canSubmit" v-if="!result && !loading">
      {{ activeTab === 'single' ? '开始排盘' : '开始双人八字合婚' }}
    </button>

    <!-- 计算中等待状态 -->
    <view class="calculating-state" v-if="loading">
      <view class="bagua-icon"></view>
      <text class="calculating-text">
        {{ activeTab === 'single' ? '正在排定乾坤命格，窥算八字局势...' : '正在排演双方五行盈缺，推导命理生克谐振...' }}
      </text>
    </view>

    <!-- 测算结果：卷轴展开动效 -->
    <view class="result-section" v-if="result && !loading">
      <text class="section-title">📜 {{ result.isMatch ? '双人生辰合婚法卷' : '个人八字排盘吉凶' }} 📜</text>
      
      <view class="scroll-wrapper">
        <view class="scroll-handle left"></view>
        <view class="scroll-body">
          <view class="scroll-inner-border">
            
            <!-- 情况A：单人排盘结果 -->
            <view v-if="!result.isMatch">
              <view class="bazi-grid">
                <view class="bazi-item" v-for="(item, index) in result.bazi" :key="index">
                  <text class="bazi-label">{{ item.label }}</text>
                  <text class="bazi-value">{{ item.value }}</text>
                </view>
              </view>

              <view class="analysis-section">
                <text class="scroll-section-title">🔮 五行占比排布</text>
                <view class="wuxing-chart">
                  <view class="wuxing-item" v-for="(item, index) in result.wuxing" :key="index">
                    <text class="wuxing-name">{{ item.name }}</text>
                    <view class="wuxing-bar">
                      <view class="wuxing-fill" :style="{ width: item.count * 20 + '%', background: item.color }"></view>
                    </view>
                    <text class="wuxing-count">{{ item.count }}</text>
                  </view>
                </view>
              </view>

              <view class="result-divider"></view>

              <view class="analysis-section">
                <text class="scroll-section-title">📖 命理总批解读</text>
                <text class="interpretation-text">{{ result.analysis }}</text>
              </view>

              <view class="action-btns">
                <button class="action-btn share" @click="share">分享结果</button>
                <button class="action-btn save" @click="save">保存记录</button>
              </view>
            </view>

            <!-- 情况B：双人合婚结果 -->
            <view v-else>
              <view class="match-score-card">
                <text class="match-score-label">合婚契合度评分</text>
                <text class="match-score-num">{{ result.score }}分</text>
                <view class="match-stars">
                  <text v-for="i in 5" :key="i" class="star">{{ i <= result.rating ? '★' : '☆' }}</text>
                </view>
              </view>

              <view class="result-divider"></view>

              <!-- 双方排盘简报 -->
              <view class="match-names-row">
                <view class="match-name-box">
                  <text class="match-n" style="color:#a71d2a;">{{ result.name1 }}</text>
                  <text class="match-e" style="color:#5d4037;">日主: {{ result.dayGan1 }}</text>
                </view>
                <view class="match-heart-icon">
                  {{ result.relationType === 'love' ? '💖' : '🤝' }}
                </view>
                <view class="match-name-box">
                  <text class="match-n" style="color:#a71d2a;">{{ result.name2 }}</text>
                  <text class="match-e" style="color:#5d4037;">日主: {{ result.dayGan2 }}</text>
                </view>
              </view>

              <view class="result-divider"></view>

              <view class="analysis-section">
                <text class="scroll-section-title">🔮 乾坤天命合婚总批</text>
                <text class="interpretation-text" style="white-space: pre-wrap; text-align: justify; word-break: break-all;">{{ result.analysis }}</text>
              </view>

              <view class="action-btns">
                <button class="action-btn share" @click="share">分享结果</button>
                <button class="action-btn reset-btn" @click="reset">重新测算合婚</button>
              </view>
            </view>

          </view>
        </view>
        <view class="scroll-handle right"></view>
      </view>
    </view>

    <view class="disclaimer">
      <text>本结果基于数理喜用神与日干命理剖析，仅供娱乐参考</text>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { calcBaziApi, baziMatchApi } from '@/api/fortune'
import { updateBirthInfoApi } from '@/api/user'
import { useUserStore } from '@/store/user'
import { GAN_WUXING, calculateBazi } from './utils/bazi-calc'

const userStore = useUserStore()
const activeTab = ref('single')

// 单人测算状态
const birthDate = ref('')
const selectedTime = ref(null)
const gender = ref('male')
const calendar = ref('solar')
const commonBaziList = ref([])

// 双人配对状态
const name1 = ref('')
const birthDate1 = ref('')
const selectedTime1 = ref(null)
const gender1 = ref('male')

const name2 = ref('')
const birthDate2 = ref('')
const selectedTime2 = ref(null)
const gender2 = ref('female')

const relationType = ref('love')
const commonBaziMatchList = ref([])

const result = ref(null)
const loading = ref(false)

const timeSlots = [
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

const localBaziPreview = computed(() => {
  if (activeTab.value === 'single') {
    if (!birthDate.value || !selectedTime.value) return null
    try {
      const [year, month, day] = birthDate.value.split('-').map(Number)
      const slotHours = {
        '子时': 0, '丑时': 1, '寅时': 3, '卯时': 5, '辰时': 7, '巳时': 9,
        '午时': 11, '未时': 13, '申时': 15, '酉时': 17, '戌时': 19, '亥时': 21
      }
      const hour = slotHours[selectedTime.value.value] || 0
      const localResult = calculateBazi(year, month, day, hour)
      return {
        gangan: `${localResult.year.gan}${localResult.year.zhi}年 ${localResult.month.gan}${localResult.month.zhi}月 ${localResult.day.gan}${localResult.day.zhi}日 ${localResult.hour.gan}${localResult.hour.zhi}时`,
        shengXiao: localResult.shengXiao
      }
    } catch (e) {
      return null
    }
  } else {
    if (!birthDate1.value || !selectedTime1.value || !birthDate2.value || !selectedTime2.value) return null
    try {
      const slotHours = {
        '子时': 0, '丑时': 1, '寅时': 3, '卯时': 5, '辰时': 7, '巳时': 9,
        '午时': 11, '未时': 13, '申时': 15, '酉时': 17, '戌时': 19, '亥时': 21
      }
      
      const [y1, m1, d1] = birthDate1.value.split('-').map(Number)
      const h1 = slotHours[selectedTime1.value.value] || 0
      const b1 = calculateBazi(y1, m1, d1, h1)

      const [y2, m2, d2] = birthDate2.value.split('-').map(Number)
      const h2 = slotHours[selectedTime2.value.value] || 0
      const b2 = calculateBazi(y2, m2, d2, h2)

      return {
        gangan1: `${b1.year.gan}${b1.year.zhi}年 ${b1.month.gan}${b1.month.zhi}月 ${b1.day.gan}${b1.day.zhi}日 ${b1.hour.gan}${b1.hour.zhi}时`,
        gangan2: `${b2.year.gan}${b2.year.zhi}年 ${b2.month.gan}${b2.month.zhi}月 ${b2.day.gan}${b2.day.zhi}日 ${b2.hour.gan}${b2.hour.zhi}时`
      }
    } catch (e) {
      return null
    }
  }
})

onMounted(() => {
  // 读取单人历史
  const lastInput = uni.getStorageSync('last_bazi_input')
  if (lastInput) {
    birthDate.value = lastInput.birthDate || ''
    selectedTime.value = lastInput.selectedTime || null
    gender.value = lastInput.gender || 'male'
    calendar.value = lastInput.calendar || 'solar'
  }
  
  const common = uni.getStorageSync('common_bazi_inputs')
  if (common) {
    commonBaziList.value = common
  }

  // 读取双人合婚历史
  const lastMatchInput = uni.getStorageSync('last_bazi_match_input')
  if (lastMatchInput) {
    name1.value = lastMatchInput.name1 || ''
    birthDate1.value = lastMatchInput.birthDate1 || ''
    selectedTime1.value = lastMatchInput.selectedTime1 || null
    gender1.value = lastMatchInput.gender1 || 'male'
    
    name2.value = lastMatchInput.name2 || ''
    birthDate2.value = lastMatchInput.birthDate2 || ''
    selectedTime2.value = lastMatchInput.selectedTime2 || null
    gender2.value = lastMatchInput.gender2 || 'female'
    
    relationType.value = lastMatchInput.relationType || 'love'
  }

  const commonMatch = uni.getStorageSync('common_bazi_match_inputs')
  if (commonMatch) {
    commonBaziMatchList.value = commonMatch
  }
})

const fillForm = (item) => {
  birthDate.value = item.birthDate
  selectedTime.value = item.selectedTime
  gender.value = item.gender
  calendar.value = item.calendar || 'solar'
  uni.showToast({ title: '已回填生辰', icon: 'none' })
}

const deleteMemory = (index) => {
  commonBaziList.value.splice(index, 1)
  uni.setStorageSync('common_bazi_inputs', commonBaziList.value)
  uni.showToast({ title: '已删除常用', icon: 'none' })
}

const fillMatchForm = (item) => {
  name1.value = item.name1
  birthDate1.value = item.birthDate1
  selectedTime1.value = item.selectedTime1
  gender1.value = item.gender1 || 'male'
  
  name2.value = item.name2
  birthDate2.value = item.birthDate2
  selectedTime2.value = item.selectedTime2
  gender2.value = item.gender2 || 'female'
  
  relationType.value = item.relationType || 'love'
  uni.showToast({ title: '已回填合婚数据', icon: 'none' })
}

const deleteMatchMemory = (index) => {
  commonBaziMatchList.value.splice(index, 1)
  uni.setStorageSync('common_bazi_match_inputs', commonBaziMatchList.value)
  uni.showToast({ title: '已删除常用', icon: 'none' })
}

const canSubmit = computed(() => {
  if (loading.value) return false
  if (activeTab.value === 'single') {
    return birthDate.value && selectedTime.value
  } else {
    return name1.value && name1.value.trim() && birthDate1.value && selectedTime1.value &&
           name2.value && name2.value.trim() && birthDate2.value && selectedTime2.value
  }
})

const onDateChange = (e) => { birthDate.value = e.detail.value }
const onTimeChange = (e) => { selectedTime.value = timeSlots[e.detail.value] }

const onDateChange1 = (e) => { birthDate1.value = e.detail.value }
const onTimeChange1 = (e) => { selectedTime1.value = timeSlots[e.detail.value] }

const onDateChange2 = (e) => { birthDate2.value = e.detail.value }
const onTimeChange2 = (e) => { selectedTime2.value = timeSlots[e.detail.value] }

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
      const res = await calcBaziApi({
        solarDate: birthDate.value,
        birthTime: selectedTime.value.value,
        gender: gender.value
      })
      
      if (res.code !== 0) {
        throw new Error(res.message || '排盘失败')
      }

      const currentInput = {
        birthDate: birthDate.value,
        selectedTime: selectedTime.value,
        gender: gender.value,
        calendar: calendar.value
      }
      uni.setStorageSync('last_bazi_input', currentInput)

      // 更新常用列表
      const list = [...commonBaziList.value]
      const existIndex = list.findIndex(item => 
        item.birthDate === currentInput.birthDate && 
        item.selectedTime?.value === currentInput.selectedTime?.value && 
        item.gender === currentInput.gender
      )
      if (existIndex !== -1) {
        list.splice(existIndex, 1)
      }
      list.unshift(currentInput)
      if (list.length > 3) {
        list.pop()
      }
      commonBaziList.value = list
      uni.setStorageSync('common_bazi_inputs', list)

      const data = res.data
      const baziData = data.bazi || {}
      const wuxingData = baziData.wuxing || {}
      const wuxingNames = { metal: '金', wood: '木', water: '水', fire: '火', earth: '土' }
      const wuxingColors = { metal: '#f1c40f', wood: '#27ae60', water: '#3498db', fire: '#e74c3c', earth: '#8b4513' }
      const wuxingCounts = {}
      Object.keys(wuxingNames).forEach(k => { wuxingCounts[k] = 0 })
      
      Object.keys(wuxingCounts).forEach(k => {
        if (typeof wuxingData[k] === 'number') wuxingCounts[k] = wuxingData[k]
      })

      result.value = {
        isMatch: false,
        bazi: [
          { label: '年柱', value: baziData.yearGanZhi || '--' },
          { label: '月柱', value: baziData.monthGanZhi || '--' },
          { label: '日柱', value: baziData.dayGanZhi || '--' },
          { label: '时柱', value: baziData.hourGanZhi || '--' }
        ],
        wuxing: Object.keys(wuxingNames).map(k => ({
          name: wuxingNames[k],
          count: wuxingCounts[k],
          color: wuxingColors[k]
        })),
        analysis: data.interpretation || '分析完成'
      }
    } else {
      // 双人配对模式
      const res = await baziMatchApi({
        name1: name1.value.trim(),
        solarDate1: birthDate1.value,
        birthTime1: selectedTime1.value.value,
        gender1: gender1.value,
        name2: name2.value.trim(),
        solarDate2: birthDate2.value,
        birthTime2: selectedTime2.value.value,
        gender2: gender2.value,
        relationType: relationType.value
      })

      if (res.code !== 0) {
        throw new Error(res.message || '合婚测算失败')
      }

      const currentInput = {
        name1: name1.value.trim(),
        birthDate1: birthDate1.value,
        selectedTime1: selectedTime1.value,
        gender1: gender1.value,
        name2: name2.value.trim(),
        birthDate2: birthDate2.value,
        selectedTime2: selectedTime2.value,
        gender2: gender2.value,
        relationType: relationType.value
      }
      uni.setStorageSync('last_bazi_match_input', currentInput)

      // 更新双人常用列表
      const list = [...commonBaziMatchList.value]
      const existIndex = list.findIndex(item => 
        item.birthDate1 === currentInput.birthDate1 && 
        item.birthDate2 === currentInput.birthDate2 &&
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
      commonBaziMatchList.value = list
      uni.setStorageSync('common_bazi_match_inputs', list)

      const data = res.data
      const wuxingNames = { metal: '金', wood: '木', water: '水', fire: '火', earth: '土' }

      result.value = {
        isMatch: true,
        name1: data.name1 || name1.value.trim(),
        name2: data.name2 || name2.value.trim(),
        dayGan1: data.bazi1.dayGanZhi.charAt(0) + '(' + (wuxingNames[GAN_WUXING[data.bazi1.dayGanZhi.charAt(0)]] || '土') + ')',
        dayGan2: data.bazi2.dayGanZhi.charAt(0) + '(' + (wuxingNames[GAN_WUXING[data.bazi2.dayGanZhi.charAt(0)]] || '土') + ')',
        relationType: data.relationType,
        score: data.score || 75,
        rating: data.rating || 3,
        analysis: data.analysis || '合婚批注完成'
      }
    }

    await userStore.fetchUserInfo()
  } catch (err) {
    uni.showToast({ title: err.message || '排盘失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

const share = () => {
  if (!result.value) return
  const query = {
    type: activeTab.value === 'single' ? 'bazi' : 'baziMatch',
    title: activeTab.value === 'single' ? '生辰八字命盘' : '生辰合婚法卷',
    name: activeTab.value === 'single' ? '本命信士' : `${result.value.name1} 与 ${result.value.name2}`,
    score: result.value.score || (activeTab.value === 'single' ? 88 : 75),
    analysis: result.value.analysis || ''
  }
  uni.navigateTo({
    url: `/pages/share/index?type=${query.type}&title=${encodeURIComponent(query.title)}&name=${encodeURIComponent(query.name)}&score=${query.score}&analysis=${encodeURIComponent(query.analysis)}`
  })
}

const save = async () => {
  if (!birthDate.value || !selectedTime.value) {
    uni.showToast({ title: '请选择出生日期与时辰', icon: 'none' })
    return
  }
  uni.showLoading({ title: '保存中...' })
  try {
    const res = await updateBirthInfoApi({
      solarDate: birthDate.value,
      birthTime: selectedTime.value.value
    })
    if (res.code === 0) {
      uni.showToast({ title: '已保存至个人生辰', icon: 'success' })
      if (userStore.isLoggedIn) {
        await userStore.fetchUserInfo()
      }
    } else {
      uni.showToast({ title: res.message || '保存失败', icon: 'none' })
    }
  } catch (err) {
    uni.showToast({ title: err.message || '保存失败', icon: 'none' })
  } finally {
    uni.hideLoading()
  }
}

const reset = () => {
  result.value = null
  if (activeTab.value === 'single') {
    birthDate.value = ''
    selectedTime.value = null
  } else {
    name1.value = ''
    birthDate1.value = ''
    selectedTime1.value = null
    name2.value = ''
    birthDate2.value = ''
    selectedTime2.value = null
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
  background: var(--bg-color, #f5f0e8);
  min-height: 100vh;
}

.section-title {
  font-size: 32rpx;
  font-weight: bold;
  color: var(--primary-color, #c41e3a);
  margin-bottom: 20rpx;
  display: block;
}

.form-section {
  background: var(--card-bg, #fff);
  border-radius: 20rpx;
  padding: 30rpx;
  margin-bottom: 30rpx;
}

/* ==================== 实时生辰预览卡样式 ==================== */
.live-preview-card {
  background: rgba(229, 193, 88, 0.08);
  border: 2rpx dashed var(--secondary-color, #e5c158);
  border-radius: 20rpx;
  padding: 24rpx;
  margin-bottom: 30rpx;
  box-shadow: 0 4rpx 12rpx rgba(229, 193, 88, 0.05);
}

.theme-chinese .live-preview-card {
  background: rgba(229, 193, 88, 0.04);
  border: 2rpx dashed #c8a261;
}

.preview-header {
  display: flex;
  align-items: center;
  gap: 12rpx;
  border-bottom: 1rpx dashed rgba(229, 193, 88, 0.2);
  padding-bottom: 12rpx;
  margin-bottom: 16rpx;
}

.theme-chinese .preview-header {
  border-bottom: 1rpx dashed rgba(200, 162, 97, 0.2);
}

.preview-title-icon {
  font-size: 28rpx;
  color: var(--secondary-color, #e5c158);
  animation: rotateBagua 4s linear infinite;
}

.preview-title-text {
  font-size: 24rpx;
  font-weight: bold;
  color: var(--secondary-color, #e5c158);
}

.theme-chinese .preview-title-text {
  color: #c8a261;
}

.preview-body-content {
  display: flex;
  flex-direction: column;
}

.preview-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.preview-label-tag {
  font-size: 22rpx;
  color: var(--text-secondary, #999);
}

.theme-chinese .preview-label-tag {
  color: #a69ebd;
}

.preview-val-tag {
  font-size: 24rpx;
  font-weight: bold;
  color: var(--text-primary, #333);
}

.theme-chinese .preview-val-tag {
  color: #e2dcf0;
}

.preview-val-tag.shengxiao {
  color: var(--primary-color, #c41e3a);
  background: rgba(196, 30, 58, 0.1);
  padding: 2rpx 12rpx;
  border-radius: 8rpx;
  font-size: 20rpx;
}

.theme-chinese .preview-val-tag.shengxiao {
  color: #e74c3c;
  background: rgba(231, 76, 60, 0.15);
}

.preview-val-tag.ganzhi {
  color: var(--secondary-color, #aa7c11);
}

.theme-chinese .preview-val-tag.ganzhi {
  color: #e5c158;
}


.form-item {
  margin-bottom: 24rpx;
}

.label {
  font-size: 28rpx;
  color: var(--text-primary, #333);
  margin-bottom: 12rpx;
  display: block;
}

.picker-value {
  height: 88rpx;
  line-height: 88rpx;
  padding: 0 20rpx;
  background: var(--input-bg, #f5f5f5);
  border-radius: 12rpx;
  font-size: 28rpx;
  color: var(--text-primary, #333);
  border: 1rpx solid var(--border-color, #eee);
  box-sizing: border-box;
}

.gender-group {
  display: flex;
  gap: 20rpx;
}

.gender-btn {
  flex: 1;
  padding: 16rpx;
  text-align: center;
  background: var(--input-bg, #f5f5f5);
  border-radius: 12rpx;
  font-size: 28rpx;
  color: var(--text-primary, #333);
}

.gender-btn.active {
  background: var(--primary-color, #c41e3a);
  color: #fff;
}

.submit-btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  background: var(--primary-color, #c41e3a);
  color: #fff;
  font-size: 32rpx;
  border-radius: 44rpx;
  margin-bottom: 30rpx;
  border: none;
}

.submit-btn[disabled] {
  opacity: 0.5;
}

.result-section {
  background: var(--card-bg, #fff);
  border-radius: 20rpx;
  padding: 30rpx;
  margin-bottom: 30rpx;
}

.bazi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16rpx;
  margin-bottom: 30rpx;
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

.analysis-section {
  margin-bottom: 24rpx;
}

.wuxing-chart {
  padding: 16rpx 0;
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
  transition: width 0.3s;
}

.wuxing-count {
  width: 40rpx;
  font-size: 26rpx;
  color: var(--text-primary, #333);
  text-align: right;
}

.analysis-text {
  font-size: 28rpx;
  color: var(--text-primary, #333);
  line-height: 1.8;
}

.action-btns {
  display: flex;
  gap: 20rpx;
  margin-top: 30rpx;
}

.action-btn {
  flex: 1;
  height: 80rpx;
  line-height: 80rpx;
  border-radius: 40rpx;
  font-size: 28rpx;
  border: none;
}

.action-btn.share {
  background: var(--primary-color, #c41e3a);
  color: #fff;
}

.action-btn.save {
  background: var(--input-bg, #f5f5f5);
  color: var(--text-primary, #333);
  border: 1rpx solid var(--border-color, #eee);
}

.disclaimer {
  text-align: center;
  padding: 20rpx;
  font-size: 22rpx;
  color: var(--text-secondary, #999);
}

/* 常用记忆胶囊 */
.memory-section {
  margin-top: 10rpx;
  margin-bottom: 24rpx;
  padding-bottom: 16rpx;
  border-bottom: 1rpx dashed var(--border-color, #eee);
}
.theme-chinese .memory-section {
  border-bottom: 1rpx dashed #3e282c;
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

.tab-item {
  flex: 1;
  text-align: center;
  padding: 24rpx 0;
  font-size: 28rpx;
  font-weight: bold;
  color: var(--text-secondary, #666);
  transition: all 0.2s;
}

.tab-item.active {
  background: var(--primary-color, #c41e3a);
  color: #fff;
}

.form-title-sub {
  font-size: 28rpx;
  font-weight: bold;
  color: var(--primary-color, #c41e3a);
  margin-bottom: 20rpx;
  text-align: center;
}

.input {
  height: 88rpx;
  line-height: 88rpx;
  padding: 0 20rpx;
  background: var(--input-bg, #f5f5f5);
  border-radius: 12rpx;
  font-size: 28rpx;
  color: var(--text-primary, #333);
  border: 1rpx solid var(--border-color, #eee);
  box-sizing: border-box;
  width: 100%;
}

.input-placeholder {
  color: var(--text-secondary, #6d658c);
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
  background: linear-gradient(to right, #8a640f, #e5c158, #8a640f);
  border-radius: 8rpx;
  z-index: 10;
  box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.3);
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
  background: linear-gradient(135deg, #fdf8eb, #f3eacf);
  border: 2rpx solid #aa7c11;
  box-sizing: border-box;
  border-radius: 12rpx;
  transform: scaleX(0);
  transform-origin: center center;
  animation: bodyUnfold 1.2s cubic-bezier(0.25, 0.8, 0.25, 1) forwards;
  padding: 30rpx;
  box-shadow: inset 0 0 40rpx rgba(138, 100, 15, 0.15);
}

.scroll-inner-border {
  width: 100%;
  border: 2rpx dashed #d5c295;
  border-radius: 8rpx;
  padding: 20rpx;
  box-sizing: border-box;
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
  color: #3e2723;
  display: block;
  margin-bottom: 20rpx;
  text-align: center;
}

.interpretation-text {
  font-size: 26rpx;
  color: #3e2723;
  line-height: 1.8;
  display: block;
  text-align: justify;
  white-space: pre-wrap;
  word-break: break-all;
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

.star {
  font-size: 30rpx;
  color: #d4af37;
  margin: 0 4rpx;
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

.reset-btn {
  background: var(--input-bg, #f5f5f5);
  color: var(--text-primary, #333);
  border: 2rpx solid var(--border-color, #eee);
}

.calculating-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 100rpx 0;
  gap: 40rpx;
}

.bagua-icon {
  width: 120rpx;
  height: 120rpx;
  border: 4rpx solid var(--primary-color, #c41e3a);
  border-radius: 50%;
  background: repeating-conic-gradient(from 0deg, #fff 0deg 90deg, var(--primary-color, #c41e3a) 90deg 180deg);
  box-shadow: 0 0 20rpx rgba(196, 30, 58, 0.3);
  animation: rotateBagua 2s linear infinite;
}

@keyframes rotateBagua {
  to { transform: rotate(360deg); }
}

.calculating-text {
  font-size: 26rpx;
  color: var(--text-secondary, #666);
  text-align: center;
}

/* 华夏红主题的表单与输入框深度优化 */
.theme-chinese .form-section {
  background: rgba(30, 20, 22, 0.6);
  border: 2rpx solid #6b1d28;
  backdrop-filter: blur(10px);
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.3);
}

.theme-chinese .label {
  color: #e5c158;
}

.theme-chinese .input {
  background: rgba(14, 11, 12, 0.6);
  border: 1rpx solid #5a353b;
  color: #fff;
}

.theme-chinese .picker-value {
  background: rgba(14, 11, 12, 0.6);
  border: 1rpx solid #5a353b;
  color: #fff;
}

.theme-chinese .gender-btn {
  background: rgba(14, 11, 12, 0.6);
  border: 1rpx solid #5a353b;
  color: #a69ebd;
}

.theme-chinese .gender-btn.active {
  background: rgba(196, 30, 58, 0.2);
  border-color: #c41e3a;
  color: #fff;
  box-shadow: 0 0 15rpx rgba(196, 30, 58, 0.3);
}

.theme-chinese .submit-btn {
  background: linear-gradient(135deg, #c41e3a, #990f26);
  box-shadow: 0 6rpx 20rpx rgba(196, 30, 58, 0.4);
}

.theme-chinese .submit-btn[disabled] {
  background: #3a2a2c;
  color: #726062;
  box-shadow: none;
  opacity: 0.6;
}

.theme-chinese .tab-container {
  background: rgba(30, 20, 22, 0.6);
  border: 2rpx solid #6b1d28;
  box-shadow: none;
}

.theme-chinese .tab-item {
  color: #a69ebd;
}

.theme-chinese .tab-item.active {
  background: linear-gradient(135deg, #c41e3a, #990f26);
  color: #fff;
  box-shadow: 0 0 15rpx rgba(196, 30, 58, 0.3);
}

.theme-chinese .reset-btn {
  background: rgba(50, 40, 85, 0.5);
  color: #e2dcf0;
  border: 2rpx solid #4a3e72;
}

.theme-chinese .input-placeholder {
  color: #887fa3 !important;
}
</style>
