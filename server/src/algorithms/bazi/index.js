const { Solar, Lunar } = require('lunar-javascript');
const { calculateWuxing, analyzeWuxingBalance } = require('./wuxing');
const { getInterpretation } = require('./interpretations');

// 时辰 -> 取该时辰内的固定时刻（配合下面的 30 分，落在时辰正中）
// 子时跨 23:00-01:00，统一按 00:30 处理，避开晚子时的流派分歧
const BIRTH_TIME_HOURS = {
  '子时': 0, '丑时': 2, '寅时': 4, '卯时': 6,
  '辰时': 8, '巳时': 10, '午时': 12, '未时': 14,
  '申时': 16, '酉时': 18, '戌时': 20, '亥时': 22,
};

// 这些都是用户输入问题，不是服务器故障。全局错误处理只对 4xx 回显 message
// （5xx 在生产环境统一说"服务器内部错误"），所以必须打上 400 才能让用户看到原因
function inputError(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

// 认不出的时辰以前会静默落到子时，导致「时柱恒为子时」这种没人报错的错结果
// （HTTP 路由有 validator 挡着，但 AI 工具调用绕过了 validator）。这里改成直接抛错。
// 同时兼容 0-23 的小时数：模型有时会传 "10" 而不是「巳时」。
function resolveHour(birthTime) {
  const raw = String(birthTime === 0 ? 0 : (birthTime || '')).trim();
  if (!raw) {
    throw inputError('出生时辰不能为空');
  }

  const byName = BIRTH_TIME_HOURS[raw] ?? BIRTH_TIME_HOURS[`${raw}时`];
  if (byName !== undefined) {
    return byName;
  }

  if (/^\d{1,2}$/.test(raw)) {
    const h = Number(raw);
    if (h >= 0 && h <= 23) {
      // 23 点与 0 点同属子时，(h + 1) % 24 后每 2 小时一个时辰
      return Math.floor(((h + 1) % 24) / 2) * 2;
    }
  }

  throw inputError(`无法识别的出生时辰「${raw}」，应为${Object.keys(BIRTH_TIME_HOURS).join('/')}之一`);
}

// 农历日期 -> 公历日期。历法选了「农历」时先转成公历，
// 后面排盘、存库、展示统一只认公历，避免把农历日期当公历算。
// 注意：闰月按普通月处理（前端的日期选择器表达不了闰月）。
function resolveSolarDate(dateStr, calendar) {
  const [year, month, day] = String(dateStr || '').split('-').map(Number);
  if (!year || !month || !day) {
    throw inputError('出生日期格式不正确，应为 YYYY-MM-DD');
  }

  if (calendar !== 'lunar') {
    return dateStr;
  }

  try {
    return Lunar.fromYmd(year, month, day).getSolar().toYmd();
  } catch (err) {
    // 库里的原始报错形如 only 30 days in lunar year 1984 month 1
    throw inputError(`农历 ${year} 年 ${month} 月 ${day} 日不存在，请重新选择（${err.message}）`);
  }
}

// 生肖直接从年柱地支取。库里的 getYearShengXiaoByLiChun() 只精确到立春那一天，
// 而年柱走的是立春的精确时刻，两者在立春当天会打架（2000-02-04 00:30 年柱己卯却报"龙"）
const ZHI_SHENG_XIAO = {
  '子': '鼠', '丑': '牛', '寅': '虎', '卯': '兔',
  '辰': '龙', '巳': '蛇', '午': '马', '未': '羊',
  '申': '猴', '酉': '鸡', '戌': '狗', '亥': '猪',
};

// 公历日期 + 时辰 -> lunar-javascript 八字对象
// 年柱以立春为界、月柱按节气、日柱查万年历，均由库负责
function getEightChar(solarDate, birthTime) {
  const [year, month, day] = String(solarDate || '').split('-').map(Number);
  if (!year || !month || !day) {
    throw inputError('出生日期格式不正确，应为 YYYY-MM-DD');
  }
  return Solar.fromYmdHms(year, month, day, resolveHour(birthTime), 30, 0)
    .getLunar()
    .getEightChar();
}

// 八字算命主入口
// data.calendar 为 'lunar' 时 data.solarDate 按农历解析，先折算成公历再排盘；
// 返回值里的 solarDate 一定是公历，调用方应当用它落库，别再存用户输入的农历日期。
async function baziAnalysis(data) {
  const { solarDate, birthTime, gender, calendar } = data;

  // 0. 农历折算成公历（历法为公历时原样返回）
  const resolvedSolarDate = resolveSolarDate(solarDate, calendar);

  // 1. 排四柱（含农历、节气等信息）
  const bazi = calculateBazi(resolvedSolarDate, birthTime);

  // 2. 计算五行
  const wuxing = calculateWuxing(bazi);

  // 3. 分析五行平衡
  const analysis = analyzeWuxingBalance(wuxing, gender, bazi);

  // 4. 获取解读
  const interpretation = getInterpretation(bazi, wuxing, analysis, gender);

  return {
    solarDate: resolvedSolarDate,
    bazi: {
      ...bazi,
      wuxing,
    },
    analysis,
    interpretation,
  };
}

// 排四柱
function calculateBazi(solarDate, birthTime) {
  const eightChar = getEightChar(solarDate, birthTime);
  const lunar = eightChar.getLunar();

  return {
    yearGanZhi: eightChar.getYear(),
    monthGanZhi: eightChar.getMonth(),
    dayGanZhi: eightChar.getDay(),
    hourGanZhi: eightChar.getTime(),
    // 生肖跟随年柱地支，与四柱保持一致
    shengXiao: ZHI_SHENG_XIAO[eightChar.getYear().charAt(1)] || '',
    lunarDate: `${lunar.getYear()}-${lunar.getMonth()}-${lunar.getDay()}`,
    lunarDateText: `${lunar.getYearInChinese()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
    // 以下为解读用的补充信息
    naYin: {
      year: eightChar.getYearNaYin(),
      month: eightChar.getMonthNaYin(),
      day: eightChar.getDayNaYin(),
      hour: eightChar.getTimeNaYin(),
    },
    hideGan: {
      year: eightChar.getYearHideGan(),
      month: eightChar.getMonthHideGan(),
      day: eightChar.getDayHideGan(),
      hour: eightChar.getTimeHideGan(),
    },
    shiShen: {
      year: eightChar.getYearShiShenGan(),
      month: eightChar.getMonthShiShenGan(),
      hour: eightChar.getTimeShiShenGan(),
    },
    jieQi: {
      prev: lunar.getPrevJieQi().getName(),
      next: lunar.getNextJieQi().getName(),
    },
  };
}

module.exports = {
  baziAnalysis,
  calculateBazi,
  getEightChar,
  resolveHour,
  resolveSolarDate,
  BIRTH_TIME_HOURS,
};
