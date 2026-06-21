// 五行计算模块

// 天干五行对应
const GAN_WUXING = {
  '甲': 'wood', '乙': 'wood',
  '丙': 'fire', '丁': 'fire',
  '戊': 'earth', '己': 'earth',
  '庚': 'metal', '辛': 'metal',
  '壬': 'water', '癸': 'water',
};

// 地支五行对应
const ZHI_WUXING = {
  '子': 'water', '丑': 'earth',
  '寅': 'wood', '卯': 'wood',
  '辰': 'earth', '巳': 'fire',
  '午': 'fire', '未': 'earth',
  '申': 'metal', '酉': 'metal',
  '戌': 'earth', '亥': 'water',
};

// 五行相生
const WUXING_SHENG = {
  'metal': 'water',
  'water': 'wood',
  'wood': 'fire',
  'fire': 'earth',
  'earth': 'metal',
};

// 五行相克
const WUXING_KE = {
  'metal': 'wood',
  'wood': 'earth',
  'earth': 'water',
  'water': 'fire',
  'fire': 'metal',
};

// 五行名称
const WUXING_NAMES = {
  'metal': '金',
  'wood': '木',
  'water': '水',
  'fire': '火',
  'earth': '土',
};

// 计算八字中的五行
function calculateWuxing(bazi) {
  const wuxing = {
    metal: 0,
    wood: 0,
    water: 0,
    fire: 0,
    earth: 0,
  };

  // 解析年柱
  const yearGan = bazi.yearGanZhi.charAt(0);
  const yearZhi = bazi.yearGanZhi.charAt(1);
  if (GAN_WUXING[yearGan]) wuxing[GAN_WUXING[yearGan]]++;
  if (ZHI_WUXING[yearZhi]) wuxing[ZHI_WUXING[yearZhi]]++;

  // 解析月柱
  const monthGan = bazi.monthGanZhi.charAt(0);
  const monthZhi = bazi.monthGanZhi.charAt(1);
  if (GAN_WUXING[monthGan]) wuxing[GAN_WUXING[monthGan]]++;
  if (ZHI_WUXING[monthZhi]) wuxing[ZHI_WUXING[monthZhi]]++;

  // 解析日柱
  const dayGan = bazi.dayGanZhi.charAt(0);
  const dayZhi = bazi.dayGanZhi.charAt(1);
  if (GAN_WUXING[dayGan]) wuxing[GAN_WUXING[dayGan]]++;
  if (ZHI_WUXING[dayZhi]) wuxing[ZHI_WUXING[dayZhi]]++;

  // 解析时柱
  const hourGan = bazi.hourGanZhi.charAt(0);
  const hourZhi = bazi.hourGanZhi.charAt(1);
  if (GAN_WUXING[hourGan]) wuxing[GAN_WUXING[hourGan]]++;
  if (ZHI_WUXING[hourZhi]) wuxing[ZHI_WUXING[hourZhi]]++;

  return wuxing;
}

// 分析五行平衡
function analyzeWuxingBalance(wuxing, gender, bazi) {
  const total = Object.values(wuxing).reduce((sum, v) => sum + v, 0);
  const analysis = {
    wuxingCount: { ...wuxing },
    wuxingPercent: {},
    dayMaster: null,
    strongOrWeak: null,
    favorableElements: [],
    unfavorableElements: [],
  };

  // 计算百分比
  for (const [key, value] of Object.entries(wuxing)) {
    analysis.wuxingPercent[key] = total > 0 ? (value / total * 100).toFixed(1) : 0;
  }

  // 判断日主强弱（简化版）
  // 日主为日柱天干
  const dayGan = bazi ? bazi.dayGanZhi.charAt(0) : '戊';
  const dayMasterElement = GAN_WUXING[dayGan] || 'earth';
  analysis.dayMaster = dayMasterElement;

  // 计算生扶力量和克泄力量
  let shengLi = 0; // 生扶力量
  let keXieLi = 0; // 克泄力量

  for (const [element, count] of Object.entries(wuxing)) {
    if (count === 0) continue;

    // 生日主的五行
    if (WUXING_SHENG[element] === dayMasterElement) {
      shengLi += count;
    }
    // 同类
    if (element === dayMasterElement) {
      shengLi += count;
    }
    // 克日主的五行
    if (WUXING_KE[element] === dayMasterElement) {
      keXieLi += count;
    }
    // 日主克的五行
    if (WUXING_KE[dayMasterElement] === element) {
      keXieLi += count;
    }
  }

  analysis.strongOrWeak = shengLi > keXieLi ? 'strong' : 'weak';

  // 确定喜用神和忌神
  if (analysis.strongOrWeak === 'strong') {
    // 身强喜克泄耗
    analysis.favorableElements = [
      WUXING_KE[dayMasterElement],
      WUXING_SHENG[WUXING_KE[dayMasterElement]],
      WUXING_SHENG[dayMasterElement],
    ];
    analysis.unfavorableElements = [dayMasterElement, WUXING_SHENG[dayMasterElement]];
  } else {
    // 身弱喜生扶
    analysis.favorableElements = [dayMasterElement, WUXING_SHENG[dayMasterElement]];
    analysis.unfavorableElements = [
      WUXING_KE[dayMasterElement],
      WUXING_SHENG[WUXING_KE[dayMasterElement]],
    ];
  }

  return analysis;
}

// 获取五行属性
function getWuxingElement(element) {
  return WUXING_NAMES[element] || '未知';
}

module.exports = {
  calculateWuxing,
  analyzeWuxingBalance,
  getWuxingElement,
  GAN_WUXING,
  ZHI_WUXING,
  WUXING_SHENG,
  WUXING_KE,
  WUXING_NAMES,
};
