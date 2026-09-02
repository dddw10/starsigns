const Feedback = require('../models/Feedback');

class AdminService {
  /**
   * 分页获取用户意见反馈
   */
  async getFeedbackList({ page = 1, pageSize = 10, status, type }) {
    const query = {};
    if (status) query.status = status;
    if (type) query.type = type;

    const total = await Feedback.countDocuments(query);
    const list = await Feedback.find(query)
      .populate('userId', 'nickname avatar')
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(Number(pageSize));

    return {
      total,
      page: Number(page),
      pageSize: Number(pageSize),
      list,
    };
  }

  /**
   * 回复反馈并采纳奖励
   */
  async replyFeedback(feedbackId, replyContent, adminUserId) {
    if (!replyContent || !replyContent.trim()) {
      throw new Error('回复内容不能为空');
    }

    const feedback = await Feedback.findById(feedbackId);
    if (!feedback) {
      throw new Error('该反馈记录不存在');
    }

    feedback.replyContent = replyContent.trim();
    feedback.status = 'processed';
    feedback.replyAt = new Date();

    await feedback.save();

    // 重新拉取以带上用户关联数据
    const populatedFeedback = await Feedback.findById(feedbackId).populate(
      'userId',
      'nickname avatar'
    );

    return {
      feedback: populatedFeedback,
      rewardGranted: false,
    };
  }
}

module.exports = new AdminService();
