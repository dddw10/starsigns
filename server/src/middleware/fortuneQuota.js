const memberService = require('../services/memberService');

// 算命次数检查中间件
async function fortuneQuotaMiddleware(req, res, next) {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        code: 401,
        message: '请先登录',
      });
    }
    const userId = req.user.userId;

    // 检查用户是否有可用次数
    const quotaCheck = await memberService.checkFreeQuota(userId);

    if (!quotaCheck.canUse) {
      return res.status(403).json({
        code: 403,
        message: '今日免费次数已用完，请购买会员或次数包',
        data: {
          needPurchase: true,
          dailyFree: 0,
          fortuneQuota: 0,
          memberLevel: 0,
        },
      });
    }

    // 将配额信息附加到请求对象
    req.quotaInfo = quotaCheck;
    next();
  } catch (error) {
    console.error('检查算命次数失败:', error);
    next(error);
  }
}

// 算命次数扣减中间件（在算命完成后调用）
async function deductQuotaMiddleware(req, res, next) {
  try {
    if (!req.user || !req.user.userId) {
      return next();
    }
    const userId = req.user.userId;
    const quotaInfo = req.quotaInfo;

    if (!quotaInfo) {
      return next();
    }

    // 扣除次数
    await memberService.deductUsage(userId, quotaInfo.type);

    // 更新响应中的剩余次数信息
    const originalJson = res.json.bind(res);
    res.json = function (data) {
      if (data && data.code === 0) {
        // 刷新用户配额信息
        memberService.checkFreeQuota(userId).then(newQuota => {
          data.data = data.data || {};
          data.data.quotaInfo = newQuota;
          originalJson(data);
        }).catch(() => {
          originalJson(data);
        });
      } else {
        originalJson(data);
      }
    };

    next();
  } catch (error) {
    console.error('扣除算命次数失败:', error);
    next(error);
  }
}

// VIP权益检查中间件
function requireFeature(feature) {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.userId) {
        return res.status(401).json({
          code: 401,
          message: '请先登录',
        });
      }
      const userId = req.user.userId;

      const hasFeature = await memberService.checkFeature(userId, feature);
      if (!hasFeature) {
        return res.status(403).json({
          code: 403,
          message: '此功能需要VIP会员才能使用',
          data: {
            needMember: true,
            feature,
          },
        });
      }

      next();
    } catch (error) {
      console.error('检查会员权益失败:', error);
      next(error);
    }
  };
}

// 会员等级检查中间件
function requireMemberLevel(minLevel = 1) {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.userId) {
        return res.status(401).json({
          code: 401,
          message: '请先登录',
        });
      }
      const userId = req.user.userId;

      const memberInfo = await memberService.getMemberInfo(userId);
      if (memberInfo.memberLevel < minLevel) {
        const levelName = minLevel === 1 ? 'VIP' : 'SVIP';
        return res.status(403).json({
          code: 403,
          message: `此功能需要${levelName}会员才能使用`,
          data: {
            needMember: true,
            requiredLevel: minLevel,
            currentLevel: memberInfo.memberLevel,
          },
        });
      }

      next();
    } catch (error) {
      console.error('检查会员等级失败:', error);
      next(error);
    }
  };
}

module.exports = {
  fortuneQuotaMiddleware,
  deductQuotaMiddleware,
  requireFeature,
  requireMemberLevel,
};
