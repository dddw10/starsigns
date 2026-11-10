const { getBeijingDateString } = require('./date');
const DAY = 86400000;
const CONSTELLATIONS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
function invalid(message) { const error = new Error(message); error.status = 400; throw error; }
function dateTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) invalid('日期须为 YYYY-MM-DD');
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) invalid('日期不存在');
  return timestamp;
}
function fortuneDate(value) {
  const target = value === undefined ? getBeijingDateString() : value;
  if (Math.abs(dateTimestamp(target) - dateTimestamp(getBeijingDateString())) > 31 * DAY) invalid('日期须在今天前后31天内');
  return target;
}
function cacheTTL(date) {
  const end = dateTimestamp(date) + 16 * 3600000;
  return Math.min(86400, Math.max(60, Math.floor((end - Date.now()) / 1000)));
}
module.exports = { CONSTELLATIONS, invalid, dateTimestamp, fortuneDate, cacheTTL };
