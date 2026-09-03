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

### 微信订阅消息（每日运势推送）

推送要真的发得出去，**四项必须齐全**，缺一项的表现都一样：界面上开关能开，用户就是收不到。启动时会逐项检查并把缺的那一项点名，看日志的 `[启动检查]`。

```bash
WECHAT_APP_ID=                    # 1. 取 access_token 用
WECHAT_APP_SECRET=
WECHAT_TPL_DAILY_FORTUNE=         # 2. 模板 ID（微信公众平台「订阅消息 → 我的模板」）
WECHAT_TPL_DAILY_FORTUNE_FIELDS=  # 3. 字段映射，见下
ENABLE_SCHEDULER=true             # 4. 不写 true 定时任务根本不注册
```

**字段映射为什么必须显式声明。** 微信要求 `data` 的键与模板参数**严格一致**，多一个、少一个都按 `47003` 整条拒收；每种字段还有各自的类型限制，把中文塞进 `character_string`、把分数塞进 `phrase` 一样被拒。所以模板参数在 `.env` 里声明，格式 `微信字段名:内容键`，逗号分隔：

```bash
WECHAT_TPL_DAILY_FORTUNE_FIELDS=thing1:level,thing2:brief,time3:date
```

**字段名一律照模板详情页的「详细内容」抄，不要按语义猜。** 详情页会把参数名原样写出来（`{{thing1.DATA}}` 这种），键名是「类型 + 序号」，序号就是关键词在模板里的位置。上面这行对应的是本项目在用的模板「今日运势提醒」（模版编号 71514），三个关键词依次是运势关键词 / 运势简述 / 日期，而**「日期」被声明成 `time3` 而不是 `date3`** —— 光看关键词列表看不出类型，猜错就是 `47003`。

| 字段类型 | 限制 |
| --- | --- |
| `thing` | ≤ 20 字符 |
| `phrase` | ≤ 5 个**汉字**（非汉字会被滤掉） |
| `character_string` | ≤ 32，只收数字 / 字母 / 符号，**不收中文** |
| `number` | 纯数字 |
| `date` | `YYYY-MM-DD` |
| `time` | ≤ 24，支持带年月日；`date` 内容进 `time` 字段会自动写成 `2026年09月03日` |
| `symbol` | ≤ 5 |
| `amount` | ≤ 11 |

可用内容键：`date score level rating summary brief overall yi ji yiji career wealth love health luckyNumber luckyColor dayElement`。写错字段名、写错内容键、字段重复、内容键与字段类型不匹配（比如 `phrase1:score`）都在**启动时**直接抛错，而不是等推送那一刻被微信拒。真被拒时也不白疼：发送失败**不扣配额**，日志会把 `47003` 的报文连同当前声明一起打出来对账。

**`thing` 只有 20 个字符，这是硬上限，所以内容要为它专门写。** 微信没有更长的中文字段类型（`character_string` 虽然 32 但不收中文），塞不进的部分只能截断。`summary` 是一句长话，进 `thing` 会变成「79分 今日金气适中，工作顺利，人际关…」——20 个字符全花在铺垫上，结论一个字都没露出来。所以线上用 `brief`：「分数 + 最该做的一件事 + 最该避的一件事」，例如 `79分 宜聚餐会友 忌独自决断`（15 字符，不用截断）。完整那段运势解读不塞进卡片，用户点「进入小程序查看」就能看到全文——这也是订阅消息本来的用法。

**订阅模型是授权次数计数。** 微信一次性订阅消息「授权一次只能发一条」，但可以反复授权累积。所以每次用户在弹窗里点「允许」，服务端 `remainingQuota += 1`（封顶 7）；每成功发出一条 `-1`，发送失败不扣；归零后小程序首页横幅重新出现，引导再授权。用户可以勾选微信弹窗里的「总是保持以上选择」免去重复弹窗。

模板 ID 只有服务端一个来源，由 `GET /api/config` 的 `push.templateId` 下发，前端不写死。没配齐时 `push.enabled` 为 `false`，小程序端开关置灰并说明原因，**不会**去弹微信授权窗——那一次授权会被白烧掉（授权已消耗、服务端却没有订阅记录）。

未配置时 `POST /api/push/subscribe` 返回 **503 +「微信订阅消息尚未完成服务端配置」**，而不是 500「服务器内部错误」，见下面「错误信息可见性」。

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
- `GET /api/config` - 下发 `push: { enabled, templateId, pushTimeLabel, maxQuota }`（无需登录，带 60s 缓存）
- `GET /api/push/settings` - 权威推送状态：`pushEnabled` / `remainingQuota` / `expireAt` / `lastPushDate`
- `POST /api/push/subscribe` - 授权一次，`remainingQuota += 1`（未配置返回 503）
- `POST /api/push/unsubscribe` - 关闭提醒，配额清零（**幂等**，订阅不存在也不报错）
- `POST /api/push/trigger-daily` - **管理员**手动触发当日推送（`adminMiddleware` + `strictRateLimiter`），上线自检和补推都用它；同一天重复调用会被 `lastPushDate` 去重，不会重复发、不会重复扣配额。带 `{ "force": true }` 可无视当日去重重发一遍——改完字段映射要复验、早上那轮内容发错了要补推时需要它（定时任务永远不传 `force`）

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

