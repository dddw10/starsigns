/**
 * 塔罗牌数据
 */

// 大阿卡那牌
export const majorArcana = [
  {
    id: 0,
    name: '愚者',
    nameEn: 'The Fool',
    number: 0,
    image: '/static/tarot/00-the-fool.png',
    upright: '新的开始、冒险、天真、自由、潜力',
    reversed: '鲁莽、冒失、犹豫不决、恐惧未知',
    description: '愚者代表着新的旅程和无限的可能性。他轻装上阵，对未知充满好奇与期待。'
  },
  {
    id: 1,
    name: '魔术师',
    nameEn: 'The Magician',
    number: 1,
    image: '/static/tarot/01-the-magician.png',
    upright: '创造力、技能、意志力、新机会、自信',
    reversed: '欺骗、操控、能力不足、缺乏方向',
    description: '魔术师象征着创造力和意志力的结合。他拥有将想法变为现实的能力。'
  },
  {
    id: 2,
    name: '女祭司',
    nameEn: 'The High Priestess',
    number: 2,
    image: '/static/tarot/02-the-high-priestess.png',
    upright: '直觉、智慧、神秘、潜意识、内在声音',
    reversed: '信息隐藏、忽视直觉、表面化、秘密',
    description: '女祭司代表着直觉和潜意识的智慧。她引导你倾听内心的声音。'
  },
  {
    id: 3,
    name: '女皇',
    nameEn: 'The Empress',
    number: 3,
    image: '/static/tarot/03-the-empress.png',
    upright: '丰收、母性、美丽、自然、创造力',
    reversed: '依赖、过度溺爱、创造力受阻、缺乏',
    description: '女皇象征着丰收和母性的力量。她代表着生命的孕育和成长。'
  },
  {
    id: 4,
    name: '皇帝',
    nameEn: 'The Emperor',
    number: 4,
    image: '/static/tarot/04-the-emperor.png',
    upright: '权威、稳定、领导力、秩序、保护',
    reversed: '控制欲、僵化、专制、缺乏纪律',
    description: '皇帝代表着权威和稳定的结构。他建立秩序，提供保护和指导。'
  },
  {
    id: 5,
    name: '教皇',
    nameEn: 'The Hierophant',
    number: 5,
    image: '/static/tarot/05-the-hierophant.png',
    upright: '传统、信仰、教育、精神指导、道德',
    reversed: '打破常规、非传统、个人信念、反叛',
    description: '教皇象征着传统和精神信仰。他提供智慧和道德指引。'
  },
  {
    id: 6,
    name: '恋人',
    nameEn: 'The Lovers',
    number: 6,
    image: '/static/tarot/06-the-lovers.png',
    upright: '爱情、和谐、选择、吸引力、价值观',
    reversed: '不和谐、错误选择、价值观冲突、分离',
    description: '恋人代表着爱情和重要的选择。它提醒我们关注内心真正的渴望。'
  },
  {
    id: 7,
    name: '战车',
    nameEn: 'The Chariot',
    number: 7,
    image: '/static/tarot/07-the-chariot.png',
    upright: '胜利、意志力、决心、克服困难、前进',
    reversed: '失败、缺乏方向、失控、侵略性',
    description: '战车象征着胜利和前进的动力。它代表着通过意志力克服障碍。'
  },
  {
    id: 8,
    name: '力量',
    nameEn: 'Strength',
    number: 8,
    image: '/static/tarot/08-strength.png',
    upright: '勇气、耐心、内在力量、同情心、自控',
    reversed: '软弱、自我怀疑、缺乏信心、冲动',
    description: '力量代表着内在的勇气和耐心。它提醒我们温柔而坚定地面对挑战。'
  },
  {
    id: 9,
    name: '隐士',
    nameEn: 'The Hermit',
    number: 9,
    image: '/static/tarot/09-the-hermit.png',
    upright: '独处、内省、智慧、指引、寻找真相',
    reversed: '孤立、逃避、固执、拒绝帮助',
    description: '隐士代表着独处和内省。他引导我们向内寻找答案和智慧。'
  },
  {
    id: 10,
    name: '命运之轮',
    nameEn: 'Wheel of Fortune',
    number: 10,
    image: '/static/tarot/10-wheel-of-fortune.png',
    upright: '命运、转变、机遇、好运、循环',
    reversed: '厄运、抗拒改变、停滞、失控',
    description: '命运之轮象征着生命的循环和变化。它提醒我们接受命运的安排。'
  },
  {
    id: 11,
    name: '正义',
    nameEn: 'Justice',
    number: 11,
    image: '/static/tarot/11-justice.png',
    upright: '公正、平衡、因果、真相、责任',
    reversed: '不公、逃避责任、偏见、错误判断',
    description: '正义代表着公平和平衡。它提醒我们要为自己的行为负责。'
  },
  {
    id: 12,
    name: '倒吊人',
    nameEn: 'The Hanged Man',
    number: 12,
    image: '/static/tarot/12-the-hanged-man.png',
    upright: '牺牲、等待、新视角、放下、灵性',
    reversed: '拖延、逃避、无谓牺牲、抗拒',
    description: '倒吊人代表着牺牲和新的视角。它提醒我们换个角度看问题。'
  },
  {
    id: 13,
    name: '死神',
    nameEn: 'Death',
    number: 13,
    image: '/static/tarot/13-death.png',
    upright: '结束、转变、新生、放下过去、重生',
    reversed: '抗拒改变、停滞不前、恐惧、逃避',
    description: '死神象征着结束和新生。它代表着旧事物的消亡和新事物的诞生。'
  },
  {
    id: 14,
    name: '节制',
    nameEn: 'Temperance',
    number: 14,
    image: '/static/tarot/14-temperance.png',
    upright: '平衡、和谐、耐心、调和、中庸',
    reversed: '失衡、过度、急躁、极端',
    description: '节制代表着平衡和和谐。它提醒我们寻找生活的中庸之道。'
  },
  {
    id: 15,
    name: '恶魔',
    nameEn: 'The Devil',
    number: 15,
    image: '/static/tarot/15-the-devil.png',
    upright: '束缚、诱惑、物质、欲望、阴暗面',
    reversed: '解脱、打破束缚、自由、觉醒',
    description: '恶魔代表着束缚和诱惑。它提醒我们要警惕内心的阴暗面。'
  },
  {
    id: 16,
    name: '塔',
    nameEn: 'The Tower',
    number: 16,
    image: '/static/tarot/16-the-tower.png',
    upright: '破坏、突变、觉醒、重建、真相',
    reversed: '逃避灾难、恐惧改变、延迟',
    description: '塔象征着突如其来的变化和破坏。它提醒我们要接受必要的改变。'
  },
  {
    id: 17,
    name: '星星',
    nameEn: 'The Star',
    number: 17,
    image: '/static/tarot/17-the-star.png',
    upright: '希望、灵感、宁静、信念、治愈',
    reversed: '绝望、失去信心、孤独、幻灭',
    description: '星星代表着希望和灵感。它在黑暗中为我们指引方向。'
  },
  {
    id: 18,
    name: '月亮',
    nameEn: 'The Moon',
    number: 18,
    image: '/static/tarot/18-the-moon.png',
    upright: '幻象、直觉、潜意识、恐惧、不确定',
    reversed: '真相大白、克服恐惧、清醒',
    description: '月亮代表着幻象和潜意识。它提醒我们要相信直觉。'
  },
  {
    id: 19,
    name: '太阳',
    nameEn: 'The Sun',
    number: 19,
    image: '/static/tarot/19-the-sun.png',
    upright: '成功、快乐、活力、温暖、乐观',
    reversed: '暂时的挫折、过度乐观、倦怠',
    description: '太阳象征着成功和快乐。它带来温暖和正能量。'
  },
  {
    id: 20,
    name: '审判',
    nameEn: 'Judgement',
    number: 20,
    image: '/static/tarot/20-judgement.png',
    upright: '觉醒、重生、反思、召唤、决定',
    reversed: '自我怀疑、拒绝觉醒、逃避',
    description: '审判代表着觉醒和重生。它提醒我们要反思过去，迎接新的开始。'
  },
  {
    id: 21,
    name: '世界',
    nameEn: 'The World',
    number: 21,
    image: '/static/tarot/21-the-world.png',
    upright: '完成、成就、圆满、整合、旅程结束',
    reversed: '未完成、缺乏闭合、拖延',
    description: '世界象征着完成和圆满。它代表着一个周期的结束和新旅程的开始。'
  }
]

