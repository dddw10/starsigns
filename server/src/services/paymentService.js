const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Order = require('../models/Order');
const User = require('../models/User');
const Fortune = require('../models/Fortune');
const wechatConfig = require('../config/wechat');
const { getRedis } = require('../config/redis');

// 商品配置
const PRODUCTS = {
  fortune_bazi: { name: '八字算命', amount: 990, description: '生辰八字详细分析' },
  fortune_tarot: { name: '塔罗牌占卜', amount: 1990, description: '专业塔罗牌占卜解读' },
  fortune_name: { name: '姓名测算', amount: 590, description: '姓名五格三才分析' },
  fortune_fengshui: { name: '风水分析', amount: 2990, description: '专业风水分析报告' },
  member_monthly: { name: '月度VIP会员', amount: 1990, description: '30天VIP会员权益', duration: 30 },
  member_yearly: { name: '年度SVIP会员', amount: 29900, description: '365天SVIP会员权益', duration: 365 },
  vip_monthly: { name: 'VIP月卡', amount: 1990, description: '30天VIP会员权益', level: 1, duration: 30 },
  vip_yearly: { name: 'VIP年卡', amount: 16800, description: '365天VIP会员权益', level: 1, duration: 365 },
  svip_monthly: { name: 'SVIP月卡', amount: 2990, description: '30天SVIP会员权益', level: 2, duration: 30 },
  svip_yearly: { name: 'SVIP年卡', amount: 29900, description: '365天SVIP会员权益', level: 2, duration: 365 },
  quota_pack: { name: '算命次数包', amount: 490, description: '5次算命机会', quota: 5 },
};

// 会员权益配置
const MEMBER_BENEFITS = {
  0: { name: '普通用户', dailyFree: 1, discount: 1.0, features: [] },
  1: { name: 'VIP会员', dailyFree: 5, discount: 0.8, features: ['专属客服', '优先响应', '详细解读'] },
  2: { name: 'SVIP会员', dailyFree: 10, discount: 0.6, features: ['专属客服', '优先响应', '详细解读', 'AI深度分析', '个性化报告'] },
};

class PaymentService {
  // 创建订单
  async createOrder(userId, data) {
    const { productType, productId } = data;

    const product = PRODUCTS[productType];
    if (!product) {
      throw new Error('商品类型不存在');
    }

    // 检查用户是否已有所需会员
    if (this._isMemberProduct(productType)) {
      const user = await User.findById(userId);
      if (user && user.memberExpireAt && user.memberExpireAt > new Date()) {
        const newLevel = this._getMemberProductLevel(productType);
        if (user.memberLevel > newLevel) {
          const error = new Error('您已拥有更高等级的会员');
          error.status = 400;
          throw error;
        }
      }
    }

    // 创建订单
    const orderNo = Order.generateOrderNo();
    const order = await Order.create({
      orderNo,
      userId,
      productType,
      productName: product.name,
      amount: product.amount,
      status: 'pending',
      metadata: { productId, description: product.description },
    });

    // 调用微信支付统一下单
    try {
      const prepayResult = await this._wechatPrepay(order);
      order.prepayId = prepayResult.prepay_id;
      if (prepayResult.mockPaid) {
        order.status = 'paid';
        order.transactionId = prepayResult.transactionId;
        order.paidAt = new Date();
        order.actualAmount = order.amount;
        await this._handleOrderBusiness(order);
      }
      await order.save();

      return {
        orderNo,
        status: order.status,
        amount: product.amount,
        productName: product.name,
        prepayData: prepayResult,
      };
    } catch (error) {
      order.status = 'cancelled';
      await order.save();
      throw new Error('创建支付订单失败');
    }
  }

