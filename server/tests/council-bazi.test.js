// 会谈（多智能体）拼给模型的八字串。
//
// 这里钉的是一个真实发生过的 bug：baziAnalysis 是 async，而调用处漏了 await，
// 拿到的是 Promise，读 .bazi 抛 TypeError，又被 catch 静默换成"未提供生辰八字"——
// 结果三位专家永远看不到用户的八字，而日志里一个字都没有。
// 所以下面每条都要求真的排出四柱，只断言"没抛错"是不够的。
// langfuse 包在加载时用了动态 import()，jest 的 CJS 沙箱跑不了（要 --experimental-vm-modules）。
// 这里只替掉这个第三方包，src/config/langfuse.js 仍走真实逻辑：没配密钥时它导出 null，
// 和本地开发一致，正好也顺手验证了 multiAgentService 在无链路追踪时不崩。
jest.mock('langfuse', () => ({ Langfuse: class {} }));

const service = require('../src/services/multiAgentService');

const EXPECTED = '八字: 癸亥 乙丑 丙寅 辛卯, 五行平衡: 金1 木3 水2 火1 土1';

describe('buildBaziString', () => {
  test('时辰名能排出四柱和五行', async () => {
    const s = await service.buildBaziString({ solarDate: '1984-02-02', birthTime: '卯时' }, 'male');
    expect(s).toBe(EXPECTED);
  });

  // 聊天页传的是 0-23 的钟点字符串（默认 '12'），不是时辰名
  test('钟点数字也能排（聊天页就是这么传的）', async () => {
    const s = await service.buildBaziString({ solarDate: '1984-02-02', birthTime: '6' }, 'male');
    expect(s).toBe(EXPECTED);
  });

  test('农历生日先折算成公历再排', async () => {
    const s = await service.buildBaziString(
      { solarDate: '1984-01-01', birthTime: '卯时', calendar: 'lunar' },
      'male'
    );
    expect(s).toBe(EXPECTED);
  });

  test.each([
    ['没有生辰信息', null],
    ['缺日期', { birthTime: '卯时' }],
    ['缺时辰', { solarDate: '1984-02-02' }],
  ])('%s 时退回占位串', async (_label, birthInfo) => {
    expect(await service.buildBaziString(birthInfo, 'male')).toBe('未提供生辰八字');
  });

  test('时辰不合法时退回占位串，并把原因写进日志', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const s = await service.buildBaziString({ solarDate: '1984-02-02', birthTime: '未知' }, 'male');
      expect(s).toBe('未提供生辰八字');
      expect(spy).toHaveBeenCalled();
      expect(spy.mock.calls[0].join(' ')).toContain('未知');
    } finally {
      spy.mockRestore();
    }
  });
});
