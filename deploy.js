const { execSync, spawnSync } = require('child_process');

const deployHost = process.env.DEPLOY_HOST;
const deployUser = process.env.DEPLOY_USER;

if (!deployHost || !deployUser) {
  throw new Error('Set DEPLOY_HOST and DEPLOY_USER before deploying.');
}

console.log('==========================================');
console.log('开始双端编译、打包并上传部署到云服务器...');
console.log('==========================================');

try {
  // 1. 编译打包
  console.log('\n[1/3] 正在本地执行编译打包...');
  execSync('node build-and-pack.js', { stdio: 'inherit' });

  // 2. 上传部署包
  console.log('\n[2/3] 正在上传部署包到云服务器...');
  console.log('提示: 请根据提示输入 root 用户的登录密码（如果配置了免密 Key，则会自动登录）。\n');
  const scpResult = spawnSync('scp', ['server-deploy.zip', `${deployUser}@${deployHost}:/opt/fortune-server/`], { stdio: 'inherit' });
  if (scpResult.status !== 0) {
    throw new Error('上传部署包失败！');
  }

  // 3. 远端部署
  console.log('\n[3/3] 上传成功！正在登录服务器解压并启动 Docker 容器...');
  console.log('提示: 请再次输入 root 密码以运行远端指令。\n');
  // compose 文件里的 ${MONGO_ROOT_PASSWORD}/${REDIS_PASSWORD} 不会从 env_file 取值，
  // 必须显式 --env-file，否则会当成空字符串（compose 那边已加 :? 会直接报错退出）。
  // .env.production 是服务器上手工维护的，打包时被排除，所以先确认它在。
  const composeArgs = '--env-file .env.production -f docker-compose.prod.yml';
  const sshCmd = [
    'cd /opt/fortune-server',
    'if [ ! -f .env.production ]; then echo "缺少 /opt/fortune-server/.env.production，请参考 .env.production.example 创建后重试"; exit 1; fi',
    'if [ -d src ]; then rm -rf src_bak; mv src src_bak; fi',
    'unzip -o server-deploy.zip',
    `docker compose ${composeArgs} up -d --build`,
    `docker compose ${composeArgs} ps`
  ].join(' && ');
  const sshResult = spawnSync('ssh', [`${deployUser}@${deployHost}`, sshCmd], { stdio: 'inherit' });
  if (sshResult.status !== 0) {
    throw new Error('远端部署指令执行失败！');
  }

  console.log('\n==========================================');
  console.log('云端部署更新顺利完成！');
  console.log('==========================================');

} catch (error) {
  console.error('\n部署失败:', error.message);
  process.exit(1);
}
