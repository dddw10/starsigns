const Feedback = require('../models/Feedback');
const User = require('../models/User');

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
      .populate('userId', 'nickname avatar memberLevel')
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

    // 采纳奖励逻辑：如果关联了用户，且尚未发放奖励
    let rewardGranted = false;
    if (feedback.userId && !feedback.rewardGranted) {
      const user = await User.findById(feedback.userId);
      if (user) {
        user.fortuneQuota += 3; // 奖励 3 次测算额度
        await user.save();
        feedback.rewardGranted = true;
        rewardGranted = true;
      }
    }

    await feedback.save();

    // 重新拉取以带上用户关联数据
    const populatedFeedback = await Feedback.findById(feedbackId).populate(
      'userId',
      'nickname avatar memberLevel fortuneQuota'
    );

    return {
      feedback: populatedFeedback,
      rewardGranted,
    };
  }
}

module.exports = new AdminService();
