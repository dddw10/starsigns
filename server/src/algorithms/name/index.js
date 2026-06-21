// 姓名测算算法模块

// 五行笔画对应
const STROKE_WUXING = {
  metal: [2, 3, 16, 17, 18, 24, 25, 32, 33, 39, 41],
  wood: [3, 4, 8, 11, 12, 13, 14, 18, 19, 22, 28, 31, 32, 36, 37],
  water: [1, 6, 7, 10, 11, 13, 15, 16, 17, 19, 20, 21, 23, 24, 29, 30, 35],
  fire: [2, 3, 7, 13, 14, 15, 21, 23, 24, 25, 28, 29, 31, 32, 33, 37, 38],
  earth: [5, 6, 10, 11, 12, 14, 15, 20, 21, 22, 26, 27, 31, 34, 35, 40],
};

// 三才配置
const SAN_CAI_CONFIG = {
  '1-1': { element: 'water', score: 80, desc: '水水配置，性格聪明，但需注意情绪波动。' },
  '1-2': { element: 'water', score: 75, desc: '水木配置，有创造力，适合文艺工作。' },
  '1-3': { element: 'fire', score: 70, desc: '水火配置，性格多变，需保持平衡。' },
  '1-4': { element: 'fire', score: 65, desc: '水火配置，有热情，但易冲动。' },
  '1-5': { element: 'earth', score: 85, desc: '水土配置，稳重踏实，事业有成。' },
  '2-1': { element: 'wood', score: 82, desc: '木水配置，有智慧，适合研究工作。' },
  '2-2': { element: 'wood', score: 78, desc: '木木配置，正直善良，有领导才能。' },
  '2-3': { element: 'fire', score: 88, desc: '木火配置，才华横溢，事业成功。' },
  '2-4': { element: 'fire', score: 85, desc: '木火配置，有热情，适合创业。' },
  '2-5': { element: 'earth', score: 80, desc: '木土配置，稳重可靠，家庭幸福。' },
  '3-1': { element: 'fire', score: 70, desc: '火水配置，性格急躁，需冷静。' },
  '3-2': { element: 'fire', score: 85, desc: '火木配置，有才华，适合艺术工作。' },
  '3-3': { element: 'fire', score: 90, desc: '火火配置，热情洋溢，事业成功。' },
  '3-4': { element: 'fire', score: 88, desc: '火火配置，有领导才能，适合管理。' },
  '3-5': { element: 'earth', score: 75, desc: '火土配置，稳重但需注意健康。' },
  '4-1': { element: 'fire', score: 68, desc: '火水配置，有想法但缺乏行动力。' },
  '4-2': { element: 'fire', score: 82, desc: '火木配置，有创造力，适合创新。' },
  '4-3': { element: 'fire', score: 87, desc: '火火配置，有热情，适合销售。' },
  '4-4': { element: 'fire', score: 85, desc: '火火配置，有魄力，适合创业。' },
  '4-5': { element: 'earth', score: 78, desc: '火土配置，稳重踏实，适合技术工作。' },
  '5-1': { element: 'earth', score: 75, desc: '土水配置，稳重但需灵活。' },
  '5-2': { element: 'earth', score: 80, desc: '土木配置，有耐心，适合教育工作。' },
  '5-3': { element: 'fire', score: 82, desc: '土火配置，有热情，适合服务行业。' },
  '5-4': { element: 'fire', score: 78, desc: '土火配置，稳重但需主动。' },
  '5-5': { element: 'earth', score: 90, desc: '土土配置，稳重可靠，事业有成。' },
};

// 五格计算
function calculateWuge(strokes) {
  const result = {};

  // 天格（姓氏笔画+1或两字之和）
  if (strokes.length === 1) {
    result.tianGe = strokes[0] + 1;
  } else {
    result.tianGe = strokes[0] + strokes[1];
  }

  // 人格（姓氏最后一字+名字第一字）
  if (strokes.length >= 2) {
    result.renGe = strokes[strokes.length - 2] + strokes[strokes.length - 1];
  } else {
    result.renGe = strokes[0] + 1;
  }

  // 地格（名字笔画之和，单字+1）
  if (strokes.length === 1) {
    result.diGe = strokes[0] + 1;
  } else if (strokes.length === 2) {
    result.diGe = strokes[1];
  } else {
    result.diGe = strokes.slice(1).reduce((a, b) => a + b, 0);
  }

  // 外格（总格-人格+1）
  result.zongGe = strokes.reduce((a, b) => a + b, 0);
  result.waiGe = result.zongGe - result.renGe + 1;

  return result;
}

