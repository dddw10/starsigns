/**
 * 八字展示辅助（纯常量 + 纯函数）
 *
 * 排盘本身一律走 lunar-javascript（万年历 + 节气），与服务端同库同版本，
 * 所以这里不再保留任何自己实现的干支/历法换算 —— 以前那套
 * (year-1900)*365.25 + month*30 + day 的日柱公式和 year % 12 的生肖
 * 都是错的，留着只会被下次误用。
 */

// 天干五行
export const GAN_WUXING = {
  '甲': '木', '乙': '木',
  '丙': '火', '丁': '火',
  '戊': '土', '己': '土',
  '庚': '金', '辛': '金',
  '壬': '水', '癸': '水'
}

// 地支五行
export const ZHI_WUXING = {
  '子': '水', '丑': '土',
  '寅': '木', '卯': '木',
  '辰': '土', '巳': '火',
  '午': '火', '未': '土',
  '申': '金', '酉': '金',
  '戌': '土', '亥': '水'
}

/**
 * 五行相生：本元素生出的那一个
 * @param {string} element 木/火/土/金/水
 * @returns {string}
 */
export function getShengElement(element) {
  const shengMap = {
    '木': '火',
    '火': '土',
    '土': '金',
    '金': '水',
    '水': '木'
  }
  return shengMap[element] || ''
}

/**
 * 五行相克：本元素克制的那一个
 * @param {string} element 木/火/土/金/水
 * @returns {string}
 */
export function getKeElement(element) {
  const keMap = {
    '木': '土',
    '土': '水',
    '水': '火',
    '火': '金',
    '金': '木'
  }
  return keMap[element] || ''
}
