const Fortune = require('../models/Fortune');
const User = require('../models/User');
const { baziAnalysis: baziAlgorithm } = require('../algorithms/bazi');
const { generateDailyFortune } = require('../algorithms/daily-fortune');
const { tarotReading: tarotAlgorithm } = require('../algorithms/tarot');
const { nameAnalysis: nameAlgorithm } = require('../algorithms/name');
const { nameMatchAnalysis: nameMatchAlgorithm } = require('../algorithms/name/match');
const { doubleBaziAnalysis } = require('../algorithms/bazi/match');
const { fengshuiAnalysis: fengshuiAlgorithm } = require('../algorithms/fengshui');
const { getRedis } = require('../config/redis');
const { getDayGanZhi, TIAN_GAN } = require('../algorithms/bazi/lunar');
const { GAN_WUXING } = require('../algorithms/bazi/wuxing');

class FortuneService {
  // 八字算命
  async baziAnalysis(userId, data) {
    const mongoose = require('mongoose');
    const isValidUser = userId && mongoose.Types.ObjectId.isValid(userId);
    let user = null;
    
    if (isValidUser) {
      user = await User.findById(userId);
    }

    if (user && user.fortuneQuota <= 0 && user.memberLevel === 0) {
      throw new Error('算命次数已用完，请充值或升级会员');
    }

    // 执行八字分析
    const result = await baziAlgorithm(data);

    if (user) {
      // 扣除次数
      if (user.memberLevel === 0) {
        user.fortuneQuota -= 1;
        await user.save();
      }

      // 保存算命记录
      const fortune = await Fortune.create({
        userId,
        type: 'bazi',
        bazi: {
          input: data,
          result: result.bazi,
        },
        aiInterpretation: result.interpretation,
        isPaid: false,
      });

      await this._rewardPetFood(userId, 'coarseGrass', 1);

      return {
        fortuneId: fortune._id,
        bazi: result.bazi,
        interpretation: result.interpretation,
      };
    }

    // 游客模式直接返回计算结果
    return {
      bazi: result.bazi,
      interpretation: result.interpretation,
    };
  }

