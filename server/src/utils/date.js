// 北京时间（UTC+8）日期工具
//
// 服务器时区不确定（容器里常是 UTC），而"今天"必须按北京时间算：
// 每日运势、签到、宠物喂食都以此为准，算错一天等于用户白等或重复领奖。
// 做法是把时间戳整体 +8 小时后取 ISO 字符串的日期部分，
// 这样无论进程时区如何，得到的都是北京时间的那一天。

const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;

/**
 * 北京时间的日期字符串 YYYY-MM-DD
 * @param {number|Date} [time=Date.now()] 时间戳或 Date
 * @returns {string}
 */
function getBeijingDateString(time = Date.now()) {
  const ms = time instanceof Date ? time.getTime() : Number(time);
  return new Date(ms + BEIJING_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * 北京时间的"墙上时间" Date。
 * 注意：返回的 Date 时间戳被刻意偏移过，只能用来读 getHours()/getDay() 这类字段，
 * 不要再拿它去做时间差计算或存库。
 * @param {number|Date} [time=Date.now()]
 * @returns {Date}
 */
function getBeijingDate(time = Date.now()) {
  const ms = time instanceof Date ? time.getTime() : Number(time);
  return new Date(ms + BEIJING_OFFSET_MS);
}

module.exports = {
  BEIJING_OFFSET_MS,
  getBeijingDateString,
  getBeijingDate,
};
