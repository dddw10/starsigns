const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { adminMiddleware } = require('../middleware/auth');

// 所有 /api/admin/* 路由均需要管理员身份认证
router.use(adminMiddleware);

// 分页获取反馈列表
router.get('/feedback', adminController.getFeedbackList);

// 回复反馈
router.post('/feedback/:id/reply', adminController.replyFeedback);

module.exports = router;
