const { getRedis } = require('../config/redis');

// 默认限流配置
const DEFAULT_CONFIG = {
  windowMs: 60 * 1000, // 1 分钟窗口
  max: 100, // 窗口内最大请求数
  message: '请求过于频繁，请稍后再试',
};

// 内存存储（降级方案）
const memoryStore = new Map();

// 创建限流中间件
function createRateLimiter(options = {}) {
  const config = { ...DEFAULT_CONFIG, ...options };

  return async (req, res, next) => {
    const key = `ratelimit:${config.keyPrefix || ''}:${req.ip}`;
    const now = Date.now();
    const windowStart = now - config.windowMs;

    try {
      // 尝试使用 Redis
      let redis;
      try {
        redis = getRedis();
      } catch (e) {
        // Redis 不可用，降级到内存存储
      }

      if (redis) {
        // 使用 Redis 滑动窗口
        const pipeline = redis.pipeline();
        pipeline.zremrangebyscore(key, 0, windowStart);
        pipeline.zadd(key, now, `${now}-${Math.random()}`);
        pipeline.zcard(key);
        pipeline.pexpire(key, config.windowMs);

        const results = await pipeline.exec();
        const count = results[2][1];

        if (count > config.max) {
          return res.status(429).json({
            code: 429,
            message: config.message,
          });
        }
      } else {
        // 降级到内存存储
        const record = memoryStore.get(key) || { count: 0, resetAt: now + config.windowMs };

        if (now > record.resetAt) {
          record.count = 0;
          record.resetAt = now + config.windowMs;
        }

        record.count += 1;
        memoryStore.set(key, record);

        // 清理过期记录
        if (memoryStore.size > 10000) {
          for (const [k, v] of memoryStore.entries()) {
            if (now > v.resetAt) {
              memoryStore.delete(k);
            }
          }
        }

        if (record.count > config.max) {
          return res.status(429).json({
            code: 429,
            message: config.message,
          });
        }
      }

      next();
    } catch (error) {
      // 出错时放行
      next();
    }
  };
}

// 预定义的限流策略
const rateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 100,
  message: '请求过于频繁，请稍后再试',
});

// 严格限流（用于敏感接口）
const strictRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  keyPrefix: 'strict',
  message: '操作过于频繁，请1分钟后再试',
});

// 登录限流
const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: process.env.NODE_ENV === 'production' ? 20 : 100,
  keyPrefix: 'login',
  message: '登录尝试次数过多，请15分钟后再试',
});

module.exports = {
  createRateLimiter,
  rateLimiter,
  strictRateLimiter,
  loginRateLimiter,
};
