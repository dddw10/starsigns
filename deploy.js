const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const quote = value => `'${String(value).replace(/'/g, `'"'"'`)}'`;

function main() {
  const env = process.env;
  if (!env.DEPLOY_HOST || !env.DEPLOY_USER || !/^[a-zA-Z0-9.:-]+$/.test(env.DEPLOY_HOST) || !/^[a-zA-Z0-9_-]+$/.test(env.DEPLOY_USER)) throw new Error('Set valid DEPLOY_HOST and DEPLOY_USER');
  const dryRun = process.argv.includes('--dry-run');
  if (process.argv.slice(2).some(arg => arg !== '--dry-run')) throw new Error('Usage: node deploy.js [--dry-run]');
  const remoteDir = env.APP_DIR || '/opt/fortune-server';
  const envFile = env.DEPLOY_ENV_FILE || '.env.production';
  const composeFile = env.DEPLOY_COMPOSE_FILE || 'docker-compose.prod.yml';
  const target = `${env.DEPLOY_USER}@${env.DEPLOY_HOST}`;
  const options = ['-o', 'StrictHostKeyChecking=yes'];
  if (env.DEPLOY_KNOWN_HOSTS) options.push('-o', `UserKnownHostsFile=${env.DEPLOY_KNOWN_HOSTS}`);
  if (env.DEPLOY_KEY_PATH) options.push('-i', env.DEPLOY_KEY_PATH);
  const port = env.DEPLOY_PORT || '22';
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) throw new Error('Invalid DEPLOY_PORT');
  const run = (command, args, input) => {
    const result = spawnSync(command, args, { cwd: __dirname, stdio: input ? ['pipe', 'inherit', 'inherit'] : 'inherit', input });
    if (result.error || result.status !== 0) throw new Error(`${command} failed`);
  };
  const proxy = fs.readFileSync(path.join(__dirname, 'server/src/config/proxy.js'), 'utf8').replace('module.exports = { trustedProxies };', '');
  const preflight = fs.readFileSync(path.join(__dirname, 'server/scripts/deploy-preflight.js'), 'utf8')
    .replace(/^#!.*\n/, '').replace("const { trustedProxies } = require('../src/config/proxy');", proxy);
  run('ssh', [...options, '-p', port, target, `cd ${quote(remoteDir)} && node - --env-file ${quote(envFile)} -f ${quote(composeFile)}`], preflight);
  if (dryRun) return;
  run(process.execPath, ['build-and-pack.js']);
  run('scp', [...options, '-P', port, 'server-deploy.tar.gz', `${target}:${remoteDir}/server-deploy.tar.gz`]);
  const script = fs.readFileSync(path.join(__dirname, 'server/scripts/deploy-remote.sh'), 'utf8');
  run('ssh', [...options, '-p', port, target, `APP_DIR=${quote(remoteDir)} DEPLOY_ENV_FILE=${quote(envFile)} DEPLOY_COMPOSE_FILE=${quote(composeFile)} sh -s`], script);
  console.log('Deployment complete');
}

try { main(); } catch (error) { console.error(`Deployment failed: ${error.message}`); process.exit(1); }
