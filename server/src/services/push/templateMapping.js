// 微信订阅消息 data 字段的声明式映射。
//
// 为什么要有这个文件：以前 pushService 一次往 data 里塞 30 多个字段
// （date1-5 / thing1-5 / character_string1-5 / phrase1-5 / number1-5），
// 注释写的是「以防开发者使用不同的模板参数配置」。但微信要求 data 的键与模板参数
// **严格一致**，多传一个整条就是 47003；而且每种字段还有各自的类型限制
// （phrase 只收 5 个汉字、character_string 只收数字字母符号），
// 把中文塞进 character_string 一样被拒。所以那不是兜底，是保证每条都发不出去。
//
// 现在改成：模板参数由 WECHAT_TPL_DAILY_FORTUNE_FIELDS 显式声明，
// 只发声明过的字段，并且在**启动时**就校验「这个内容能不能放进这种字段」，
// 而不是等到推送那一刻被微信拒掉。

// 微信字段类型 → 长度上限与可接受的内容形态
// 长度按字符数算（Array.from，汉字算 1 个）
const FIELD_TYPES = {
  thing: { maxLen: 20, kind: 'text' },
  character_string: { maxLen: 32, kind: 'alnum' },
  phrase: { maxLen: 5, kind: 'han' },
  number: { maxLen: 32, kind: 'number' },
  letter: { maxLen: 32, kind: 'letter' },
  symbol: { maxLen: 5, kind: 'symbol' },
  date: { maxLen: 24, kind: 'date' },
  time: { maxLen: 24, kind: 'time' },
  amount: { maxLen: 11, kind: 'amount' },
  enum: { maxLen: 32, kind: 'text' },
};

// thing1、character_string2 这类：类型名 + 1~2 位编号
const FIELD_NAME_RE = /^([a-z_]+)(\d{1,2})$/;

// 可用的内容键 → 允许放进哪些字段类型。
// 这张表是「启动即报错」的依据：把分数映射进 phrase（限中文）会在解析阶段就被拒。
const CONTENT_KEYS = {
  // 日期也允许放进 time 字段：微信的 time「支持+年月日」，而模板里的「日期」关键词
  // 到底被声明成 date 还是 time 只有模板详情页知道（本项目那个「今日运势提醒」就是 time3）
  date: ['date', 'time', 'text'],
  score: ['number', 'alnum', 'text'],
  level: ['han', 'text'],
  rating: ['symbol', 'text'],
  summary: ['text'],
  brief: ['text'],
  overall: ['text'],
  yi: ['text'],
  ji: ['text'],
  yiji: ['text'],
  career: ['text'],
  wealth: ['text'],
  love: ['text'],
  health: ['text'],
  luckyNumber: ['number', 'alnum', 'text'],
  luckyColor: ['han', 'text'],
  dayElement: ['han', 'text'],
};

function configError(message) {
  const err = new Error(message);
  err.status = 500;
  err.isPushConfigError = true;
  return err;
}

/**
 * 解析 WECHAT_TPL_DAILY_FORTUNE_FIELDS。
 * 格式：`微信字段名:内容键`，逗号分隔，例如
 *   thing1:yiji,thing2:summary,phrase3:luckyColor,date4:date,number5:score
 * 空字符串返回空数组（= 没配字段映射，推送整体不启用，不报错）。
 * 任何写错的地方都在这里抛，让它在启动时就暴露，而不是推送那一刻才被微信拒。
 */
function parseFieldMapping(raw) {
  const text = String(raw || '').trim();
  if (!text) return [];

  const mapping = [];
  const seen = new Set();

  for (const piece of text.split(',')) {
    const item = piece.trim();
    if (!item) continue;

    const parts = item.split(':');
    if (parts.length !== 2) {
      throw configError(`订阅消息字段映射格式错误: "${item}"，应为 "字段名:内容键"`);
    }

    const field = parts[0].trim();
    const contentKey = parts[1].trim();

    const matched = FIELD_NAME_RE.exec(field);
    if (!matched || !FIELD_TYPES[matched[1]]) {
      throw configError(
        `订阅消息字段名无效: "${field}"，可用类型: ${Object.keys(FIELD_TYPES).join(' / ')}（后面跟编号，如 thing1）`
      );
    }
    if (seen.has(field)) {
      throw configError(`订阅消息字段重复声明: "${field}"`);
    }
    if (!CONTENT_KEYS[contentKey]) {
      throw configError(
        `订阅消息内容键无效: "${contentKey}"，可用: ${Object.keys(CONTENT_KEYS).join(' / ')}`
      );
    }

    const { kind } = FIELD_TYPES[matched[1]];
    if (!CONTENT_KEYS[contentKey].includes(kind)) {
      throw configError(
        `内容 "${contentKey}" 不能放进 ${field}（该字段只接受 ${kind}），否则微信会以 47003 拒收整条消息`
      );
    }

    seen.add(field);
    mapping.push({ field, type: matched[1], kind, contentKey });
  }

  return mapping;
}

const LEVEL_TEXT = {
  excellent: '大吉',
  good: '吉',
  normal: '平',
  bad: '小凶',
  terrible: '凶',
};

const ELEMENT_TEXT = { metal: '金', wood: '木', water: '水', fire: '火', earth: '土' };

const chars = (str) => Array.from(String(str));

// 只有 text 类字段截断时才补省略号：phrase 只收汉字，塞一个「…」进去照样违规
function truncate(str, maxLen, ellipsis) {
  const arr = chars(str);
  if (arr.length <= maxLen) return arr.join('');
  if (ellipsis && maxLen > 1) return arr.slice(0, maxLen - 1).join('') + '…';
  return arr.slice(0, maxLen).join('');
}