  // 双人八字契合度合婚测算
  async baziMatchAnalysis(userId, data) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('用户不存在');
    }

    if (user.fortuneQuota <= 0 && user.memberLevel === 0) {
      throw new Error('您的算命额度已用完，可通过每日签到、升级会员或充值获取更多次数！');
    }

    const result = doubleBaziAnalysis(data);

    // 扣除次数
    if (user.memberLevel === 0) {
      user.fortuneQuota -= 1;
      await user.save();
    }

    // 保存记录
    const fortune = await Fortune.create({
      userId,
      type: 'baziMatch',
      baziMatch: {
        name1: data.name1,
        solarDate1: data.solarDate1,
        birthTime1: data.birthTime1,
        gender1: data.gender1,
        name2: data.name2,
        solarDate2: data.solarDate2,
        birthTime2: data.birthTime2,
        gender2: data.gender2,
        relationType: data.relationType,
        score: result.score,
        analysis: result.analysis,
      },
    });

    await this._rewardPetFood(userId, 'coarseGrass', 1);

    return {
      fortuneId: fortune._id,
      ...result,
    };
  }

  // 获取每日运势
  async getDailyFortune(userId, date) {
    const targetDate = date || new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const redis = getRedis();

    // 拼装缓存 Key
    const cacheKey = userId ? `daily_fortune:user:${userId}:${targetDate}` : `daily_fortune:default:${targetDate}`;

    // 尝试读取 Redis 缓存
    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch (err) {
        console.warn('Redis read failed in getDailyFortune:', err.message);
      }
    }

    let result = null;

    // 如果有用户 ID，根据其八字生成运势
    if (userId) {
      const user = await User.findById(userId);
      if (user && user.birthInfo && user.birthInfo.yearGanZhi) {
        const bazi = {
          yearGanZhi: user.birthInfo.yearGanZhi,
          monthGanZhi: user.birthInfo.monthGanZhi,
          dayGanZhi: user.birthInfo.dayGanZhi,
          hourGanZhi: user.birthInfo.hourGanZhi,
        };
        // 计算日主五行
        const dayGan = bazi.dayGanZhi.charAt(0);
        const dayMaster = GAN_WUXING[dayGan] || 'earth';
        const birthInfo = { ...bazi, dayMaster };
        result = generateDailyFortune(birthInfo, targetDate);
      }
    }

    if (!result) {
      // 默认运势
      result = generateDailyFortune(null, targetDate);
    }

    // 写入 Redis 缓存（缓存有效期设置为至北京时间当天 23:59:59 截止）
    if (redis && result) {
      try {
        const [year, month, day] = targetDate.split('-').map(Number);
        const beijingMidnightUtc = Date.UTC(year, month - 1, day, 15, 59, 59, 999);
        const secondsUntilMidnight = Math.max(60, Math.floor((beijingMidnightUtc - Date.now()) / 1000));
        await redis.set(cacheKey, JSON.stringify(result), 'EX', secondsUntilMidnight);
      } catch (err) {
        console.warn('Redis write failed in getDailyFortune:', err.message);
      }
    }

    return result;
  }

  // 塔罗牌占卜
  async tarotReading(userId, data) {
    const result = tarotAlgorithm(data);

    const mongoose = require('mongoose');
    const isValidUser = userId && mongoose.Types.ObjectId.isValid(userId);
    
    if (isValidUser) {
      // 保存记录
      const fortune = await Fortune.create({
        userId,
        type: 'tarot',
        tarot: result,
      });

      await this._rewardPetFood(userId, 'coarseGrass', 1);

      return {
        fortuneId: fortune._id,
        ...result,
      };
    }

    return result;
  }

  // 姓名测算
  async nameAnalysis(userId, data) {
    const result = nameAlgorithm(data);

    // 保存记录
    const fortune = await Fortune.create({
      userId,
      type: 'name',
      nameAnalysis: result,
    });

    await this._rewardPetFood(userId, 'coarseGrass', 1);

    return {
      fortuneId: fortune._id,
      ...result,
    };
  }

  // 姓名配对契合度测算
  async nameMatchAnalysis(userId, data) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('用户不存在');
    }

    if (user.fortuneQuota <= 0 && user.memberLevel === 0) {
      throw new Error('您的算命额度已用完，可通过每日签到、升级会员或充值获取更多次数！');
    }

    const result = nameMatchAlgorithm(data);

    // 扣除次数
    if (user.memberLevel === 0) {
      user.fortuneQuota -= 1;
      await user.save();
    }

    // 保存记录
    const fortune = await Fortune.create({
      userId,
      type: 'nameMatch',
      nameMatch: {
        name1: result.name1,
        name2: result.name2,
        relationType: result.relationType,
        score: result.score,
        analysis: result.analysis,
      },
    });

    await this._rewardPetFood(userId, 'coarseGrass', 1);

    return {
      fortuneId: fortune._id,
      ...result,
    };
  }

  // 风水分析
  async fengshuiAnalysis(userId, data) {
    const result = fengshuiAlgorithm(data);

    // 保存记录
    const fortune = await Fortune.create({
      userId,
      type: 'fengshui',
      fengshui: result,
    });

    await this._rewardPetFood(userId, 'coarseGrass', 1);

    return {
      fortuneId: fortune._id,
      ...result,
    };
  }

  // 面相手相分析
  async facePalmAnalysis(userId, data) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('用户不存在');
    }

    if (user.fortuneQuota <= 0 && user.memberLevel === 0) {
      throw new Error('您的算命额度已用完，可通过每日签到、升级会员或充值获取更多次数！');
    }

    // 扣除次数
    if (user.memberLevel === 0) {
      user.fortuneQuota -= 1;
      await user.save();
    }

    const { type, skinRatio, edgeAverage } = data;

    // 根据传入的特征数据与随机种子，生成千人千面的测算文案
    const seed = Math.floor((skinRatio || 0) * 1000) + Math.floor((edgeAverage || 0) * 100);
    const rng = this._seededRandom(seed);
    const selectRandom = (arr) => arr[Math.floor(rng() * arr.length)];

    let result = {};

    if (type === 'face') {
      const isSkinHigh = (skinRatio || 0.15) > 0.15;
      const isEdgeHigh = (edgeAverage || 4.5) > 4.5;

      const fTitle = 'AI面部特征识别';
      
      const featuresPart1 = isSkinHigh 
        ? selectRandom([
            '面部红润饱满，天庭饱满，印堂开阔有光泽。',
            '面色莹润，地阁方圆，五官分布匀称，气色红润。',
            '气血充沛，额头圆润饱满，山根高耸，双颊丰满有肉。'
          ])
        : selectRandom([
            '面相清秀端正，骨骼轮廓分明，眉清目秀，神态深邃。',
            '脸型端正，气色清澈，鼻梁挺拔，下颌线条流畅有力。',
            '天庭平整，双目有神，山根端直，五官线条清晰而精巧。'
          ]);

      const featuresPart2 = isEdgeHigh
        ? selectRandom([
            '五官线条立体感极强，双眼皮深刻，嘴角微微上扬，透出坚毅与决断力。',
            '眉骨与鼻骨线条分明，眼神坚毅锐利，具有极强的意志力与威严感。',
            '面部轮廓刚毅，眉宇间气宇轩昂，下巴宽厚有力，具备天然的领袖气场。'
          ])
        : selectRandom([
            '五官线条温和亲切，眼神流露温润智慧，嘴角自然上翘，极具亲和力。',
            '双颊弧度柔和，眉毛清秀修长，眼神柔和充满善意，人缘魅力极佳。',
            '面部线条温婉圆润，唇形丰满饱满，气场温和而稳重，亲和力十足。'
          ]);

      const fortune = selectRandom([
        '近期运势稳健上行。工作方面会有新的平台或项目向你招手，且多能得到贵人与长辈的提携；财运以正财为主，做好储蓄规划可使资产稳步增长；感情上有不错的社交机会，单身者只要主动即可展开一段美好的缘分。',
        '近三个月内福星高照。事业迎来上升期，你的见解和创意将得到团队的肯定，甚至带来职位或收入的阶梯式提升；偏财运良好，有可能获得意外的理财收益或礼物；健康方面精力充沛，但需注意作息规律。',
        '近期处于“积累与突破”的黄金期。虽然手头工作繁杂，但只要踏实推进必有大成。财运方面忌讳投机倒把，踏实工作所得更为稳妥；感情运势顺利，伴侣间沟通增多，默契度和信任度能达到新高度。'
      ]);

      const personality = selectRandom([
        '性格乐观开朗，为人正直诚恳，具有天生的乐观主义和正义感。做事专注认真，执行力强；但有时性格稍微有些直来直往，容易在不经意间得罪他人，在人际交往中多倾听会有更大的收获。',
        '内心细腻，思考极为细腻，做决定前喜欢权衡利弊，因此极具靠谱感与责任心。待人温和有礼，懂得包容；但在面对突发事件时可能会过于谨慎，偶尔多一分冒险精神，能帮你抓住转折点。',
        '兼具独立精神与坚韧意志，做事有目标有规划，不容易被他人的言论所左右。自律性强，面对困难有很强的抗压性；但有时防备心稍重，多向身边的亲友敞开心扉，会让你感到更加轻松愉快。'
      ]);

      result = {
        featureTitle: fTitle,
        features: `${featuresPart1}${featuresPart2}`,
        fortune,
        personality,
      };
    } else {
      // palm 手相
      const isSkinHigh = (skinRatio || 0.2) > 0.22;
      const isEdgeHigh = (edgeAverage || 5.0) > 5.0;

      const fTitle = 'AI手相特征识别';

      const featuresPart1 = isSkinHigh
        ? selectRandom([
            '掌丘丰满红润，掌色白里透红，生命线深长且弧度宽广，表示生命力充沛。',
            '手掌厚实多肉，掌心红润有弹性，智慧线与生命线起点相连，主稳健务实。',
            '掌纹清晰深邃，掌心温润红润，指节匀称，手掌软绵，具有极佳的福泽。'
          ])
        : selectRandom([
            '掌心平整清秀，纹路清晰利落，智慧线修长且走势平直，代表极其理性。',
            '掌面细致白皙，主纹线（生命、智慧、感情）深刻无杂纹，心思单纯且专注。',
            '手掌骨骼清奇，智慧线末端分叉，代表思维极其活跃，极具领悟力与天赋。'
          ]);

      const featuresPart2 = isEdgeHigh
        ? selectRandom([
            '事业线与成功线纵横交错且深，代表一生多有白手起家的创业运或管理潜力，能够承担重任。',
            '主纹路上有多条清晰的分支辅助纹，代表一生机缘极多，能够跨行业或通过多渠道获取成就。',
            '智慧线长而深刻，伴有深长的事业线直接中指，意味着凭借智慧与才干能打破现状，取得名望。'
          ])
        : selectRandom([
            '主纹路清爽干净，几乎无杂纹，代表生活状态简单快乐，情感单纯，一生较少挫折和波澜。',
            '感情线走向柔和，末端向上弯曲，代表感情充沛，重情重义，在家庭和婚姻中能获得极大的幸福。',
            '生命线与智慧线相交较长，代表做事细心稳妥，擅长在团队或稳健岗位中发挥专长，一生平稳。'
          ]);

      const fortune = selectRandom([
        '近期财运与事业运势极佳。手掌的纹路显示你正处于一个决策上升期，适合推进长线项目或进行业务转型；理财上建议稳中求进，不要听信小道消息；感情方面，有与熟人发展成伴侣的机缘，宜多沟通。',
        '近期生活如意，家庭幸福感显著提升。如果你正在等待某个审核或考试结果，近期有望迎来令人满意的喜讯。财运方面正财稳固，多劳多得；健康方面注意缓解眼部和颈椎疲劳。',
        '近期正偏财运皆有斩获。手相显示你近期会有意外的项目红利或兼职收入。工作中你的协作能力得到提升，团队关系融洽；单身者在旅行或社交活动中容易结识意气相投的异性，多展示自己。'
      ]);

      const personality = selectRandom([
        '做事脚踏实地，富有强烈的责任心，对待朋友和工作极其忠诚。性格稳重，不喜浮夸，但在关键时刻往往能够爆发出强大的决断力；在面对新机会时，可更自信果敢一些。',
        '个性温和，善解人意，具有很强的同理心，人缘极好。喜欢和谐稳定的生活环境，在团队中是优秀的倾听者与合作者；但在个人原则上需要更加坚定，避免因为迁就他人而委屈自己。',
        '思维敏锐，创造力强，对于未知领域充满好奇心与探索欲。善于分析问题，有独特的审美或洞察力；只是有时耐力稍显不足，坚持把一件事情做到底，能让你收获意想不到的丰硕成果。'
      ]);

      result = {
        featureTitle: fTitle,
        features: `${featuresPart1}${featuresPart2}`,
        fortune,
        personality,
      };
    }

    // 保存记录
    const fortuneRecord = await Fortune.create({
      userId,
      type: type === 'face' ? 'face' : 'palm',
      facePalm: {
        type,
        featureTitle: result.featureTitle,
        features: result.features,
        fortune: result.fortune,
        personality: result.personality,
      },
    });

    return {
      fortuneId: fortuneRecord._id,
      ...result,
    };
  }

  // 获取算命记录详情
  async getRecord(userId, recordId) {
    const fortune = await Fortune.findOne({ _id: recordId, userId });
    if (!fortune) {
      throw new Error('记录不存在');
    }
    return fortune;
  }

  // 获取算命记录列表
  async getRecords(userId, options = {}) {
    const { page = 1, pageSize = 10, type } = options;

    const query = { userId };
    if (type) {
      query.type = type;
    }

    const total = await Fortune.countDocuments(query);
    const records = await Fortune.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(parseInt(pageSize, 10));

    return {
      total,
      page: parseInt(page, 10),
      pageSize: parseInt(pageSize, 10),
      records,
    };
  }

  // 分享算命结果
  async shareRecord(userId, recordId) {
    const fortune = await Fortune.findOneAndUpdate(
      { _id: recordId, userId },
      { $inc: { shareCount: 1 } },
      { new: true }
    );

    if (!fortune) {
      throw new Error('记录不存在');
    }

    return {
      shareCount: fortune.shareCount,
    };
  }

  // 删除算命记录
  async deleteRecord(userId, recordId) {
    const fortune = await Fortune.findOneAndDelete({ _id: recordId, userId });
    if (!fortune) {
      throw new Error('记录不存在');
    }
    return true;
  }

  // 星座运势
  async getConstellationFortune(userId, constellation, date) {
    const targetDate = date || new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const redis = getRedis();
    const cacheKey = `constellation_fortune:${constellation}:${targetDate}`;

    // 尝试读取 Redis 缓存
    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch (err) {
        console.warn('Redis read failed in getConstellationFortune:', err.message);
      }
    }

    const constellationNames = {
      aries: '白羊座', taurus: '金牛座', gemini: '双子座',
      cancer: '巨蟹座', leo: '狮子座', virgo: '处女座',
      libra: '天秤座', scorpio: '天蝎座', sagittarius: '射手座',
      capricorn: '摩羯座', aquarius: '水瓶座', pisces: '双鱼座',
    };

    const constellationMatch = {
      aries: '天秤座', taurus: '天蝎座', gemini: '射手座',
      cancer: '摩羯座', leo: '水瓶座', virgo: '双鱼座',
      libra: '白羊座', scorpio: '金牛座', sagittarius: '双子座',
      capricorn: '巨蟹座', aquarius: '狮子座', pisces: '处女座',
    };

    const name = constellationNames[constellation] || '白羊座';
    const rng = this._seededRandom(this._getDateSeed(`${targetDate}-${constellation}`));

    const rating = Math.floor(rng() * 3) + 3;
    const dimensions = ['overall', 'love', 'career', 'wealth', 'health'];
    const dimensionLabels = {
      overall: '综合',
      love: '感情',
      career: '事业',
      wealth: '财运',
      health: '健康',
    };
    const fortunes = {};
    const descriptors = ['不错', '较好', '平稳', '需要注意', '有波动'];
    dimensions.forEach((dim) => {
      fortunes[dim] = `${name}今日${dimensionLabels[dim]}运势${descriptors[Math.floor(rng() * descriptors.length)]}。`;
    });

    const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];
    const colorNames = ['红色', '蓝色', '绿色', '黄色', '紫色', '青色'];
    const colorIdx = Math.floor(rng() * colors.length);

    const result = {
      name,
      rating,
      ...fortunes,
      luckyColor: colors[colorIdx],
      luckyColorName: colorNames[colorIdx],
      luckyNumber: Math.floor(rng() * 9) + 1,
      match: constellationMatch[constellation] || '天秤座',
      advice: `${name}今日适合${rating >= 4 ? '积极行动' : '稳守待变'}，多关注${dimensionLabels[dimensions[Math.floor(rng() * dimensions.length)]]}方面。`,
    };

    // 写入 Redis 缓存（缓存有效期至北京时间当天 23:59:59 截止）
    if (redis) {
      try {
        const [year, month, day] = targetDate.split('-').map(Number);
        const beijingMidnightUtc = Date.UTC(year, month - 1, day, 15, 59, 59, 999);
        const secondsUntilMidnight = Math.max(60, Math.floor((beijingMidnightUtc - Date.now()) / 1000));
        await redis.set(cacheKey, JSON.stringify(result), 'EX', secondsUntilMidnight);
      } catch (err) {
        console.warn('Redis write failed in getConstellationFortune:', err.message);
      }
    }

    return result;
  }

  async _rewardPetFood(userId, itemType = 'coarseGrass', count = 1) {
    try {
      const Pet = require('../models/Pet');
      let pet = await Pet.findOne({ userId });
      if (!pet) {
        const User = require('../models/User');
        const user = await User.findById(userId);
        const solarDate = user && user.birthInfo && user.birthInfo.solarDate;
        
        let type = 'egg';
        if (solarDate) {
          try {
            const date = new Date(solarDate);
            if (!isNaN(date.getTime())) {
              const month = date.getMonth() + 1;
              const day = date.getDate();
              const val = month + day / 100;
              const qilinDays = [2.04, 3.20, 5.05, 6.21, 8.07, 9.22, 11.07, 12.22];
              if (qilinDays.includes(val)) {
                type = 'qilin';
              } else if (val >= 3.20 && val <= 6.20) {
                type = 'qinglong';
              } else if (val >= 6.21 && val <= 9.21) {
                type = 'zhuque';
              } else if (val >= 9.22 && val <= 12.21) {
                type = 'baihu';
              } else {
                type = 'xuanwu';
              }
            }
          } catch (err) {}
        }
        
        const names = { egg: '神秘星运蛋', qinglong: '东方青龙', zhuque: '南方朱雀', baihu: '西方白虎', xuanwu: '北方玄武', qilin: '祥瑞麒麟' };
        pet = new Pet({
          userId,
          type,
          name: names[type] || '神秘星运蛋',
          inventory: {
            coarseGrass: 1,
            morningDew: 0,
            wuguPill: 0,
            taijiPeach: 0
          }
        });
      }
      pet.inventory[itemType] = (pet.inventory[itemType] || 0) + count;
      await pet.save();
    } catch (e) {
      console.warn('赠送神兽饲料失败:', e.message);
    }
  }

  _getDateSeed(dateStr) {
    let hash = 0;
    for (let i = 0; i < dateStr.length; i++) {
      hash = ((hash << 5) - hash + dateStr.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }

  _seededRandom(seed) {
    let s = Number(seed) % 2147483647;
    if (s <= 0) s += 2147483646;
    return () => {
      s = (s * 16807 + 0) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }
}

module.exports = new FortuneService();
