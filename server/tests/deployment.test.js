const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '../..');
const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : '/bin/bash';
const unix = value => value.replace(/\\/g, '/').replace(/^([A-Z]):/i, (_, drive) => `/${drive.toLowerCase()}`);
const fixtures = [];

function fixture(config = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fortune-deploy-'));
  fixtures.push(dir);
  fs.mkdirSync(path.join(dir, 'bin'));
  fs.mkdirSync(path.join(dir, 'src'));
  fs.mkdirSync(path.join(dir, 'public'));
  fs.writeFileSync(path.join(dir, 'src/old.txt'), 'keep');
  fs.writeFileSync(path.join(dir, 'public/old.txt'), 'keep');
  fs.writeFileSync(path.join(dir, '.env.production'), 'NODE_ENV=production\n');
  fs.writeFileSync(path.join(dir, 'docker-compose.prod.yml'), 'fixture');
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(config));
  fs.writeFileSync(path.join(dir, 'bin/docker'), '#!/bin/sh\nprintf "%s\\n" "$*" >> "$APP_DIR/calls"\nexit "${DOCKER_UP_STATUS:-0}"\n');
  fs.writeFileSync(path.join(dir, 'preflight-driver.js'), `const fs = require('fs'); const cp = require('child_process'); cp.spawnSync = (cmd, args) => { fs.appendFileSync('calls', args.join(' ') + '\\n'); return { status: Number(process.env.COMPOSE_CONFIG_STATUS || 0), stdout: fs.readFileSync('config.json', 'utf8'), stderr: 'fixture-private-secret' }; }; const { preflight } = require(${JSON.stringify(path.join(root, 'server/scripts/deploy-preflight.js'))}); try { preflight(process.argv[4], process.argv[6]); } catch (error) { console.error(error.message); process.exit(1); }`);
  fs.writeFileSync(path.join(dir, 'bin/node'), `#!/bin/sh\nexec '${unix(process.execPath)}' '${unix(path.join(dir, 'preflight-driver.js'))}' "$@"\n`);
  return dir;
}

function runShell(dir, args = ['--dry-run'], env = {}, script = 'server/deploy-cloud.sh') {
  return spawnSync(bash, [unix(path.join(root, script)), ...args], {
    encoding: 'utf8', env: { ...process.env, APP_DIR: unix(dir), PATH: `${unix(path.join(dir, 'bin'))}:/usr/bin:/bin`, NODE_BINARY: unix(path.join(dir, 'bin/node')), ...env },
  });
}

afterAll(() => fixtures.forEach(dir => fs.rmSync(dir, { recursive: true, force: true })));

test('shell preflight refuses missing credentials before changing old application files', () => {
  const dir = fixture();
  const result = runShell(dir);
  expect(result.status).not.toBe(0);
  expect(fs.readFileSync(path.join(dir, 'src/old.txt'), 'utf8')).toBe('keep');
  expect(fs.readFileSync(path.join(dir, 'public/old.txt'), 'utf8')).toBe('keep');
  expect(fs.existsSync(path.join(dir, 'logs'))).toBe(false);
  expect(fs.readFileSync(path.join(dir, 'calls'), 'utf8')).not.toContain('up ');
});

function validConfig() {
  return { services: {
    app: { environment: { NODE_ENV: 'production', BIND_HOST: '0.0.0.0', JWT_SECRET: 'fixture-jwt-32-chars-independent', WECHAT_APP_ID: 'wx-fixture-id', WECHAT_APP_SECRET: 'fixture-wechat-secret', MONGODB_URI: 'mongodb://app:fixture-app-pass@mongo:27017/fortune_miniprogram?authSource=fortune_miniprogram', REDIS_HOST: 'redis', REDIS_PORT: '6379', REDIS_PASSWORD: 'fixture-redis-pass', TRUST_PROXY: '172.20.0.2/32' }, ports: [{ host_ip: '127.0.0.1', target: 3000, published: '3000' }] },
    mongo: { environment: { MONGO_INITDB_ROOT_USERNAME: 'admin', MONGO_INITDB_ROOT_PASSWORD: 'fixture-root-pass', MONGO_APP_USERNAME: 'app', MONGO_APP_PASSWORD: 'fixture-app-pass', MONGO_INITDB_DATABASE: 'fortune_miniprogram' }, command: ['mongod', '--auth'] },
    redis: { command: ['redis-server', '--requirepass', 'fixture-redis-pass'] },
  } };
}

