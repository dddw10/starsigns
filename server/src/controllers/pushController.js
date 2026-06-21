const pushService = require('../services/pushService');

// 获取推送设置
exports.getSettings = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const result = await pushService.getSettings(userId);
    res.json({
      code: 0,
      message: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// 更新推送设置
exports.updateSettings = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const result = await pushService.updateSettings(userId, req.body);
    res.json({
      code: 0,
      message: '保存成功',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// 订阅推送消息
exports.subscribe = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { templateId } = req.body;
    const result = await pushService.subscribe(userId, templateId);
    res.json({
      code: 0,
      message: '订阅成功',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// 取消订阅推送消息
exports.unsubscribe = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { templateId } = req.body;
    await pushService.unsubscribe(userId, templateId);
    res.json({
      code: 0,
      message: '取消订阅成功',
    });
  } catch (error) {
    next(error);
  }
};

// 获取用户订阅列表
exports.getSubscriptions = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const result = await pushService.getSubscriptions(userId);
    res.json({
      code: 0,
      message: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// 获取推送历史记录
exports.getPushHistory = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { page, pageSize } = req.query;
    const result = await pushService.getPushHistory(userId, { page, pageSize });
    res.json({
      code: 0,
      message: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// 手动触发每日运势推送
exports.triggerDailyPush = async (req, res, next) => {
  try {
    const result = await pushService.triggerDailyPush();
    res.json({
      code: 0,
      message: '推送任务已触发',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
