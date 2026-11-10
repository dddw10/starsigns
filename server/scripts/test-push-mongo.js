// Disposable local Mongo only; never accepts an existing database URI.
const { execFileSync, spawnSync } = require('child_process');
const { randomBytes } = require('crypto');
const mongoose = require('mongoose');
const path = require('path');
const name = `push-test-${randomBytes(6).toString('hex')}`;
const password = randomBytes(24).toString('hex');
const docker = args => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

async function main() {
  let network = false; let volume = false; let container = false;
  try {
    docker(['network', 'create', '--driver', 'bridge', name]); network = true;
    docker(['volume', 'create', name]); volume = true;
    docker(['run', '--pull=never', '-d', '--name', name, '--network', name,
      '-p', '127.0.0.1::27017', '-v', `${name}:/data/db`,
      '-e', 'MONGO_INITDB_ROOT_USERNAME=fixture', '-e', `MONGO_INITDB_ROOT_PASSWORD=${password}`, 'mongo:7']); container = true;
    const address = docker(['port', name, '27017/tcp']);
    if (!/^127\.0\.0\.1:\d+$/.test(address)) throw new Error('Fixture port is not loopback-only');
    const uri = `mongodb://fixture:${password}@${address}/push_fixture?authSource=admin`;
    let ready = false;
    for (let i = 0; i < 45; i++) {
      const connection = mongoose.createConnection(uri, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 500 });
      try { await connection.asPromise(); ready = true; break; }
      catch { await new Promise(r => setTimeout(r, 500)); }
      finally { await connection.close(); }
    }
    if (!ready) throw new Error('Disposable Mongo failed to become ready');
    console.log('Authenticated isolated Mongo 7 fixture ready (loopback port, temporary bridge and volume).');
    const run = spawnSync(process.execPath, [path.join(__dirname, '../node_modules/jest/bin/jest.js'), '--runInBand',
      '--testMatch', '**/tests/**/*.test.js', '--runTestsByPath', path.join(__dirname, '../tests/push-concurrency.mongo.test.js'),
      ...process.argv.slice(2)], {
      cwd: path.join(__dirname, '..'), stdio: 'inherit',
      env: { ...process.env, PUSH_TEST_MONGO_URI: uri, PUSH_TEST_ISOLATED: '1' },
    });
    process.exitCode = run.status || (run.error ? 1 : 0);
  } finally {
    if (container) docker(['rm', '-f', name]);
    if (volume) docker(['volume', 'rm', name]);
    if (network) docker(['network', 'rm', name]);
    console.log('Disposable Mongo container, volume and network removed.');
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
