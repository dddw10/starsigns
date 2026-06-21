const express = require('express');
const router = express.Router();
const pushController = require('../controllers/pushController');
const { authMiddleware } = require('../middleware/auth');
const { pushValidation } = require('../middleware/validator');
const { strictRateLimiter } = require('../middleware/rateLimit');

// 获取推送设置
router.get('/settings', authMiddleware, pushController.getSettings);

// 更新推送设置
router.put('/settings', authMiddleware, pushController.updateSettings);

// 订阅推送消息
router.post('/subscribe', authMiddleware, pushValidation.subscribe, pushController.subscribe);

// 取消订阅推送消息
router.post('/unsubscribe', authMiddleware, pushValidation.unsubscribe, pushController.unsubscribe);

// 获取用户订阅列表
router.get('/subscriptions', authMiddleware, pushController.getSubscriptions);

// 获取推送历史记录
router.get('/history', authMiddleware, pushController.getPushHistory);

// 手动触发每日运势推送（管理员接口）
router.post('/trigger-daily', authMiddleware, strictRateLimiter, pushController.triggerDailyPush);

module.exports = router;
