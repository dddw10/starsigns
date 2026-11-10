# 推送订阅唯一状态迁移与验收

此工具随源码交付：`server/scripts/migrate-push-subscriptions.js`。从完整源码检出的 `server` 目录运行，使用该目录已安装的 Node/Mongoose 依赖。已核对当前 `build-and-pack.js` 打包 server 且未排除 scripts，Dockerfile 使用 `COPY . .`，因此由本版本新建的包可包含脚本；既有生产归档或运行中的容器不一定有本工具。以下命令均在受控源码运维工作区执行，不依赖线上容器。本次没有修改部署打包范围，也没有连接生产数据库。

## 上线边界

必须先停止所有旧版 API 实例、所有定时/手动发送入口和其他订阅写入进程，再做最终预览与 apply；仅设置 `ENABLE_SCHEDULER=false` 不足以阻止订阅、取消和管理员手动调用。等待在途发送结束；未决认领不得猜测为失败。新旧版本不可混跑。

应用不会自动建立订阅集合或索引。每次 `subscribe()` 与每轮 `triggerDailyPush()` 都读取真实索引，要求全量、非稀疏、非 partial 的 `{userId:1,templateId:1}` 唯一约束。没有约束则拒绝授权写入与发送，返回可公开的 503 / `PUSH_MIGRATION_REQUIRED`（接口的通用错误包装未必输出 code）。取消仍然可以执行，以免维护期间用户无法关闭推送。此预检不是 DDL 锁；运行期间不能删除索引。

## 只读预览

连接串只从专用环境变量 `PUSH_MIGRATION_URI` 读取，工具不会读取应用 `.env` 或默认连接现有库。先由运维人员将已核对库名和权限的连接串放入环境变量，不要写进提交或命令历史。预览推荐使用只读数据库账号。

在源码 `server` 目录运行（输出目录需已存在，文件不得已存在）：

```powershell
node scripts/migrate-push-subscriptions.js --preview C:/secure/push-preview.json --backup C:/secure/push-backup.json
```

不加 `--apply` 即 dry-run。连接明确使用 `autoIndex:false` 和 `autoCreate:false`；只执行集合清单、文档查询、索引清单，不创建集合或索引。会向指定本地路径写入 Extended JSON 预览及备份，保留 ObjectId/Date 类型。文件含 openid 等身份数据，需放入受控目录、禁止提交。本地 Windows 权限由目录 ACL 控制。

终端仅打印统计及 hash：`records`、`duplicateGroups`、`manualGroups`、`proposedChanges`、`uniqueIndexPresent`、`hash`。预览包含原索引、全部原订阅和相关用户的身份/推送意愿快照，及每组建议。任何数据库或预览变动均需重新输出到新文件重新审阅。

安全重复组：同一 user/template、当前可信微信身份一致、状态一致、余额合法且无未决认领。保留第一条 `_id`；余额取最小值，绝不求和；到期取最早值；成功日期、尝试日期和成功时间取最新值；成功次数取最大值而非求和。已取消或已过期记录保持状态和零余额。即使多个记录完全相同，也不代表多次有效授权。

身份不明/冲突、取消状态冲突、余额异常、日期异常或成功历史缺日期、pending/unknown、无法归类的认领、重复组已有 token、同名索引冲突等进入 `manual`。原始数据保留在快照中，不自动修改；建议余额为零且阻塞发送（索引冲突本身没有额度建议）。存在任何 manual 项时整次 apply 拒绝。需人工先核实原始授权和实际投递事实、制定单独修复操作、保留备份，再重新预览；不允许手工编辑预览来跳过检查。

## 显式 apply

只有在全部写入及发送已暂停、预览无 manual 项、备份内容与预览逐项审阅且保存于安全位置后，才切换到有迁移权限的连接账号，使用预览实际输出的 hash：

```powershell
node scripts/migrate-push-subscriptions.js --apply --preview C:/secure/push-preview.json --backup C:/secure/push-backup.json --confirm-paused --confirm-backup-reviewed --expected-hash <预览实际hash>
```

