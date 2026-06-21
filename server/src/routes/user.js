const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authMiddleware } = require('../middleware/auth');
const { userValidation } = require('../middleware/validator');
const { loginRateLimiter } = require('../middleware/rateLimit');

// 微信登录
router.post('/login', loginRateLimiter, userValidation.wxLogin, userController.wxLogin);

// 每日签到
router.post('/check-in', authMiddleware, userController.checkIn);

// 获取用户信息（需鉴权）
router.get('/profile', authMiddleware, userController.getProfile);

// 更新用户信息（需鉴权）
router.put('/profile', authMiddleware, userValidation.updateProfile, userController.updateProfile);

// 更新生辰八字（需鉴权）
router.put('/birth-info', authMiddleware, userValidation.updateBirthInfo, userController.updateBirthInfo);

// 获取用户统计（需鉴权）
router.get('/stats', authMiddleware, userController.getStats);

// 检查会员状态（需鉴权）
router.get('/member-status', authMiddleware, userController.getMemberStatus);

// 提交意见反馈（需鉴权）
router.post('/feedback', authMiddleware, userValidation.feedback, userController.submitFeedback);

// 获取用户自身的意见反馈列表（需鉴权）
router.get('/feedback', authMiddleware, userController.getUserFeedbackList);

module.exports = router;
