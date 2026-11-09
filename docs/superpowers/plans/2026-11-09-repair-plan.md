# 全项目分批修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. 每批按失败回归 → 最小实现 → 验证 → 独立审查执行。

**Goal:** 完成 REPAIR_PLAN 六批源码修复，交付可运行回归、迁移预览与部署预检，保持旧用户身份和数据。

**Architecture:** 保留 Vue/Pinia + Express/Mongoose 现有结构。客户端统一会话恢复与请求生命周期，服务端维护可信身份并用数据库条件更新协调并发；生产运维变更以独立的预览和回滚流程交付。

**Tech Stack:** uni-app、Vue 3、Pinia、Node.js >=18、Express、Mongoose 7、MongoDB、Redis、Jest、OpenAI SDK、Paramiko、Docker Compose。

**Spec:** [原始修复建议](../../../graphify-out/REPAIR_PLAN.md)，以及用户确认的“按推荐方案分批实施全部源码修复”和“先给出计划，再使用 Superpowers 去实现”。

## Global Constraints

- 先给出本计划，再开始业务代码实现。此前已做只读审计、独立分支和测试基线。
- 管理员保留真实验证手机号和 ADMIN_USER_IDS；旧 phone 不自动变为已验证。
- 用户退出会谈页取消当前请求；应用后台隐藏保持现有行为，不引入持久任务。
- 只用假微信发送和假模型，最多四次模型调用的单个圆桌夹具；不发送真实消息或消耗模型额度。
- 真实数据库迁移、生产配置/凭据变更、线上发布需在可评审预览与备份/回滚准备后确认，本次不执行。
- 不改既有 Mongo 主版本、服务名或卷名；不轮换 JWT_SECRET；不凭图谱关系宣称漏洞已在线复现。
- 每批建立能触发旧错误的行为测试，不用源码字符串检查替代运行验证。无需新增测试框架。
- 实施目录 C:/Users/Administrator/.codex/worktrees/repair-plan/fortune-miniprogram；分支 codex/repair-plan；基线 382ede7。
- 原目录未提交的 .claude/、docs/、graphify-out/ 保留。独立工作区中只提交明确列出的本批文件。

## 批次依赖与交付

| 批次 | 依赖 | 独立交付 | 验收入口 |
| --- | --- | --- | --- |
| 1 登录 | 无 | 恢复状态、请求闸门、页面补加载、配置守卫 | 客户端真实模块回归、双端构建 |
| 2 身份 | 1 的账号切换隔离 | authSource、可信手机、管理员只读预览 | 身份/权限服务回归 |
| 3 推送 | 2 的微信资格 | 原子订阅与认领、保守重复合并预览 | 并发夹具、迁移 dry-run |
| 4 AI | 1 的共享恢复接口 | 双端取消、AbortSignal 全链路 | 假模型及 HTTP 断开回归 |
| 5 部署 | 无业务依赖，沿顺序实施 | 统一预检、可信 SSH、鉴权模板和运行手册 | 无副作用脚本测试、Compose 校验 |
| 6 其他加固 | 2 的 User、4 的 AI、5 的 env | 旧密码/JWT 兼容、输入限制、原子签到库存、文档 | 兼容/边界/竞争回归、完整构建 |

每批内部的小循环按以下编号实施。每个小循环先见到失败再改代码，批末由独立审查者核对完整原始要求。

## Task 1: 登录与页面恢复

**Files:** 修改 miniprogram/src/store/user.js、api/request.js、api/user.js、App.vue、utils/auditGuard.js、首页/个人中心/聊天页及守卫调用页；创建客户端行为回归和必要测试加载器。

**Interfaces:** store 对外返回明确 sessionStatus（restoring/authenticated/failed/logged_out）、sessionVersion 与共享恢复方法；request 对外保持 recoverSession，并提供可被手写聊天请求复用的会话等待/版本检查。skipSessionGate 与 skipAutoRecovery 必须独立。

