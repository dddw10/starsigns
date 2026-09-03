# 算命小程序项目技术架构与功能白皮书

本小程序是一个基于 **uni-app (Vue3) + Node.js (Express)** 架构的算命与运势测算平台，融合了**传统东方命理学**、**西方神秘学**、**现代心理学咨询**以及**大语言模型 (LLM) 多智能体圆桌会谈/多模态分析**，并结合了**游戏化神兽养成系统**。

---

## 一、 系统技术栈

### 1. 前端技术栈 (位于 [miniprogram](file:///c:/Users/Administrator/fortune-miniprogram/miniprogram))
- **核心框架**：[uni-app 3.x](file:///c:/Users/Administrator/fortune-miniprogram/miniprogram/package.json) (Vue 3, Vite 5.x) — 支持一套代码打包为微信小程序、H5 等多端运行。
- **状态管理**：Pinia 2.x — 统一管理用户信息、主题配置、神兽状态等。
- **UI 组件库**：uni-ui — 提供轻量化的跨端基础组件。
- **核心逻辑封装**：
  - [api/request.js](file:///c:/Users/Administrator/fortune-miniprogram/miniprogram/src/api/request.js)：封装统一的网络请求，负责 Token 自动附加、启动期会话闸门、401 自动换令牌并重试一次（详见「二 · 7 登录与会话」）。
  - [styles](file:///c:/Users/Administrator/fortune-miniprogram/miniprogram/src/styles)：四套高质感主题样式配置（中国风 `theme-chinese`、现代简约 `theme-modern`、神秘暗黑 `theme-dark`、卡通可爱 `theme-cute`）。

### 2. 后端技术栈 (位于 [server](file:///c:/Users/Administrator/fortune-miniprogram/server))
- **核心框架**：Node.js 18+ & Express — 轻量、高性能的 RESTful API 基础服务。
- **数据库**：
  - **MongoDB 7.x**：通过 Mongoose 进行对象文档映射，存储用户、测算历史、神兽属性、推送订阅记录、推送日志与意见反馈（`User` / `Fortune` / `History` / `Pet` / `PushSubscription` / `PushLog` / `Feedback`），以及存放系统开关的 `configs` 集合。
  - **Redis 7.x**：缓存高频配置项，处理高并发限流逻辑。
- **万年历**：lunar-javascript 1.7.7 — 干支排盘、节气与农历公历互转的唯一数据来源，前后端**锁同一个版本号**，保证同一个生日在两端排出同一盘。
- **大模型链路**：
  - **OpenAI SDK**：接入 GPT 或 DeepSeek 等主流大语言模型。
  - **Langfuse SDK**：全链路监控大模型调用，包含 Token 消耗、耗时、提示词追踪与 Tool Call 过程。未配置公私钥时自动降级为关闭，不影响主流程。
- **定时调度**：node-schedule — 每日运势推送与失效订阅清理，由 `ENABLE_SCHEDULER=true` 显式开启。

---

## 二、 核心功能模块与技术实现分类

### 1. 传统东方命理与星座运势
基于纯数学与天干地支五行公式进行本地化计算，减少对大模型的直接依赖，实现精确排盘。

- **生辰八字分析 (BaZi)**
  - **对应代码**：[algorithms/bazi/index.js](file:///c:/Users/Administrator/fortune-miniprogram/server/src/algorithms/bazi/index.js)、[wuxing.js](file:///c:/Users/Administrator/fortune-miniprogram/server/src/algorithms/bazi/wuxing.js)、[lunar.js](file:///c:/Users/Administrator/fortune-miniprogram/server/src/algorithms/bazi/lunar.js)
  - **技术实现**：排盘直接取自 **lunar-javascript 万年历**（`Solar.fromYmdHms(...).getLunar().getEightChar()`），四柱、纳音、藏干、节气均由库给出，不再自己维护农历对照表。三处关键取法：
    1. **时柱取时辰正中**：十二时辰映射到 0/2/…/22 点的 `:30`，子时统一按 00:30 处理；无法识别的时辰**直接报 400** 而不是静默落到子时。
    2. **年柱以立春的精确时刻为界**：如 2024-02-04 立春在 16:27，同一天子时仍是癸卯、亥时已进甲辰。
    3. **生肖从年柱地支取**：库里的 `getYearShengXiaoByLiChun()` 只精确到立春那一天，会和四柱打架，因此生肖只认年柱地支。
  - **农历录入**：用户可选公历/农历（`calendar` 字段）。农历先经 `resolveSolarDate()` 折算成公历再排盘，落库时 `bazi.input.solarDate` 永远是公历、原始农历输入另存 `lunarDate`；农历里不存在的日子（月只有 29/30 天）报 400 而不是排出一个错盘。
  - **前后端一致**：小程序端 [bazi-chart.js](file:///c:/Users/Administrator/fortune-miniprogram/miniprogram/src/pages/bazi/utils/bazi-chart.js) 用同一个库做本地实时预览，由 [bazi-client-parity.test.js](file:///c:/Users/Administrator/fortune-miniprogram/server/tests/bazi-client-parity.test.js) 逐柱比对，保证预览与提交结果不会两样。
  - **具体功能**：在四柱之上计算日主强弱与金、木、水、火、土**五行盈缺比值**，给出详尽的性格解析、大运流年走向，以及双人八字合婚配对 ([match.js](file:///c:/Users/Administrator/fortune-miniprogram/server/src/algorithms/bazi/match.js))。
- **每日运势生成 (Daily Fortune)**
  - **对应代码**：[algorithms/daily-fortune/index.js](file:///c:/Users/Administrator/fortune-miniprogram/server/src/algorithms/daily-fortune/index.js)
  - **技术实现**：以万年历的值日干支计算日柱与今日五行交互（同类、生我、我生、克我等五行生克关系），并检测值日地支是否与用户生肖或日支发生**地支相冲**（如子午相冲、丑未相冲）。结果按"用户 + 日期"确定性生成，同一天刷新多少次都是同一份。
  - **"今天"一律按北京时间**：容器进程时区通常是 UTC，签到、每日运势、宠物状态衰退、推送时段判断全部统一走 [utils/date.js](file:///c:/Users/Administrator/fortune-miniprogram/server/src/utils/date.js) 的 `getBeijingDateString()`，不再各处自己 `+8 小时`。
  - **具体功能**：计算每日运势百分制分数，输出运势等级（星级），并智能派发个性化的**宜忌活动**、幸运颜色（Hex 值）及幸运数字。
- **姓名五格剖象与配对 (Name Testing)**
  - **对应代码**：[algorithms/name/index.js](file:///c:/Users/Administrator/fortune-miniprogram/server/src/algorithms/name/index.js)
  - **技术实现**：基于传统繁体字笔画，自动排盘出**天格、人格、地格、外格、总格**五大维度（五格剖象法），并根据五行吉凶给出剖析。
  - **具体功能**：分析姓名三才配置、吉凶祸福，并支持双人姓名契合度配对 ([match.js](file:///c:/Users/Administrator/fortune-miniprogram/server/src/algorithms/name/match.js))。
- **风水空间美学 (Feng Shui)**
  - **对应代码**：[algorithms/fengshui/index.js](file:///c:/Users/Administrator/fortune-miniprogram/server/src/algorithms/fengshui/index.js)
  - **具体功能**：输入户型结构与朝向，系统通过九宫飞星或八宅法，给出家居及办公空间的风水方位吉凶分析与摆设调理建议。

### 2. 西方神秘学与塔罗占卜
- **灵感卡牌占卜 (Tarot)**
  - **对应代码**：[algorithms/tarot/index.js](file:///c:/Users/Administrator/fortune-miniprogram/server/src/algorithms/tarot/index.js)、前端数据字典 [tarot-cards.js](file:///c:/Users/Administrator/fortune-miniprogram/miniprogram/src/utils/tarot-cards.js)
  - **技术实现**：提供**单牌占卜**、**三牌占卜**（过去/现在/未来）及**感情配对牌阵**。模拟 78 张塔罗牌（大阿尔克纳+小阿尔克纳）的随机抽取过程，支持**正位与逆位**两种状态的差异化算法释义。

### 3. 前沿 AI 智能互动与圆桌会谈
- **AI 命理大师流式聊天 (Master Agent)**
  - **对应代码**：[services/aiService.js](file:///c:/Users/Administrator/fortune-miniprogram/server/src/services/aiService.js) (`chat` 函数)
  - **技术实现**：调用 OpenAI 接口，挂载两个高精度 Function：`analyze_bazi` 和 `analyze_tarot`。`analyze_bazi` 的 `birthTime` 参数用 `enum` 锁死十二时辰并在描述里写明钟点换算，避免模型编出"上午十点时"这类排不出盘的取值。
  - **具体功能**：当用户在聊天界面提问时，Agent 会通过 **Function Calling** 机制调用后端的科学计算函数，将获得的精准命理 JSON 转化成富有人文关怀、富有启发性的聊天式解读，彻底规避了大模型的“胡言乱语”与虚构盘面。支持 Server-Sent Events (SSE) 流式字符响应。
- **AI 智能体圆桌会谈 (Multi-Agent Council)**
  - **对应代码**：[services/multiAgentService.js](file:///c:/Users/Administrator/fortune-miniprogram/server/src/services/multiAgentService.js) (`councilStream` 函数)
  - **技术实现**：编排四个不同的智能体角色进行协作讨论：
    1. **妙空大师 (东方命理)**：禅意满满，精通八字易经。
    2. **塞蕾娜 (西方占星)**：优雅浪漫，精通塔罗占星。
    3. **德叔 (心理学咨询)**：现代幽默，专注于 CBT 实际行动。
    4. **编排编译主笔**：总结前三位专家的会谈精髓，按 Markdown 排版出终极报告。
  - **喂给专家的八字**由 `buildBaziString()` 统一产出（流式分支在异步 IIFE 内 `await`，因为 `councilStream` 必须同步返回 `Readable`）；它同时接受十二时辰名与聊天页传来的 0-23 钟点字符串，并由 [council-bazi.test.js](file:///c:/Users/Administrator/fortune-miniprogram/server/tests/council-bazi.test.js) 钉住——历史上这里漏过一次 `await`，专家们曾长期收到"未提供生辰八字"而日志毫无痕迹。
  - **具体功能**：用户只需发起一次提问，四个智能体将接力流式发言，为用户奉上融合中西命理与现代心理咨询的圆桌诊断方案。
- **AI 颜值多模态识别 (VLM Face/Palm Reading)**
  - **对应代码**：[services/aiService.js](file:///c:/Users/Administrator/fortune-miniprogram/server/src/services/aiService.js) (`analyzeFacePalm` 函数)
  - **技术实现**：
    - **视觉模式**：将用户在前端拍摄的面部/手部图像以 Base64 发送到 VLM 视觉大模型（如 GPT-4o），直接多模态识别五官或掌纹。
    - **兜底模式 (如 DeepSeek 纯文本模式)**：若当前模型不支持图像输入，后端会分析提取图像边缘特征（如皮肤平滑红润度 `skinRatio`、轮廓纹理均值 `edgeAverage`），将其拼装进 Prompt 中，进行传统相学的智能推演解析，确保功能在各种模型下均可用。

### 4. 游戏化神兽养成系统 (Guardian Beast)
通过游戏玩法提高小程序用户的黏性与日活率。

- **核心数据模型**：[models/Pet.js](file:///c:/Users/Administrator/fortune-miniprogram/server/src/models/Pet.js)
- **技术实现**：
  - **孵化与成长**：用户初始拥有一颗“封印蛋 (`egg`)”。可通过日常签到、抚摸或喂食获得经验值，逐步破壳进化为**青龙、朱雀、白虎、玄武、麒麟**五大神兽之一，等级最高可升至 30 级。
  - **喂食与互动**：道具仓库存储四类仙草食物（粗粮仙草、晨露琼浆、五谷朱砂丹、太极蟠桃），可增加饱食度与经验。每日可通过“抚摸（摸摸头）”增加心情值。
  - **状态自然衰退**：每次获取宠物状态时，后端计算当前时间与上次扣除时间 `lastDecayAt` 的差值，自动按照时间衰退饱食度与心情，实现云养宠的真实生命感。
  - **奖励反馈 (星能福袋)**：升级或互动能获得“待开启的福袋 (`giftBoxes`)”，开启后按概率掉落太极蟠桃、粗粮仙草或 200 点灵气（灵气溢出会再次触发升级、再送福袋）。完成任意一次测算也会掉落一株粗粮仙草，把命理功能与养成循环串起来。

### 5. 管理后台与「简洁模式」开关
本项目不含任何支付、会员或付费额度逻辑，所有测算功能对全部登录用户免费开放；管理能力仅限白名单管理员。

- **管理员判定**：[config/admin.js](file:///c:/Users/Administrator/fortune-miniprogram/server/src/config/admin.js) — 由 `ADMIN_PHONES` / `ADMIN_USER_IDS` 两个环境变量（逗号分隔）声明白名单，手机号归一化后比较，`+86`、空格、横线等写法都能命中。白名单在**每次调用时读环境变量**，改配置不必改代码；白名单为空时谁都不是管理员。判定结果通过用户信息里的 `isAdmin` 下发给小程序端。
- **简洁模式 (`auditMode`)**：[config/systemConfig.js](file:///c:/Users/Administrator/fortune-miniprogram/server/src/config/systemConfig.js)
  - **含义**：开启后小程序首页只放出星座能量与空间美学两项，用于送审等需要收敛功能面的场景。
  - **读**：`GET /api/config` 返回当前开关，值存在 MongoDB 的 `configs` 集合（`key: 'auditMode'`），带 **60 秒进程内缓存**；数据库不可用时回落到环境变量 `AUDIT_MODE`，且**只有显式写 `false` 才关闭**（送审安全优先）。
  - **写**：`POST /api/admin/config/toggle`（整个 `/api/admin/*` 由 `adminMiddleware` 把守），写库后立即刷新缓存，管理员切完开关无需等待 60 秒。
  - **入口**：小程序「我的」页面在管理员账号下多出一行带 `switch` 的「简洁模式」，整行不挂点击事件以免误触；切换失败时开关靠本地 `ref` 回弹，提示排在 `hideLoading()` 之后（小程序的 loading 与 toast 共用同一个原生浮层）。
- **意见反馈处理**：[services/adminService.js](file:///c:/Users/Administrator/fortune-miniprogram/server/src/services/adminService.js) — 分页拉取用户反馈、回复并置为 `processed`。

### 6. 定时任务与消息订阅推送

这条链路整体重做过一次。之前的状态是「代码在、也确实在调真实微信接口，但一条也发不出去」，五处阻断每一处单独都足以致命：前后端各写一份模板 ID 且对不上（而客户端**先弹微信授权、后调服务端**，用户那一次宝贵的授权被白烧掉、订阅记录一条都没落库）；`.env.production.example` 里 `ENABLE_SCHEDULER=false`；cron 不传 `tz`，容器 UTC 下落在北京时间 20:00；`data` 一次塞 30+ 个字段必被微信按 `47003` 整条拒收；PM2 cluster 下 N 个 worker 各注册各推。

- **任务调度器**：[scheduler/pushScheduler.js](file:///c:/Users/Administrator/fortune-miniprogram/server/src/scheduler/pushScheduler.js)（需 `ENABLE_SCHEDULER=true` 才注册）
- **推送服务**：[services/pushService.js](file:///c:/Users/Administrator/fortune-miniprogram/server/src/services/pushService.js)
- **配额状态机**：[services/push/quota.js](file:///c:/Users/Administrator/fortune-miniprogram/server/src/services/push/quota.js)（纯函数，推送时间/cron/时区与去重判定的唯一来源）
- **模板字段映射**：[services/push/templateMapping.js](file:///c:/Users/Administrator/fortune-miniprogram/server/src/services/push/templateMapping.js)（纯函数）

**订阅模型：授权次数计数。** 微信一次性订阅消息「授权一次只能发一条」，但允许反复授权累积。所以 `PushSubscription.remainingQuota` 每次授权 `+1`（封顶 7）、每**成功**发出一条 `-1`；发送失败不扣（一次网络抖动不该白吃一次授权），`43101`（用户已在微信里拒收）直接清零。归零后小程序首页横幅重新出现，这是重新授权的入口——旧实现里客户端的 `pushEnabled` 是 localStorage 里永远为 `true` 的布尔值，服务端发完却把订阅置 `inactive`，于是横幅再也不出现，用户既看不出已经用完也找不到入口。现在权威状态一律由 `GET /api/push/settings` 从 `PushSubscription` 算出。

**模板配置驱动。** 模板 ID 只有服务端一个来源，经 `GET /api/config` 的 `push.templateId` 下发；字段映射写在 `WECHAT_TPL_DAILY_FORTUNE_FIELDS`（`微信字段名:内容键`，逗号分隔）。`buildTemplateData()` **只输出声明过的键**——微信要求 `data` 与模板参数严格一致，多一个就是 `47003`。各字段还有类型限制（`thing` ≤20 字符、`phrase` ≤5 个**汉字**、`character_string` ≤32 且不收中文、`number` 纯数字），写错字段名 / 内容键 / 字段重复 / 内容键与类型不匹配都在**启动时**抛错，不等推送那一刻被拒。字段名是「类型 + 序号」，只能照模板详情页的「详细内容」抄（那里原样写着 `{{thing1.DATA}}`）——本项目在用的「今日运势提醒」（模版编号 71514）三个关键词是运势关键词 / 运势简述 / 日期，而「日期」被声明成 `time3` 而不是 `date3`，光看关键词列表分辨不出类型，按语义猜就是 `47003`。没配齐时 `push.enabled` 为 `false`，客户端开关置灰并说明原因、**不弹**授权窗；`POST /api/push/subscribe` 返回 503 且带 `err.expose`，让这句文案穿过「5xx 一律替换成服务器内部错误」的全局规则。

**内容要为 20 个字符专门写。** `thing` 的 20 字符是微信的硬上限，没有更长的中文字段类型可选（`character_string` 虽然 32 但不收中文），塞不进的只能截断。所以 `summary`（`分数 + 整段运势解读`）进 `thing` 会变成「79分 今日金气适中，工作顺利，人际关…」——预算全花在铺垫上，结论一个字都没露出来。线上因此改用 `brief`：`分数 + 最该做的一件事 + 最该避的一件事`，即 `79分 宜聚餐会友 忌独自决断`（15 字符，宜忌词条都是 4 字，三位分数下最长 16 字符，永远不触发截断）。整段解读不塞进卡片，用户点卡片底部的「进入小程序查看」看全文——这也是订阅消息本来的用法。`tests/push.test.js` 同时钉住了 `brief` 不带省略号和 `summary` 一定被截断两条，换回去会立刻变红。

**核心定时逻辑：**
  - 每日 **08:30（北京时间）**，`{ rule: '30 8 * * *', tz: 'Asia/Shanghai' }`。`tz` 必须显式给，容器里进程时区通常是 UTC。首页标签、设置页文案都从 `pushTimeLabel` 取，不再出现「cron 20:00 / 界面写 00:00 / 用户存的时间没人读」三个时间互不相干。
  - 清理与推送**合成一个任务、顺序执行**：先把 `expireAt` 已过的订阅置 `expired`，再推送。原先两个任务落在同一分钟，当天才到期的订阅可能先被用掉一次配额再被标记过期。
  - **cluster 单实例守卫** + **Redis 日锁**：只有 `NODE_APP_INSTANCE` 为 `0`（或未注入）的实例注册；多机部署再靠 `SET push:daily:<北京日期> NX EX 3600` 决出唯一一台。微信 `access_token` 按 AppID 全局唯一，并发去取会互相顶掉，所以它也走 Redis 共享缓存。
  - **同日去重**：`lastPushDate === getBeijingDateString()` 的记录跳过，管理员手动 `POST /api/push/trigger-daily` 重复调用不会重复发、不会重复扣配额。统计里的 `skipped` 拆成 `skippedNoBirthInfo` / `skippedAlreadyPushed` 两个原因——合成一个数字时「没收到」既可能是缺生辰也可能是当日已推，分辨不出来。
  - **`force` 只给手动接口**：当天推过之后 `lastPushDate` 已是今天，此后同一天的触发（包括用户重新授权后）一律被去重挡住。这对定时任务是对的，但会让手动接口在当天彻底失效，而它整个存在的理由就是自检和补推。所以 `POST /api/push/trigger-daily` 收 `{ force: true }`，由 `shouldSkipDuplicate()` 判定；它**只**放开日期这一条，配额照旧要求 `> 0`、照旧只有成功才扣、`43101` 照旧清零。定时任务永远不传，cluster 多 worker 的幂等兜底不受影响。用户重新授权也**不**重置 `lastPushDate`：配额会攒上，但要等第二天 08:30——同一天的运势不重复发。
  - **推送内容与 App 完全一致**：走 `fortuneService.getDailyFortune(userId, date)`，而不是直调 `generateDailyFortune(user.birthInfo)`——`birthInfo` 里没有 `dayMaster`，少了它分数不加减五行、`relation` 恒为 `companion`，推送里的分数和宜忌和小程序里不是一份。同时 `daily-fortune` 的幸运色与幸运数字已从 `Math.random()` 改为按「用户日柱 + 日期」的确定性种子（App 侧被 Redis 缓存盖住看不出来，推送侧绕过缓存直调算法，两边必然对不上）。

**删掉的死代码**（界面写了但代码不做）：`pushTime` / `setPushTime`（服务端认真做了 HH:mm 校验，推送逻辑从不读它）、「生日密码日运」「星座日运」两个只写库的类型开关、以及前端硬编码的模板 ID。

### 7. 登录与会话（"用户数据不丢"的关键路径）

线上曾出现"用久了数据就没了、页面还卡着进不去"，根因不在业务代码而在这条链路上，因此单列一节。

**服务端：宁可登录失败，也不发一个换了人的身份**
- **openid 是唯一稳定身份**。`uni.login()` 拿到的 `code` 是一次性的，只有 AppID + AppSecret 都真实才能换到 openid。缺凭证时旧代码会降级成 mock，用 `dev_openid_<code>` 当身份 —— **每次冷启动都是一个新用户**，生辰、历史、神兽自然全都对不上。
- **降级规则**（[services/userService.js](file:///c:/Users/Administrator/fortune-miniprogram/server/src/services/userService.js) 的 `_shouldUseMockLogin`）：凭证齐全一律走真实登录；凭证缺失时只有 `NODE_ENV !== 'production'` 才允许 mock；生产环境直接 **503** 并在日志里点名 `WECHAT_APP_SECRET`。`ALLOW_MOCK_LOGIN=true` 是唯一的显式逃生门。占位值（`your_app_id` / `your_app_secret`）由 [config/wechat.js](file:///c:/Users/Administrator/fortune-miniprogram/server/src/config/wechat.js) 的 `hasCredentials()` 统一判定，算作"没配"。
- **`h5-` 前缀的 code 例外**：H5 端没有微信 code，前端下发的是存在浏览器里的持久 UUID，这是 H5 的正式身份来源，生产环境同样走 `_mockWxLogin`。
- **启动即报警**：[app.js](file:///c:/Users/Administrator/fortune-miniprogram/server/src/app.js) 的 `checkLoginConfig()` 在 bootstrap 阶段就把缺凭证喊出来，不必等第一个用户登录失败才发现。
- **规则由测试钉住**：[login-degradation.test.js](file:///c:/Users/Administrator/fortune-miniprogram/server/tests/login-degradation.test.js)（11 条）覆盖凭证判定表、五种降级组合与"生产缺凭证返回 503 而不是造新用户"。
- **`optionalAuthMiddleware` 不再把过期令牌当游客**（[middleware/auth.js](file:///c:/Users/Administrator/fortune-miniprogram/server/src/middleware/auth.js)）：没带令牌才是游客；带了但验不过如实回 401。旧行为下客户端会拿到一份默认运势（看起来就是"我的生日和运势丢了"），而且**永远收不到 401、永远不会去换令牌**。
- **登录接口单独限流**（[middleware/rateLimit.js](file:///c:/Users/Administrator/fortune-miniprogram/server/src/middleware/rateLimit.js)）：`/api/user/login` 每次冷启动、每次 401 恢复都会被打一次，按 IP 的"15 分钟 20 次"会让同一个运营商出口下的用户集体 429（表现就是登录失败、进不去），改为 `wxLoginRateLimiter`（60 秒 120 次）；账号密码的 `/register`、`/login-account` 可被撞库，保留 `loginRateLimiter`（15 分钟 20 次）并新增 `accountAuth` 入参校验。

**客户端：令牌一定能换回来，页面一定不被拖住**
- **小程序启动时丢弃本地令牌重换**（[store/user.js](file:///c:/Users/Administrator/fortune-miniprogram/miniprogram/src/store/user.js) 的 `initFromStorage` + [App.vue](file:///c:/Users/Administrator/fortune-miniprogram/miniprogram/src/App.vue)）：JWT 无法离线验证，`uni.login()` 又不需要用户操作。**注意不能再拿"本地有没有令牌"当要不要登录的条件** —— 那样一次登录失败就永久停在未登录态，页面还显示着旧的 `user_info`，正是"数据没了还进不去"。
- **启动期会话闸门**：`restoreWechatSession()` 把登录 Promise 交给 `setSessionReadyPromise()`，业务请求先等它，**最多 6 秒**（`Promise.race`）。不等会拿到游客数据；无上限地等就成了真卡死。登录/注册自身必须带 `skipSessionGate`，否则自己等自己。
- **401 恢复单飞**：`recoverSession()` 用一个 `sessionRecoveryPromise` 收敛并发 401，成功后原请求重试一次。`recoverExpiredSession()` 刻意**不提前清令牌**（`login()` 可能复用一个已写好新令牌的在途请求，先清会把它抹掉）；按 `auth_mode` 区分——微信会话自动重登，账号密码会话只能提示用户去「我的」重新登录。
- **聊天页的 SSE 也接进同一条恢复链**（[pages/chat/index.vue](file:///c:/Users/Administrator/fortune-miniprogram/miniprogram/src/pages/chat/index.vue)）：它用手写的 `uni.request` / `wx.request`（`enableChunked` 才能收 SSE），不走 `request.js`。现在 401 会调 `recoverSession()` 换令牌后重发一次（请求头每次现取令牌，流式分片状态每次重置），否则用户会在对话里看到一条"服务器状态码: 401"。
- **生辰本机备份**：生辰是用户最在意、也最容易"看起来丢了"的数据。`backupBirthInfo()` 把 `solarDate` + `birthTime` 存一份在本机，登录后若**服务端为空**才回填（`restoreBirthInfoFromCache()`，带 `skipSessionGate`），绝不覆盖服务端已有值；`logout()` 会连备份一起清掉，避免下一个人被回填成上一个人的生辰。
- **loading 与 toast 的顺序**：小程序的 `showLoading` / `showToast` 共用同一个原生浮层，任何排在 `hideLoading()` 之前的提示都会被一起收走；且 `hideLoading()` 必须放在 `finally` 里——只在 `code === 0` 和 `catch` 两条路上关，"有响应但 code 不为 0"就会把 loading 永久挂在页面上。

### 8. 失败态与用户可见反馈（"看起来像丢数据"的第二类来源）

上一节讲的是身份真丢了；这一节讲的是身份没丢、数据也在，但页面把一次失败**画成了空**或**画成了成功**。判断标准只有一条：**屏幕上写的话必须是真的**。

- **加载失败 ≠ 没有数据**。[pages/history/index.vue](file:///c:/Users/Administrator/fortune-miniprogram/miniprogram/src/pages/history/index.vue) 原先在 `catch` 里 `historyList.value = []`，于是一次超时就渲染出「暂无历史记录 / 快去测算一下吧」——和真的没有记录一模一样，用户读到的是"我的记录全没了"。现在分三态：`loading` 显示"正在读取"、`loadError` 显示原因加**重新加载**按钮、两者都空才是空态；刷新失败时若列表里还有上次的数据，则保留数据并用 toast 说明这次没刷上。[pages/result/index.vue](file:///c:/Users/Administrator/fortune-miniprogram/miniprogram/src/pages/result/index.vue) 同样把"这条记录没能加载出来（可重试）"和"记录不存在"分开。
- **顺手刷新不许把成功变成失败**。`fetchUserInfo()`（[store/user.js](file:///c:/Users/Administrator/fortune-miniprogram/miniprogram/src/store/user.js)）是测算/签到/绑定成功之后"顺手同步灵气与道具"的动作，十几个调用点都写在业务的 `try` 里。它**自己吞异常、只返回布尔值**：往外抛的话，一次刷新失败就会掉进业务的 `catch`，把明明成功的测算显示成「排盘失败 / 抽取失败 / 堪舆失败 / 推演失败」。八字保存那处更隐蔽——`catch` 只改了提示文案没改 `ok`，错误文字会配着 `success` 的 ✓ 图标弹出来（`ok` 现在也一并回落）。同理 `checkLoginStatus()` 不再因为一次网络抖动就 `logout()`。
- **提示一律排在 `hideLoading()` 之后**。这轮把还没改到的地方一起补齐：历史记录删除、首页两条绑定手机号分支、「我的」页的反馈提交/反馈列表/管理端拉取与回复/账号登录注册/头像处理/资料保存。回复反馈那处还把 `loadAdminFeedbacks()` 挪到 `hideLoading()` 之后——它自己也会 `showLoading`，嵌在外层 try 里会出现两层浮层互相关闭。
- **按钮必须真的做事**。结果页的「分享给好友」以前只弹一句"分享链接已复制"，其实什么都没发生；「保存海报」是 `setTimeout` 1.2 秒后直接说"海报已保存至相册"，相册里什么都没有。现在微信端用 `open-type="share"` 配 `onShareAppMessage` 唤起真的转发面板，H5 端用 `setClipboardData` 复制真实地址，保存海报跳到 share 页由 canvas 真实绘制并写入相册。

---

## 三、 工程化构建与部署

1. **回归测试**：[server/tests](file:///c:/Users/Administrator/fortune-miniprogram/server/tests) — `npm test` 跑 Jest（纯函数，不连数据库、不发网络请求、不消耗大模型额度）。覆盖四柱基准值、立春换年柱、时辰解析的接受/拒绝表、农历折算、前后端排盘一致性、北京时间边界（15:59:59Z / 16:00:00Z）、每日运势确定性与相冲扣分、管理员白名单归一化、会谈八字串，以及推送的字段映射与配额状态机（`data` 只输出声明过的键、各字段类型的裁剪、`brief` 不截断 / `summary` 必截断、授权累加封顶、成功才扣配额、`43101` 清零、同日去重与 `force`）。**这些期望值是“钉子”**：改动排盘取法时如果红了，说明用户拿到的四柱变了，必须先想清楚是不是真的要变。
2. **一键打包脚本**：[build-and-pack.js](file:///c:/Users/Administrator/fortune-miniprogram/build-and-pack.js) — 自动调用 `npm run build:mp-weixin` 编译前端 uni-app，打包生成的静态目录以及服务配置项，将其整理压缩成一键发布部署的 `server-deploy.zip`。
3. **多机自动化部署**：[deploy.js](file:///c:/Users/Administrator/fortune-miniprogram/deploy.js) 及 [deploy_helper.py](file:///c:/Users/Administrator/fortune-miniprogram/deploy_helper.py) — 脚本集成了 SSH、SFTP 连接，可自动将包上传到生产服务器并解压重启 PM2，实现极简的 CI/CD 流程。
4. **Docker 容器化**：配置 [docker-compose.yml](file:///c:/Users/Administrator/fortune-miniprogram/docker-compose.yml) 快速拉起后端应用、MongoDB 与 Redis，实现测试与环境的高一致性。注意 compose 文件里的 `${VAR}` **不会**从 `env_file` 取值，部署时必须显式带上 `--env-file`。
5. **上线前必须替换的配置**：
   - `WECHAT_APP_ID` + `WECHAT_APP_SECRET`：**两项都必填**。缺一项或留占位值，小程序登录接口一律返回 503（不会降级成 mock，理由见「二 · 7」）。AppSecret 在微信公众平台「开发管理 → 开发设置」重置获取，只显示一次。
   - `JWT_SECRET`：默认是占位串，留着起不来服务；用 `openssl rand -hex 32` 生成。换掉后已签发的 token 立即失效，小程序端会自动重登。
   - `ADMIN_PHONES`：不填则简洁模式开关无人可见。
   - `ALLOW_MOCK_LOGIN`：保持 `false`。设成 `true` 等于允许线上给用户换身份。

---

## 四、 已知待办（安全加固）

以下几项属于成本与滥用防护，尚未实施，上线前需要评估：

- `/api/fortune/ai-chat` 与 `/api/fortune/council` 挂的是 `optionalAuthMiddleware`（登录可选）且没有独立限流，未登录也能直接调用并消耗付费大模型额度。
- `/api/fortune/face-palm` 缺少入参校验与图片体积上限（`express.json` 的 `10mb` 是唯一约束）。
- SSE 流式接口在出错时会把 `error.message` 原样推给前端（[aiController.js](file:///c:/Users/Administrator/fortune-miniprogram/server/src/controllers/aiController.js) 的 71 / 123 / 142 行），可能泄漏上游报错细节。
