const { convertSolarToLunar } = require('./lunar');
const { calculateWuxing, analyzeWuxingBalance } = require('./wuxing');
const { getInterpretation } = require('./interpretations');

// 八字算命主入口
async function baziAnalysis(data) {
  const { solarDate, birthTime, gender } = data;

  // 1. 转换农历
  const lunarDate = convertSolarToLunar(solarDate);

  // 2. 计算八字
  const bazi = calculateBazi(lunarDate, birthTime);

  // 3. 计算五行
  const wuxing = calculateWuxing(bazi);

  // 4. 分析五行平衡
  const analysis = analyzeWuxingBalance(wuxing, gender, bazi);

  // 5. 获取解读
  const interpretation = getInterpretation(bazi, wuxing, analysis, gender);

  return {
    bazi: {
      ...bazi,
      wuxing,
    },
    analysis,
    interpretation,
  };
}

// 计算八字
function calculateBazi(lunarDate, birthTime) {
  // 天干
  const tianGan = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  // 地支
  const diZhi = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

  // 年柱
  const yearGanZhi = getYearGanZhi(lunarDate.year);
  // 月柱
  const monthGanZhi = getMonthGanZhi(lunarDate.year, lunarDate.month);
  // 日柱
  const dayGanZhi = getDayGanZhi(lunarDate.year, lunarDate.month, lunarDate.day);
  // 时柱
  const hourGanZhi = getHourGanZhi(dayGanZhi.charAt(0), birthTime);

  return {
    yearGanZhi,
    monthGanZhi,
    dayGanZhi,
    hourGanZhi,
  };
}

// 计算年柱
function getYearGanZhi(year) {
  const tianGan = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const diZhi = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

  // 以立春为界
  const ganIndex = (year - 4) % 10;
  const zhiIndex = (year - 4) % 12;

  return tianGan[ganIndex] + diZhi[zhiIndex];
}

// 计算月柱
function getMonthGanZhi(year, month) {
  const tianGan = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const diZhi = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

  // 年干决定月干起始
  const yearGan = (year - 4) % 10;
  const monthGanOffset = (yearGan % 5) * 2;
  const ganIndex = (monthGanOffset + month - 1) % 10;
  const zhiIndex = (month + 1) % 12;

  return tianGan[ganIndex] + diZhi[zhiIndex];
}

// 计算日柱
function getDayGanZhi(year, month, day) {
  const tianGan = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const diZhi = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

  // 使用公式计算
  const date = new Date(year, month - 1, day);
  const baseDate = new Date(1900, 0, 1);
  const days = Math.floor((date - baseDate) / (24 * 60 * 60 * 1000));

  const ganIndex = (days + 9) % 10;
  const zhiIndex = (days + 1) % 12;

  return tianGan[ganIndex] + diZhi[zhiIndex];
}

// 计算时柱
function getHourGanZhi(dayGan, birthTime) {
  const tianGan = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const diZhi = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

  // 时辰对应
  const timeMap = {
    '子时': 0, '丑时': 1, '寅时': 2, '卯时': 3,
    '辰时': 4, '巳时': 5, '午时': 6, '未时': 7,
    '申时': 8, '酉时': 9, '戌时': 10, '亥时': 11,
  };

  const zhiIndex = timeMap[birthTime] || 0;
  const ganIndex = (tianGan.indexOf(dayGan) % 5 * 2 + zhiIndex) % 10;

  return tianGan[ganIndex] + diZhi[zhiIndex];
}

module.exports = {
  baziAnalysis,
  calculateBazi,
};
