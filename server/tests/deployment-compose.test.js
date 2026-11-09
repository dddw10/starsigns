const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '../..');
const available = spawnSync('docker', ['compose', 'version'], { encoding: 'utf8' }).status === 0;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fortune-compose-'));
const envFile = path.join(dir, 'production.env');
fs.writeFileSync(envFile, [
  'NODE_ENV=production', 'MONGO_ROOT_USERNAME=fixture_admin', 'MONGO_ROOT_PASSWORD=fixture_root_pass',
  'MONGO_APP_USERNAME=fixture_app', 'MONGO_APP_PASSWORD=fixture_app_pass', 'MONGO_APP_DATABASE=fortune_miniprogram',
  'MONGODB_URI=mongodb://fixture_app:fixture_app_pass@mongo:27017/fortune_miniprogram?authSource=fortune_miniprogram',
  'REDIS_HOST=redis', 'REDIS_PORT=6379', 'REDIS_PASSWORD=fixture_redis_pass', 'TRUST_PROXY=172.20.0.2/32',
  'JWT_SECRET=fixture_jwt_secret_32_chars_independent', 'WECHAT_APP_ID=wx_fixture', 'WECHAT_APP_SECRET=fixture_wechat_secret',
].join('\n'));
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

(available ? test.each : test.skip.each)([
  ['docker-compose.yml', 'mongodb', 'server', 'mongo:7', 'mongodb_data'],
  ['server/docker-compose.prod.yml', 'mongo', 'app', 'mongo:6.0', 'mongo-data'],
])('%s preserves original Mongo and volume while enforcing application credentials and private ports', (file, mongoName, appName, image, volume) => {
  const result = spawnSync('docker', ['compose', '--env-file', envFile, '-f', path.join(root, file), 'config', '--format', 'json'], { encoding: 'utf8', env: { ...process.env, DEPLOY_ENV_FILE: envFile } });
  expect(result.status).toBe(0);
  const config = JSON.parse(result.stdout);
  const mongo = config.services[mongoName];
  const app = config.services[appName];
  expect(mongo.image).toBe(image);
  expect(mongo.volumes.some(item => item.source === volume)).toBe(true);
  expect(mongo.command).toContain('--auth');
  expect(mongo.environment.MONGO_APP_USERNAME).toBe('fixture_app');
  expect(app.environment.MONGO_ROOT_PASSWORD || '').toBe('');
  expect(app.environment.MONGO_ROOT_USERNAME || '').toBe('');
  expect(app.environment.BIND_HOST).toBe('0.0.0.0');
  expect(app.environment.MONGODB_URI).toContain(`@${mongoName}:27017/fortune_miniprogram?authSource=fortune_miniprogram`);
  for (const service of Object.values(config.services)) {
    expect((service.ports || []).every(port => ['127.0.0.1', '::1'].includes(port.host_ip))).toBe(true);
  }
  const { validateConfig } = require('../scripts/deploy-preflight');
  expect(validateConfig(config)).toEqual([]);
});

(available ? test : test.skip)('preflight selects the same custom env file for interpolation and the application environment', () => {
  const result = spawnSync(process.execPath, [path.join(root, 'server/scripts/deploy-preflight.js'), '--env-file', envFile, '-f', path.join(root, 'server/docker-compose.prod.yml')], {
    encoding: 'utf8', env: { ...process.env, DEPLOY_ENV_FILE: path.join(dir, 'wrong.env') },
  });
  expect(result.status).toBe(0);
  expect(result.stdout + result.stderr).not.toContain('fixture_root_pass');
});