// 获取笔画数对应的五行
function getWuxingByStrokes(stroke) {
  for (const [element, strokes] of Object.entries(STROKE_WUXING)) {
    if (strokes.includes(stroke % 41 || 41)) {
      return element;
    }
  }
  return 'earth';
}

// 获取三才配置
function getSanCai(wuge) {
  const sanCaiKey = `${wuge.tianGe % 5 + 1}-${wuge.renGe % 5 + 1}`;
  return SAN_CAI_CONFIG[sanCaiKey] || { element: 'earth', score: 70, desc: '配置一般，需要努力。' };
}

// 计算姓名笔画（简化版，实际需要查康熙字典）
function calculateStrokes(name) {
  // 简化处理，使用字符编码
  const strokes = [];
  for (let i = 0; i < name.length; i++) {
    const charCode = name.charCodeAt(i);
    // 简化的笔画计算
    const stroke = (charCode % 20) + 1;
    strokes.push(stroke);
  }
  return strokes;
}

// 姓名测算
function nameAnalysis(data) {
  const { name } = data;

  // 计算笔画
  const strokes = calculateStrokes(name);
  const totalStrokes = strokes.reduce((a, b) => a + b, 0);

  // 计算五格
  const wuge = calculateWuge(strokes);

  // 获取五行
  const wuxing = getWuxingByStrokes(totalStrokes);

  // 获取三才
  const sanCai = getSanCai(wuge);

  // 计算总分
  const score = Math.floor((sanCai.score + (totalStrokes % 10) * 2) / 1.1);

  // 生成分析
  const analysis = generateAnalysis(name, strokes, wuge, wuxing, sanCai, score);

  return {
    name,
    strokeCount: totalStrokes,
    strokes,
    wuge,
    fiveElement: wuxing,
    threeTalent: sanCai.element,
    sanCaiDesc: sanCai.desc,
    score: Math.min(100, Math.max(30, score)),
    analysis,
  };
}

// 生成分析
function generateAnalysis(name, strokes, wuge, wuxing, sanCai, score) {
  const wuxingNames = { metal: '金', wood: '木', water: '水', fire: '火', earth: '土' };
  let analysis = '';

  analysis += `【${name}姓名分析】\n\n`;

  // 笔画分析
  analysis += `【笔画数理】\n`;
  analysis += `总笔画：${strokes.reduce((a, b) => a + b, 0)}画\n`;
  analysis += `天格：${wuge.tianGe}（${wuxingNames[getWuxingByStrokes(wuge.tianGe)]}）\n`;
  analysis += `人格：${wuge.renGe}（${wuxingNames[getWuxingByStrokes(wuge.renGe)]}）\n`;
  analysis += `地格：${wuge.diGe}（${wuxingNames[getWuxingByStrokes(wuge.diGe)]}）\n`;
  analysis += `外格：${wuge.waiGe}（${wuxingNames[getWuxingByStrokes(wuge.waiGe)]}）\n`;
  analysis += `总格：${wuge.zongGe}（${wuxingNames[getWuxingByStrokes(wuge.zongGe)]}）\n\n`;

  // 五行分析
  analysis += `【五行属性】\n`;
  analysis += `姓名五行属${wuxingNames[wuxing]}。\n`;
  analysis += `五行相生相克关系良好，有助于运势发展。\n\n`;

  // 三才分析
  analysis += `【三才配置】\n`;
  analysis += `${sanCai.desc}\n\n`;

  // 综合评分
  analysis += `【综合评分】\n`;
  if (score >= 90) {
    analysis += `姓名评分：${score}分（优秀）\n`;
    analysis += `此名大吉大利，事业有成，家庭幸福。\n`;
  } else if (score >= 80) {
    analysis += `姓名评分：${score}分（良好）\n`;
    analysis += `此名较为吉利，运势平稳，有发展空间。\n`;
  } else if (score >= 70) {
    analysis += `姓名评分：${score}分（中等）\n`;
    analysis += `此名运势一般，需要努力奋斗。\n`;
  } else {
    analysis += `姓名评分：${score}分（较差）\n`;
    analysis += `此名运势欠佳，建议改名或采取补救措施。\n`;
  }

  // 建议
  analysis += `\n【改善建议】\n`;
  if (score < 80) {
    analysis += `建议在日常生活中多接触五行属${wuxingNames[sanCai.element]}的事物，以增强运势。\n`;
    analysis += `可考虑使用五行属${wuxingNames[sanCai.element]}的物品或颜色来调和。\n`;
  } else {
    analysis += `姓名运势良好，继续保持积极心态，努力奋斗即可。\n`;
  }

  return analysis;
}

module.exports = {
  nameAnalysis,
  calculateStrokes,
  calculateWuge,
  getWuxingByStrokes,
};