  // 微信支付统一下单（JSAPI）
  async _wechatPrepay(order) {
    const nonceStr = this._generateNonceStr();
    const timeStamp = Math.floor(Date.now() / 1000).toString();

    if (this._shouldUseMockPayment()) {
      return this._mockPrepay(order, timeStamp, nonceStr);
    }

    // 获取用户openid
    const user = await User.findById(order.userId);
    const openid = user ? user.openid : '';

    // 构建下单参数
    const params = {
      appid: wechatConfig.appId,
      mchid: wechatConfig.mchId,
      description: order.productName,
      out_trade_no: order.orderNo,
      notify_url: `${process.env.BASE_URL || 'https://your-domain.com'}/api/payment/wechat/notify`,
      amount: {
        total: order.amount,
        currency: 'CNY',
      },
      payer: {
        openid: openid,
      },
      time_expire: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    };

    try {
      // 调用微信支付统一下单接口
      const response = await axios.post(
        'https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi',
        params,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': await this._getWechatAuth(),
          },
        }
      );

      if (response.data && response.data.prepay_id) {
        // 生成小程序支付签名
        const paySign = this._generatePaySign(response.data.prepay_id, timeStamp, nonceStr);

        return {
          prepay_id: response.data.prepay_id,
          timeStamp,
          nonceStr,
          package: `prepay_id=${response.data.prepay_id}`,
          signType: 'RSA',
          paySign,
        };
      }