- [ ] **1.1 写失败回归并运行。** 保留缓存资料但 isLoggedIn 为 false；阻塞登录 Promise 后发个人请求，断言未发游客请求；恢复途中 logout，晚到的登录/资料/生辰响应都不写 storage。用受控 Promise 和假 uni.request 运行真实代码。
- [ ] **1.2 实现状态与版本。** 从缓存初始化展示资料；真实令牌交换成功后标为 authenticated；主动退出持久标记并递增版本；切换账号前也递增。每个异步写入检查发起时版本。并发恢复共享 Promise，超时、有限重试和冷却后返回失败；无 token 且未退出的前台恢复可重试。

```js
// 所有写入当前会话的在途动作使用同一个版本边界。
const startedVersion = sessionVersion.value;
const res = await getUserInfoApi();
if (startedVersion !== sessionVersion.value) return false;
```

- [ ] **1.3 写登录/回填 401 和闸门超时失败回归，再修 API。** 登录/注册/回填设置 { skipSessionGate: true, skipAutoRecovery: true }；登录完成只依赖 session 保存，回填不阻塞。闸门等待失败返回明确可重试错误；公开 API 显式允许游客。
- [ ] **1.4 写前台恢复、页面补加载、配置失败/退页失效回归，再修生命周期。** theme 初始化先于网络；config 与登录独立；页面观察成功会话补加载；配置 unknown/failed/loaded 分开，未知或失败限制能力但提示重试，离页取消发起页的退页定时器。
- [ ] **1.5 验证并提交。** 客户端行为回归全部通过；运行 H5 和微信构建，检查 diff；独立审查通过后标记本批完成。

**Expected:** 已有用户弱网启动保留展示资料、保护操作等待真实认证；断网恢复后可再次加载；旧响应无法重新登录或串号。

## Task 2: 身份来源与管理员权限

**Files:** server/src/models/User.js、services/userService.js、config/admin.js、推送身份资格辅助函数与引用；server/tests/admin.test.js、login-degradation.test.js、身份服务回归；新增管理员只读预览脚本及说明。

**Interfaces:** User.authSource 使用 wechat/h5_guest/account/dev_mock/unknown；phoneVerifiedSource 使用 wechat 或空值（模拟为明确不可信）；只有完成对应服务端认证路径才能写来源。isAdminUser(user) 保持签名，ID 白名单仍有效；手机号必须验证来源可信且不是模拟身份。

- [ ] **2.1 写并运行失败回归。** production 的 h5- 手机凭证被拒绝；模拟手机号即使命中 ADMIN_PHONES 也返回 isAdmin=false；真实已验证手机号与 ID 管理员返回 true；profile 入参中的来源/验证字段不能落库。
- [ ] **2.2 实现可信来源。** 微信真实响应需含有效 openid 后设置 wechat；H5 UUID 保留既有 dev_openid_h5- 派生算法和长度，来源为 h5_guest；账号成功密码验证设 account；开发模拟只在明确非生产模式允许。历史未知来源不推断为微信，下次真实认证更新来源。

```js
const verifiedPhone = user.phoneVerifiedSource === 'wechat'
  && user.authSource !== 'dev_mock';
// ID 白名单命中独立于手机号；旧号码不自动获得 verifiedPhone。
```

- [ ] **2.3 写重复登录不重建用户和 H5 不可通知回归，再修全部资格判断。** 用现有 openid 查询旧资料；统一按 authSource 允许微信消息，不再依赖不同前缀。
- [ ] **2.4 管理员迁移预览。** 只读取用户/白名单，列出旧号码候选、已可信管理员、现有 ID 管理员；候选需维护者核验，不自动应用 ADMIN_USER_IDS 或升级旧手机号。
- [ ] **2.5 验证并提交。** 身份/admin/login 回归及已有后端回归通过；审查业务路径和预览无写操作。

## Task 3: 推送唯一状态与并发计量

**Files:** server/src/models/PushSubscription.js、services/pushService.js、services/push/quota.js、scheduler/pushScheduler.js、推送并发回归；新增重复订阅审计/迁移脚本和运行说明。

**Interfaces:** 唯一键 { userId: 1, templateId: 1 }；认领 token 与结果状态 pending/success/failed/unknown 同时限制手动/定时任务；保留 force 跳过已成功日期的现有语义。

- [ ] **3.1 写首次订阅竞争和额度累计失败回归。** 同一 user/template 两次首次订阅最终一条；并发授权计数不丢且封顶 7。实现原子 upsert，11000 竞争重新更新，条件原子累加代替 read-modify-save。

