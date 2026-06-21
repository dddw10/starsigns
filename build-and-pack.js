const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('==========================================');
console.log('开始执行 H5 网页编译与云端部署包打包任务...');
console.log('==========================================');

try {
  // 1. 编译 H5 前端
  console.log('\n[1/4] 编译 H5 前端静态资源...');
  const miniprogramDir = path.join(__dirname, 'miniprogram');
  
  // 确保 node_modules 存在
  if (!fs.existsSync(path.join(miniprogramDir, 'node_modules'))) {
    console.log('未检测到 node_modules，正在安装依赖...');
    execSync('npm install', { cwd: miniprogramDir, stdio: 'inherit' });
  }
  
  execSync('npm run build:h5', { cwd: miniprogramDir, stdio: 'inherit' });
  console.log('前端 H5 编译成功！');

  // 2. 准备后端公共目录并清理旧资源
  console.log('\n[2/4] 清理并准备后端公共静态资源目录...');
  const publicDir = path.join(__dirname, 'server', 'public');
  if (fs.existsSync(publicDir)) {
    fs.rmSync(publicDir, { recursive: true, force: true });
    console.log('清理旧 public 目录成功。');
  }
  fs.mkdirSync(publicDir, { recursive: true });
  console.log('创建 public 目录成功。');

  // 3. 复制编译后的 H5 前端资源到 Express public 目录
  console.log('\n[3/4] 拷贝编译成果到后端...');
  const h5BuildDir = path.join(miniprogramDir, 'dist', 'build', 'h5');
  if (fs.existsSync(h5BuildDir)) {
    fs.cpSync(h5BuildDir, publicDir, { recursive: true });
    console.log('H5 静态文件成功复制到 ' + publicDir);
  } else {
    throw new Error('未找到编译后的 H5 目录：' + h5BuildDir);
  }

  // 4. 打包后端部署 zip 包
  console.log('\n[4/4] 打包 Express 服务部署包...');
  const zipPath = path.join(__dirname, 'server-deploy.zip');
  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }

  // 使用 Windows 自带的 tar.exe 压缩，排除 node_modules, logs, .env 等本地开发文件
  const tarCmd = 'tar.exe -a -c -f ../server-deploy.zip --exclude="node_modules" --exclude="logs" --exclude=".env" .';
  execSync(tarCmd, { cwd: path.join(__dirname, 'server'), stdio: 'inherit' });
  console.log('部署包打包成功 -> ' + zipPath);

  console.log('\n==========================================');
  console.log('全部打包任务执行完成！');
  console.log('请将项目根目录下的 [server-deploy.zip] 上传部署到云服务器。');
  console.log('==========================================');

} catch (error) {
  console.error('\n打包失败:', error.message);
  process.exit(1);
}
