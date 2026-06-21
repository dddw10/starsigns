// 双人八字配对（合婚）算法
const { convertSolarToLunar } = require('./lunar');
const { calculateBazi } = require('./index');
const { 
  calculateWuxing, 
  analyzeWuxingBalance, 
  GAN_WUXING, 
  ZHI_WUXING, 
  WUXING_NAMES, 
  WUXING_SHENG, 
  WUXING_KE 
} = require('./wuxing');

const RELATION_TYPE_ZH = {
  love: '姻缘合婚',
  business: '合伙求财',
  friend: '志趣社交'
};

const ZODIAC_NAMES = {
  '子': '鼠', '丑': '牛', '寅': '虎', '卯': '兔',
  '辰': '龙', '巳': '蛇', '午': '马', '未': '羊',
  '申': '猴', '酉': '鸡', '戌': '狗', '亥': '猪'
};

// 地支六合
const ZHI_LIU_HE = {
  '子': '丑', '丑': '子', '寅': '亥', '亥': '寅',
  '卯': '戌', '戌': '卯', '辰': '酉', '酉': '辰',
  '巳': '申', '申': '巳', '午': '未', '未': '午'
};

// 地支三合组
const ZHI_SAN_HE_GROUPS = [
  ['申', '子', '辰'],
  ['亥', '卯', '未'],
  ['寅', '午', '戌'],
  ['巳', '酉', '丑']
];

// 地支六冲
const ZHI_LIU_CHONG = {
  '子': '午', '午': '子', '丑': '未', '未': '丑',
  '寅': '申', '申': '寅', '卯': '酉', '酉': '卯',
  '辰': '戌', '戌': '辰', '巳': '亥', '亥': '巳'
};

// 地支六害
const ZHI_LIU_HAI = {
  '子': '未', '未': '子', '丑': '午', '午': '丑',
  '寅': '巳', '巳': '寅', '卯': '辰', '辰': '卯',
  '申': '亥', '亥': '申', '酉': '戌', '戌': '酉'
};

