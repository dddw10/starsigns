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
- **神兽养成**：签到、喂食、抚摸养成五大神兽，测算掉落道具
- **简洁模式**：管理员可一键收敛首页功能面（送审用），见「管理员配置」

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
2. 获取 AppID 和 AppSecret（AppSecret 在「开发管理 → 开发设置」重置获取，**只显示一次**）
3. 在 `.env` 文件中配置

```bash
WECHAT_APP_ID=wx...
WECHAT_APP_SECRET=...      # 与 AppID 必须同时配齐
ALLOW_MOCK_LOGIN=false     # 保持 false
```

**这两项在生产环境是必填的。** 缺一项、或还是占位值（`your_app_id` / `your_app_secret`）时：

- `NODE_ENV=production`：`POST /api/user/login` 直接返回 **503**，启动日志里也会点名缺的是哪一项。
- 本地开发（`NODE_ENV=development`）：自动走 mock 登录，openid 由一次性 `code` 派生 —— **每次冷启动都是一个新用户**，本地造数据时要认准最新那条。

之所以生产环境宁可 503 也不降级：mock 登录会悄悄给用户换一个身份，用户看到的是生辰、历史记录、神兽全部对不上，也就是"用久了数据就没了"，而且比登录失败难查得多。确实要在生产用 mock 才显式设 `ALLOW_MOCK_LOGIN=true`。

H5 端没有微信 `code`，前端下发的是存在浏览器 localStorage 里的持久 UUID（`h5-` 前缀），这是 H5 的正式身份来源，不受上面的限制。

### 微信订阅消息

1. 在微信公众平台申请订阅消息模板
2. 配置模板 ID 到 `.env`

### 数据库

确保 MongoDB 和 Redis 服务已启动，默认端口：
- MongoDB: 27017
- Redis: 6379

### 管理员配置

管理员由环境变量白名单声明，逗号分隔，改配置不必改代码：

```bash
ADMIN_PHONES=13500000000        # 手机号，+86 / 空格 / 横线写法都能识别
ADMIN_USER_IDS=                 # 也可以直接写用户 _id
```

命中白名单的账号在小程序「我的」页面会多出一行 **简洁模式** 开关。开启后首页只放出星座能量与空间美学两项，用于送审等需要收敛功能面的场景。开关值存在 MongoDB 的 `configs` 集合，读接口带 60 秒进程内缓存；数据库不可用时回落到环境变量 `AUDIT_MODE`，且**只有显式写 `false` 才关闭**（送审安全优先）。

本地想试这个开关：把 `MOCK_BIND_PHONE` 和 `ADMIN_PHONES` 填成同一个号，然后在小程序里走一次绑定手机号。

## API 接口

### 用户接口
- `POST /api/user/login` - 微信登录（生产环境缺微信凭证时返回 503，不降级）
- `POST /api/user/register` / `POST /api/user/login-account` - H5 账号注册 / 登录（限流 15min / 20 次）
- `GET /api/user/info` - 获取用户信息

### 算命接口
- `POST /api/fortune/bazi` - 生辰八字（支持 `calendar: solar | lunar`）
- `POST /api/fortune/bazi-match` - 双人八字合婚
- `GET /api/fortune/daily` - 每日运势（登录可选：不带令牌按游客返回，带了但过期返回 401）
- `GET /api/fortune/constellation/:constellation` - 星座运势
- `POST /api/fortune/tarot` - 塔罗牌占卜
- `POST /api/fortune/name` - 姓名测算
- `POST /api/fortune/name-match` - 双人姓名配对
- `POST /api/fortune/fengshui` - 风水分析
- `POST /api/fortune/face-palm` - 面相手相（AI，消耗大模型额度）
- `POST /api/fortune/ai-chat` - AI 命理大师流式聊天（SSE，消耗大模型额度）
- `POST /api/fortune/council` - AI 圆桌会谈（SSE，消耗大模型额度）
- `GET /api/fortune/records` / `GET /api/fortune/record/:id` / `DELETE /api/fortune/record/:id` - 历史记录

### 神兽接口
- `GET /api/pet/status` - 神兽状态
- `POST /api/pet/feed` / `POST /api/pet/interact` / `POST /api/pet/rename` / `POST /api/pet/draw` - 喂食 / 抚摸 / 改名 / 开福袋

### 系统与管理接口
- `GET /api/config` - 读取简洁模式开关（无需登录，带 60s 缓存）
- `POST /api/admin/config/toggle` - 切换简洁模式（仅管理员）
- `GET /api/admin/feedback` / `POST /api/admin/feedback/:id/reply` - 反馈列表与回复（仅管理员）
- `GET /health` - 健康检查

### 推送接口
- `POST /api/push/subscribe` - 订阅推送
- `POST /api/push/unsubscribe` - 取消订阅

## 开发说明

### 算法模块

- `algorithms/bazi/` - 八字算法。排盘直接取自 **lunar-javascript 万年历**（前后端锁同一版本 1.7.7，保证本地预览与提交结果一致）。三处关键取法：时柱按时辰正中的 `:30` 取点、年柱以**立春的精确时刻**为界（不是按天）、生肖只认年柱地支。无法识别的时辰和农历里不存在的日子一律报 400，不静默排出错盘。
- `algorithms/daily-fortune/` - 每日运势，结果按"用户 + 日期"确定性生成
- `algorithms/tarot/` - 塔罗牌
- `algorithms/name/` - 姓名测算
- `algorithms/fengshui/` - 风水

