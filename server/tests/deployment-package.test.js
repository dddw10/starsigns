const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const cp = require('child_process');
const root = path.resolve(__dirname, '../..');
test('the actual deployment archive excludes environment, infrastructure and certificate private keys', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fortune-package-'));
  try {
    for (const sub of ['server/certs', 'server/src', 'miniprogram/node_modules', 'miniprogram/dist/build/h5']) fs.mkdirSync(path.join(dir, sub), { recursive: true });
    for (const file of ['server/.env.production', 'server/custom.env', 'server/docker-compose.prod.yml', 'server/certs/tls.key', 'server/signing.pem', 'server/client.p12', 'server/id_ed25519', 'server/src/app.js', 'miniprogram/dist/build/h5/index.html']) fs.writeFileSync(path.join(dir, file), 'fixture');
    const context = { require: name => name === 'child_process' ? { execSync: (command, options) => { if (!command.startsWith('npm')) return cp.execSync(command, options); } } : require(name), __dirname: dir, console: { log() {}, error() {} }, process: { platform: process.platform, exit: code => { throw new Error(`build exit ${code}`); } } };
    vm.runInNewContext(fs.readFileSync(path.join(root, 'build-and-pack.js'), 'utf8'), context);
    const entries = cp.execFileSync(process.platform === 'win32' ? 'tar.exe' : 'tar', ['-tzf', path.join(dir, 'server-deploy.tar.gz')], { encoding: 'utf8' });
    expect(entries).toContain('src/app.js');
    expect(entries).not.toMatch(/\.env|docker-compose|certs|signing\.pem|client\.p12|id_ed25519/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
