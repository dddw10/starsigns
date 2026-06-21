/**
 * 星座数据
 */

export const constellations = [
  {
    id: 'aries',
    name: '白羊座',
    icon: '♈',
    dateRange: '3月21日-4月19日',
    element: '火',
    rulingPlanet: '火星',
    luckyColor: '红色',
    luckyNumber: '1, 8',
    traits: ['热情', '勇敢', '直接', '冲动', '自信'],
    description: '白羊座是黄道十二宫的第一个星座，代表着新的开始。他们充满活力、热情洋溢，总是冲在最前面。'
  },
  {
    id: 'taurus',
    name: '金牛座',
    icon: '♉',
    dateRange: '4月20日-5月20日',
    element: '土',
    rulingPlanet: '金星',
    luckyColor: '绿色',
    luckyNumber: '2, 6',
    traits: ['稳重', '务实', '固执', '享受', '忠诚'],
    description: '金牛座追求稳定与安全感，他们踏实可靠，享受生活中的美好事物。'
  },
  {
    id: 'gemini',
    name: '双子座',
    icon: '♊',
    dateRange: '5月21日-6月21日',
    element: '风',
    rulingPlanet: '水星',
    luckyColor: '黄色',
    luckyNumber: '3, 7',
    traits: ['聪明', '好奇', '多变', '健谈', '灵活'],
    description: '双子座思维敏捷，善于沟通，对新鲜事物充满好奇，是天生的社交达人。'
  },
  {
    id: 'cancer',
    name: '巨蟹座',
    icon: '♋',
    dateRange: '6月22日-7月22日',
    element: '水',
    rulingPlanet: '月亮',
    luckyColor: '银色',
    luckyNumber: '2, 7',
    traits: ['温柔', '体贴', '敏感', '顾家', '情绪化'],
    description: '巨蟹座重视家庭，情感丰富，善于照顾他人，是最温暖的星座之一。'
  },
  {
    id: 'leo',
    name: '狮子座',
    icon: '♌',
    dateRange: '7月23日-8月22日',
    element: '火',
    rulingPlanet: '太阳',
    luckyColor: '金色',
    luckyNumber: '1, 5',
    traits: ['自信', '大方', '领导力', '骄傲', '热情'],
    description: '狮子座天生具有领袖气质，自信大方，喜欢成为众人瞩目的焦点。'
  },
  {
    id: 'virgo',
    name: '处女座',
    icon: '♍',
    dateRange: '8月23日-9月22日',
    element: '土',
    rulingPlanet: '水星',
    luckyColor: '灰色',
    luckyNumber: '5, 6',
    traits: ['完美主义', '细心', '挑剔', '务实', '谦虚'],
    description: '处女座追求完美，注重细节，善于分析，是天生的策划者。'
  },
  {
    id: 'libra',
    name: '天秤座',
    icon: '♎',
    dateRange: '9月23日-10月23日',
    element: '风',
    rulingPlanet: '金星',
    luckyColor: '粉色',
    luckyNumber: '6, 9',
    traits: ['优雅', '公正', '犹豫', '浪漫', '社交'],
    description: '天秤座追求平衡与和谐，审美能力强，善于处理人际关系。'
  },
  {
    id: 'scorpio',
    name: '天蝎座',
    icon: '♏',
    dateRange: '10月24日-11月22日',
    element: '水',
    rulingPlanet: '冥王星',
    luckyColor: '深红色',
    luckyNumber: '4, 8',
    traits: ['神秘', '专注', '占有欲', '洞察力', '极端'],
    description: '天蝎座神秘而深邃，拥有强大的洞察力，对事物有着执着的追求。'
  },
  {
    id: 'sagittarius',
    name: '射手座',
    icon: '♐',
    dateRange: '11月23日-12月21日',
    element: '火',
    rulingPlanet: '木星',
    luckyColor: '紫色',
    luckyNumber: '3, 9',
    traits: ['乐观', '自由', '直率', '贪玩', '哲学'],
    description: '射手座热爱自由，乐观开朗，喜欢探索未知，是天生的冒险家。'
  },
  {
    id: 'capricorn',
    name: '摩羯座',
    icon: '♑',
    dateRange: '12月22日-1月19日',
    element: '土',
    rulingPlanet: '土星',
    luckyColor: '黑色',
    luckyNumber: '4, 8',
    traits: ['稳重', '务实', '野心', '保守', '责任感'],
    description: '摩羯座脚踏实地，目标明确，有着强烈的责任感和上进心。'
  },
  {
    id: 'aquarius',
    name: '水瓶座',
    icon: '♒',
    dateRange: '1月20日-2月18日',
    element: '风',
    rulingPlanet: '天王星',
    luckyColor: '蓝色',
    luckyNumber: '4, 7',
    traits: ['独立', '创新', '叛逆', '友善', '理智'],
    description: '水瓶座思维独特，追求创新，重视个人独立，是十二星座中最特立独行的。'
  },
  {
    id: 'pisces',
    name: '双鱼座',
    icon: '♓',
    dateRange: '2月19日-3月20日',
    element: '水',
    rulingPlanet: '海王星',
    luckyColor: '海蓝色',
    luckyNumber: '3, 7',
    traits: ['浪漫', '敏感', '善良', '梦幻', '多情'],
    description: '双鱼座温柔浪漫，富有同理心，拥有丰富的想象力，是最具艺术气质的星座。'
  }
]

/**
 * 根据日期获取星座
 * @param {number} month - 月份
 * @param {number} day - 日期
 * @returns {Object} 星座信息
 */
export function getConstellationByDate(month, day) {
  const dates = [
    { start: [1, 20], end: [2, 18], id: 'aquarius' },
    { start: [2, 19], end: [3, 20], id: 'pisces' },
    { start: [3, 21], end: [4, 19], id: 'aries' },
    { start: [4, 20], end: [5, 20], id: 'taurus' },
    { start: [5, 21], end: [6, 21], id: 'gemini' },
    { start: [6, 22], end: [7, 22], id: 'cancer' },
    { start: [7, 23], end: [8, 22], id: 'leo' },
    { start: [8, 23], end: [9, 22], id: 'virgo' },
    { start: [9, 23], end: [10, 23], id: 'libra' },
    { start: [10, 24], end: [11, 22], id: 'scorpio' },
    { start: [11, 23], end: [12, 21], id: 'sagittarius' },
    { start: [12, 22], end: [1, 19], id: 'capricorn' }
  ]

  for (const item of dates) {
    const [sM, sD] = item.start
    const [eM, eD] = item.end

    if (sM === eM) {
      // 同月内
      if (month === sM && day >= sD && day <= eD) {
        return constellations.find(c => c.id === item.id)
      }
    } else if (sM > eM) {
      // 跨年（摩羯座）
      if ((month === sM && day >= sD) || (month === eM && day <= eD)) {
        return constellations.find(c => c.id === item.id)
      }
    } else {
      // 一般情况
      if ((month === sM && day >= sD) || (month === eM && day <= eD)) {
        return constellations.find(c => c.id === item.id)
      }
    }
  }

  return constellations[0] // 默认返回白羊座
}

/**
 * 根据ID获取星座
 * @param {string} id - 星座ID
 * @returns {Object} 星座信息
 */
export function getConstellationById(id) {
  return constellations.find(c => c.id === id) || null
}

/**
 * 获取所有星座列表
 * @returns {Array} 星座列表
 */
export function getAllConstellations() {
  return constellations
}