/**
 * 把一份每日运势摊平成可映射的内容键。
 * 键名与 CONTENT_KEYS 一一对应。
 */
function buildContentValues(fortune) {
  const f = fortune || {};
  const yi = Array.isArray(f.yi) ? f.yi : [];
  const ji = Array.isArray(f.ji) ? f.ji : [];
  const stars = Math.max(1, Math.min(5, Number(f.rating) || 3));

  return {
    date: f.date || '',
    score: f.score,
    level: LEVEL_TEXT[f.level] || '平',
    rating: '★'.repeat(stars) + '☆'.repeat(5 - stars),
    summary: `${f.score != null ? `${f.score}分 ` : ''}${f.overall || ''}`,
    // 专给 thing 字段用（微信硬上限 20 字符，没有更长的中文字段类型可选）。
    // summary 是一句长话，进 thing 必然被截成「79分 今日金气适中，工作顺利，人际关…」——
    // 20 个字符全花在铺垫上，结论一个字都没露出来。同样的预算不如给
    // 「分数 + 最该做的一件事 + 最该避的一件事」，本来就短，不用截断。
    brief: [
      f.score != null ? `${f.score}分` : '',
      yi[0] ? `宜${yi[0]}` : '',
      ji[0] ? `忌${ji[0]}` : '',
    ]
      .filter(Boolean)
      .join(' '),
    overall: f.overall || '',
    yi: yi.join('、'),
    ji: ji.join('、'),
    yiji: `宜:${yi.slice(0, 2).join(' ')} 忌:${ji.slice(0, 2).join(' ')}`,
    career: f.career || '',
    wealth: f.wealth || '',
    love: f.love || '',
    health: f.health || '',
    luckyNumber: f.luckyNumber,
    luckyColor: f.luckyColorName || '',
    dayElement: ELEMENT_TEXT[f.dayElement] || '',
  };
}

const HAN_RE = /[一-龥]/g;
const ALNUM_RE = /[0-9A-Za-z_\-.:,;/()[\]{}!?@#%&*+=~$^|\\'"<> ]/g;
const LETTER_RE = /[A-Za-z]/g;
const SYMBOL_RE = /[^0-9A-Za-z一-龥\s]/g;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const keepOnly = (str, re) => (String(str).match(re) || []).join('');

/**
 * 按微信字段类型把内容裁剪成合法值。
 * 这里是 47003 的根因所在：长度超限、汉字塞进 character_string、非数字塞进 number，
 * 微信都会整条拒收，而不是只忽略那一个字段。
 * 类型不匹配在 parseFieldMapping 阶段已经拦掉了，这里只负责「同一类型内」的裁剪与兜底。
 */
function formatTemplateValue(field, raw) {
  const matched = FIELD_NAME_RE.exec(String(field));
  const type = matched && FIELD_TYPES[matched[1]];
  if (!type) throw configError(`订阅消息字段名无效: "${field}"`);

  const text = raw == null ? '' : String(raw).replace(/\s+/g, ' ').trim();

  switch (type.kind) {
    case 'text':
      return truncate(text, type.maxLen, true);

    case 'han': {
      // phrase 只收汉字，且最多 5 个
      const han = keepOnly(text, HAN_RE);
      return truncate(han || '平', type.maxLen, false);
    }

    case 'alnum': {
      // character_string 不收汉字
      const alnum = keepOnly(text, ALNUM_RE).trim();
      return truncate(alnum, type.maxLen, false);
    }

    case 'number': {
      const digits = keepOnly(text, /[0-9]/g);
      return truncate(digits || '0', type.maxLen, false);
    }

    case 'letter':
      return truncate(keepOnly(text, LETTER_RE), type.maxLen, false);

    case 'symbol':
      return truncate(keepOnly(text, SYMBOL_RE), type.maxLen, false);

    case 'date':
      // 运势里的 date 就是 getBeijingDateString() 的 YYYY-MM-DD
      return DATE_RE.test(text) ? text : truncate(text, type.maxLen, false);

    case 'time':
      // 微信的 time 是「24 小时制时间格式（支持+年月日）」，模板详情页的示例卡片也写成
      // 「2019年11月11日」。运势里的 date 是 YYYY-MM-DD，这里换成年月日写法最稳妥：
      // 带横线的写法微信收不收没有明文，而年月日是文档里给出的形态
      return truncate(
        text.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$1年$2月$3日'),
        type.maxLen,
        false
      );

    case 'amount': {
      const num = Number(keepOnly(text, /[0-9.]/g)) || 0;
      return truncate(String(num), type.maxLen, false);
    }

    default:
      return truncate(text, type.maxLen, true);
  }
}

/**
 * 产出 subscribe/send 的 data。
 * **只输出声明过的字段** —— 这是与旧实现最本质的区别：
 * 旧代码一次塞 30 多个键，只要模板参数不是刚好那 30 个，整条就是 47003。
 */
function buildTemplateData(mapping, fortune) {
  const values = buildContentValues(fortune);
  const data = {};
  for (const item of mapping || []) {
    data[item.field] = { value: formatTemplateValue(item.field, values[item.contentKey]) };
  }
  return data;
}

module.exports = {
  FIELD_TYPES,
  CONTENT_KEYS,
  LEVEL_TEXT,
  parseFieldMapping,
  buildContentValues,
  formatTemplateValue,
  buildTemplateData,
};



