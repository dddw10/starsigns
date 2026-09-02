const adminService = require('../services/adminService');
const { setAuditMode } = require('../config/systemConfig');

/**
   * 分页获取用户意见反馈
   */
exports.getFeedbackList = async (req, res, next) => {
  try {
    const { page = 1, pageSize = 10, status, type } = req.query;
    const result = await adminService.getFeedbackList({ page, pageSize, status, type });
    res.json({
      code: 0,
      message: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
   * 回复反馈并采纳奖励
   */
exports.replyFeedback = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { replyContent } = req.body;
    const adminUserId = req.user.userId;

    const result = await adminService.replyFeedback(id, replyContent, adminUserId);
    res.json({
      code: 0,
      message: result.rewardGranted ? '回复成功，并已为该用户赠送3次免费测算额度' : '回复成功',
      data: result.feedback,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 切换系统审核模式（小程序端的「简洁模式」）
 */
exports.toggleAuditMode = async (req, res, next) => {
  try {
    const { auditMode } = req.body;
    if (typeof auditMode !== 'boolean') {
      const err = new Error('参数错误，auditMode 必须为布尔值');
      err.status = 400;
      throw err;
    }

    // 落库并同步刷新 /api/config 的进程内缓存
    await setAuditMode(auditMode);

    res.json({
      code: 0,
      message: auditMode ? '已开启简洁模式' : '已关闭简洁模式，开放完整功能',
      data: { auditMode }
    });
  } catch (error) {
    next(error);
  }
};

