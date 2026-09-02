const jwt = require('jsonwebtoken');
const { isAdminUser } = require('../config/admin');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// 占位符一律拒绝启动：曾经 `your_jwt_secret_key_here` 靠多一个后缀绕过了这道检查
const JWT_SECRET_PLACEHOLDERS = [
  'your_jwt_secret_key',
  'your_jwt_secret_key_here',
  'changeme',
  'secret',
];

if (!JWT_SECRET || JWT_SECRET_PLACEHOLDERS.includes(JWT_SECRET.trim().toLowerCase())) {
  throw new Error('JWT_SECRET must be configured with a strong production secret.');
}

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
    // 没带令牌就是游客，正常返回默认内容
    req.user = null;
    return next();
  }

  const token = authHeader.substring(7);
  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    return next();
  } catch (error) {
    // 带了令牌但验不过（最常见是过期）：这里以前当游客放过去，
    // 于是客户端拿到的是一份默认运势，人却以为「我的生日和运势丢了」，
    // 而且没有 401 就永远不会触发客户端换令牌。改成如实回 401，
    // 让客户端走已有的恢复流程（换到新令牌后自动重试一次）
    return res.status(401).json({
      code: 401,
      message: error.name === 'TokenExpiredError' ? '令牌已过期，请重新登录' : '无效的认证令牌',
    });
  }
}

// 管理员鉴权中间件
async function adminMiddleware(req, res, next) {
  const User = require('../models/User');
  authMiddleware(req, res, async () => {
    try {
      const user = await User.findById(req.user.userId);
      if (!isAdminUser(user)) {
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