// 多元化合婚场景建议库 (动态三段式拼接以保证不重复)
const BAZI_COMPATIBILITY_ADVICE = {
  love: {
    good: {
      open: [
        '姻缘契合：乾坤和合，良缘天定。你们的八字五行磁场流转有情，呈现出极佳的互相生旺格局。',
        '姻缘契合：鸾凤呈祥，五行交泰。两人的命格在日干与夫妻宫上展现了深层的心灵引力，日常相处顺遂愉快。'
      ],
      scenario: [
        '在居家生活中，你们的行事节奏与精神需求高度契合，一方的包容能巧妙融化另一方的坚硬，共同抵御现实的风雨。',
        '关于理财、消费和家庭建设的探讨上，你们极易达成一致，彼此不仅是深情的情侣，更是人生路上的黄金合伙人。'
      ],
      action: [
        '建议在卧室布置中增加一些暖色调的绿植，并在日常中多进行户外旅行，促进八字木火磁场的进一步融合。',
        '每逢流年太岁有所波动时，可以利用对方的喜用神进行“气场中和”，各自佩戴其所喜的玉石饰物，能保运势稳健。'
      ]
    },
    neutral: {
      open: [
        '姻缘契合：中吉平和，细水长流。双方八字虽有局部的相克磨合，但五行总体趋于均衡，属于平淡隽永的格局。',
        '姻缘契合：磨炼雕琢，渐入佳境。两人的性格各具鲜明的特色，相处初期伴随着思想的火花与生活细节的碰撞。'
      ],
      scenario: [
        '日常交往中，可能会因为作息习惯、家务分配或人情往来产生小口角，但只要坦诚交流，这些磨砺反而会促使性格成熟。',
        '在面临重大家庭财务或买房决策时，双方容易有不同的偏向，需要各自收敛执着，理智评估。'
      ],
      action: [
        '建议在相处中保持一定的个人空间与精神独立，这就像构筑了磁场堤坝，能极佳地化解八字细节中的冲克力。',
        '可在家中摆放泥陶艺术品或淡蓝色的加湿器，这在风水能量上起到桥梁作用，疏导双方的克性，增进互信。'
      ]
    },
    conflict: {
      open: [
        '姻缘契合：命理磨砺，和光同尘。由于双方夫妻宫存在克冲，性格特质和家庭观念差异极大，需要下很大功夫磨合。',
        '姻缘契合：逆流而上，宜温克刚。八字中的冲制关系预示着你们在一起时容易激发彼此潜在的心气与倔强。'
      ],
      scenario: [
        '一旦涉及原则问题，双方容易陷入言语犀利或陷入冷战，这会对彼此的感情和情绪价值造成一定的内耗消耗。',
        '在涉及双方长辈关系或日常开销规划上，极易因为视角不同而产生分歧，感情容易大起大落。'
      ],
      action: [
        '吵架时切忌在气头上做任何决定，建议立下“吵架不过夜”的书面契约，用温和的拥抱消解磁场的对立。',
        '建议在居室的西南方向摆放铜质风铃，或者在家中多引入米色、咖色的软装，能从环境物理学上极佳地调和刑冲气场。'
      ]
    }
  },
  business: {
    good: {
      open: [
        '合作契合：强强联手，财源广进。双方八字互补性极强，一方所喜正是另一方所旺，能够起到极佳的创富共振。',
        '合作契合：生财有道，默契无间。在商业运筹上，你们在决策大局与执行细节上有着天然的优势互补。'
      ],
      scenario: [
        '在拓展外部市场或商务谈判时，一攻一防，配合默契，能够轻易抓住商业转折点，规避投资盲区。',
        '在内部治理和财务分配上，能保持极高的信任度，以事实和规章说话，实现公司规模的阶梯式扩张。'
      ],
      action: [
        '在分工上，建议身强的一方负责前方的业务公关与市场拓展，而八字喜印比的一方负责财务内控，责权清晰。',
        '平时可多以非正式的茶叙进行长远战略探讨，放松的能量场有利于你们推演出极富商业价值的项目。'
      ]
    },
    neutral: {
      open: [
        '合作契合：合伙守成，步步为营。双方磁场交互一般，属于在条条框框的合同下能够平稳运作的常规搭配。',
        '合作契合：利弊并存，谋划后动。由于八字中存在一定的五行劫夺，合作过程中需注重规章和股权细化。'
      ],
      scenario: [
        '在运营思路上面临选择时，可能会产生不同的业务偏好。一人想激进投资，一人想保守观望，沟通成本偏高。',
        '虽然能维持基本的合伙关系，但随着收益的增加，细节矛盾也会浮出水面，需要透明度支撑。'
      ],
      action: [
        '必须建立清晰的书面分红与股权流转契约，引入合规的法律和第三方财务审计，规避一切口头人情账。',
        '重大商业决策前给彼此三天缓冲期，各自进行风险研判，能够最大化弥补你们八字命理中的决策盲区。'
      ]
    },
    conflict: {
      open: [
        '合作契合：规则至上，防微杜渐。双方八字干支相冲较多，合作容易产生各执己见、内耗严重的倾向。',
        '合作契合：气场磨折，宜清责任。命理冲突会导致在合伙过程中，对利益分配和管理权极其敏感。'
      ],
      scenario: [
        '极易因账目细节、客户归属或业务话语权发生正面碰撞，使得项目进程频频受阻，甚至产生信任危机。',
        '商业思路完全相悖，一方面的退让往往积攒成怨言，极易在中途面临拆伙的商业危机。'
      ],
      action: [
        '只适合各自独立管辖互不干扰的项目，并在收益计算上实行彻底的承包制或独立核算制。',
        '在合作空间多使用黄色与白色的软装，或佩戴生肖贵人饰物，以减弱地支相冲对合作气场带来的冲击。'
      ]
    }
  }
};

/**
 * 伪随机生成器
 */
function getSeededRandom(seedStr) {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = seedStr.charCodeAt(i) + ((hash << 5) - hash);
  }
  return () => {
    const x = Math.sin(hash++) * 10000;
    return x - Math.floor(x);
  };
}

/**
 * 双人八字配对主算法
 */