test('preflight rejects the same secret placeholder rejected by application startup', () => {
  const config = validConfig();
  config.services.app.environment.JWT_SECRET = ' secret ';
  const { validateConfig } = require('../scripts/deploy-preflight');
  expect(validateConfig(config)).toContain('JWT_SECRET');
});

test('valid shell dry-run validates selected files without publishing or moving application files', () => {
  const dir = fixture(validConfig());
  const result = runShell(dir);
  expect(result.status).toBe(0);
  const calls = fs.readFileSync(path.join(dir, 'calls'), 'utf8');
  expect(calls).toContain('compose --env-file');
  expect(calls).toContain('-f');
  expect(calls).toContain('config --format json');
  expect(calls).not.toContain('up ');
  expect(fs.existsSync(path.join(dir, 'src/old.txt'))).toBe(true);
  expect(fs.existsSync(path.join(dir, 'logs'))).toBe(false);
  expect(result.stdout + result.stderr).not.toContain('fixture-app-pass');
});

test.each([
  ['root reuse', config => { config.services.app.environment.MONGODB_URI = 'mongodb://admin:fixture-root-pass@mongo:27017/fortune_miniprogram?authSource=admin'; }],
  ['placeholder', config => { config.services.mongo.environment.MONGO_APP_PASSWORD = 'replace_with_password'; }],
  ['blank JWT', config => { config.services.app.environment.JWT_SECRET = '   '; }],
  ['root environment leak', config => { config.services.app.environment.MONGO_ROOT_PASSWORD = 'fixture-root-pass'; }],
  ['public node', config => { config.services.app.ports[0].host_ip = '0.0.0.0'; }],
  ['unreachable container bind', config => { config.services.app.environment.BIND_HOST = '127.0.0.1'; }],
  ['hop trust', config => { config.services.app.environment.TRUST_PROXY = '1'; }],
  ['anonymous redis', config => { config.services.redis.command = ['redis-server']; }],
  ['anonymous mongo', config => { config.services.mongo.command = ['mongod']; }],
  ['disabled mongo auth', config => { config.services.mongo.command.push('--noauth'); }],
  ['overridden redis password', config => { config.services.redis.command.push('--requirepass', ''); }],
])('preflight rejects %s before application backup, without secret output', (_, mutate) => {
  const config = validConfig(); mutate(config);
  const dir = fixture(config);
  const result = runShell(dir, []);
  expect(result.status).not.toBe(0);
  expect(fs.existsSync(path.join(dir, 'src/old.txt'))).toBe(true);
  expect(fs.readFileSync(path.join(dir, 'calls'), 'utf8')).not.toContain('up ');
  expect(result.stdout + result.stderr).not.toMatch(/fixture-(app|root|redis)-pass/);
});

test('shell publish propagates Docker failure after using the same selected files', () => {
  const dir = fixture(validConfig());
  fs.writeFileSync(path.join(dir, 'bin/docker'), '#!/bin/sh\nprintf "%s\\n" "$*" >> "$APP_DIR/calls"\nexit 9\n');
  expect(runShell(dir, []).status).toBe(9);
  const calls = fs.readFileSync(path.join(dir, 'calls'), 'utf8').trim().split('\n');
  expect(calls[1]).toBe(`compose --env-file ${unix(dir)}/.env.production -f docker-compose.prod.yml up -d --build`);
  expect(calls).toHaveLength(2);
});

