const express = require('express');
const router = express.Router();
const fortuneController = require('../controllers/fortuneController');
const aiController = require('../controllers/aiController');
const { authMiddleware, optionalAuthMiddleware } = require('../middleware/auth');
const { fortuneValidation } = require('../middleware/validator');
const { rateLimiter } = require('../middleware/rateLimit');
const { auditGuard } = require('../middleware/auditGuard');

// 简洁模式（auditMode）开启时，带 auditGuard 的这些能力一律 403。
// 留下的只有首页宫格在简洁模式下还放出的那两项——星座能量（constellation）
// 与空间美学（fengshui）——以及每日运势和历史记录。
// 前端隐藏图标只是第一层，能不能用由这里说了算：审核人员按路径直开页面也拿不到数据。

// 八字算命
router.post('/bazi', auditGuard, authMiddleware, fortuneValidation.bazi, fortuneController.baziAnalysis);

// 双人八字配对（合婚）
router.post('/bazi-match', auditGuard, authMiddleware, fortuneValidation.baziMatch, fortuneController.baziMatch);

// 获取每日运势
router.get('/daily', optionalAuthMiddleware, fortuneController.getDailyFortune);

// 塔罗牌占卜
router.post('/tarot', auditGuard, authMiddleware, fortuneValidation.tarot, fortuneController.tarotReading);

// 姓名测算
router.post('/name', auditGuard, authMiddleware, fortuneValidation.nameAnalysis, fortuneController.nameAnalysis);

// 姓名配对契合度测算
router.post('/name-match', auditGuard, authMiddleware, fortuneValidation.nameMatch, fortuneController.nameMatch);

// 风水分析
router.post('/fengshui', authMiddleware, fortuneValidation.fengshui, fortuneController.fengshuiAnalysis);

// 面相手相分析
router.post('/face-palm', auditGuard, authMiddleware, fortuneController.facePalmAnalysis);

// 获取算命记录详情
router.get('/record/:id', authMiddleware, fortuneValidation.getRecord, fortuneController.getRecord);

// 获取算命记录列表
router.get('/records', authMiddleware, fortuneValidation.getList, fortuneController.getRecords);

// 分享算命结果
router.post('/share/:id', authMiddleware, fortuneController.shareRecord);

// 删除算命记录
router.delete('/record/:id', authMiddleware, fortuneValidation.getRecord, fortuneController.deleteRecord);

// 星座运势
router.get('/constellation/:constellation', optionalAuthMiddleware, fortuneController.constellationFortune);

// AI 命理智能体对话（流式响应）
router.post('/ai-chat', auditGuard, optionalAuthMiddleware, aiController.chatStream);

// AI 命理多智能体圆桌会议（流式响应）
router.post('/council', auditGuard, optionalAuthMiddleware, aiController.councilStream);

module.exports = router;
