# 算命小程序后端服务

基于 Express + MongoDB + Redis 的算命小程序后端 API 服务。

## 功能特性

- 微信小程序登录
- 八字算命、星座运势、塔罗牌占卜、姓名测算、风水分析
- 微信支付对接
- VIP 会员系统
- 每日运势推送

## 快速开始

### 环境要求

- Node.js >= 18.0.0
- MongoDB >= 6.0
- Redis >= 7.0

### 安装依赖

```bash
npm install
```

### 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，填写正确的配置信息
```

### 启动开发服务器

```bash
npm run dev
```

### 启动生产服务器

```bash
npm start
```

### 使用 PM2 启动（推荐）

```bash
npm run pm2:start
```

## 项目结构

```
server/
├── src/
│   ├── algorithms/        # 算法模块
│   │   ├── bazi/          # 八字算法
│   │   ├── tarot/         # 塔罗牌算法
│   │   ├── name/          # 姓名测算
│   │   ├── fengshui/      # 风水分析
│   │   └── daily-fortune/ # 每日运势
│   ├── config/            # 配置文件
│   ├── controllers/       # 控制器
│   ├── middleware/         # 中间件
│   ├── models/            # 数据模型
│   ├── routes/            # 路由
│   ├── services/          # 业务逻辑
│   ├── scheduler/         # 定时任务
│   └── app.js             # 应用入口
├── logs/                  # 日志目录
├── certs/                 # 证书目录
├── .env.example           # 环境变量示例
├── ecosystem.config.js    # PM2 配置
└── package.json
```

## API 文档

### 用户相关

- `POST /api/user/wx-login` - 微信登录
- `GET /api/user/info` - 获取用户信息
- `PUT /api/user/info` - 更新用户信息

### 算命相关

- `POST /api/fortune/bazi` - 八字算命
- `GET /api/fortune/constellation/:sign` - 星座运势
- `POST /api/fortune/tarot` - 塔罗牌占卜
- `POST /api/fortune/name` - 姓名测算
- `POST /api/fortune/fengshui` - 风水分析
- `GET /api/fortune/daily` - 每日运势

### 支付相关

- `POST /api/payment/create` - 创建订单
- `GET /api/payment/order/:orderNo` - 查询订单
- `POST /api/payment/wechat/notify` - 微信支付回调

### 会员相关

- `GET /api/member/info` - 会员信息
- `GET /api/member/quota` - 检查次数
- `GET /api/member/benefits` - 会员权益

## 部署说明

### 无域名先部署到云服务器

如果当前只是先跑通后端，可以先使用服务器公网 IP，不必立刻上域名：

1. 复制环境变量文件

```bash
cp .env.production.example .env.production
```

2. 修改 `.env.production`

至少先改这些值：

```bash
BASE_URL=http://你的服务器公网IP:3000
JWT_SECRET=一串足够长的随机字符串
WECHAT_APP_ID=你的小程序 appid
WECHAT_APP_SECRET=你的小程序 secret
```

3. 准备证书目录

```bash
mkdir -p certs logs
```

如果暂时不用微信支付，可以先不放支付证书。

4. 使用 Docker Compose 启动整套服务

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

5. 检查服务状态

```bash
docker compose -f docker-compose.prod.yml ps
curl http://127.0.0.1:3000/health
```

6. 开放服务器安全组端口

至少放行：

- `3000`：后端接口
- `22`：SSH 登录

7. 小程序开发调试时，把前端请求地址改成服务器公网 IP

例如：

```bash
http://你的服务器公网IP:3000
```

注意：这只适合先联调。后续上线体验版和正式版，仍然需要域名和 HTTPS。

### 1. 准备工作

1. 注册微信小程序账号
2. 申请微信支付商户号
3. 准备域名和 SSL 证书
4. 安装 MongoDB 和 Redis

### 2. 配置环境变量

编辑 `.env` 文件，填写以下配置：

- 微信小程序 AppID 和 AppSecret
- 微信支付商户号和 API 密钥
- MongoDB 和 Redis 连接信息
- JWT 密钥

### 3. 部署服务

```bash
# 安装依赖
npm install

# 启动服务
npm run pm2:start
```

### 4. 配置 Nginx

```nginx
server {
    listen 443 ssl;
    server_name api.your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 注意事项

1. 微信支付需要配置证书文件
2. 生产环境请修改 JWT 密钥
3. 建议开启 Redis 集群提高可用性
4. 定期备份 MongoDB 数据

## License

MIT
