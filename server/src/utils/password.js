const crypto = require('crypto');
const { promisify } = require('util');
const scrypt = promisify(crypto.scrypt);
const options = { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 };

async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 6 || password.length > 64) throw new Error('密码长度需在6到64位之间');
  const salt = crypto.randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 32, options);
  return `scrypt$16384$8$1$${salt}$${key.toString('hex')}`;
}

async function verifyPassword(password, stored) {
  if (typeof password !== 'string' || password.length > 64 || typeof stored !== 'string') return false;
  if (/^[0-9a-f]{64}$/.test(stored)) {
    const key = crypto.createHash('sha256').update(password).digest();
    return crypto.timingSafeEqual(key, Buffer.from(stored, 'hex'));
  }
  // Only the fixed, bounded cost we issue is accepted from stored data.
  const match = /^scrypt\$16384\$8\$1\$([0-9a-f]{32})\$([0-9a-f]{64})$/.exec(stored);
  if (!match) return false;
  const key = await scrypt(password, match[1], 32, options);
  return crypto.timingSafeEqual(key, Buffer.from(match[2], 'hex'));
}

module.exports = { hashPassword, verifyPassword };
