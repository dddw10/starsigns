// 客户端「即时排演」预览与服务端排盘必须逐字一致，否则用户会看到
// 预览一套四柱、提交后又变成另一套。两边同库同版本（lunar-javascript 1.7.7），
// 这里直接把两份实现跑同样的输入做对照。
//
// 客户端那份是 ESM，jest 默认不转译，所以用正则把它改写成 CommonJS 后再 require。
// 这样做的好处是不必为一个文件引入 babel；坏处是客户端改写法时这里可能需要跟着调。
const fs = require('fs');
const path = require('path');
const Module = require('module');

const { calculateBazi, resolveSolarDate } = require('../src/algorithms/bazi');

const CLIENT_UTIL = path.join(
  __dirname,
  '../../miniprogram/src/pages/bazi/utils/bazi-chart.js'
);

function loadClientUtil() {
  const source = fs
    .readFileSync(CLIENT_UTIL, 'utf8')
    .replace(/^import\s+\{([^}]+)\}\s+from\s+'lunar-javascript'$/m, 'const {$1} = require("lunar-javascript")')
    .replace(/^export\s+(function|const)\s/gm, '$1 ');

  const m = new Module(CLIENT_UTIL, null);
  m.filename = CLIENT_UTIL;
  // 让客户端文件能 require 到 server 这边的 node_modules
  m.paths = Module._nodeModulePaths(path.join(__dirname, '..'));
  m._compile(
    `${source}\nmodule.exports = { calcBaziChart, formatBaziChart, BIRTH_TIME_HOURS };`,
    CLIENT_UTIL
  );
  return m.exports;
}

const client = loadClientUtil();

describe('客户端预览 == 服务端排盘', () => {
  const cases = [
    ['1984-02-02', '卯时'],
    ['2000-02-04', '子时'],
    ['2024-02-04', '亥时'],
    ['1995-10-10', '巳时'],
    ['1990-06-15', '午时'],
  ];

  test.each(cases)('%s %s 四柱与生肖一致', (date, time) => {
    const server = calculateBazi(date, time);
    const preview = client.calcBaziChart(date, time);

    expect(preview.yearGanZhi).toBe(server.yearGanZhi);
    expect(preview.monthGanZhi).toBe(server.monthGanZhi);
    expect(preview.dayGanZhi).toBe(server.dayGanZhi);
    expect(preview.hourGanZhi).toBe(server.hourGanZhi);
    expect(preview.shengXiao).toBe(server.shengXiao);
    expect(preview.lunarDateText).toBe(server.lunarDateText);
  });

  test('时辰映射两边完全一样', () => {
    expect(client.BIRTH_TIME_HOURS).toEqual(
      require('../src/algorithms/bazi').BIRTH_TIME_HOURS
    );
  });

  test('农历录入两边折算出同一个公历、同一盘', () => {
    const preview = client.calcBaziChart('1984-01-01', '卯时', 'lunar');
    expect(preview.solarDate).toBe(resolveSolarDate('1984-01-01', 'lunar'));

    const server = calculateBazi(preview.solarDate, '卯时');
    expect(preview.yearGanZhi).toBe(server.yearGanZhi);
    expect(preview.hourGanZhi).toBe(server.hourGanZhi);
  });

  test('农历没有的日子给出可读提示，而不是排出一个错盘', () => {
    const preview = client.calcBaziChart('1984-01-31', '卯时', 'lunar');
    expect(preview.error).toContain('农历');
    expect(preview.yearGanZhi).toBeUndefined();
    // 服务端同样会拒
    expect(() => resolveSolarDate('1984-01-31', 'lunar')).toThrow();
  });

  test('时辰没选满时不猜，返回 null 把预览藏起来', () => {
    expect(client.calcBaziChart('1984-02-02', '')).toBeNull();
    expect(client.calcBaziChart('', '卯时')).toBeNull();
    expect(client.calcBaziChart('1984-02-02', '未知')).toBeNull();
  });

  test('展示串形如「癸亥年 乙丑月 丙寅日 辛卯时」', () => {
    const chart = client.calcBaziChart('1984-02-02', '卯时');
    expect(client.formatBaziChart(chart)).toBe('癸亥年 乙丑月 丙寅日 辛卯时');
    expect(client.formatBaziChart(null)).toBe('');
    expect(client.formatBaziChart({ error: 'x' })).toBe('');
  });
});
