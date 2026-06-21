const Redis = require('ioredis');

const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = parseInt(process.env.REDIS_PORT, 10) || 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || '';
const REDIS_DB = parseInt(process.env.REDIS_DB, 10) || 0;

let redisClient = null;

async function connectRedis() {
  return new Promise((resolve, reject) => {
    redisClient = new Redis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      password: REDIS_PASSWORD || undefined,
      db: REDIS_DB,
      retryStrategy(times) {
        if (times > 3) return null;
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    redisClient.on('connect', () => {
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