test('shell uses the selected absolute env path for both Compose interpolation and container env_file', () => {
  const dir = fixture(validConfig());
  fs.renameSync(path.join(dir, '.env.production'), path.join(dir, 'custom.env'));
  fs.writeFileSync(path.join(dir, 'bin/docker'), '#!/bin/sh\nprintf "%s|%s\\n" "$DEPLOY_ENV_FILE" "$*" >> "$APP_DIR/calls"\n');
  const result = runShell(dir, [], { DEPLOY_ENV_FILE: 'custom.env' });
  expect(result.status).toBe(0);
  expect(fs.readFileSync(path.join(dir, 'calls'), 'utf8')).toContain(`${unix(dir)}/custom.env|compose --env-file ${unix(dir)}/custom.env -f docker-compose.prod.yml up -d --build`);
});

test.each([0, 9])('remote archive release retains old application backup when Docker exits %i', status => {
  const dir = fixture(validConfig());
  const bundle = path.join(dir, 'bundle');
  fs.mkdirSync(path.join(bundle, 'src'), { recursive: true });
  fs.mkdirSync(path.join(bundle, 'public'));
  fs.copyFileSync(path.join(root, 'server/deploy-cloud.sh'), path.join(bundle, 'deploy-cloud.sh'));
  fs.writeFileSync(path.join(bundle, 'src/new.txt'), 'new-app');
  fs.writeFileSync(path.join(bundle, 'public/new.txt'), 'new-public');
  expect(spawnSync('tar', ['-czf', path.join(dir, 'server-deploy.tar.gz'), '-C', bundle, '.']).status).toBe(0);
  const result = runShell(dir, [], { DOCKER_UP_STATUS: String(status) }, 'server/scripts/deploy-remote.sh');
  expect(result.status).toBe(status);
  const backup = fs.readdirSync(dir).find(name => name.startsWith('backup.'));
  expect(fs.readFileSync(path.join(dir, backup, 'src/old.txt'), 'utf8')).toBe('keep');
  expect(fs.readFileSync(path.join(dir, backup, 'public/old.txt'), 'utf8')).toBe('keep');
  expect(fs.readFileSync(path.join(dir, 'src/new.txt'), 'utf8')).toBe('new-app');
  expect(fs.readFileSync(path.join(dir, '.env.production'), 'utf8')).toBe('NODE_ENV=production\n');
  expect(fs.readFileSync(path.join(dir, 'docker-compose.prod.yml'), 'utf8')).toBe('fixture');
});

test('remote corrupt archive does not move src or public', () => {
  const dir = fixture(validConfig());
  fs.writeFileSync(path.join(dir, 'server-deploy.tar.gz'), 'corrupt');
  expect(runShell(dir, [], {}, 'server/scripts/deploy-remote.sh').status).not.toBe(0);
  expect(fs.existsSync(path.join(dir, 'src/old.txt'))).toBe(true);
  expect(fs.existsSync(path.join(dir, 'public/old.txt'))).toBe(true);
});

test('shell refuses missing env without copying a placeholder template', () => {
  const dir = fixture();
  fs.unlinkSync(path.join(dir, '.env.production'));
  fs.writeFileSync(path.join(dir, '.env.production.example'), 'JWT_SECRET=your_secret');
  expect(runShell(dir).status).not.toBe(0);
  expect(fs.existsSync(path.join(dir, '.env.production'))).toBe(false);
});

test('Node deployment uses strict SSH verification and stops before upload when remote preflight fails', () => {
  const calls = [];
  const context = {
    require: name => name === 'child_process' ? {
      execSync: () => calls.push('build'),
      spawnSync: (command, args) => { calls.push({ command, args }); return { status: command === 'ssh' ? 7 : 0 }; },
    } : require(name),
    __dirname: root, module: { exports: {} }, exports: {}, console: { log() {}, error() {} },
    process: { env: { DEPLOY_HOST: 'fixture.invalid', DEPLOY_USER: 'fixture' }, execPath: process.execPath, argv: ['node', 'deploy.js'], exit: code => { throw new Error(`exit ${code}`); } },
  };
  try { vm.runInNewContext(fs.readFileSync(path.join(root, 'deploy.js'), 'utf8'), context); } catch (error) { expect(error.message).toBe('exit 1'); }
  expect(calls.some(call => call.command === 'scp')).toBe(false);
  const ssh = calls.find(call => call.command === 'ssh');
  expect(ssh.args).toContain('StrictHostKeyChecking=yes');
});

