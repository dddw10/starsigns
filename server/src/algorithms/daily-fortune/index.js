// 每日运势生成算法

// 天干五行对应
const GAN_WUXING = {
  '甲': 'wood', '乙': 'wood',
  '丙': 'fire', '丁': 'fire',
  '戊': 'earth', '己': 'earth',
  '庚': 'metal', '辛': 'metal',
  '壬': 'water', '癸': 'water',
};

// 天干
const TIAN_GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];

// 地支
const DI_ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

// 五行运势描述
const FORTUNE_BY_ELEMENT = {
  metal: {
    excellent: '今日金气旺盛，适合做重要决定，投资理财有好运。',
    good: '今日金气适中，工作顺利，人际关系和谐。',
    normal: '今日金气平平，按部就班即可，不宜冒险。',
    bad: '今日金气受克，避免冲动消费，注意言辞。',
    terrible: '今日金气衰弱，宜静不宜动，多休息。',
  },
  wood: {
    excellent: '今日木气旺盛，创造力爆棚，适合开展新项目。',
    good: '今日木气适中，学习工作有进步，心情愉快。',
    normal: '今日木气平平，保持现状，不宜大动作。',
    bad: '今日木气受克，注意肝胆健康，避免熬夜。',
    terrible: '今日木气衰弱，精神不振，宜多休息。',
  },
  water: {
    excellent: '今日水气旺盛，思维敏捷，适合学习和创作。',
    good: '今日水气适中，社交顺利，有意外收获。',
    normal: '今日水气平平，正常发挥即可，不必强求。',
    bad: '今日水气受克，注意肾脏健康，避免过度劳累。',
    terrible: '今日水气衰弱，灵感枯竭，宜放松心情。',
  },
  fire: {
    excellent: '今日火气旺盛，热情高涨，适合表现自我。',
    good: '今日火气适中，工作效率高，得到认可。',
    normal: '今日火气平平，保持平常心，不宜急躁。',
    bad: '今日火气受克，注意心脏健康，避免剧烈运动。',
    terrible: '今日火气衰弱，情绪低落，宜静心修养。',
  },
  earth: {
    excellent: '今日土气旺盛，稳重踏实，适合处理重要事务。',
    good: '今日土气适中，人际关系稳定，合作顺利。',
    normal: '今日土气平平，按计划行事，不宜变动。',
    bad: '今日土气受克，注意脾胃健康，饮食规律。',
    terrible: '今日土气衰弱，做事不顺，宜耐心等待。',
  },
};

// 幸运颜色
const LUCKY_COLORS = {
  metal: ['白色', '银色', '金色'],
  wood: ['绿色', '青色', '翠色'],
  water: ['蓝色', '黑色', '深灰色'],
  fire: ['红色', '紫色', '橙色'],
  earth: ['黄色', '棕色', '咖啡色'],
};

// 幸运数字
const LUCKY_NUMBERS = {
  metal: [4, 9],
  wood: [3, 8],
  water: [1, 6],
  fire: [2, 7],
  earth: [5, 0],
};

// 宜忌活动
const YIJI_BY_ELEMENT = {
  metal: {
    yi: ['签约', '谈判', '投资', '购物', '理发'],
    ji: ['争吵', '冲动消费', '熬夜', '远行'],
  },
  wood: {
    yi: ['学习', '创作', '种植', '运动', '聚会'],
    ji: ['酗酒', '暴怒', '熬夜', '高风险投资'],
  },
  water: {
    yi: ['社交', '旅行', '约会', '学习', '冥想'],
    ji: ['赌博', '冒险', '熬夜', '过度劳累'],
  },
  fire: {
    yi: ['表演', '演讲', '约会', '运动', '表白'],
    ji: ['争吵', '冒险', '熬夜', '辛辣食物'],
  },
  earth: {
    yi: ['签约', '搬家', '装修', '存钱', '聚餐'],
    ji: ['投机', '冲动决策', '熬夜', '暴饮暴食'],
  },
};