```js
// pipeline 累加与封顶在同一次数据库更新内完成。
remainingQuota: { $min: [7, { $add: [{ $ifNull: ['$remainingQuota', 0] }, 1] }] }
```

- [ ] **3.2 写多个任务只发送一次、成功一次扣额回归，再实现条件认领。** 同日普通任务最多一次发送尝试；所有任务争用同一认领；成功按 token 原子扣额和记日期。取消与新增授权不能被旧发送响应覆盖。
- [ ] **3.3 写确定失败/超时未知/取消竞争回归，再修结果状态。** 确定失败不扣额；上游超时未知保留阻塞状态，不自动重发；未知状态人工核验，不能宣称端到端严格一次投递。
- [ ] **3.4 建立保守迁移 dry-run。** 列出现有索引、重复键、保留成功日期/取消/余额的合并建议；绝不把计数相加当授权；不确定记录列为人工处理并避免提高发送额度。apply 需显式参数、确认写入/发送已暂停及预览校验，先处理重复再建唯一索引，不在应用启动隐式迁移。
- [ ] **3.5 验证并提交。** 假发送并发用例和 dry-run 无写用例通过；可用隔离真实 Mongo 时验证索引/原子查询，否则明确保留数据库集成验收项。

## Task 4: AI 生命周期与取消

**Files:** miniprogram/src/pages/chat/index.vue、必要请求生命周期辅助函数；server/src/controllers/aiController.js、services/aiService.js、services/multiAgentService.js；新增 AI 取消行为回归。

**Interfaces:** chat/councilStream/councilNonStream 接收 signal；OpenAI 每次 create(payload, { signal })；客户端复用 Task 1 的会话接口，每次请求有独立版本。

- [ ] **4.1 写专家1中断后不启动专家2、非流式中断回归，再传递 signal。** 每个模型调用和阶段前检查 signal；普通聊天工具循环和最终流调用同样覆盖。
- [ ] **4.2 写真实 HTTP 请求体正常 close 不取消、响应异常 close 取消回归，再修控制器。** 使用 req.aborted 和 res.close，并以 res.writableFinished 判断正常完成；清理监听器与流。取消后不 write/json/end 重复响应。

```js
const controller = new AbortController();
const onClose = () => {
  if (!res.writableFinished) controller.abort();
};
res.once('close', onClose);
// 正常完成或取消后移除所有为该请求注册的监听器。
```

- [ ] **4.3 写返回、切换模式、重试旧流不串入回归，再修前端。** 流/非流 requestTask 均保存并 abort；onUnload、模式切换、开始新请求先失效旧版本；后台 onHide 不取消；401 共享恢复且每请求最多重试一次。
- [ ] **4.4 生产错误公开文案。** 流式错误和普通 JSON 采用公开提示，上游细节只进入服务端日志，保持前端 SSE 解析协议。
- [ ] **4.5 验证并提交。** 单次圆桌夹具模型调用最多四次，无真实模型；HTTP 生命周期回归及双端构建通过。

## Task 5: 数据库、代理和部署配置

**Files:** docker-compose.yml、server/docker-compose.prod.yml、server/src/app.js、deploy_helper.py、deploy.js、server/deploy-cloud.sh、环境示例、Docker ignore、部署预检工具、运维文档和脚本回归。

**Interfaces:** 三入口明确传 --env-file 与 -f，不自动复制占位 env；预检只输出缺失变量名和脱敏摘要；Python upload/exec 共用 known_hosts 验证后的 SSHClient。

