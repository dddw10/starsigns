// 日柱干支工具
// 排盘一律走 lunar-javascript（万年历 + 节气），此处不再自己实现历法换算

const { Solar } = require('lunar-javascript');

// 获取某个公历日期的日柱干支（用于"今日值日干支"这类场景）
function getDayGanZhi(year, month, day) {
  return Solar.fromYmd(year, month, day).getLunar().getDayInGanZhi();
}

module.exports = {
  getDayGanZhi,
};