function doubleBaziAnalysis(data) {
  const { 
    name1 = '自身', 
    solarDate1, 
    birthTime1, 
    gender1, 
    name2 = '对方', 
    solarDate2, 
    birthTime2, 
    gender2,
    relationType = 'love' 
  } = data;

  // 1. 分别获取双方八字与五行
  const lunar1 = convertSolarToLunar(solarDate1);
  const lunar2 = convertSolarToLunar(solarDate2);

  const bazi1 = calculateBazi(lunar1, birthTime1);
  const bazi2 = calculateBazi(lunar2, birthTime2);

  const wuxing1 = calculateWuxing(bazi1);
  const wuxing2 = calculateWuxing(bazi2);

  const balance1 = analyzeWuxingBalance(wuxing1, gender1, bazi1);
  const balance2 = analyzeWuxingBalance(wuxing2, gender2, bazi2);

  // 2. 日干相合/相生克分析
  const dayGan1 = bazi1.dayGanZhi.charAt(0);
  const dayGan2 = bazi2.dayGanZhi.charAt(0);
  const dayGanWx1 = GAN_WUXING[dayGan1] || 'earth';
  const dayGanWx2 = GAN_WUXING[dayGan2] || 'earth';

  let ganScore = 15;
  let ganReason = '';
  let isGanCombined = false;

  // 天干五合
  const ganPair = [dayGan1, dayGan2].sort().join('');
  const tianGanCombinations = {
    '甲己': '甲己中正之合：甲木仁慈挺拔，己土厚德宽容，双方在交往中互相尊重，相得益彰。这是一段以稳定和信任为基础的佳配。',
    '乙庚': '乙庚仁义之合：乙木柔顺温婉，庚金刚毅果断，双方互补性极强。不仅能在生活中互相关爱，更能在关键时刻共同承担现实压力。',
    '丙辛': '丙辛威制之合：丙火热情光芒，辛金坚韧玲珑，水火相济，能够碰撞出极富吸引力的激情火花，是极具活力与浪漫色彩的搭配。',
    '丁壬': '丁壬仁寿木之合：丁火温婉柔顺，壬水浩大奔流，水火交融，气场在不知不觉中交融无间，拥有深厚的默契与精神共振。',
    '戊癸': '戊癸水火相济之合：戊土沉稳大度，癸水灵动细腻，一刚一柔，相处时极富趣味性，能够和谐包容彼此的缺点。'
  };

  if (tianGanCombinations[ganPair]) {
    ganScore = 25;
    ganReason = tianGanCombinations[ganPair];
    isGanCombined = true;
  } else if (WUXING_SHENG[dayGanWx1] === dayGanWx2 || WUXING_SHENG[dayGanWx2] === dayGanWx1) {
    ganScore = 20;
    ganReason = `天干相生（${WUXING_NAMES[dayGanWx1]}生${WUXING_NAMES[dayGanWx2]}）：双方核心气场构成生助反哺。一方向另一方默默倾注关怀与支持，形成极佳的情绪慰藉，感情深厚温暖。`;
  } else if (dayGanWx1 === dayGanWx2) {
    ganScore = 15;
    ganReason = `天干同气（双${WUXING_NAMES[dayGanWx1]}）：双方核心主张高度一致，脾气性情相似，有聊不完的共同话题，在作决定时很容易达成心理共识。`;
  } else {
    ganScore = 10;
    ganReason = `天干相克（${WUXING_NAMES[dayGanWx1]}与${WUXING_NAMES[dayGanWx2]}克制）：核心思维上存在主导与受制。克制在八字上也是一种雕琢，意味着双方思考问题角度迥异，能互相监督，需在言语上多加宽容。`;
  }

  // 3. 夫妻宫地支相合/刑冲克分析
  const dayZhi1 = bazi1.dayGanZhi.charAt(1);
  const dayZhi2 = bazi2.dayGanZhi.charAt(1);
  const dayZhiWx1 = ZHI_WUXING[dayZhi1] || 'earth';
  const dayZhiWx2 = ZHI_WUXING[dayZhi2] || 'earth';

  let zhiScore = 15;
  let zhiReason = '';

  // 地支六合
  if (ZHI_LIU_HE[dayZhi1] === dayZhi2) {
    zhiScore = 25;
    zhiReason = `夫妻宫呈现【六合】大吉。这意味着你们在居家生活、习惯爱好与情感契合上具有极其高度的同步率。日常相处默契十足，生活温馨。`;
  } 
  // 地支三合
  else if (checkZhiSanHe(dayZhi1, dayZhi2)) {
    zhiScore = 20;
    zhiReason = `夫妻宫呈现【三合】格局。代表着两人的内在需求、家庭观念能完美契合，家庭结构极其稳固，能在生活中同舟共济。`;
  }
  // 地支六冲
  else if (ZHI_LIU_CHONG[dayZhi1] === dayZhi2) {
    zhiScore = 5;
    zhiReason = `夫妻宫呈现【六冲】冲击。这意味着在日常居家生活习惯（如作息、饮食、家庭开支）上存在显著的差异，较易产生口舌冲突。需学会尊重各自的独立空间，求同存异。`;
  }
  // 地支六害
  else if (ZHI_LIU_HAI[dayZhi1] === dayZhi2) {
    zhiScore = 8;
    zhiReason = `夫妻宫地支存在【六害】隐疾。这表示在细节沟通中容易因为信息不对称或胡思乱想产生无端的猜忌。要多些坦诚沟通，忌猜疑冷战。`;
  }
  // 地支相生或比和
  else if (WUXING_SHENG[dayZhiWx1] === dayZhiWx2 || WUXING_SHENG[dayZhiWx2] === dayZhiWx1) {
    zhiScore = 15;
    zhiReason = `夫妻宫呈现五行相生。日常生活中能互帮互助，一方乐于为另一方打理家庭琐事，生活氛围比较融洽。`;
  } else {
    zhiScore = 10;
    zhiReason = `夫妻宫五行比和。相处中行事做派风格相近，对家庭生活环境的需求相似，平淡中见真情。`;
  }

  // 4. 生肖合配度
  const yearZhi1 = bazi1.yearGanZhi.charAt(1);
  const yearZhi2 = bazi2.yearGanZhi.charAt(1);
  const zodiac1 = ZODIAC_NAMES[yearZhi1];
  const zodiac2 = ZODIAC_NAMES[yearZhi2];

  let zodiacScore = 10;
  let zodiacReason = '';

  if (ZHI_LIU_HE[yearZhi1] === yearZhi2) {
    zodiacScore = 15;
    zodiacReason = `生肖呈【六合】。属${zodiac1}与属${zodiac2}为天然合配，初次相识便极易产生亲近感，社会社交关系良好。`;
  } else if (checkZhiSanHe(yearZhi1, yearZhi2)) {
    zodiacScore = 12;
    zodiacReason = `生肖呈【三合】。属${zodiac1}与属${zodiac2}组合大吉，朋友圈子与外在交际非常合拍，有利于事业和家运。`;
  } else if (ZHI_LIU_CHONG[yearZhi1] === yearZhi2) {
    zodiacScore = 4;
    zodiacReason = `生肖存在【六冲】。属${zodiac1}与属${zodiac2}生肖相冲，脾气脾性差异极大，初相处时可能在表达方式上有一定摩擦。`;
  } else if (ZHI_LIU_HAI[yearZhi1] === yearZhi2) {
    zodiacScore = 6;
    zodiacReason = `生肖存在【六害】。属${zodiac1}与属${zodiac2}相害，防范因为外部流言蜚语干扰彼此的信任，宜一致对外。`;
  } else {
    zodiacScore = 10;
    zodiacReason = `生肖运势平和。属${zodiac1}与属${zodiac2}缘分平稳，不存在相克，平淡相守即可。`;
  }

  // 5. 五行喜忌互补计算 (极富科学感的量化分析)
  let complementScore = 15;
  let complementReason = '';
  
  // 计算两人的五行喜用神重合度与能量流动
  const fav1 = balance1.favorableElements; // 人1喜用神
  const fav2 = balance2.favorableElements; // 人2喜用神
  
  let p1FavProvidedByp2 = 0;
  let p2FavProvidedByp1 = 0;
  
  fav1.forEach(el => {
    p1FavProvidedByp2 += (wuxing2[el] || 0);
  });
  fav2.forEach(el => {
    p2FavProvidedByp1 += (wuxing1[el] || 0);
  });

  const totalInterchange = p1FavProvidedByp2 + p2FavProvidedByp1;
  
  if (totalInterchange >= 6) {
    complementScore = 25;
    complementReason = `五行喜忌极佳互补。经量化计算，你们的“能量交换系数”高达${(totalInterchange * 15).toFixed(0)}%。【${name1}】八字喜用神属【${fav1.map(el => WUXING_NAMES[el]).join('/')}】，而【${name2}】八字中蕴含着丰沛的【${fav1.map(el => WUXING_NAMES[el]).join('/')}】能量；同理，【${name2}】所喜五行在【${name1}】命格中同样旺盛。这种互补关系相当于彼此天然的“运势充能站”，能有效化解各自流年的颓势。`;
  } else if (totalInterchange >= 3) {
    complementScore = 20;
    complementReason = `五行喜忌有情互补。你们的“能量交换系数”约为${(totalInterchange * 15).toFixed(0)}%。其中一方的命理五行气场，对另一方具有不错的滋养与稳定作用。日常相处能够带给彼此情绪和运气的正向引导。`;
  } else {
    complementScore = 12;
    complementReason = `五行气场相对独立。你们的“能量交换系数”在${(totalInterchange * 15).toFixed(0)}%左右。五行气场上交集偏弱，喜忌重合较少。这表明在运势上彼此没有太大的拉扯和消耗，各自保持独立的运程，宜各自安好。`;
  }

  // 6. 综合评分计算 (限制在 40 - 99 之间)
  const baseScore = ganScore + zhiScore + zodiacScore + complementScore + 18;
  const finalScore = Math.min(99, Math.max(40, baseScore));

  // 星级判定
  let rating = 3;
  if (finalScore >= 90) rating = 5;
  else if (finalScore >= 80) rating = 4;
  else if (finalScore >= 65) rating = 3;
  else if (finalScore >= 50) rating = 2;
  else rating = 1;

  // 7. 动态合婚批文组装
  let rType = relationType;
  if (rType !== 'love' && rType !== 'business') rType = 'love';
  
  let tone = 'neutral';
  if (finalScore >= 80) tone = 'good';
  else if (finalScore < 65) tone = 'conflict';

  const adviceParts = BAZI_COMPATIBILITY_ADVICE[rType][tone];
  
  const seedStr = `${name1}${name2}${solarDate1}${solarDate2}${relationType}`;
  const rand = getSeededRandom(seedStr);
  const selectRandom = (arr) => arr[Math.floor(rand() * arr.length)];

  const adviceText = `${selectRandom(adviceParts.open)}${selectRandom(adviceParts.scenario)}${selectRandom(adviceParts.action)}`;

  // 8. 物理风水能量调和建议
  const harmonizerMap = {
    metal: { lucky: '白色/银灰色饰物', element: '金属', direction: '西方', item: '铜质葫芦' },
    wood: { lucky: '绿色/青蓝色衣服', element: '木植', direction: '东方', item: '六杆富贵竹' },
    water: { lucky: '深蓝/黑色水洗色系', element: '水流', direction: '北方', item: '小型循环喷泉' },
    fire: { lucky: '朱红/浅紫色挂件', element: '光热', direction: '南方', item: '红色中国结挂件' },
    earth: { lucky: '琥珀/土黄色陶瓷', element: '土石', direction: '东北或西南方', item: '水晶原石或陶瓷花瓶' }
  };

  // 以双方喜用神为基准推荐气场中和物
  const primaryFav1 = fav1[0] || 'earth';
  const primaryFav2 = fav2[0] || 'earth';
  const h1 = harmonizerMap[primaryFav1];
  const h2 = harmonizerMap[primaryFav2];

  // 9. 拼接最终科学严谨的报告
  let report = `☯️ 【${name1}】与【${name2}】双人生辰八字合婚报告（${RELATION_TYPE_ZH[relationType] || '命理合婚'}） ☯️\n\n`;

  // 命格基础排盘
  report += `【双方天命八字排盘】\n`;
  report += `· 【${name1}】八字：${bazi1.yearGanZhi}年 ${bazi1.monthGanZhi}月 ${bazi1.dayGanZhi}日 ${bazi1.hourGanZhi}时（日主属：${WUXING_NAMES[dayGanWx1]}）\n`;
  report += `· 【${name2}】八字：${bazi2.yearGanZhi}年 ${bazi2.monthGanZhi}月 ${bazi2.dayGanZhi}日 ${bazi2.hourGanZhi}时（日主属：${WUXING_NAMES[dayGanWx2]}）\n\n`;

  // 五行占比百分制
  report += `【双方五行能量量化比对】\n`;
  report += `· 【${name1}】：`;
  report += Object.entries(wuxing1).map(([k, v]) => `${WUXING_NAMES[k]}(${(v/8*100).toFixed(0)}%)`).join(' | ') + `；状态：身${balance1.strongOrWeak === 'strong' ? '强' : '弱'}\n`;
  report += `· 【${name2}】：`;
  report += Object.entries(wuxing2).map(([k, v]) => `${WUXING_NAMES[k]}(${(v/8*100).toFixed(0)}%)`).join(' | ') + `；状态：身${balance2.strongOrWeak === 'strong' ? '强' : '弱'}\n\n`;

  // 日干契合之理
  report += `【第一轨：日干灵魂契合】\n`;
  report += `· 命理释意：${ganReason}\n\n`;

  // 夫妻宫互动机制
  report += `【第二轨：夫妻宫居家和谐】\n`;
  report += `· 命理释意：${zhiReason}\n\n`;

  // 生肖外在互动
  report += `【第三轨：生肖交际缘分】\n`;
  report += `· 命理释意：${zodiacReason}\n\n`;

  // 喜用神互补机制
  report += `【第四轨：五行喜忌能量互补】\n`;
  report += `· 能量流转：${complementReason}\n\n`;

  // 场景实战建议
  report += `【${RELATION_TYPE_ZH[relationType]}场景交互批注】\n`;
  report += `· ${adviceText}\n\n`;

  // 天书批注与调和
  report += `【契合度天书批注】\n`;
  report += `本次八字合婚综合测算评分为：${finalScore}分。\n`;
  if (finalScore >= 88) {
    report += `· 上上大吉：八字有情，天作之合。你们的主轴五行相生，夫妻宫契合，生活理念极易共鸣，是能够互相滋养、共度一生的极佳搭配。\n`;
  } else if (finalScore >= 70) {
    report += `· 中吉平和：数理清吉，细水长流。虽然命盘细节中有零星克制，但不伤大局。只要日常多沟通包容，必能家和万事兴。\n`;
  } else {
    report += `· 磨合历练：五行克冲，缘分有磨。双方八字在地支或生肖上存在冲突，行事风格和表达方式差异大。需要各自克制脾气，以柔克刚，相敬如宾，同样能共白头。\n`;
  }
  
  // 气场物理调和
  report += `· 科学气场调和建议：建议平时【${name1}】多搭配【${h1.lucky}】，并在家中的【${h1.direction}】摆放【${h1.item}】；【${name2}】多搭配【${h2.lucky}】，并在家中的【${h2.direction}】摆放【${h2.item}】。通过微观环境能量学疏通八字相制，能对双方的情感与财运产生良好的调和作用。`;

  return {
    score: finalScore,
    rating,
    analysis: report,
    bazi1,
    bazi2,
    wuxing1,
    wuxing2
  };
}

/**
 * 判断两个地支是否同在一个三合局中
 */
function checkZhiSanHe(zhi1, zhi2) {
  for (const group of ZHI_SAN_HE_GROUPS) {
    if (group.includes(zhi1) && group.includes(zhi2)) {
      return true;
    }
  }
  return false;
}

module.exports = {
  doubleBaziAnalysis
};