// 小阿卡那牌花色
export const minorArcanaSuits = [
  { id: 'wands', name: '权杖', element: '火', symbol: '🔥' },
  { id: 'cups', name: '圣杯', element: '水', symbol: '💧' },
  { id: 'swords', name: '宝剑', element: '风', symbol: '💨' },
  { id: 'pentacles', name: '星币', element: '土', symbol: '🌍' }
]

// 小阿卡那牌面值
export const minorArcanaRanks = [
  { id: 'ace', name: 'A', value: 1 },
  { id: 'two', name: '2', value: 2 },
  { id: 'three', name: '3', value: 3 },
  { id: 'four', name: '4', value: 4 },
  { id: 'five', name: '5', value: 5 },
  { id: 'six', name: '6', value: 6 },
  { id: 'seven', name: '7', value: 7 },
  { id: 'eight', name: '8', value: 8 },
  { id: 'nine', name: '9', value: 9 },
  { id: 'ten', name: '10', value: 10 },
  { id: 'page', name: '侍从', value: 11 },
  { id: 'knight', name: '骑士', value: 12 },
  { id: 'queen', name: '皇后', value: 13 },
  { id: 'king', name: '国王', value: 14 }
]

/**
 * 随机抽取塔罗牌
 * @param {number} count - 抽取数量
 * @returns {Array} 抽取的牌
 */
export function drawRandomCards(count = 3) {
  // 洗牌
  const shuffled = [...majorArcana].sort(() => Math.random() - 0.5)
  // 抽取指定数量
  return shuffled.slice(0, count).map((card, index) => ({
    ...card,
    position: index + 1,
    isReversed: Math.random() > 0.5 // 随机决定正逆位
  }))
}

/**
 * 根据ID获取牌
 * @param {number} id - 牌ID
 * @returns {Object} 牌信息
 */
export function getCardById(id) {
  return majorArcana.find(c => c.id === id) || null
}

/**
 * 获取牌的解读
 * @param {Object} card - 牌对象
 * @returns {string} 解读文本
 */
export function getCardInterpretation(card) {
  if (!card) return ''

  const position = card.isReversed ? '逆位' : '正位'
  const meaning = card.isReversed ? card.reversed : card.upright

  return `【${card.name}·${position}】${meaning}`
}

/**
 * 获取牌阵解读
 * @param {Array} cards - 牌数组
 * @returns {Object} 解读结果
 */
export function interpretSpread(cards) {
  const positionNames = ['过去', '现在', '未来']

  return cards.map((card, index) => ({
    position: positionNames[index] || `位置${index + 1}`,
    card: card,
    interpretation: getCardInterpretation(card)
  }))
}
