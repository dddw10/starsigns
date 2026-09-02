// 系统开关（configs 集合）的读写与进程内缓存
// auditMode 就是小程序端的「简洁模式」：开启后首页只放出星座能量与空间美学
const mongoose = require('mongoose');

const CACHE_TTL_MS = 60 * 1000;

let cache = { value: null, expireAt: 0 };

function getDb() {
  return mongoose.connection && mongoose.connection.db ? mongoose.connection.db : null;
}

// 没有数据库配置时的兜底：环境变量说了 false 才关，其余一律按开启处理（送审安全第一）
function auditModeFromEnv() {
  return process.env.AUDIT_MODE !== 'false';
}

// 读取 auditMode，命中缓存则不查库
async function getAuditMode() {
  if (cache.value !== null && Date.now() < cache.expireAt) {
    return cache.value;
  }

  let auditMode;
  const db = getDb();
  if (db) {
    const config = await db.collection('configs').findOne({ key: 'auditMode' });
    auditMode = config ? !!config.value : auditModeFromEnv();
  } else {
    auditMode = auditModeFromEnv();
  }

  cache = { value: auditMode, expireAt: Date.now() + CACHE_TTL_MS };
  return auditMode;
}

// 写入 auditMode 并顺手刷新缓存，避免管理员切完还要等 60 秒
async function setAuditMode(auditMode) {
  const db = getDb();
  if (!db) {
    throw new Error('数据库未连接，暂时无法保存系统配置');
  }
  await db.collection('configs').updateOne(
    { key: 'auditMode' },
    { $set: { value: !!auditMode, updatedAt: new Date() } },
    { upsert: true }
  );
  cache = { value: !!auditMode, expireAt: Date.now() + CACHE_TTL_MS };
  return !!auditMode;
}

function invalidateAuditModeCache() {
  cache = { value: null, expireAt: 0 };
}

module.exports = {
  getAuditMode,
  setAuditMode,
  invalidateAuditModeCache,
};
