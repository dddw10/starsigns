const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authMiddleware } = require('../middleware/auth');
const { paymentValidation } = require('../middleware/validator');
const { strictRateLimiter } = require('../middleware/rateLimit');

// 创建订单
router.post('/create', authMiddleware, strictRateLimiter, paymentValidation.createOrder, paymentController.createOrder);

// 查询订单状态
router.get('/order/:orderNo', authMiddleware, paymentController.getOrderStatus);

// 获取用户订单列表
router.get('/orders', authMiddleware, paymentController.getUserOrders);

// 微信支付回调（不需要鉴权）
router.post('/wechat/notify', paymentController.wechatNotify);

// 申请退款
router.post('/refund', authMiddleware, strictRateLimiter, paymentValidation.refund, paymentController.refund);

// 查询退款状态
router.get('/refund/:orderNo', authMiddleware, paymentController.getRefundStatus);

// 微信退款回调（不需要鉴权）
router.post('/wechat/refund-notify', paymentController.wechatRefundNotify);

module.exports = router;
