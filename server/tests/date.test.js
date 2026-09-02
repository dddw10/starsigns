// 北京时间日期工具。容器里进程时区通常是 UTC，
// 而"今天"必须按北京时间算：签到、每日运势、宠物喂食都以此为准。
const { getBeijingDateString, getBeijingDate } = require('../src/utils/date');

describe('getBeijingDateString', () => {
  test('UTC 当天下午 = 北京时间同一天', () => {
    expect(getBeijingDateString(new Date('2026-09-02T03:00:00Z'))).toBe('2026-09-02');
  });

  test('UTC 傍晚已经是北京时间的第二天', () => {
    // 17:00Z = 次日 01:00 北京时间
    expect(getBeijingDateString(new Date('2026-09-01T17:00:00Z'))).toBe('2026-09-02');
    // 15:59:59Z 还差一分钟，仍是当天
    expect(getBeijingDateString(new Date('2026-09-01T15:59:59Z'))).toBe('2026-09-01');
    // 16:00:00Z 正好跨到次日 00:00 北京时间
    expect(getBeijingDateString(new Date('2026-09-01T16:00:00Z'))).toBe('2026-09-02');
  });

  test('跨月跨年也对', () => {
    expect(getBeijingDateString(new Date('2025-12-31T16:00:00Z'))).toBe('2026-01-01');
    expect(getBeijingDateString(new Date('2026-01-31T16:00:00Z'))).toBe('2026-02-01');
  });

  test('接受时间戳和 Date 两种入参', () => {
    const d = new Date('2026-09-02T03:00:00Z');
    expect(getBeijingDateString(d.getTime())).toBe(getBeijingDateString(d));
  });

  test('不传参数时取当下', () => {
    expect(getBeijingDateString()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('getBeijingDate', () => {
  test('用来读小时数（推送时段判断靠它）', () => {
    // 01:00Z = 北京时间 09:00
    expect(getBeijingDate(new Date('2026-09-02T01:00:00Z')).getUTCHours()).toBe(9);
  });
});
