// 每日运势：值日干支必须来自万年历，同一天同一个人必须得到同一个分数
// （否则用户刷新一次运势就变，缓存也就失去意义）。
const { generateDailyFortune, calculateDayElement } = require('../src/algorithms/daily-fortune');
const { getDayGanZhi } = require('../src/algorithms/bazi/lunar');
const { getBeijingDateString } = require('../src/utils/date');

const USER = { dayGanZhi: '丙寅', yearGanZhi: '癸亥', dayMaster: 'fire' };

describe('值日干支与当日五行', () => {
  test('2026-09-02 的日柱是己卯（万年历）', () => {
    expect(getDayGanZhi(2026, 9, 2)).toBe('己卯');
  });

  test('当日五行取日柱天干（己 -> 土）', () => {
    expect(calculateDayElement(2026, 9, 2)).toBe('earth');
    expect(generateDailyFortune(USER, '2026-09-02').dayElement).toBe('earth');
  });
});

describe('同一天同一个人结果稳定', () => {
  test('分数与等级可重复', () => {
    const a = generateDailyFortune(USER, '2026-09-02');
    const b = generateDailyFortune(USER, '2026-09-02');
    expect(a.score).toBe(b.score);
    expect(a.level).toBe(b.level);
    expect(a.rating).toBe(b.rating);
    expect(a.overall).toBe(b.overall);
  });

  // 幸运色和幸运数字以前用 Math.random()。App 侧被 Redis 缓存盖住看不出来，
  // 推送侧绕过缓存直调算法，于是「推送里的幸运色」和「小程序里的幸运色」是两个值。
  test('幸运色与幸运数字同日可重复（以前是 Math.random()）', () => {
    const a = generateDailyFortune(USER, '2026-09-02');
    const b = generateDailyFortune(USER, '2026-09-02');
    expect(a.luckyColorName).toBe(b.luckyColorName);
    expect(a.luckyColor).toBe(b.luckyColor);
    expect(a.luckyNumber).toBe(b.luckyNumber);
  });

  test('幸运色与幸运数字换天会变（不是写死的常数）', () => {
    const days = ['2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06', '2026-09-07'];
    const colors = new Set(days.map((d) => generateDailyFortune(USER, d).luckyColorName));
    const numbers = new Set(days.map((d) => generateDailyFortune(USER, d).luckyNumber));
    expect(colors.size).toBeGreaterThan(1);
    expect(numbers.size).toBeGreaterThan(1);
  });

  test('同一天不同的人不会都拿到同一个幸运色（种子里带日柱）', () => {
    const ganZhi = ['丙寅', '辛未', '甲子', '戊辰', '壬申', '乙亥', '庚午', '癸酉'];
    const pairs = new Set(
      ganZhi.map((dayGanZhi) => {
        const f = generateDailyFortune({ ...USER, dayGanZhi }, '2026-09-02');
        return `${f.luckyColorName}/${f.luckyNumber}`;
      })
    );
    // 单个用户之间撞车是允许的（颜色和数字都是小词表），
    // 但整体必须散开——否则说明种子里根本没带用户信息
    expect(pairs.size).toBeGreaterThan(1);
  });

  test('游客（没有八字信息）也能拿到确定性的幸运色与数字', () => {
    const a = generateDailyFortune(null, '2026-09-02');
    const b = generateDailyFortune(null, '2026-09-02');
    expect(a.luckyColorName).toBe(b.luckyColorName);
    expect(a.luckyNumber).toBe(b.luckyNumber);
  });

  test('换一天分数会变（不是写死的常数）', () => {
    const days = ['2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06'];
    const scores = new Set(days.map((d) => generateDailyFortune(USER, d).score));
    expect(scores.size).toBeGreaterThan(1);
  });

  test('不传日期时按北京时间的今天', () => {
    expect(generateDailyFortune(USER).date).toBe(getBeijingDateString());
  });

  test('分数落在 0-100，等级星级自洽', () => {
    for (const d of ['2026-01-01', '2026-06-15', '2026-12-31']) {
      const f = generateDailyFortune(USER, d);
      expect(f.score).toBeGreaterThanOrEqual(0);
      expect(f.score).toBeLessThanOrEqual(100);
      expect(f.rating).toBeGreaterThanOrEqual(1);
      expect(f.rating).toBeLessThanOrEqual(5);
      expect(f.yi.length).toBeGreaterThan(0);
      expect(f.ji.length).toBeGreaterThan(0);
    }
  });
});

describe('地支相冲', () => {
  // 2026-09-02 值日地支为卯，卯酉相冲
  test('日支相冲要扣分并给出提示', () => {
    const normal = generateDailyFortune(USER, '2026-09-02');
    const clashed = generateDailyFortune(
      { ...USER, dayGanZhi: '丁酉' },
      '2026-09-02'
    );
    expect(clashed.score).toBeLessThan(normal.score);
    expect(clashed.overall).toContain('相冲');
    expect(clashed.overall).toContain('日支');
  });

  test('年支相冲也能识别', () => {
    const clashed = generateDailyFortune(
      { ...USER, yearGanZhi: '癸酉' },
      '2026-09-02'
    );
    expect(clashed.overall).toContain('生肖年支');
  });

  test('不相冲时不加提示', () => {
    expect(generateDailyFortune(USER, '2026-09-02').overall).not.toContain('相冲');
  });

  test('没有八字信息也能出运势（游客）', () => {
    const f = generateDailyFortune(null, '2026-09-02');
    expect(f.score).toBeGreaterThan(0);
    expect(f.overall).not.toContain('相冲');
  });
});
