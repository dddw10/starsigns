const userService = require('../services/userService');

// 微信登录
exports.wxLogin = async (req, res, next) => {
  try {
    const { code } = req.body;
    const result = await userService.wxLogin(code);
    res.json({
      code: 0,
      message: '登录成功',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// 获取用户信息
exports.getProfile = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const profile = await userService.getProfile(userId);
    res.json({
      code: 0,
      message: 'success',
      data: profile,
    });
  } catch (error) {
    next(error);
  }
};

// 更新用户信息
exports.updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { nickname, avatar, gender } = req.body;
    const result = await userService.updateProfile(userId, { nickname, avatar, gender });
    res.json({
      code: 0,
      message: '更新成功',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// 更新生辰八字
exports.updateBirthInfo = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { solarDate, lunarDate, birthTime } = req.body;
    const result = await userService.updateBirthInfo(userId, { solarDate, lunarDate, birthTime });
    res.json({
      code: 0,
      message: '更新成功',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// 获取用户统计
exports.getStats = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const stats = await userService.getStats(userId);
    res.json({
      code: 0,
      message: 'success',
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

// 获取会员状态
exports.getMemberStatus = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const status = await userService.getMemberStatus(userId);
    res.json({
      code: 0,
      message: 'success',
      data: status,
    });
  } catch (error) {
    next(error);
  }
};

// 每日签到
exports.checkIn = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const result = await userService.checkIn(userId);
    res.json({
      code: 0,
      message: '签到成功',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// 提交意见反馈
exports.submitFeedback = async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    const { type, content, contact } = req.body;
    const result = await userService.submitFeedback(userId, { type, content, contact });
    res.json({
      code: 0,
      message: '反馈提交成功，感谢您的支持！',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// 获取当前用户的意见反馈列表
exports.getUserFeedbackList = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { page = 1, pageSize = 10 } = req.query;
    const result = await userService.getUserFeedbackList(userId, { page, pageSize });
    res.json({
      code: 0,
      message: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
