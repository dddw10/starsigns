#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { trustedProxies } = require('../src/config/proxy');

const placeholder = value => !String(value ?? '').trim() || /(?:your[_-]|replace[_-]|change[_-]?me|placeholder|example|<[^>]+>|^secret$)/i.test(String(value).trim());

function validateConfig(config) {
  const errors = new Set();
  const services = config.services || {};
  const app = services.app || services.server || {};
  const mongoName = services.mongo ? 'mongo' : 'mongodb';
  const mongo = services[mongoName] || {};
  const redis = services.redis || {};
  const env = app.environment || {};
  const mongoEnv = mongo.environment || {};
  const required = (name, value) => { if (placeholder(value)) errors.add(name); };
  for (const name of ['JWT_SECRET', 'WECHAT_APP_ID', 'WECHAT_APP_SECRET', 'MONGODB_URI', 'REDIS_PASSWORD']) required(name, env[name]);
  required('MONGO_ROOT_USERNAME', mongoEnv.MONGO_INITDB_ROOT_USERNAME);
  required('MONGO_ROOT_PASSWORD', mongoEnv.MONGO_INITDB_ROOT_PASSWORD);
  required('MONGO_APP_USERNAME', mongoEnv.MONGO_APP_USERNAME);
  required('MONGO_APP_PASSWORD', mongoEnv.MONGO_APP_PASSWORD);
  required('MONGO_APP_DATABASE', mongoEnv.MONGO_INITDB_DATABASE);
  if (env.NODE_ENV !== 'production') errors.add('NODE_ENV');
  if (env.BIND_HOST !== '0.0.0.0') errors.add('BIND_HOST');
  if (env.ALLOW_MOCK_LOGIN === 'true') errors.add('ALLOW_MOCK_LOGIN');
  for (const name of ['MONGO_ROOT_USERNAME', 'MONGO_ROOT_PASSWORD', 'MONGO_INITDB_ROOT_USERNAME', 'MONGO_INITDB_ROOT_PASSWORD']) {
    if (env[name]) errors.add(`app.${name}`);
  }
  try { trustedProxies(env.TRUST_PROXY); } catch { errors.add('TRUST_PROXY'); }
  if (mongoEnv.MONGO_APP_USERNAME === mongoEnv.MONGO_INITDB_ROOT_USERNAME
      || mongoEnv.MONGO_APP_PASSWORD === mongoEnv.MONGO_INITDB_ROOT_PASSWORD) errors.add('MONGO_APP_CREDENTIALS');
  try {
    const uri = new URL(env.MONGODB_URI);
    if (uri.protocol !== 'mongodb:' || uri.hostname !== mongoName || uri.port !== '27017'
      || decodeURIComponent(uri.username) !== mongoEnv.MONGO_APP_USERNAME
      || decodeURIComponent(uri.password) !== mongoEnv.MONGO_APP_PASSWORD
      || uri.pathname.slice(1) !== mongoEnv.MONGO_INITDB_DATABASE
      || uri.searchParams.get('authSource') !== mongoEnv.MONGO_INITDB_DATABASE) errors.add('MONGODB_URI');
  } catch { errors.add('MONGODB_URI'); }
  if (!(mongo.command || []).includes('--auth') || (mongo.command || []).includes('--noauth')) errors.add('MONGO_AUTH');
  const command = redis.command || [];
  const passIndex = command.indexOf('--requirepass');
  if (command.filter(arg => arg === '--requirepass').length !== 1 || placeholder(command[passIndex + 1]) || command[passIndex + 1] !== env.REDIS_PASSWORD) errors.add('REDIS_AUTH');
  if (env.REDIS_HOST !== 'redis' || String(env.REDIS_PORT) !== '6379') errors.add('REDIS_ENDPOINT');
  for (const [name, service] of Object.entries(services)) {
    if (service.network_mode === 'host') errors.add(`${name}.network_mode`);
    for (const port of service.ports || []) {
      if (!['127.0.0.1', '::1'].includes(port.host_ip)) errors.add(`${name}.ports`);
    }
  }
  return [...errors].sort();
}

function preflight(envFile, composeFile) {
  for (const [label, file] of [['env-file', envFile], ['compose-file', composeFile]]) {
    if (!file || !fs.existsSync(file)) throw new Error(`missing ${label}`);
  }
  const result = spawnSync('docker', ['compose', '--env-file', path.resolve(envFile), '-f', path.resolve(composeFile), 'config', '--format', 'json'], {
    encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, env: { ...process.env, DEPLOY_ENV_FILE: path.resolve(envFile) },
  });
  // Compose 错误可能回显插值凭据，仅输出固定错误与变量名。
  if (result.error || result.status !== 0) throw new Error('Compose validation failed; inspect configuration privately');
  let config;
  try { config = JSON.parse(result.stdout); } catch { throw new Error('Compose returned invalid configuration'); }
  const errors = validateConfig(config);
  if (errors.length) throw new Error(`invalid configuration: ${errors.join(', ')}`);
  console.log('Preflight OK: production, authenticated Mongo/Redis, separate application account, loopback/container-only ports, explicit proxy policy.');
}

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 4 || args[0] !== '--env-file' || args[2] !== '-f') throw new Error('usage: deploy-preflight.js --env-file FILE -f FILE');
    preflight(args[1], args[3]);
  } catch (error) { console.error(`Preflight refused: ${error.message}`); process.exitCode = 1; }
}
module.exports = { validateConfig, preflight };