// 根据日期生成每日运势
function generateDailyFortune(birthInfo, date) {
  const targetDate = date || new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [year, month, day] = targetDate.split('-').map(Number);

  // 计算当日五行属性（简化算法）
  const dayElement = calculateDayElement(year, month, day);

  // 生成运势分数
  const score = generateScore(birthInfo, dayElement, year, month, day);

  // 确定运势等级与星级
  let level;
  let rating;
  if (score >= 90) {
    level = 'excellent';
    rating = 5;
  } else if (score >= 75) {
    level = 'good';
    rating = 4;
  } else if (score >= 60) {
    level = 'normal';
    rating = 3;
  } else if (score >= 40) {
    level = 'bad';
    rating = 2;
  } else {
    level = 'terrible';
    rating = 1;
  }

  // 生成运势描述
  const fortune = FORTUNE_BY_ELEMENT[dayElement][level];

  // 生成各维度运势
  const dimensions = generateDimensions(score, dayElement, year + month + day);

  // 生成幸运元素
  const luckyColorName = LUCKY_COLORS[dayElement][Math.floor(Math.random() * 3)];
  const LUCKY_COLOR_HEX = {
    '白色': '#7f8c8d', // 使用深一点的灰色/白色，避免白色文字在白色背景上看不清
    '银色': '#95a5a6',
    '金色': '#d35400',
    '绿色': '#27ae60',
    '青色': '#16a085',
    '翠色': '#2ecc71',
    '蓝色': '#2980b9',
    '黑色': '#2c3e50',
    '深灰色': '#7f8c8d',
    '红色': '#c41e3a',
    '紫色': '#8e44ad',
    '橙色': '#d35400',
    '黄色': '#f39c12',
    '棕色': '#d35400',
    '咖啡色': '#8b5a2b',
  };
  const luckyColor = LUCKY_COLOR_HEX[luckyColorName] || '#c41e3a';
  const luckyNumber = LUCKY_NUMBERS[dayElement][Math.floor(Math.random() * 2)];

  // 生成宜忌
  const yiji = YIJI_BY_ELEMENT[dayElement] || YIJI_BY_ELEMENT.earth;
  const yi = yiji.yi.slice(0, 3);
  const ji = yiji.ji.slice(0, 3);

  return {
    date: targetDate,
    score,
    level,
    rating,
    overall: fortune,
    career: dimensions.career,
    wealth: dimensions.wealth,
    love: dimensions.love,
    health: dimensions.health,
    luckyNumber,
    luckyColor,
    luckyColorName,
    dayElement,
    yi,
    ji,
  };
}

// 计算当日五行属性（使用日柱天干）
function calculateDayElement(year, month, day) {
  // 使用日柱天干计算，更准确
  const date = new Date(year, month - 1, day);
  const baseDate = new Date(1900, 0, 1);
  const days = Math.floor((date - baseDate) / (24 * 60 * 60 * 1000));
  const ganIndex = (days + 9) % 10;
  const dayGan = TIAN_GAN[ganIndex];
  return GAN_WUXING[dayGan] || 'earth';
}

// 生成运势分数
function generateScore(birthInfo, dayElement, year, month, day) {
  let baseScore = 60;

  // 如果有八字信息，根据日主和当日五行的关系调整
  if (birthInfo && birthInfo.dayMaster) {
    const dayMasterElement = birthInfo.dayMaster;
    const WUXING_SHENG = {
      'metal': 'water', 'water': 'wood', 'wood': 'fire',
      'fire': 'earth', 'earth': 'metal',
    };

    // 同类
    if (dayMasterElement === dayElement) {
      baseScore += 15;
    }
    // 生我
    else if (WUXING_SHENG[dayElement] === dayMasterElement) {
      baseScore += 20;
    }
    // 我生
    else if (WUXING_SHENG[dayMasterElement] === dayElement) {
      baseScore -= 5;
    }
    // 克我
    else if (WUXING_SHENG[WUXING_SHENG[dayElement]] === dayMasterElement) {
      baseScore -= 15;
    }
  }

  // 根据日期生成随机波动
  const dateSeed = (year * 366 + month * 31 + day) % 100;
  const fluctuation = Math.floor(dateSeed / 10) - 5;
  baseScore += fluctuation;

  // 限制范围
  return Math.max(30, Math.min(100, baseScore));
}

