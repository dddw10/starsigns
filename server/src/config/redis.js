const Redis = require('ioredis');

const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = parseInt(process.env.REDIS_PORT, 10) || 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || '';
const REDIS_DB = parseInt(process.env.REDIS_DB, 10) || 0;

let redisClient = null;
let hasConnectedOnce = false;

async function connectRedis() {
  return new Promise((resolve, reject) => {
    redisClient = new Redis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      password: REDIS_PASSWORD || undefined,
      db: REDIS_DB,
      retryStrategy(times) {
        // 首次连接：失败 3 次即放弃，让服务降级为内存模式正常启动
        if (!hasConnectedOnce) {
          if (times > 3) return null;
          return Math.min(times * 50, 2000);
        }
        // 运行期断线（Redis 重启等）：持续重连，否则缓存会永久失效直到进程重启
        return Math.min(times * 200, 5000);
      },
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    redisClient.on('connect', () => {
      hasConnectedOnce = true;
      console.log('Redis 连接成功');
    });

    redisClient.on('error', (err) => {
      // silent
    });

    redisClient.connect().then(() => {
      resolve(redisClient);
    }).catch((err) => {
      redisClient = null;
      reject(err);
    });
  });
}

function getRedis() {
  if (!redisClient) {
    return null;
  }
  return redisClient;
}

module.exports = { connectRedis, getRedis };