### 日期与时区

容器里进程时区通常是 UTC，而"今天"必须按北京时间算（签到、每日运势、宠物状态衰退、推送时段判断）。统一走 `server/src/utils/date.js` 的 `getBeijingDateString()`，不要在业务代码里自己 `+8 小时`。

### 错误信息可见性

全局错误处理**只对 4xx 回显 `err.message`**，5xx 一律替换成"服务器内部错误"。所以凡是要让用户看到原因的校验错误，抛出时必须带上 `err.status = 400`。

### 登录与会话

这条链路上出过"用久了数据就没了、页面还卡着进不去"，改动前先看清规则：

- **openid 是唯一稳定身份**。`code` 是一次性的，AppID + AppSecret 都真实才能换到 openid。降级规则见上面「微信小程序配置」。
- **带了令牌但过期 → 401，不当游客**。`optionalAuthMiddleware` 只把"没带令牌"当游客。旧行为下过期令牌会拿到一份默认运势（用户以为生辰和运势丢了），而且客户端永远收不到 401、永远不会去换令牌。
- **登录接口的限流和别的不一样**。`/api/user/login` 每次冷启动和每次 401 恢复都会被打一次，按 IP 算的严格限流会让同一运营商出口下的用户集体 429，所以用宽松的 `wxLoginRateLimiter`（60s / 120 次）；可被撞库的 `/register`、`/login-account` 才用 `loginRateLimiter`（15min / 20 次）。
- **小程序启动时丢弃本地令牌重新换一个**（JWT 无法离线验证，`uni.login()` 不需要用户操作）。**不要**再拿"本地有没有令牌"当要不要登录的条件——那样一次登录失败就永久停在未登录态，页面还显示着旧的 `user_info`。
- **启动期会话闸门最多等 6 秒**。业务请求先等启动登录（否则冷启动会拿到游客数据），但必须有上限，否则登录卡住就等于页面卡死。登录/注册请求自己要带 `skipSessionGate`。
- **401 恢复是单飞的**，成功后原请求自动重试一次。恢复时**不要提前清令牌**：`login()` 可能复用一个已经写好新令牌的在途请求。聊天页的 SSE 走手写 `wx.request`，已单独接入同一个 `recoverSession()`。
- **`showLoading` 和 `showToast` 共用一个原生浮层**：提示必须排在 `hideLoading()` 之后，`hideLoading()` 必须放 `finally`（否则"有响应但 code 不为 0"那条路会把 loading 永久挂住）。

### 失败态与提示

判断标准只有一条：**屏幕上写的话必须是真的**。

- **加载失败 ≠ 没有数据**。历史记录页和结果页把"正在读取 / 加载失败（可重试）/ 真的没有"分成三态，`catch` 里绝不清空列表——清空之后渲染出的「暂无历史记录」和真没记录长得一模一样，用户读到的是"我的记录全没了"。
- **`fetchUserInfo()` 自己吞异常、只返回布尔值**。它是测算/签到/绑定成功之后顺手同步灵气道具的动作，十几个调用点都在业务的 `try` 里；往外抛会把一次成功的测算显示成「排盘失败 / 抽取失败 / 堪舆失败 / 推演失败」。`checkLoginStatus()` 也不再因为一次网络抖动就 `logout()`。
- **提示排在 `hideLoading()` 之后**（见上一节），并且**成功图标要跟着结果回落**——八字保存那处的 `catch` 曾经只改文案没改 `ok`，错误文字配着 ✓ 一起弹。
- **按钮必须真的做事**。结果页的分享走微信 `open-type="share"` + `onShareAppMessage`（H5 复制真实地址），保存海报跳 share 页由 canvas 真实绘制；不要再用 `setTimeout` 假装"已保存至相册"。

### 定时任务

需在 `.env` 设置 `ENABLE_SCHEDULER=true` 才会注册，默认不跑：

- 每日 12:00 推送每日运势（微信一次性订阅消息，一次授权只能发一条）
- 每日 12:00 检查订阅过期

### 测试

```bash
cd server && npm test
```

Jest 全是纯函数用例，不连数据库、不发网络请求、不消耗大模型额度。覆盖四柱基准、立春换年柱、时辰解析、农历折算、前后端排盘一致性、北京时间边界、每日运势确定性、管理员白名单，以及**登录降级规则**（生产缺凭证必须报 503 而不是造一个新用户）。改动排盘取法后这里若变红，说明用户拿到的四柱变了。

## 部署

### 生产环境

```bash
# 后端（无需 build，直接跑 src/app.js）
cd server
npm ci --omit=dev
pm2 start ecosystem.config.js

# 前端
cd miniprogram
npm run build:mp-weixin
# 上传到微信小程序后台
```

### Docker 部署

```bash
docker-compose --env-file server/.env.production up -d
```

`docker-compose.yml` 里的 `${VAR}` 不会从 `env_file` 取值，必须显式带 `--env-file`。

## 免责声明

本小程序所有内容仅供娱乐参考，不构成任何决策建议。请理性看待，相信科学。

## License

MIT
