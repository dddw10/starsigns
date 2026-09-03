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

  // 4. 打包后端部署包
  console.log('\n[4/4] 打包 Express 服务部署包...');

  // 产物必须叫 .tar.gz，不能叫 .zip。
  // tar.exe 的 -a 只按后缀挑「压缩方式」，.zip 不是它认识的压缩后缀，
  // 于是以前那句 `-a -c -f ../server-deploy.zip` 产出的是一个**未压缩的 POSIX tar**，
  // 只是名字叫 zip。本机 `tar -tf` 读得动，所以一直没人发现；
  // 但两个部署脚本在服务器上跑的是 `unzip -o`，一定会以
  // 「End-of-central-directory signature not found」失败——
  // 也就是说这条自动部署链路从来没有真的跑通过。
  const packPath = path.join(__dirname, 'server-deploy.tar.gz');
  for (const stale of [packPath, path.join(__dirname, 'server-deploy.zip')]) {
    if (fs.existsSync(stale)) {
      fs.unlinkSync(stale);
      console.log('删除旧产物 ' + path.basename(stale));
    }
  }

  // 排除 node_modules, logs, .env 等本地开发文件（.env.* 也会排除 .env.production.example）
  //
  // docker-compose*.yml 也必须排除，和 .env.production 同理：它描述的是**这台服务器的基础设施**
  // （端口绑定、数据卷、mongo/redis 是否开鉴权），由服务器上手工维护，不该被一次应用发版覆盖。
  // 仓库里的 docker-compose.prod.yml 是「加固版」：mongod --auth + ${MONGO_ROOT_PASSWORD:?}。
  // 而线上那卷 mongo 是当初无鉴权初始化的、admin 库里 0 个用户，
  // MONGO_INITDB_ROOT_* 只对空数据卷生效，所以那份配置直接盖上去的后果是：
  // 好一点是 compose 因为 :? 缺变量当场报错退出（部署失败，且服务器上正在用的那份配置被悄悄换掉了）；
  // 坏一点是有人为了消掉报错随手补上 MONGO_ROOT_PASSWORD，mongo 带 --auth 重启，
  // 应用再也连不上一个装着真实用户的库。
  // 要收紧基础设施必须是一次单独、有备份、有回滚的动作，不能挂在发版链路上。
  const tarCmd = 'tar.exe -a -c -f ../server-deploy.tar.gz --exclude="node_modules" --exclude="logs" --exclude=".env" --exclude=".env.*" --exclude="docker-compose*.yml" .';
  execSync(tarCmd, { cwd: path.join(__dirname, 'server'), stdio: 'inherit' });

  // 就地验一次真的是 gzip tar，别再让「名字对、格式不对」的包流到服务器上
  execSync('tar.exe -tzf server-deploy.tar.gz > ' + (process.platform === 'win32' ? 'NUL' : '/dev/null'), {
    cwd: __dirname,
    stdio: 'inherit',
  });
  const sizeMB = (fs.statSync(packPath).size / 1024 / 1024).toFixed(2);
  console.log('部署包打包成功 -> ' + packPath + '（' + sizeMB + ' MB，已验证可解压）');

  console.log('\n==========================================');
  console.log('全部打包任务执行完成！');
  console.log('请将项目根目录下的 [server-deploy.tar.gz] 上传部署到云服务器。');
  console.log('==========================================');

} catch (error) {
  console.error('\n打包失败:', error.message);
  process.exit(1);
}
