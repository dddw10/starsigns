const express = require('express');
const router = express.Router();
const petController = require('../controllers/petController');
const { authMiddleware } = require('../middleware/auth');

// 获取宠物状态
router.get('/status', authMiddleware, petController.getPetStatus);

// 喂食神兽
router.post('/feed', authMiddleware, petController.feedPet);

// 互动抚摸 (摸摸头)
router.post('/interact', authMiddleware, petController.interactPet);

// 修改名字
router.post('/rename', authMiddleware, petController.renamePet);

// 开启福袋
router.post('/draw', authMiddleware, petController.drawPetReward);

module.exports = router;
