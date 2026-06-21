// 参数校验中间件
const { body, param, query, validationResult } = require('express-validator');

// 处理校验结果
function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      code: 400,
      message: '参数校验失败',
      errors: errors.array().map((err) => ({
        field: err.path,
        message: err.msg,
      })),
    });
  }
  next();
}

// 用户相关校验
const userValidation = {
  // 微信登录
  wxLogin: [
    body('code').notEmpty().withMessage('微信登录凭证不能为空'),
    handleValidation,
  ],

  // 更新用户信息
  updateProfile: [
    body('nickname').optional().isString().withMessage('昵称格式不正确'),
    body('avatar').optional().isURL().withMessage('头像地址格式不正确'),
    body('gender').optional().isIn([0, 1, 2]).withMessage('性别值无效'),
    handleValidation,
  ],

  // 更新生辰八字
  updateBirthInfo: [
    body('solarDate').notEmpty().withMessage('阳历日期不能为空'),
    body('birthTime').notEmpty().withMessage('出生时辰不能为空'),
    handleValidation,
  ],

  // 意见反馈
  feedback: [
    body('content').notEmpty().withMessage('反馈内容不能为空')
      .isLength({ max: 1000 }).withMessage('反馈内容不能超过1000个字符'),
    body('type').optional().isIn(['bug', 'suggestion', 'other']).withMessage('反馈类型值无效'),
    body('contact').optional().isLength({ max: 100 }).withMessage('联系方式不能超过100个字符'),
    handleValidation,
  ],
};

// 算命相关校验
const fortuneValidation = {
  // 八字算命
  bazi: [
    body('solarDate').notEmpty().withMessage('阳历日期不能为空'),
    body('birthTime').notEmpty().withMessage('出生时辰不能为空'),
    body('gender').isIn(['male', 'female']).withMessage('性别值无效'),
    handleValidation,
  ],

  // 塔罗牌
  tarot: [
    body('spreadType').isIn(['single', 'three', 'celtic']).withMessage('牌阵类型无效'),
    handleValidation,
  ],

  // 姓名测算
  nameAnalysis: [
    body('name').isLength({ min: 2, max: 10 }).withMessage('姓名长度需在2-10个字符之间'),
    handleValidation,
  ],

  // 姓名配对
  nameMatch: [
    body('name1').isLength({ min: 2, max: 10 }).withMessage('您的姓名长度需在2-10个字符之间'),
    body('name2').isLength({ min: 2, max: 10 }).withMessage('对方的姓名长度需在2-10个字符之间'),
    body('relationType').optional().isIn(['love', 'business', 'friend']).withMessage('关系类型无效'),
    handleValidation,
  ],

  // 双人八字配对
  baziMatch: [
    body('name1').isLength({ min: 2, max: 10 }).withMessage('您的姓名长度需在2-10个字符之间'),
    body('solarDate1').notEmpty().withMessage('阳历日期1不能为空'),
    body('birthTime1').notEmpty().withMessage('出生时辰1不能为空'),
    body('gender1').isIn(['male', 'female']).withMessage('性别1值无效'),
    body('name2').isLength({ min: 2, max: 10 }).withMessage('对方的姓名长度需在2-10个字符之间'),
    body('solarDate2').notEmpty().withMessage('阳历日期2不能为空'),
    body('birthTime2').notEmpty().withMessage('出生时辰2不能为空'),
    body('gender2').isIn(['male', 'female']).withMessage('性别2值无效'),
    body('relationType').optional().isIn(['love', 'business', 'friend']).withMessage('关系类型无效'),
    handleValidation,
  ],

  // 风水分析
  fengshui: [
    body('direction').notEmpty().withMessage('朝向不能为空'),
    body('layout').notEmpty().withMessage('格局描述不能为空'),
    handleValidation,
  ],

  // 获取算命记录
  getRecord: [
    param('id').isMongoId().withMessage('记录ID格式不正确'),
    handleValidation,
  ],

  // 获取算命列表
  getList: [
    query('page').optional().isInt({ min: 1 }).withMessage('页码格式不正确'),
    query('pageSize').optional().isInt({ min: 1, max: 50 }).withMessage('每页数量格式不正确'),
    query('type').optional().isIn(['bazi', 'daily', 'tarot', 'name', 'fengshui', 'nameMatch', 'baziMatch']).withMessage('类型值无效'),
    handleValidation,
  ],
};

// 支付相关校验
const paymentValidation = {
  // 创建订单
  createOrder: [
    body('productType').notEmpty().withMessage('商品类型不能为空'),
    body('productId').optional().isString().withMessage('商品ID格式不正确'),
    handleValidation,
  ],

  // 支付回调
  wechatCallback: [
    body('resource').notEmpty().withMessage('支付数据不能为空'),
    handleValidation,
  ],

  // 申请退款
  refund: [
    body('orderNo').notEmpty().withMessage('订单号不能为空'),
    body('reason').optional().isString(),
    handleValidation,
  ],
};

// 推送相关校验
const pushValidation = {
  // 订阅推送
  subscribe: [
    body('templateId').notEmpty().withMessage('模板ID不能为空'),
    handleValidation,
  ],

  // 取消订阅
  unsubscribe: [
    body('templateId').notEmpty().withMessage('模板ID不能为空'),
    handleValidation,
  ],
};

// 通用校验
const commonValidation = {
  // 分页参数
  pagination: [
    query('page').optional().isInt({ min: 1 }).withMessage('页码格式不正确'),
    query('pageSize').optional().isInt({ min: 1, max: 50 }).withMessage('每页数量格式不正确'),
    handleValidation,
  ],

  // ID 参数
  mongoId: [
    param('id').isMongoId().withMessage('ID格式不正确'),
    handleValidation,
  ],
};

module.exports = {
  handleValidation,
  userValidation,
  fortuneValidation,
  paymentValidation,
  pushValidation,
  commonValidation,
};
