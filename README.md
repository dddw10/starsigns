# 算命小程序

基于 uni-app + Node.js 的微信算命小程序，支持生辰八字、星座运势、塔罗牌占卜、姓名测算、风水分析、面相手相六大功能。

## 功能特性

- **生辰八字**：基于出生时间的命理分析
- **星座运势**：每日星座运势预测
- **塔罗牌占卜**：多种牌阵解读
- **姓名测算**：五格剖象法分析
- **风水分析**：家居/办公风水建议
- **面相手相**：AI智能识别分析
- **每日推送**：微信订阅消息推送每日运势
- **主题切换**：四套主题（中国风、现代简约、神秘暗黑、卡通可爱）
- **会员系统**：VIP会员解锁更多功能

## 技术栈

### 前端
- uni-app 3.x (Vue3)
- Vite 5.x
- Pinia 2.x
- uni-ui

### 后端
- Node.js 18+
- Express
- MongoDB 7.x
- Redis 7.x
- node-schedule

## 项目结构

```
fortune-miniprogram/
├── miniprogram/          # 前端 uni-app 项目
│   ├── src/
│   │   ├── pages/        # 页面
│   │   ├── components/   # 组件
│   │   ├── store/        # 状态管理
│   │   ├── api/          # 接口
│   │   ├── styles/       # 样式
│   │   └── utils/        # 工具
│   └── package.json
│
└── server/               # 后端 Node.js 项目
    ├── src/
    │   ├── controllers/  # 控制器
    │   ├── services/     # 服务
    │   ├── models/       # 数据模型
    │   ├── algorithms/   # 算法
    │   ├── scheduler/    # 定时任务
    │   └── middleware/    # 中间件
    └── package.json
```

## 快速开始

### 环境要求

- Node.js 18+
- MongoDB 7.x
- Redis 7.x
- 微信开发者工具

### 后端启动

```bash
cd server

# 安装依赖
npm install

# 复制环境变量
cp .env.example .env

# 修改 .env 配置（数据库、微信等）

# 启动服务
npm run dev
```

### 前端启动

```bash
cd miniprogram

# 安装依赖
npm install

# 启动开发
npm run dev:mp-weixin
```

然后用微信开发者工具打开 `dist/dev/mp-weixin` 目录。

## 配置说明

### 微信小程序配置

1. 在微信公众平台注册小程序
2. 获取 AppID 和 AppSecret
3. 在 `.env` 文件中配置

### 微信订阅消息

1. 在微信公众平台申请订阅消息模板
2. 配置模板 ID 到 `.env`

### 数据库

确保 MongoDB 和 Redis 服务已启动，默认端口：
- MongoDB: 27017
- Redis: 6379

## API 接口

### 用户接口
- `POST /api/user/login` - 微信登录
- `GET /api/user/info` - 获取用户信息

### 算命接口
- `POST /api/fortune/bazi` - 生辰八字
- `POST /api/fortune/constellation` - 星座运势
- `POST /api/fortune/tarot` - 塔罗牌占卜
- `POST /api/fortune/name` - 姓名测算
- `POST /api/fortune/fengshui` - 风水分析

### 支付接口
- `POST /api/payment/create` - 创建订单
- `POST /api/payment/notify` - 支付回调

### 推送接口
- `POST /api/push/subscribe` - 订阅推送
- `POST /api/push/unsubscribe` - 取消订阅

## 开发说明

### 算法模块

- `algorithms/bazi/` - 八字算法
- `algorithms/daily-fortune/` - 每日运势
- `algorithms/tarot/` - 塔罗牌
- `algorithms/name/` - 姓名测算
- `algorithms/fengshui/` - 风水

### 定时任务

- 每日 8:00 推送运势
- 每日 12:00 检查订阅过期
- 每日 2:00 清理过期订单

## 部署

### 生产环境

```bash
# 后端
cd server
npm run build
pm2 start ecosystem.config.js

# 前端
cd miniprogram
npm run build:mp-weixin
# 上传到微信小程序后台
```

### Docker 部署

```bash
docker-compose up -d
```

## 免责声明

本小程序所有内容仅供娱乐参考，不构成任何决策建议。请理性看待，相信科学。

## License

MIT
