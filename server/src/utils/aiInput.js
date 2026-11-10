const { resolveHour, resolveSolarDate, BIRTH_TIME_HOURS } = require('../algorithms/bazi');
const { SPREAD_TYPES } = require('../algorithms/tarot');
const { dateTimestamp, invalid } = require('./fortuneInput');

function validateBirthDate(date, calendar = 'solar') {
  if (!['solar', 'lunar'].includes(calendar)) invalid('历法值无效');
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || +date.slice(0, 4) < 1850 || +date.slice(0, 4) > 2100) invalid('出生日期无效');
  dateTimestamp(resolveSolarDate(date, calendar));
}

function validateBirthTime(value) {
  if (!['string', 'number'].includes(typeof value)) invalid('出生时辰值无效');
  const raw = String(value).trim();
  if (!Object.hasOwn(BIRTH_TIME_HOURS, raw) && !Object.hasOwn(BIRTH_TIME_HOURS, `${raw}时`)
    && !(/^\d{1,2}$/.test(raw) && Number(raw) <= 23)) invalid('出生时辰值无效');
  const hour = resolveHour(value);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) invalid('出生时辰值无效');
}

function validateAIInput({ messages, birthInfo, gender, stream }) {
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > 50) invalid('对话数量须在1到50条之间');
  let total = 0;
  for (const message of messages) {
    if (!message || typeof message !== 'object' || Array.isArray(message)) invalid('对话格式无效');
    const prototype = Object.getPrototypeOf(message);
    if ((prototype !== Object.prototype && prototype !== null)
      || !Object.hasOwn(message, 'role') || !Object.hasOwn(message, 'content')
      || Reflect.ownKeys(message).some(key => key !== 'role' && key !== 'content')) invalid('对话字段只允许 role/content');
    if (!['user', 'assistant'].includes(message.role) || typeof message.content !== 'string'
      || !message.content.trim() || message.content.length > 4000) invalid('对话角色或内容无效');
    total += message.content.length;
  }
  if (total > 20000) invalid('对话总长度不能超过20000字符');
  if (stream !== undefined && typeof stream !== 'boolean') invalid('stream 须为布尔值');
  if (gender !== undefined && !['', 'male', 'female'].includes(gender)) invalid('性别值无效');
  if (birthInfo !== undefined) {
    if (!birthInfo || typeof birthInfo !== 'object' || Array.isArray(birthInfo)) invalid('生辰格式无效');
    if (birthInfo.calendar !== undefined && !['solar', 'lunar'].includes(birthInfo.calendar)) invalid('历法值无效');
    if (birthInfo.solarDate) validateBirthDate(birthInfo.solarDate, birthInfo.calendar);
    if (birthInfo.birthTime !== undefined && birthInfo.birthTime !== '') validateBirthTime(birthInfo.birthTime);
  }
}

function validateToolArguments(name, args) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) invalid('工具参数格式无效');
  const allowed = name === 'analyze_bazi' ? ['solarDate', 'birthTime', 'gender', 'calendar']
    : name === 'analyze_tarot' ? ['spreadType'] : [];
  if (!allowed.length || Object.keys(args).some(key => !allowed.includes(key))) invalid('工具参数无效');
  if (name === 'analyze_bazi') {
    validateBirthDate(args.solarDate, args.calendar);
    validateBirthTime(args.birthTime);
    if (!['male', 'female'].includes(args.gender)) invalid('性别值无效');
  } else if (!Object.hasOwn(SPREAD_TYPES, args.spreadType)) invalid('牌阵类型无效');
}
module.exports = { validateAIInput, validateToolArguments };