test.each([
  ['dry-run', true, -1, 0, 1],
  ['success', false, -1, 0, 4],
  ['build failure', false, 1, 1, 2],
  ['upload failure', false, 2, 1, 3],
  ['release failure', false, 3, 1, 4],
])('Node %s selects the same files and propagates failures', (_, dryRun, failAt, exitStatus, count) => {
  const calls = [];
  let status = 0;
  const context = {
    require: name => name === 'child_process' ? {
      spawnSync: (command, args, options) => { calls.push({ command, args, input: options.input }); return { status: calls.length - 1 === failAt ? 8 : 0 }; },
    } : require(name),
    __dirname: root, module: { exports: {} }, exports: {}, console: { log() {}, error() {} },
    process: { env: { DEPLOY_HOST: 'fixture.invalid', DEPLOY_USER: 'fixture', APP_DIR: '/opt/fortune fixture', DEPLOY_ENV_FILE: 'custom.env', DEPLOY_COMPOSE_FILE: 'compose.custom.yml', DEPLOY_KNOWN_HOSTS: 'known_hosts' }, execPath: process.execPath, argv: ['node', 'deploy.js', ...(dryRun ? ['--dry-run'] : [])], exit: code => { status = code; } },
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'deploy.js'), 'utf8'), context);
  expect(status).toBe(exitStatus);
  expect(calls).toHaveLength(count);
  expect(calls[0].args.at(-1)).toBe("cd '/opt/fortune fixture' && node - --env-file 'custom.env' -f 'compose.custom.yml'");
  expect(calls[0].args).toContain('UserKnownHostsFile=known_hosts');
  if (dryRun) {
    // Run the actual streamed preflight in a host with no repository module loader.
    const dir = fixture(validConfig());
    const remoteModule = { exports: {} };
    let checked = false;
    const remoteRequire = name => name === 'child_process' ? {
      spawnSync: (command, args, options) => {
        checked = true;
        expect(args).toEqual(['compose', '--env-file', path.join(dir, '.env.production'), '-f', path.join(dir, 'docker-compose.prod.yml'), 'config', '--format', 'json']);
        expect(options.env.DEPLOY_ENV_FILE).toBe(path.join(dir, '.env.production'));
        return { status: 0, stdout: JSON.stringify(validConfig()) };
      },
    } : require(name);
    remoteRequire.main = remoteModule;
    const remoteProcess = { env: {}, argv: ['node', '-', '--env-file', path.join(dir, '.env.production'), '-f', path.join(dir, 'docker-compose.prod.yml')] };
    vm.runInNewContext(calls[0].input, { require: remoteRequire, module: remoteModule, process: remoteProcess, URL, console: { log() {}, error() {} } });
    expect(checked).toBe(true);
    expect(remoteProcess.exitCode).toBeUndefined();
  }
  if (count === 4) {
    expect(calls[3].args.at(-1)).toBe("APP_DIR='/opt/fortune fixture' DEPLOY_ENV_FILE='custom.env' DEPLOY_COMPOSE_FILE='compose.custom.yml' sh -s");
    expect(calls[2].args).toContain('StrictHostKeyChecking=yes');
  }
});

test('Compose errors do not echo interpolation secrets or touch old files', () => {
  const dir = fixture(validConfig());
  const result = runShell(dir, [], { COMPOSE_CONFIG_STATUS: '1' });
  expect(result.status).not.toBe(0);
  expect(result.stdout + result.stderr).not.toContain('fixture-private-secret');
  expect(fs.existsSync(path.join(dir, 'src/old.txt'))).toBe(true);
  expect(fs.existsSync(path.join(dir, 'logs'))).toBe(false);
});
