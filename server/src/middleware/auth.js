const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// 生成 JWT token
function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// 验证 JWT token
function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

// 鉴权中间件
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      code: 401,
      message: '未提供有效的认证令牌',
    });
  }

  const token = authHeader.substring(7);
  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        code: 401,
        message: '令牌已过期，请重新登录',
      });
    }
    return res.status(401).json({
      code: 401,
      message: '无效的认证令牌',
    });
  }
}

// 可选鉴权中间件（不强制要求登录）
function optionalAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.substring(7);
  try {
    const decoded = verifyToken(token);
    req.user = decoded;
  } catch (error) {
    req.user = null;
  }
  next();
}

// 管理员鉴权中间件（仅允许 SVIP / Admin 访问）
async function adminMiddleware(req, res, next) {
  const User = require('../models/User');
  authMiddleware(req, res, async () => {
    try {
      const user = await User.findById(req.user.userId);
      if (!user || user.memberLevel < 2) {
        return res.status(403).json({
          code: 403,
          message: '权限不足，仅限管理员访问',
        });
      }
      req.adminUser = user;
      next();
    } catch (error) {
      next(error);
    }
  });
}

module.exports = {
  generateToken,
  verifyToken,
  authMiddleware,
  optionalAuthMiddleware,
  adminMiddleware,
};
