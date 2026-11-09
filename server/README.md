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

先阅读 [部署预检、数据库鉴权与回滚手册](../docs/operations/deployment.md)。远端 Compose 和环境文件独立维护，不随应用包覆盖；已有 Mongo 卷须先备份、创建或核验独立应用账户，再启用鉴权。生产模板保留 Mongo 6.0、`mongo` 服务和 `mongo-data` 卷，不可用根目录 Mongo 7 模板覆盖。

在已准备好真实配置的应用目录做脱敏预检：

```sh
APP_DIR=/opt/fortune-server DEPLOY_ENV_FILE=.env.production DEPLOY_COMPOSE_FILE=docker-compose.prod.yml sh ./deploy-cloud.sh --dry-run
```

本地入口 `node deploy.js --dry-run` 或 `python deploy_helper.py --dry-run` 使用相同文件参数，并严格验证 known_hosts。三入口均先预检，缺文件或占位凭据即停止，不自动复制环境示例。真实发布在维护者核对备份、端口和连接验收后才去掉 `--dry-run`。

Node / PM2 默认仅监听 `127.0.0.1`。Docker 模板在容器内设置 `BIND_HOST=0.0.0.0`，宿主仍仅发布到本机；不要开放 3000、27017、6379 到公网。宿主 Nginx 与容器 Nginx 使用不同上游路径，`TRUST_PROXY` 必须按 Node 实际看到的代理 IP/CIDR 配置，不能照抄固定跳数。临时联调通过已核验主机的 SSH 本地转发；正式小程序使用 HTTPS 域名。

## 注意事项

1. 微信支付需要配置证书文件
2. 新部署设置足够长的随机 JWT 密钥；已有实例保留现有值，本次不轮换
3. 建议开启 Redis 集群提高可用性
4. 定期备份 MongoDB 数据

## License

MIT
