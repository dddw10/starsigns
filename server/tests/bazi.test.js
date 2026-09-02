// 八字排盘的回归基准。全部是纯函数，不连数据库、不发网络请求。
//
// 这些期望值来自 lunar-javascript 的万年历，是"钉子"：
// 改动排盘取法（时辰取点、立春界、生肖来源、历法折算）时如果这里红了，
// 说明用户拿到的四柱变了，必须先想清楚是不是真的要变。
const {
  calculateBazi,
  resolveHour,
  resolveSolarDate,
  BIRTH_TIME_HOURS,
} = require('../src/algorithms/bazi');

const pillars = (chart) => [
  chart.yearGanZhi,
  chart.monthGanZhi,
  chart.dayGanZhi,
  chart.hourGanZhi,
].join(' ');

describe('四柱基准', () => {
  const cases = [
    ['1984-02-02', '卯时', '癸亥 乙丑 丙寅 辛卯', '猪'],
    ['1990-06-15', '午时', '庚午 壬午 辛亥 甲午', '马'],
    ['1995-10-10', '巳时', '乙亥 丙戌 甲戌 己巳', '猪'],
  ];

  test.each(cases)('%s %s -> %s', (date, time, expected, shengXiao) => {
    const chart = calculateBazi(date, time);
    expect(pillars(chart)).toBe(expected);
    expect(chart.shengXiao).toBe(shengXiao);
  });
});

describe('年柱以立春的精确时刻为界', () => {
  // 2000 年立春在 2 月 4 日晚，所以 2 月 4 日子时还算己卯（兔）年
  test('2000-02-04 子时 仍是己卯年', () => {
    expect(pillars(calculateBazi('2000-02-04', '子时'))).toBe('己卯 丁丑 壬辰 庚子');
  });

  test('2000-02-05 子时 已进庚辰年', () => {
    expect(pillars(calculateBazi('2000-02-05', '子时'))).toBe('庚辰 戊寅 癸巳 壬子');
  });

  // 2024 年立春在 2 月 4 日 16:27，同一天里跨年：这是"按天算立春"必错的场景
  test('2024-02-04 同一天内跨立春换年柱', () => {
    expect(calculateBazi('2024-02-04', '子时').yearGanZhi).toBe('癸卯');
    expect(calculateBazi('2024-02-04', '亥时').yearGanZhi).toBe('甲辰');
  });

  // 生肖必须跟年柱地支一致。库里的 getYearShengXiaoByLiChun() 只精确到立春那一天，
  // 2024-02-04 子时它会说"龙"，而年柱是癸卯——所以生肖只能从年柱地支取
  test('生肖跟随年柱地支，立春当天不与四柱打架', () => {
    expect(calculateBazi('2024-02-04', '子时').shengXiao).toBe('兔');
    expect(calculateBazi('2024-02-04', '亥时').shengXiao).toBe('龙');
  });
});

describe('时辰解析 resolveHour', () => {
  test('十二时辰各取时辰正中的钟点', () => {
    expect(Object.keys(BIRTH_TIME_HOURS)).toHaveLength(12);
    expect(resolveHour('子时')).toBe(0);
    expect(resolveHour('巳时')).toBe(10);
    expect(resolveHour('亥时')).toBe(22);
  });

  test('省掉「时」字也认', () => {
    expect(resolveHour('午')).toBe(12);
  });

  test('兼容 0-23 的钟点（AI 工具调用会传数字）', () => {
    expect(resolveHour('10')).toBe(10);
    // 23 点与 0 点同属子时，统一按 00:30 处理
    expect(resolveHour('23')).toBe(0);
    expect(resolveHour('0')).toBe(0);
    expect(resolveHour(0)).toBe(0);
    // 07:00 属辰时，取辰时正中 08:30
    expect(resolveHour('7')).toBe(8);
  });

  // 以前认不出的时辰会静默落到子时，排出来的时柱是错的却没人报错
  test.each([undefined, null, '', '未知', '24', '99', 'abc', '中午', '子时半'])(
    '认不出的 %p 直接抛错而不是默认子时',
    (bad) => {
      expect(() => resolveHour(bad)).toThrow();
    }
  );

  test('抛出的错误带 400，让全局错误处理把原因回显给用户', () => {
    expect.assertions(2);
    try {
      resolveHour('未知');
    } catch (err) {
      expect(err.status).toBe(400);
      expect(err.message).toContain('未知');
    }
  });
});

describe('农历折算 resolveSolarDate', () => {
  test('历法为公历时原样返回', () => {
    expect(resolveSolarDate('1984-02-02', 'solar')).toBe('1984-02-02');
    expect(resolveSolarDate('1984-02-02', undefined)).toBe('1984-02-02');
  });

  test.each([
    ['1984-01-01', '1984-02-02'],
    ['2000-01-01', '2000-02-05'],
    ['1990-05-23', '1990-06-15'],
  ])('农历 %s -> 公历 %s', (lunar, solar) => {
    expect(resolveSolarDate(lunar, 'lunar')).toBe(solar);
  });

  test('农历录入与直接录入公历排出同一盘', () => {
    expect(pillars(calculateBazi(resolveSolarDate('1984-01-01', 'lunar'), '卯时')))
      .toBe(pillars(calculateBazi('1984-02-02', '卯时')));
  });

  test('农历没有的日子（月只有 29/30 天）报 400 而不是排出一个错盘', () => {
    expect.assertions(2);
    try {
      resolveSolarDate('1984-01-31', 'lunar');
    } catch (err) {
      expect(err.status).toBe(400);
      expect(err.message).toContain('农历');
    }
  });

  test('日期格式不对时报 400', () => {
    expect(() => resolveSolarDate('1984/01/01', 'lunar')).toThrow();
    expect(() => resolveSolarDate('', 'solar')).toThrow();
  });
});

describe('排盘附带信息', () => {
  test('农历、节气、纳音、藏干齐全', () => {
    const chart = calculateBazi('1984-02-02', '卯时');
    expect(chart.lunarDate).toBe('1984-1-1');
    expect(chart.lunarDateText).toBe('一九八四年正月初一');
    expect(chart.jieQi).toEqual({ prev: '大寒', next: '立春' });
    expect(chart.naYin.year).toBeTruthy();
    expect(chart.hideGan.day.length).toBeGreaterThan(0);
  });

  // 闰月的 lunarDate 会长成 1995--8-16（月份为负表示闰月，库的约定）。
  // 展示只用 lunarDateText，别去解析 lunarDate
  test('闰月的文本形式带「闰」字', () => {
    const chart = calculateBazi('1995-10-10', '巳时');
    expect(chart.lunarDateText).toBe('一九九五年闰八月十六');
    expect(chart.lunarDate).toBe('1995--8-16');
  });
});
