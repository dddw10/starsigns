/**
 * 生辰 -> 四柱：直接用 lunar-javascript（万年历 + 节气）
 *
 * 与服务端 server/src/algorithms/bazi/index.js 同库、同版本、同一套时辰映射与历法折算，
 * 这样「即时排演」预览和提交后服务端返回的四柱才会逐字一致。
 * 改这里的时辰取法或农历转换时，服务端那份必须同步改。
 */
import { Solar, Lunar } from 'lunar-javascript'

// 时辰 -> 取该时辰内的固定时刻（配合下面的 30 分，落在时辰正中）
// 子时跨 23:00-01:00，统一按 00:30 处理，避开晚子时的流派分歧
export const BIRTH_TIME_HOURS = {
  '子时': 0, '丑时': 2, '寅时': 4, '卯时': 6,
  '辰时': 8, '巳时': 10, '午时': 12, '未时': 14,
  '申时': 16, '酉时': 18, '戌时': 20, '亥时': 22
}

// 生肖直接从年柱地支取。库里的 getYearShengXiaoByLiChun() 只精确到立春那一天，
// 而年柱走的是立春的精确时刻，两者在立春当天会打架
const ZHI_SHENG_XIAO = {
  '子': '鼠', '丑': '牛', '寅': '虎', '卯': '兔',
  '辰': '龙', '巳': '蛇', '午': '马', '未': '羊',
  '申': '猴', '酉': '鸡', '戌': '狗', '亥': '猪'
}

/**
 * 农历 -> 公历。日期选择器是公历选择器，选出来的日子按农历读可能根本不存在
 * （农历月只有 29/30 天，也没有 13 月），这种情况返回 null 让调用方提示用户。
 * 闰月无法用 YYYY-MM-DD 表达，一律按普通月处理，与服务端一致。
 * @param {number} year
 * @param {number} month
 * @param {number} day
 * @returns {string|null} 公历 YYYY-MM-DD
 */
function lunarToSolar(year, month, day) {
  try {
    return Lunar.fromYmd(year, month, day).getSolar().toYmd()
  } catch (e) {
    return null
  }
}

/**
 * 排四柱
 * @param {string} birthDate 出生日期，YYYY-MM-DD，按 calendar 解释
 * @param {string} birthTime 时辰名，如「卯时」
 * @param {'solar'|'lunar'} [calendar='solar'] 历法
 * @returns {{yearGanZhi:string,monthGanZhi:string,dayGanZhi:string,hourGanZhi:string,
 *            shengXiao:string,lunarDateText:string,solarDate:string}|{error:string}|null}
 *          入参不合法时返回 null（不猜时辰，避免预览出一个和服务端不一样的错结果）；
 *          农历日期不存在时返回 { error }，调用方应把这句话显示给用户
 */
export function calcBaziChart(birthDate, birthTime, calendar = 'solar') {
  const [y, m, d] = String(birthDate || '').split('-').map(Number)
  const hour = BIRTH_TIME_HOURS[String(birthTime || '').trim()]
  if (!y || !m || !d || hour === undefined) return null

  let solarDate = birthDate
  if (calendar === 'lunar') {
    solarDate = lunarToSolar(y, m, d)
    if (!solarDate) {
      return { error: `农历没有 ${m} 月 ${d} 日这一天，请重新选择日期` }
    }
  }

  const [year, month, day] = solarDate.split('-').map(Number)

  try {
    const eightChar = Solar.fromYmdHms(year, month, day, hour, 30, 0).getLunar().getEightChar()
    const lunar = eightChar.getLunar()
    const yearGanZhi = eightChar.getYear()
    return {
      yearGanZhi,
      monthGanZhi: eightChar.getMonth(),
      dayGanZhi: eightChar.getDay(),
      hourGanZhi: eightChar.getTime(),
      shengXiao: ZHI_SHENG_XIAO[yearGanZhi.charAt(1)] || '',
      lunarDateText: `${lunar.getYearInChinese()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
      solarDate
    }
  } catch (e) {
    return null
  }
}

/**
 * 四柱 -> 展示字符串，如「癸亥年 乙丑月 丙寅日 辛卯时」
 * @param {Object} chart calcBaziChart 的返回值
 * @returns {string}
 */
export function formatBaziChart(chart) {
  if (!chart || !chart.yearGanZhi) return ''
  return `${chart.yearGanZhi}年 ${chart.monthGanZhi}月 ${chart.dayGanZhi}日 ${chart.hourGanZhi}时`
}