      throw new Error('获取预支付ID失败');
    } catch (error) {
      console.error('微信统一下单失败:', error.response?.data || error.message);
      // 降级处理：使用模拟数据（开发环境）
      if (process.env.NODE_ENV === 'development') {
        return this._mockPrepay(order, timeStamp, nonceStr);
      }
      throw error;
    }
  }

  // 获取微信支付授权
  async _getWechatAuth() {
    const redis = getRedis();
    const cacheKey = 'wechat:pay:token';

    // 尝试从缓存获取
    const cached = await redis.get(cacheKey);
    if (cached) {
      return `WECHATPAY2-SHA256-RSA2048 ${cached}`;
    }

    // 生成签名
    const timestamp = Math.floor(Date.now() / 1000);
    const nonceStr = this._generateNonceStr();
    const message = `${wechatConfig.mchId}\n${timestamp}\n${nonceStr}\n\n`;

    try {
      const privateKey = fs.readFileSync(path.resolve(wechatConfig.keyPath), 'utf8');
      const sign = crypto.createSign('RSA-SHA256');
      sign.update(message);
      const signature = sign.sign(privateKey, 'base64');

      const token = `mchid="${wechatConfig.mchId}",nonce_str="${nonceStr}",signature="${signature}",timestamp="${timestamp}",serial_no="${wechatConfig.serialNo || 'mock_serial'}"`;

      // 缓存5分钟
      await redis.set(cacheKey, token, 'EX', 300);

      return `WECHATPAY2-SHA256-RSA2048 ${token}`;
    } catch (error) {
      console.error('生成微信支付签名失败:', error.message);
      throw error;
    }
  }

  // 生成小程序支付签名
  _generatePaySign(prepayId, timeStamp, nonceStr) {
    const message = `${wechatConfig.appId}\n${timeStamp}\n${nonceStr}\nprepay_id=${prepayId}\n`;

    try {
      const privateKey = fs.readFileSync(path.resolve(wechatConfig.keyPath), 'utf8');
      const sign = crypto.createSign('RSA-SHA256');
      sign.update(message);
      return sign.sign(privateKey, 'base64');
    } catch (error) {
      console.error('生成支付签名失败:', error.message);
      return 'mock_sign_' + nonceStr;
    }
  }

  // 生成随机字符串
  _generateNonceStr(length = 32) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  _shouldUseMockPayment() {
    const placeholderValues = ['your_app_id', 'your_mch_id', 'your_api_key'];
    return process.env.NODE_ENV === 'development'
      || placeholderValues.includes(wechatConfig.appId)
      || placeholderValues.includes(wechatConfig.mchId)
      || placeholderValues.includes(wechatConfig.apiKey);
  }

  _mockPrepay(order, timeStamp, nonceStr) {
    const prepayId = `mock_${order.orderNo}_${Date.now()}`;
    return {
      prepay_id: prepayId,
      timeStamp,
      nonceStr,
      package: `prepay_id=${prepayId}`,
      signType: 'RSA',
      paySign: 'mock_sign_' + nonceStr,
      mock: true,
      mockPaid: true,
      transactionId: `mock_tx_${Date.now()}`,
    };
  }

  // 查询订单状态
  async getOrderStatus(userId, orderNo) {
    const order = await Order.findOne({ orderNo, userId });
    if (!order) {
      throw new Error('订单不存在');
    }

    return {
      orderNo: order.orderNo,
      status: order.status,
      amount: order.amount,
      paidAt: order.paidAt,
      productName: order.productName,
    };
  }

  // 获取用户订单列表
  async getUserOrders(userId, options = {}) {
    const { page = 1, pageSize = 10, status } = options;

    const query = { userId };
    if (status) {
      query.status = status;
    }

    const total = await Order.countDocuments(query);
    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(parseInt(pageSize, 10));

    return {
      total,
      page: parseInt(page, 10),
      pageSize: parseInt(pageSize, 10),
      orders,
    };
  }

  // 处理微信支付回调
  async handleWechatNotify(data) {
    try {
      // 验证签名
      const isValid = await this._verifyWechatNotifySign(data);
      if (!isValid) {
        console.error('微信支付回调签名验证失败');
        return { code: 'FAIL', message: '签名验证失败' };
      }

      // 解密支付数据
      const paymentData = await this._decryptNotifyResource(data.resource);
      if (!paymentData) {
        return { code: 'FAIL', message: '解密失败' };
      }

      const { out_trade_no, transaction_id, trade_state } = paymentData;

      // 只处理支付成功的通知
      if (trade_state !== 'SUCCESS') {
        return { code: 'SUCCESS', message: '非成功状态，忽略' };
      }

      const order = await Order.findOne({ orderNo: out_trade_no });
      if (!order) {
        return { code: 'FAIL', message: '订单不存在' };
      }

      // 幂等性处理：已支付则直接返回成功
      if (order.status === 'paid') {
        return { code: 'SUCCESS', message: '已处理' };
      }

      // 使用 Redis 分布式锁防止并发处理
      const redis = getRedis();
      const lockKey = `pay:lock:${order.orderNo}`;
      const lockValue = Date.now().toString();

      const acquired = await redis.set(lockKey, lockValue, 'NX', 'EX', 10);
      if (!acquired) {
        // 等待其他进程处理完成
        await new Promise(resolve => setTimeout(resolve, 1000));
        const updatedOrder = await Order.findOne({ orderNo: out_trade_no });
        if (updatedOrder && updatedOrder.status === 'paid') {
          return { code: 'SUCCESS', message: '已处理' };
        }
        return { code: 'FAIL', message: '处理中，请稍后' };
      }

      try {
        // 更新订单状态
        order.status = 'paid';
        order.transactionId = transaction_id;
        order.paidAt = new Date();
        order.actualAmount = order.amount;
        await order.save();

        // 处理订单业务逻辑
        await this._handleOrderBusiness(order);

        return { code: 'SUCCESS', message: '成功' };
      } finally {
        // 释放锁
        await redis.del(lockKey);
      }
    } catch (error) {
      console.error('处理支付回调失败:', error);
      return { code: 'FAIL', message: '处理失败' };
    }
  }

  // 验证微信支付回调签名
  async _verifyWechatNotifySign(data) {
    try {
      const { headers, body } = data;
      const timestamp = headers['wechatpay-timestamp'];
      const nonce = headers['wechatpay-nonce'];
      const signature = headers['wechatpay-signature'];
      const serial = headers['wechatpay-serial'];

      if (!timestamp || !nonce || !signature || !serial) {
        return false;
      }

      const message = `${timestamp}\n${nonce}\n${body}\n`;
      const publicKey = await this._getWechatPublicKey(serial);

      const verify = crypto.createVerify('RSA-SHA256');
      verify.update(message);
      return verify.verify(publicKey, signature, 'base64');
    } catch (error) {
      console.error('验证签名失败:', error.message);
      return false;
    }
  }

  // 获取微信支付平台证书公钥
  async _getWechatPublicKey(serial) {
    const redis = getRedis();
    const cacheKey = `wechat:cert:${serial}`;

    const cached = await redis.get(cacheKey);
    if (cached) {
      return cached;
    }

    // 实际项目中应该从微信平台证书API获取
    // 这里简化处理，使用本地证书
    try {
      const certPath = path.resolve(wechatConfig.certPath);
      const cert = fs.readFileSync(certPath, 'utf8');
      await redis.set(cacheKey, cert, 'EX', 3600);
      return cert;
    } catch (error) {
      console.error('获取微信公钥失败:', error.message);
      return null;
    }
  }

  // 解密微信支付回调数据
  async _decryptNotifyResource(resource) {
    try {
      const { ciphertext, nonce, associated_data } = resource;

      // 获取API密钥
      const apiKey = wechatConfig.apiKey;
      const keyBuffer = Buffer.from(apiKey, 'utf8');

      // 解密
      const ciphertextBuffer = Buffer.from(ciphertext, 'base64');
      const authTag = ciphertextBuffer.slice(ciphertextBuffer.length - 16);
      const dataBuffer = ciphertextBuffer.slice(0, ciphertextBuffer.length - 16);

      const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, nonce);
      decipher.setAuthTag(authTag);
      if (associated_data) {
        decipher.setAAD(Buffer.from(associated_data, 'utf8'));
      }

      const decrypted = Buffer.concat([decipher.update(dataBuffer), decipher.final()]);
      return JSON.parse(decrypted.toString('utf8'));
    } catch (error) {
      console.error('解密支付数据失败:', error.message);
      // 开发环境模拟数据
      if (process.env.NODE_ENV === 'development') {
        return {
          out_trade_no: resource.out_trade_no || 'test_order',
          transaction_id: 'mock_tx_' + Date.now(),
          trade_state: 'SUCCESS',
        };
      }
      return null;
    }
  }

  // 处理订单业务逻辑
  async _handleOrderBusiness(order) {
    switch (order.productType) {
      case 'member_monthly':
      case 'vip_monthly':
        await this._activateMembership(order.userId, 1, 30);
        break;
      case 'member_yearly':
      case 'svip_yearly':
        await this._activateMembership(order.userId, 2, 365);
        break;
      case 'vip_yearly':
        await this._activateMembership(order.userId, 1, 365);
        break;
      case 'svip_monthly':
        await this._activateMembership(order.userId, 2, 30);
        break;
      case 'quota_pack':
        await this._addQuota(order.userId, 5);
        break;
      case 'fortune_bazi':
      case 'fortune_tarot':
      case 'fortune_name':
      case 'fortune_fengshui':
        // 标记对应的算命记录为已支付
        if (order.fortuneId) {
          await Fortune.findByIdAndUpdate(order.fortuneId, { isPaid: true });
        }
        break;
    }
  }

  // 激活会员
  async _activateMembership(userId, level, days) {
    const user = await User.findById(userId);
    if (!user) return;

    const now = new Date();
    const baseTime = user.memberExpireAt && user.memberExpireAt > now ? user.memberExpireAt : now;

    if (level > user.memberLevel) {
      user.memberLevel = level;
    }
    user.memberExpireAt = new Date(baseTime.getTime() + days * 24 * 60 * 60 * 1000);

    await user.save();
  }

  // 增加算命次数
  async _addQuota(userId, count) {
    const user = await User.findById(userId);
    if (!user) return;

    user.fortuneQuota += count;
    await user.save();
  }

  // 申请退款
  async refund(userId, orderNo, reason) {
    const order = await Order.findOne({ orderNo, userId });
    if (!order) {
      throw new Error('订单不存在');
    }

    if (order.status !== 'paid') {
      throw new Error('订单状态不支持退款');
    }

    // 检查是否超过退款期限（7天内）
    const paidTime = new Date(order.paidAt).getTime();
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    if (now - paidTime > sevenDays) {
      throw new Error('已超过7天退款期限');
    }

    // 调用微信退款接口
    try {
      const refundResult = await this._wechatRefund(order, reason);
      order.status = 'refunding';
      order.refundNo = refundResult.refund_id;
      order.refundedAt = new Date();
      order.refundReason = reason || '';
      await order.save();

      return {
        orderNo,
        status: 'refunding',
        refundNo: refundResult.refund_id,
      };
    } catch (error) {
      throw new Error('退款申请失败: ' + error.message);
    }
  }

  // 微信退款接口
  async _wechatRefund(order, reason) {
    const refundNo = `RF${order.orderNo}`;
    const params = {
      out_trade_no: order.orderNo,
      out_refund_no: refundNo,
      reason: reason || '用户申请退款',
      notify_url: `${process.env.BASE_URL || 'https://your-domain.com'}/api/payment/wechat/refund-notify`,
      amount: {
        refund: order.amount,
        total: order.amount,
        currency: 'CNY',
      },
    };

    try {
      const response = await axios.post(
        'https://api.mch.weixin.qq.com/v3/refund/domestic/refunds',
        params,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': await this._getWechatAuth(),
          },
        }
      );

      if (response.data && response.data.refund_id) {
        return response.data;
      }

      throw new Error('退款接口返回异常');
    } catch (error) {
      console.error('微信退款失败:', error.response?.data || error.message);
      // 开发环境模拟
      if (process.env.NODE_ENV === 'development') {
        return {
          refund_id: refundNo,
          status: 'SUCCESS',
        };
      }
      throw error;
    }
  }

  // 处理退款回调
  async handleRefundNotify(data) {
    try {
      const paymentData = await this._decryptNotifyResource(data.resource);
      if (!paymentData) {
        return { code: 'FAIL', message: '解密失败' };
      }

      const { out_trade_no, refund_status } = paymentData;

      const order = await Order.findOne({ orderNo: out_trade_no });
      if (!order) {
        return { code: 'FAIL', message: '订单不存在' };
      }

      if (refund_status === 'SUCCESS') {
        order.status = 'refunded';
        await order.save();

        // 回退业务逻辑
        await this._rollbackOrderBusiness(order);
      } else if (refund_status === 'CLOSED' || refund_status === 'ABNORMAL') {
        order.status = 'paid';
        order.refundNo = '';
        await order.save();
      }

      return { code: 'SUCCESS', message: '成功' };
    } catch (error) {
      console.error('处理退款回调失败:', error);
      return { code: 'FAIL', message: '处理失败' };
    }
  }

  // 回退订单业务逻辑
  async _rollbackOrderBusiness(order) {
    switch (order.productType) {
      case 'member_monthly':
      case 'member_yearly':
      case 'vip_monthly':
      case 'vip_yearly':
      case 'svip_monthly':
      case 'svip_yearly': {
        // 检查是否有其他有效的会员订单
        const now = new Date();
        const otherActiveOrders = await Order.find({
          userId: order.userId,
          orderNo: { $ne: order.orderNo },
          productType: { $in: ['member_monthly', 'member_yearly', 'vip_monthly', 'vip_yearly', 'svip_monthly', 'svip_yearly'] },
          status: 'paid',
          createdAt: { $gt: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000) }, // 一年内
        });

        const user = await User.findById(order.userId);
        if (user) {
          // 如果没有其他有效会员订单，才降级
          if (otherActiveOrders.length === 0) {
            user.memberLevel = 0;
            user.memberExpireAt = null;
          } else {
            // 计算最高等级的会员
            const hasSvip = otherActiveOrders.some(o => this._getMemberProductLevel(o.productType) === 2);
            user.memberLevel = hasSvip ? 2 : 1;
          }
          await user.save();
        }
        break;
      }
      case 'quota_pack': {
        // 扣回次数
        const userForQuota = await User.findById(order.userId);
        if (userForQuota && userForQuota.fortuneQuota >= 5) {
          userForQuota.fortuneQuota -= 5;
          await userForQuota.save();
        }
        break;
      }
    }
  }

  // 查询退款状态
  async getRefundStatus(userId, orderNo) {
    const order = await Order.findOne({ orderNo, userId });
    if (!order) {
      throw new Error('订单不存在');
    }

    return {
      orderNo: order.orderNo,
      status: order.status,
      refundedAt: order.refundedAt,
    };
  }

  _isMemberProduct(productType) {
    return ['member_monthly', 'member_yearly', 'vip_monthly', 'vip_yearly', 'svip_monthly', 'svip_yearly'].includes(productType);
  }

  _getMemberProductLevel(productType) {
    return ['member_yearly', 'svip_monthly', 'svip_yearly'].includes(productType) ? 2 : 1;
  }
}

module.exports = new PaymentService();