例外是显式标了 `err.expose = true` 的 5xx：比如「微信订阅消息尚未完成服务端配置」这类 503，它本身就是要给用户和运维看的结论，替换成"服务器内部错误"等于把真实原因吞掉。只给这种**不含上游细节**的固定文案加 `expose`，驱动错误和上游报文一律不加。

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

需在 `.env` 设置 `ENABLE_SCHEDULER=true` 才会注册，默认不跑（这条以前在 `.env.production.example` 里是 `false`，照模板部署的结果就是「界面能开、永远收不到」）。

只有一个任务，**每日北京时间 08:30**，内部顺序执行：先把 `expireAt` 已过的订阅标记为 `expired`，再推送每日运势。合成一个是有原因的——两个任务排在同一分钟时，清理可能晚于推送，当天才到期的订阅会先被用掉一次配额。

三条必须保留的约束：

- **`tz` 必须显式指定**。`schedule.scheduleJob({ rule: '30 8 * * *', tz: 'Asia/Shanghai' }, …)`。容器里进程时区通常是 UTC，不指定的话这条 cron 会落在北京时间 16:30。时间和文案的唯一来源是 `services/push/quota.js` 的 `PUSH_CRON` / `PUSH_TIME_LABEL`，小程序端从 `GET /api/config` 取，不再各写一份。
- **cluster 单实例守卫**。`ecosystem.config.js` 是 `instances: 'max'` + cluster，`initScheduler()` 在 `bootstrap()` 里跑，不加守卫就是 N 个 worker 各注册一遍、各推一遍，微信的 `access_token` 还会互相顶掉（它按 AppID 全局唯一）。只有 `NODE_APP_INSTANCE` 为 `0`（或未注入）的实例注册。
- **多机再叠一把 Redis 日锁**。`SET push:daily:<北京日期> NX EX 3600`，抢到的那台才执行；拿不到 Redis 就降级为只靠实例守卫（单机够用）。

推送内容走的是和小程序**完全同一条路**（`fortuneService.getDailyFortune(userId, date)`），因此 `dayMaster` 会被补齐、和 App 共用同一份 Redis 缓存，用户在推送里看到的分数、宜忌、幸运色和数字与打开小程序时一致。`PushLog.content` 同时记下发出去的 `data` 和运势关键字段，方便和 `GET /api/fortune/daily` 对账。

不开定时任务时，管理员仍可手动触发：`POST /api/push/trigger-daily`。

**当天已经推过之后再想发一条，必须带 `force`。** 推送成功会把 `lastPushDate` 写成当天，此后同一天的触发一律被去重挡住——`skippedAlreadyPushed` 会记下这个原因。这对定时任务是对的（一天一条运势，两张一样的卡片是骚扰），但会让手动接口在当天彻底失效，而它整个存在的理由就是自检和补推。所以手动接口收 `force`：

```bash
curl -s -X POST http://localhost:3000/api/push/trigger-daily -H "Authorization: Bearer <管理员token>" -H "Content-Type: application/json" -d '{"force":true}'
```

`force` **只**放开日期这一条：配额照旧要求 `> 0`、照旧只有成功才扣、`43101` 照旧清零。定时任务不传它，所以 cluster 多 worker 重复注册时的幂等兜底没有被削弱。返回值里的 `forced` 会如实标出这次是否绕过了去重。

注意用户重新授权**不会**重置 `lastPushDate`：他会攒到配额，但要等第二天 08:30 才收到——这是刻意的，同一天的运势不重复发。

### 测试

```bash
cd server && npm test
```

Jest 全是纯函数用例，不连数据库、不发网络请求、不消耗大模型额度。覆盖四柱基准、立春换年柱、时辰解析、农历折算、前后端排盘一致性、北京时间边界、每日运势确定性（含幸运色与幸运数字，以前是 `Math.random()`）、管理员白名单、**登录降级规则**（生产缺凭证必须报 503 而不是造一个新用户），以及**推送的字段映射与配额状态机**（`data` 只输出声明过的键、各字段类型的截断规则、`brief` 在 20 字符内不被截断而 `summary` 一定被截断、授权累加封顶、成功才扣配额、`43101` 清零、同日去重与 `force` 只放开日期这一条、cron 与文案对得上）。改动排盘取法后这里若变红，说明用户拿到的四柱变了。

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
