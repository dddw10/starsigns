// 风水算法模块

// 方位五行对应
const DIRECTION_WUXING = {
  '北': 'water',
  '南': 'fire',
  '东': 'wood',
  '西': 'metal',
  '东北': 'earth',
  '东南': 'wood',
  '西北': 'metal',
  '西南': 'earth',
};

// 方位吉凶
const DIRECTION_FORTUNE = {
  '北': { good: '事业运', bad: '感情运', color: '黑色', number: '1,6' },
  '南': { good: '名声运', bad: '健康运', color: '红色', number: '2,7' },
  '东': { good: '健康运', bad: '财运', color: '绿色', number: '3,8' },
  '西': { good: '财运', bad: '事业运', color: '白色', number: '4,9' },
  '东北': { good: '学业运', bad: '人际关系', color: '黄色', number: '5,0' },
  '东南': { good: '桃花运', bad: '健康运', color: '绿色', number: '3,8' },
  '西北': { good: '贵人运', bad: '子女运', color: '白色', number: '4,9' },
  '西南': { good: '家庭运', bad: '事业运', color: '黄色', number: '5,0' },
};

// 格局类型
const LAYOUT_TYPES = {
  '方正': { score: 90, desc: '方正格局，藏风聚气，运势平稳。' },
  '缺角': { score: 60, desc: '格局缺角，需用风水物品补角。' },
  '凹凸': { score: 65, desc: '格局凹凸，气场不稳定。' },
  'L型': { score: 55, desc: 'L型格局，需注意平衡。' },
  '长条': { score: 60, desc: '长条格局，气流不畅。' },
  '其他': { score: 50, desc: '格局特殊，需具体分析。' },
};

// 判断格局类型
function judgeLayout(layout) {
  // 简化处理，根据关键词判断
  if (layout.includes('方正') || layout.includes('正方')) return '方正';
  if (layout.includes('缺角') || layout.includes('少角')) return '缺角';
  if (layout.includes('凹') || layout.includes('凸')) return '凹凸';
  if (layout.includes('L') || layout.includes('l')) return 'L型';
  if (layout.includes('长条') || layout.includes('狭长')) return '长条';
  return '其他';
}

// 生成风水分析
function generateAnalysis(direction, layout, layoutType, fortune) {
  const wuxing = DIRECTION_WUXING[direction] || 'earth';
  const wuxingNames = { metal: '金', wood: '木', water: '水', fire: '火', earth: '土' };
  const layoutInfo = LAYOUT_TYPES[layoutType] || LAYOUT_TYPES['其他'];

  let analysis = '';

  // 朝向分析
  analysis += `【朝向分析】\n`;
  analysis += `房屋朝向${direction}，五行属${wuxingNames[wuxing]}。\n`;
  analysis += `朝向${direction}有利于${fortune.good}，但不利于${fortune.bad}。\n`;
  analysis += `建议使用${fortune.color}色调装饰，幸运数字为${fortune.number}。\n\n`;

  // 格局分析
  analysis += `【格局分析】\n`;
  analysis += `${layoutType}格局：${layoutInfo.desc}\n`;
  if (layoutType !== '方正') {
    analysis += `建议使用风水物品进行补救。\n`;
  }
  analysis += '\n';

  // 改善建议
  analysis += `【改善建议】\n`;
  analysis += generateSuggestions(direction, layoutType, wuxing);

  return analysis;
}

// 生成改善建议
function generateSuggestions(direction, layoutType, wuxing) {
  const wuxingNames = { metal: '金', wood: '木', water: '水', fire: '火', earth: '土' };
  let suggestions = [];

  // 根据朝向给出建议
  switch (wuxing) {
    case 'water':
      suggestions.push('在北方放置水景或鱼缸，增强水气。');
      suggestions.push('避免在北方放置过多红色物品，以免水火相冲。');
      break;
    case 'fire':
      suggestions.push('在南方放置红色装饰品或灯光，增强火气。');
      suggestions.push('避免在南方放置过多黑色物品，以免水火相冲。');
      break;
    case 'wood':
      suggestions.push('在东方放置绿色植物，增强木气。');
      suggestions.push('避免在东方放置过多金属物品，以免金克木。');
      break;
    case 'metal':
      suggestions.push('在西方放置金属装饰品，增强金气。');
      suggestions.push('避免在西方放置过多红色物品，以免火克金。');
      break;
    case 'earth':
      suggestions.push('在东北或西南放置黄色或棕色装饰品，增强土气。');
      suggestions.push('避免在这些方位放置过多绿色物品，以免木克土。');
      break;
  }

  // 根据格局给出建议
  if (layoutType !== '方正') {
    suggestions.push('在缺角或凹凸处放置泰山石敢当或水晶球，补足气场。');
    suggestions.push('保持房屋整洁，避免杂物堆积影响气流。');
  }

  // 通用建议
  suggestions.push('保持房屋通风良好，阳光充足。');
  suggestions.push('定期清理房屋，保持整洁。');
  suggestions.push('在客厅放置招财物品，如貔貅或金蟾。');

  return suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n');
}

// 风水分析
function fengshuiAnalysis(data) {
  const { direction, layout } = data;

  // 判断格局类型
  const layoutType = judgeLayout(layout);
  const layoutInfo = LAYOUT_TYPES[layoutType] || LAYOUT_TYPES['其他'];
  const fortune = DIRECTION_FORTUNE[direction] || DIRECTION_FORTUNE['北'];

  // 计算总分
  let score = layoutInfo.score;

  // 根据朝向调整
  const directionScores = {
    '北': 85, '南': 80, '东': 82, '西': 83,
    '东北': 78, '东南': 80, '西北': 79, '西南': 77,
  };
  score = Math.floor((score + (directionScores[direction] || 75)) / 2);

  // 生成分析
  const analysis = generateAnalysis(direction, layout, layoutType, fortune);

  // 生成建议
  const suggestions = [
    `朝向${direction}有利于${fortune.good}，可多利用此方位。`,
    `避免在${direction}方位放置过多影响${fortune.bad}的物品。`,
    layoutType !== '方正' ? '格局需要补角或调整，建议咨询专业风水师。' : '格局方正，气场稳定。',
    `使用${fortune.color}色调装饰，有助于提升运势。`,
    `幸运数字为${fortune.number}，可多接触相关数字。`,
  ];

  return {
    direction,
    layout,
    layoutType,
    score: Math.min(100, Math.max(30, score)),
    analysis,
    suggestions,
  };
}

module.exports = {
  fengshuiAnalysis,
  DIRECTION_WUXING,
  DIRECTION_FORTUNE,
  LAYOUT_TYPES,
};
