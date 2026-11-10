# 算命小程序后端服务

基于 Express + MongoDB + Redis 的算命小程序后端 API 服务。

## 功能特性

- 微信小程序登录
- 八字算命、星座运势、塔罗牌占卜、姓名测算、风水分析
- 神兽养成（签到、喂食、互动和福袋）
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

### 使用 PM2 启动（宿主机部署，需预装 PM2）

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

- `POST /api/user/login` - 微信登录
- `POST /api/user/register`、`POST /api/user/login-account` - H5 账号注册/登录
- `GET /api/user/profile` - 获取用户信息
- `PUT /api/user/profile` - 更新用户信息
- `POST /api/user/check-in` - 签到；奖励确认失败时返回 503，重新签到可补发

### 算命相关

- `POST /api/fortune/bazi` - 八字算命
- `GET /api/fortune/constellation/:constellation` - 星座运势
- `POST /api/fortune/tarot` - 塔罗牌占卜
- `POST /api/fortune/name` - 姓名测算
- `POST /api/fortune/fengshui` - 风水分析
- `GET /api/fortune/daily` - 每日运势

当前 `src/app.js` 挂载 user、fortune、push、pet、admin 路由和 `/api/config`；支付和 VIP 会员接口尚未实现。

### 密码与令牌迁移

新密码以独立随机盐异步 scrypt 存储，格式为 `scrypt$16384$8$1$salt$hash`，只接受这一固定成本格式；旧 SHA-256 仅在密码验证成功后升级，不批量重置账号。

新 JWT 固定 HS256，默认 issuer 为 `fortune-miniprogram`、audience 为 `fortune-client`。已有实例保留 `JWT_SECRET`。若要让无 claims 的旧 token 暂时可用，在发布前由维护者设置 `JWT_LEGACY_ACCEPT_UNTIL` 为明确 UTC 截止日；空值、无效值或到期立即拒绝旧 token，前端使用已有 401 恢复流程。旧 token 自身仍须未过期；错误 issuer/audience 或非 HS256 始终拒绝。改变 issuer/audience 同样会使已有新 token 失效，部署期间保持一致。

签到按北京零点原子认领。`User.checkInRewardPending` 保存待发日期，Pet 以日期标记和 `$inc` 幂等补发，失败返回明确 503，用户再次签到会先恢复未完成日期。所有 Pet 状态写入使用版本条件原子更新，库存和福袋消耗同时检查余额，冲突最多尝试 10 次后返回 409；可重新请求。部署需核验现有 `Pet.userId` 唯一索引，并让所有写入实例同时使用新版本，避免旧 save 写法绕过版本条件。

AI 客户端消息只允许 user/assistant，1..50 条，单条 1..4000 字符、总量不超过 20000；工具参数按既有历法/时辰/性别/牌阵校验。运势日期须为真实 YYYY-MM-DD，限今天前后 31 天；星座固定 12 项，缓存 TTL 为 60..86400 秒。

## 部署说明

先阅读 [部署预检、数据库鉴权与回滚手册](../docs/operations/deployment.md)。远端 Compose 和环境文件独立维护，不随应用包覆盖；已有 Mongo 卷须先备份、创建或核验独立应用账户，再启用鉴权。生产模板保留 Mongo 6.0、`mongo` 服务和 `mongo-data` 卷，不可用根目录 Mongo 7 模板覆盖。

在已准备好真实配置的应用目录做脱敏预检：

```sh
APP_DIR=/opt/fortune-server DEPLOY_ENV_FILE=.env.production DEPLOY_COMPOSE_FILE=docker-compose.prod.yml sh ./deploy-cloud.sh --dry-run
```

本地入口 `node deploy.js --dry-run` 或 `python deploy_helper.py --dry-run` 使用相同文件参数，并严格验证 known_hosts。三入口均先预检，缺文件或占位凭据即停止，不自动复制环境示例。真实发布在维护者核对备份、端口和连接验收后才去掉 `--dry-run`。

Node / PM2 默认仅监听 `127.0.0.1`。Docker 模板在容器内设置 `BIND_HOST=0.0.0.0`，宿主仍仅发布到本机；不要开放 3000、27017、6379 到公网。宿主 Nginx 与容器 Nginx 使用不同上游路径，`TRUST_PROXY` 必须按 Node 实际看到的代理 IP/CIDR 配置，不能照抄固定跳数。临时联调通过已核验主机的 SSH 本地转发；正式小程序使用 HTTPS 域名。

## 注意事项

1. 支付和 VIP 尚未实现，不能把支付环境配置视为业务接口已上线
2. 新部署设置足够长的随机 JWT 密钥；已有实例保留现有值，本次不轮换
3. 建议开启 Redis 集群提高可用性
4. 定期备份 MongoDB 数据

## License

MIT
