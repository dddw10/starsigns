/**
 * 八字计算工具函数（基础版）
 * 基于天干地支的八字排盘计算
 */

// 天干
const TIAN_GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']

// 地支
const DI_ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']

// 生肖
const SHENG_XIAO = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪']

// 五行
const WU_XING = ['木', '木', '火', '火', '土', '土', '金', '金', '水', '水']

// 天干五行对应
const GAN_WUXING = {
  '甲': '木', '乙': '木',
  '丙': '火', '丁': '火',
  '戊': '土', '己': '土',
  '庚': '金', '辛': '金',
  '壬': '水', '癸': '水'
}

// 地支五行对应
const ZHI_WUXING = {
  '子': '水', '丑': '土',
  '寅': '木', '卯': '木',
  '辰': '土', '巳': '火',
  '午': '火', '未': '土',
  '申': '金', '酉': '金',
  '戌': '土', '亥': '水'
}

// 时辰地支对应
const SHI_CHEN = {
  23: '子', 0: '子',
  1: '丑', 2: '丑',
  3: '寅', 4: '寅',
  5: '卯', 6: '卯',
  7: '辰', 8: '辰',
  9: '巳', 10: '巳',
  11: '午', 12: '午',
  13: '未', 14: '未',
  15: '申', 16: '申',
  17: '酉', 18: '酉',
  19: '戌', 20: '戌',
  21: '亥', 22: '亥'
}

/**
 * 根据公历日期计算八字
 * @param {number} year - 公历年
 * @param {number} month - 公历月
 * @param {number} day - 公历日
 * @param {number} hour - 出生时辰（0-23）
 * @returns {Object} 八字信息
 */
export function calculateBazi(year, month, day, hour) {
  // 计算年柱
  const yearGanIndex = (year - 4) % 10
  const yearZhiIndex = (year - 4) % 12

  // 计算月柱（简化算法）
  const monthGanIndex = (yearGanIndex * 2 + month) % 10
  const monthZhiIndex = (month + 1) % 12

  // 计算日柱（使用基础算法，实际应使用万年历）
  const dayOffset = Math.floor((year - 1900) * 365.25 + month * 30 + day)
  const dayGanIndex = dayOffset % 10
  const dayZhiIndex = dayOffset % 12

  // 计算时柱
  const hourZhiIndex = Math.floor(((hour + 1) % 24) / 2)
  const hourGanIndex = (dayGanIndex * 2 + hourZhiIndex) % 10

  const bazi = {
    year: {
      gan: TIAN_GAN[yearGanIndex],
      zhi: DI_ZHI[yearZhiIndex],
      wuxing: GAN_WUXING[TIAN_GAN[yearGanIndex]]
    },
    month: {
      gan: TIAN_GAN[monthGanIndex],
      zhi: DI_ZHI[monthZhiIndex],
      wuxing: GAN_WUXING[TIAN_GAN[monthGanIndex]]
    },
    day: {
      gan: TIAN_GAN[dayGanIndex],
      zhi: DI_ZHI[dayZhiIndex],
      wuxing: GAN_WUXING[TIAN_GAN[dayGanIndex]]
    },
    hour: {
      gan: TIAN_GAN[hourGanIndex],
      zhi: DI_ZHI[hourZhiIndex],
      wuxing: GAN_WUXING[TIAN_GAN[hourGanIndex]]
    }
  }

  // 计算生肖
  const shengXiaoIndex = year % 12
  bazi.shengXiao = SHENG_XIAO[shengXiaoIndex]

  // 计算五行分布
  bazi.wuXingCount = countWuXing(bazi)

  // 计算五行缺失
  bazi.wuXingMissing = findMissingWuXing(bazi.wuXingCount)

  return bazi
}

/**
 * 统计五行数量
 * @param {Object} bazi - 八字对象
 * @returns {Object} 五行统计
 */
function countWuXing(bazi) {
  const count = { '木': 0, '火': 0, '土': 0, '金': 0, '水': 0 }

  // 天干五行
  count[bazi.year.wuxing]++
  count[bazi.month.wuxing]++
  count[bazi.day.wuxing]++
  count[bazi.hour.wuxing]++

  // 地支五行
  count[ZHI_WUXING[bazi.year.zhi]]++
  count[ZHI_WUXING[bazi.month.zhi]]++
  count[ZHI_WUXING[bazi.day.zhi]]++
  count[ZHI_WUXING[bazi.hour.zhi]]++

  return count
}

/**
 * 查找缺失的五行
 * @param {Object} wuXingCount - 五行统计
 * @returns {Array} 缺失的五行列表
 */
function findMissingWuXing(wuXingCount) {
  const missing = []
  const elements = ['木', '火', '土', '金', '水']

  for (const element of elements) {
    if (wuXingCount[element] === 0) {
      missing.push(element)
    }
  }

  return missing
}

/**
 * 获取天干五行
 * @param {string} gan - 天干
 * @returns {string} 五行
 */
export function getGanWuXing(gan) {
  return GAN_WUXING[gan] || ''
}

/**
 * 获取地支五行
 * @param {string} zhi - 地支
 * @returns {string} 五行
 */
export function getZhiWuXing(zhi) {
  return ZHI_WUXING[zhi] || ''
}

/**
 * 获取生肖
 * @param {number} year - 年份
 * @returns {string} 生肖
 */
export function getShengXiao(year) {
  return SHENG_XIAO[year % 12]
}

/**
 * 格式化八字显示
 * @param {Object} bazi - 八字对象
 * @returns {string} 格式化的八字字符串
 */
export function formatBazi(bazi) {
  return `${bazi.year.gan}${bazi.year.zhi} ${bazi.month.gan}${bazi.month.zhi} ${bazi.day.gan}${bazi.day.zhi} ${bazi.hour.gan}${bazi.hour.zhi}`
}

/**
 * 获取五行相生关系
 * @param {string} element - 五行
 * @returns {string} 相生的五行
 */
export function getShengElement(element) {
  const shengMap = {
    '木': '火',
    '火': '土',
    '土': '金',
    '金': '水',
    '水': '木'
  }
  return shengMap[element]
}

/**
 * 获取五行相克关系
 * @param {string} element - 五行
 * @returns {string} 相克的五行
 */
export function getKeElement(element) {
  const keMap = {
    '木': '土',
    '土': '水',
    '水': '火',
    '火': '金',
    '金': '木'
  }
  return keMap[element]
}

export {
  TIAN_GAN,
  DI_ZHI,
  SHENG_XIAO,
  WU_XING,
  GAN_WUXING,
  ZHI_WUXING,
  SHI_CHEN
}
