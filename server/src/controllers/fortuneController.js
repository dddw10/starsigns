const fortuneService = require('../services/fortuneService');
const aiService = require('../services/aiService');

// 八字算命
exports.baziAnalysis = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { solarDate, birthTime, gender } = req.body;
    const result = await fortuneService.baziAnalysis(userId, { solarDate, birthTime, gender });
    res.json({
      code: 0,
      message: '分析完成',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// 双人八字配对（合婚）
exports.baziMatch = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { name1, solarDate1, birthTime1, gender1, name2, solarDate2, birthTime2, gender2, relationType } = req.body;
    const result = await fortuneService.baziMatchAnalysis(userId, { name1, solarDate1, birthTime1, gender1, name2, solarDate2, birthTime2, gender2, relationType });
    res.json({
      code: 0,
      message: '双人八字配对完成',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// 获取每日运势
exports.getDailyFortune = async (req, res, next) => {
  try {
    const userId = req.user ? req.user.userId : null;
    const { date } = req.query;
    const result = await fortuneService.getDailyFortune(userId, date);
    res.json({
      code: 0,
      message: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// 塔罗牌占卜
exports.tarotReading = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { spreadType } = req.body;
    const result = await fortuneService.tarotReading(userId, { spreadType });
    res.json({
      code: 0,
      message: '占卜完成',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// 姓名测算
exports.nameAnalysis = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { name } = req.body;
    const result = await fortuneService.nameAnalysis(userId, { name });
    res.json({
      code: 0,
      message: '测算完成',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// 姓名配对契合度测算
exports.nameMatch = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { name1, name2, relationType } = req.body;
    const result = await fortuneService.nameMatchAnalysis(userId, { name1, name2, relationType });
    res.json({
      code: 0,
      message: '配对测算完成',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// 风水分析
exports.fengshuiAnalysis = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { direction, layout } = req.body;
    const result = await fortuneService.fengshuiAnalysis(userId, { direction, layout });
    res.json({
      code: 0,
      message: '分析完成',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// 获取算命记录详情
exports.getRecord = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const result = await fortuneService.getRecord(userId, id);
    res.json({
      code: 0,
      message: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// 获取算命记录列表
exports.getRecords = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { page, pageSize, type } = req.query;
    const result = await fortuneService.getRecords(userId, { page, pageSize, type });
    res.json({
      code: 0,
      message: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// 分享算命结果
exports.shareRecord = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const result = await fortuneService.shareRecord(userId, id);
    res.json({
      code: 0,
      message: '分享成功',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// 删除算命记录
exports.deleteRecord = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    await fortuneService.deleteRecord(userId, id);
    res.json({
      code: 0,
      message: '删除成功',
    });
  } catch (error) {
    next(error);
  }
};

// 星座运势
exports.constellationFortune = async (req, res, next) => {
  try {
    const userId = req.user ? req.user.userId : null;
    const { constellation } = req.params;
    const { date } = req.query;
    const result = await fortuneService.getConstellationFortune(userId, constellation, date);
    res.json({
      code: 0,
      message: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// 面相手相分析
exports.facePalmAnalysis = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { type, skinRatio, edgeAverage, base64Image } = req.body;
    
    const User = require('../models/User');
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('用户不存在');
    }

    if (user.fortuneQuota <= 0 && user.memberLevel === 0) {
      throw new Error('您的算命额度已用完，可通过每日签到、升级会员或充值获取更多次数！');
    }
    
    // 调用 AI 智能分析 (支持多模态 VLM 或文本特征大模型兜底)
    const result = await aiService.analyzeFacePalm({ type, base64Image, skinRatio, edgeAverage });
    
    // 扣除次数
    if (user.memberLevel === 0) {
      user.fortuneQuota -= 1;
      await user.save();
    }

    // 赠送神兽食物
    await fortuneService._rewardPetFood(userId, 'coarseGrass', 1);

    // 保存测算记录至数据库
    const Fortune = require('../models/Fortune');
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

    res.json({
      code: 0,
      message: '分析完成',
      data: {
        fortuneId: fortuneRecord._id,
        ...result,
      },
    });
  } catch (error) {
    next(error);
  }
};
