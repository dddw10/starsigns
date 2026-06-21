const { execSync, spawnSync } = require('child_process');

console.log('==========================================');
console.log('开始双端编译、打包并上传部署到云服务器...');
console.log('==========================================');

try {
  // 1. 编译打包
  console.log('\n[1/3] 正在本地执行编译打包...');
  execSync('node build-and-pack.js', { stdio: 'inherit' });

  // 2. 上传部署包
  console.log('\n[2/3] 正在上传部署包到云服务器 (106.53.153.185)...');
  console.log('提示: 请根据提示输入 root 用户的登录密码（如果配置了免密 Key，则会自动登录）。\n');
  const scpResult = spawnSync('scp', ['server-deploy.zip', 'root@106.53.153.185:/opt/fortune-server/'], { stdio: 'inherit' });
  if (scpResult.status !== 0) {
    throw new Error('上传部署包失败！');
  }

  // 3. 远端部署
  console.log('\n[3/3] 上传成功！正在登录服务器解压并启动 Docker 容器...');
  console.log('提示: 请再次输入 root 密码以运行远端指令。\n');
  const sshCmd = 'cd /opt/fortune-server && if [ -d src ]; then rm -rf src_bak; mv src src_bak; fi && unzip -o server-deploy.zip && docker compose -f docker-compose.prod.yml up -d --build && docker compose -f docker-compose.prod.yml ps';
  const sshResult = spawnSync('ssh', ['root@106.53.153.185', sshCmd], { stdio: 'inherit' });
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