// 生成各维度运势
function generateDimensions(score, dayElement, seed) {
  // 使用种子生成伪随机数
  const random = (s) => {
    const x = Math.sin(s) * 10000;
    return x - Math.floor(x);
  };

  const adjustScore = (base, offset) => {
    return Math.max(30, Math.min(100, base + Math.floor(random(seed + offset) * 20) - 10));
  };

  const careerScore = adjustScore(score, 1);
  const wealthScore = adjustScore(score, 2);
  const loveScore = adjustScore(score, 3);
  const healthScore = adjustScore(score, 4);

  // 五行对应的各维度描述
  const CAREER_DESC = {
    metal: {
      high: '果断决策带来突破，适合谈判签约。',
      mid: '工作按计划推进，与同事协作顺畅。',
      low: '避免冲动决策，多听取他人意见。',
    },
    wood: {
      high: '创意灵感涌现，适合头脑风暴。',
      mid: '学习进修有收获，技能提升明显。',
      low: '工作压力较大，注意劳逸结合。',
    },
    water: {
      high: '沟通能力出众，社交场合有收获。',
      mid: '思维清晰，适合处理复杂问题。',
      low: '避免过度承诺，量力而行。',
    },
    fire: {
      high: '热情感染他人，领导力凸显。',
      mid: '工作效率高，任务完成顺利。',
      low: '控制情绪，避免与人争执。',
    },
    earth: {
      high: '稳扎稳打收获成果，适合长期项目。',
      mid: '踏实做事，细节处理到位。',
      low: '保持耐心，不宜急于求成。',
    },
  };

  const WEALTH_DESC = {
    metal: {
      high: '投资理财有眼光，正偏财皆旺。',
      mid: '收支平衡，理性消费。',
      low: '控制开支，避免冲动购物。',
    },
    wood: {
      high: '新的赚钱机会出现，可大胆尝试。',
      mid: '收入稳定，有小额进账。',
      low: '保守理财，不宜高风险投资。',
    },
    water: {
      high: '意外之财有望，偏财运佳。',
      mid: '收入平稳，积少成多。',
      low: '谨慎借贷，避免财务纠纷。',
    },
    fire: {
      high: '事业带动财运，升职加薪可期。',
      mid: '正财稳定，付出有回报。',
      low: '开源节流，做好财务规划。',
    },
    earth: {
      high: '长期投资见回报，资产增值。',
      mid: '稳健理财，细水长流。',
      low: '量入为出，储备应急资金。',
    },
  };

  const LOVE_DESC = {
    metal: {
      high: '魅力四射，异性缘旺，适合表白。',
      mid: '感情稳定，与伴侣默契十足。',
      low: '多些耐心，给彼此空间。',
    },
    wood: {
      high: '浪漫氛围浓厚，适合约会。',
      mid: '感情和谐，沟通顺畅。',
      low: '主动关心对方，增进感情。',
    },
    water: {
      high: '桃花运旺，单身者有望脱单。',
      mid: '感情细腻，互相理解。',
      low: '避免猜疑，坦诚沟通。',
    },
    fire: {
      high: '热情洋溢，感情升温。',
      mid: '相处融洽，甜蜜温馨。',
      low: '控制脾气，多包容对方。',
    },
    earth: {
      high: '感情踏实，适合规划未来。',
      mid: '平稳相伴，细水长流。',
      low: '制造惊喜，增添生活情趣。',
    },
  };

  const HEALTH_DESC = {
    metal: {
      high: '精力充沛，身体状态极佳。',
      mid: '注意呼吸系统，保持运动。',
      low: '多休息，避免过度劳累。',
    },
    wood: {
      high: '肝胆顺畅，心情舒畅。',
      mid: '适当运动，保持良好作息。',
      low: '少熬夜，多吃绿色蔬菜。',
    },
    water: {
      high: '肾气充足，思维敏捷。',
      mid: '多喝水，注意保暖。',
      low: '避免久坐，活动筋骨。',
    },
    fire: {
      high: '心血管健康，活力满满。',
      mid: '保持心情愉快，适度运动。',
      low: '控制情绪，避免剧烈运动。',
    },
    earth: {
      high: '脾胃健康，消化良好。',
      mid: '饮食规律，适当运动。',
      low: '清淡饮食，避免暴饮暴食。',
    },
  };

  const getScoreLevel = (s) => {
    if (s >= 80) return 'high';
    if (s >= 50) return 'mid';
    return 'low';
  };

  const getScoreDesc = (s) => {
    if (s >= 80) return '运势极佳';
    if (s >= 60) return '运势不错';
    if (s >= 40) return '运势平平';
    return '运势欠佳';
  };

  const element = dayElement || 'earth';
  const careerLevel = getScoreLevel(careerScore);
  const wealthLevel = getScoreLevel(wealthScore);
  const loveLevel = getScoreLevel(loveScore);
  const healthLevel = getScoreLevel(healthScore);

  return {
    career: `${getScoreDesc(careerScore)} ${CAREER_DESC[element][careerLevel]}`,
    wealth: `${getScoreDesc(wealthScore)} ${WEALTH_DESC[element][wealthLevel]}`,
    love: `${getScoreDesc(loveScore)} ${LOVE_DESC[element][loveLevel]}`,
    health: `${getScoreDesc(healthScore)} ${HEALTH_DESC[element][healthLevel]}`,
  };
}

module.exports = {
  generateDailyFortune,
  calculateDayElement,
};
