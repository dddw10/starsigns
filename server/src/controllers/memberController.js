const memberService = require('../services/memberService');

// 获取会员信息
exports.getMemberInfo = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const result = await memberService.getMemberInfo(userId);
    res.json({
      code: 0,
      message: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// 检查免费次数
exports.checkFreeQuota = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const result = await memberService.checkFreeQuota(userId);
    res.json({
      code: 0,
      message: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// 获取会员权益
exports.getMemberBenefits = async (req, res, next) => {
  try {
    const result = memberService.getMemberBenefits();
    res.json({
      code: 0,
      message: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// 获取会员统计
exports.getMemberStats = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const result = await memberService.getMemberStats(userId);
    res.json({
      code: 0,
      message: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