工具校验显式参数、预览重建结果/hash、备份等于快照，再重新读取数据库比对 hash；任一不一致即在写入前失败。随后按建议替换保留记录、删除该组重复记录，最后才创建唯一索引并复查。不会删除或转换现有冲突索引；该情况先人工处理。停写确认是运维声明，工具没有能力验证所有其他进程已经停机。

apply 没有跨文档事务，不要求改变 Mongo 拓扑。中途失败时保持停写，使用备份及当前状态核对，不要自动重跑过期预览。成功后再次执行只读预览，确认唯一约束存在、无重复和 manual 项，部署新版本后才能恢复入口。应用不会在启动时补做迁移。

## 发送认领与人工处理

- 普通任务按北京时间成功日期及 `lastAttemptDate` 去重：同一日期最多一次认领尝试；确定失败当天普通任务也不会重试。管理员 `force` 可复验确定失败或补推当天成功消息，但必须有余额且通过同一 token 条件认领；同批看到旧 token 的并发 force 只能有一个获准。
- 认领写为 `pending` 后才计算内容、检查取消/过期并调用微信。发出前已取消会停止发送；请求实际在途之后的取消不能撤回微信可能已接受的消息。成功按 token/pending 条件原子扣一次，记录成功日期和次数。发送过程中新增授权保留；取消之后的新授权不能被旧响应扣除；旧 43101 不能清掉更新过的授权。
- 微信明确数值 errcode 非零（包含系统忙 -1）与获取 token 失败属于确定失败，不扣额度；43101 仅在取消版本和授权版本都未变时清零。
- 消息 POST 超时/网络异常、缺少可识别结果，或结果落账失败视为 unknown。崩溃遗留 pending 与 unknown 均永久阻塞自动重发，跨天、force、取消、重新授权都不解除。没有认领超时后自动抢占。
- 成功先落账，再写推送日志。日志写失败不会回退成功状态或让普通任务再发送。落账状态写入也失败时保留 pending；服务日志用于人工排查。

本系统没有实现微信投递结果查询接口，不能保证端到端严格一次投递。人工应保留 token、日期、claim 时间、原始响应及日志，并查找可靠的实际投递证据；证据不足就继续阻塞，不能将未知状态直接改为 failed 后 force。若人工确认结果，需单独审阅按 token 的条件修复，核对取消/授权 epoch 和额度，不提供自动批量“解除未决”命令。

## 回滚

1. 保持全部写入/发送暂停；保存故障后完整集合与索引快照，确认是否已发生新发送。若已经恢复过业务流量，不可直接覆盖回旧备份，必须人工逐条对账。
2. 在独立恢复库，用 Node 的 `require('bson').EJSON.parse()` 读取 `push-backup.json`；`snapshot.subscriptions` 是原始文档，`snapshot.indexes` 是原始索引，`snapshot.users` 仅供身份核验，不应覆盖 User 集合。通过 Mongo 原生 `insertMany` 将原订阅导入空的恢复集合，核对数量、ObjectId、日期、状态、额度及 pending/unknown。
3. 若原集合含重复，不能带着新建唯一索引恢复。由运维审核目标库名和停写状态后，先撤销本次新建的唯一索引，再以已验证恢复集合中的原文档恢复订阅；依据备份恢复原索引规格。不要清理本次迁移之外的数据或索引。
4. 重新只读核对；旧版应用本身没有并发保护，因此回滚代码时仍应保持推送停用，直到有可审阅的恢复方案。保留两份快照及操作记录。

## 本地隔离验收

```powershell
node scripts/test-push-mongo.js
node node_modules/jest/bin/jest.js --runInBand --testMatch '**/tests/**/*.test.js'
```

首条命令仅启动本地已存在的 `mongo:7` 镜像（`--pull=never`），新建随机名容器、卷、bridge；启用认证，仅绑定 127.0.0.1 随机端口。没有现有库 URI 参数；finally 清理本次资源。数据库用例仅在 `PUSH_TEST_ISOLATED=1` 且存在 `PUSH_TEST_MONGO_URI` 时启用，由脚本设置。所有微信/运势调用均为测试替身，无真实发送或模型调用。普通 Jest 默认跳过数据库专项。
