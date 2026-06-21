const paymentService = require('../services/paymentService');

// 创建订单
exports.createOrder = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { productType, productId } = req.body;
    const result = await paymentService.createOrder(userId, { productType, productId });
    res.json({
      code: 0,
      message: '订单创建成功',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// 查询订单状态
exports.getOrderStatus = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { orderNo } = req.params;
    const result = await paymentService.getOrderStatus(userId, orderNo);
    res.json({
      code: 0,
      message: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// 获取用户订单列表
exports.getUserOrders = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { page, pageSize, status } = req.query;
    const result = await paymentService.getUserOrders(userId, { page, pageSize, status });
    res.json({
      code: 0,
      message: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// 微信支付回调
exports.wechatNotify = async (req, res, next) => {
  try {
    const result = await paymentService.handleWechatNotify(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

// 申请退款
exports.refund = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { orderNo, reason } = req.body;
    const result = await paymentService.refund(userId, orderNo, reason);
    res.json({
      code: 0,
      message: '退款申请已提交',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// 查询退款状态
exports.getRefundStatus = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { orderNo } = req.params;
    const result = await paymentService.getRefundStatus(userId, orderNo);
    res.json({
      code: 0,
      message: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// 微信退款回调
exports.wechatRefundNotify = async (req, res, next) => {
  try {
    const result = await paymentService.handleRefundNotify(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
};