- [ ] **5.1 记录模板与运行拓扑的界限。** 本地两份模板分别保留原 Mongo 7/6.0、mongodb/mongo、mongodb_data/mongo-data 等名称；远端 Compose/env 不在包里，改本地不代表改远端。数据库鉴权启用前提供卷识别、备份、建应用账户、连接验收与回滚次序。
- [ ] **5.2 写缺值/占位/不安全代理预检失败回归，再修模板及预检。** Mongo、Redis 明确鉴权；DB 宿主发布移除或限制本机，Node 默认限本机入口；trust proxy 默认不信任，仅接受维护者核验的代理地址/CIDR，区分宿主与容器 Nginx。
- [ ] **5.3 写主机未知/不匹配拒绝回归，再修 SSH。** load_system_host_keys、可选指定 known_hosts、RejectPolicy；同一 SSHClient.open_sftp 上传和 exec_command 执行；禁止 AutoAddPolicy/独立未验证 Transport。
- [ ] **5.4 写三入口参数和无副作用预检回归，再统一发布步骤。** 缺远端文件/占位值先失败，预检必须发生在挪动旧 src/public 之前；构建/上传/发布失败传播非零退出。Docker context 排除 .env.*、私钥和凭据，保留公开示例。
- [ ] **5.5 验证并提交。** Python/Node/shell 行为夹具通过；Docker 可用时运行脱敏 Compose 校验和隔离匿名/凭据连接验收，否则在手册明确未验证的线上条件。

## Task 6: 其他加固与文档差异

**Files:** server/src/services/userService.js、middleware/auth.js、middleware/validator.js、routes/fortune.js、services/fortuneService.js、controllers/petController.js、models/Pet.js、前端富文本转换模块；README/server README/环境示例；密码/JWT/输入/原子库存回归。

**Interfaces:** 密码格式 scrypt$N$r$p$salt$hash，独立随机盐与固定可核验成本；旧 SHA-256 成功验证后升级。JWT 新签名带 issuer/audience、算法固定 HS256；无 claims 的旧 token 仅在明确配置截止日内兼容，错误 claims 不接受。

- [ ] **6.1 写盐独立、旧密码成功升级/错误不升级回归，再实现异步 scrypt 和安全比对。** 不批量重置密码；解析旧格式严格限定，成本参数设上限以免数据库坏值造成资源耗尽。
- [ ] **6.2 写 issuer/audience/算法与旧 token 截止回归，再收紧 JWT。** 保持 JWT_SECRET，新增过渡 env 和部署文档，错误 issuer/audience 不因过渡开关放行。
- [ ] **6.3 写消息角色/数量/长度、工具参数边界失败回归，再限制输入。** 客户端消息只允许 user/assistant；数量 1..50、单条 1..4000 字符、总计 <=20000；禁止客户端注入 system/tool。工具按既有时辰、历法、性别和牌阵校验，归属始终用 req.user。
- [ ] **6.4 写富文本资源/样式边界回归，再限制渲染。** 保留已有纯文本/Markdown 使用体验；只允许明确资源来源/安全协议和有限样式，过滤脚本事件、危险 URI、任意 CSS。
- [ ] **6.5 写同日并发签到一次奖励、库存不足不能并发消费回归，再改条件原子更新。** 签到使用北京日期边界认领；Pet 按 user 唯一 upsert；奖励 $inc，消耗带余额条件；其他 save 路径不能覆盖并发库存或新增额度。
- [ ] **6.6 写日期/星座/缓存边界回归，再限制运势 API。** 检验真实 YYYY-MM-DD、固定星座枚举、合理日期范围、缓存 TTL 始终 >0 且有上限；无效输入不产生缓存键。
- [ ] **6.7 核实文档。** 对照 routes 与 pages.json 修正支付/VIP、PM2/Docker、分包说明；容器升级独立于鉴权迁移，Dify 学习材料不作为业务缺陷。
- [ ] **6.8 完整验证与审查后提交。** 所有回归通过、H5/微信构建成功、git diff --check 清洁；整分支独立审查，修复确认缺口后交付报告。

## 验证命令与完成定义

Windows 此环境 npm 转发参数和 Jest rootDir 斜线匹配存在差异，使用以下已验证入口：

```powershell
# 在 server 目录
node node_modules/jest/bin/jest.js --runInBand --testMatch '**/tests/**/*.test.js'
# 在 miniprogram 目录
node node_modules/@dcloudio/vite-plugin-uni/bin/uni.js build -p h5
node node_modules/@dcloudio/vite-plugin-uni/bin/uni.js build -p mp-weixin
# 在项目根目录
git diff --check
```

每批报告记录失败与通过命令、覆盖场景、提交和未完成的真实环境验收。完成条件为六批原始要求逐项对应实现/预览和验证；生产环境验证必须明确标为待执行，不能用假夹具结果替代。
