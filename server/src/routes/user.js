const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authMiddleware } = require('../middleware/auth');
const { userValidation } = require('../middleware/validator');
const { wxLoginRateLimiter, loginRateLimiter } = require('../middleware/rateLimit');

// 微信登录（拿一次性 code 换 token，每次冷启动都会调，限流不能太紧）
router.post('/login', wxLoginRateLimiter, userValidation.wxLogin, userController.wxLogin);

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

// 提交意见反馈（需鉴权）
router.post('/feedback', authMiddleware, userValidation.feedback, userController.submitFeedback);

// 获取用户自身的意见反馈列表（需鉴权）
router.get('/feedback', authMiddleware, userController.getUserFeedbackList);

// 绑定微信手机号（需鉴权）
router.post('/bind-phone', authMiddleware, userController.bindPhone);

// H5 注册与登录（账号密码，能被撞库，所以限流走严格档并校验入参）
router.post('/register', loginRateLimiter, userValidation.accountAuth, userController.register);
router.post('/login-account', loginRateLimiter, userValidation.accountAuth, userController.loginAccount);

module.exports = router;
