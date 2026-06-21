const express = require('express');
const router = express.Router();
const memberController = require('../controllers/memberController');
const { authMiddleware } = require('../middleware/auth');

// 获取会员信息
router.get('/info', authMiddleware, memberController.getMemberInfo);

// 检查免费次数
router.get('/quota', authMiddleware, memberController.checkFreeQuota);

// 获取会员权益
router.get('/benefits', memberController.getMemberBenefits);

// 获取会员统计
router.get('/stats', authMiddleware, memberController.getMemberStats);

module.exports = router;
