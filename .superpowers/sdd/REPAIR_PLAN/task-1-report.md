# 第一批：登录与页面恢复实施报告

状态：实现与本批验证完成，等待控制器独立审查。业务修改基线为 `ebe8ba3`；工作分支 `codex/repair-plan`。本文件与业务/回归同一提交；提交号由控制器从 `git log -1` 获取。

## 根因

1. H5 初始化直接把缓存令牌当已认证；微信启动登录失败后，前台恢复只检查 token，导致无 token 时不再恢复。缓存资料和真实认证没有独立状态。
2. 请求闸门等待六秒后直接发请求，个人运势可以被游客结果覆盖；旧闸门 finally 还可能清掉后登记的新闸门。
3. 登录只跳过闸门，没有禁止自己的 401 自动恢复；回填处于登录 promise 内，既延迟登录完成，又可能与该 promise 相互等待。
4. logout/账号切换没有版本边界，晚到登录、资料及生辰响应可复活旧会话或串号。已经 resolve 的响应在页面 await 续执行前退出，同样能重画旧资料。
5. App 等网络登录后才读主题、配置；页面只在 onShow 检查一次登录，恢复成功后没有补加载。配置失败被当成审核已开启；延迟退页没有发起页和生命周期约束。

## 实现

- store 新增 `sessionStatus`（`restoring/authenticated/failed/logged_out`）、`sessionVersion`、`sessionError`。缓存资料保留展示，`isLoggedIn` 要求真实认证；H5 缓存令牌经 profile 验证，微信交换新令牌。
- App 冷启动先读主题/本地状态，配置与共享 `restoreSession()` 独立启动；前台复用恢复入口。每轮恢复至多两次微信登录，每次包含原生登录和令牌交换的十秒上限；失败后自动恢复冷却三十秒，显式重试可绕过冷却。H5 网络失败保留待验证令牌，401 账号会话要求重新输入凭据。
- 所有登录共享在途 promise；超时后的旧原生 code 不再交换；退出/切换账号递增版本，并让旧登录、资料更新、资料刷新、生辰回填及页面加载响应失效。`user_logged_out=true` 持久保存主动退出，重启与前台不会自动登录。
- `skipSessionGate` 和 `skipAutoRecovery` 独立。登录/注册与回填禁止自动恢复；认证完成仅依赖令牌交换和保存，回填 fire-and-forget。请求闸门超时抛 `SESSION_NOT_READY`，切换抛 `SESSION_CHANGED`，401 最终失败抛 `AUTH_EXPIRED`，不会降级游客。
- 公开配置/星座明确 `guest:true`，首页真正未登录时走明确游客运势路径。普通受保护请求要求认证；只有 store 的缓存令牌验证使用 `allowUnverifiedToken:true`。
- 首页、个人中心在可见时观察认证成功补加载；加载失败展示点击重试，不再把虚构默认运势当个人数据。聊天在发送前等会话，失败保留问题且不发游客 AI 请求；恢复后同步生辰。
- 配置新增 `unknown/failed/loaded`；未知或失败只显示重试内容，缓存 audit_mode 不授予能力。五个受限页通过 `useAuditGuard()` 在 setup 注册 `onHide/onUnload` 清理；退页绑定页面对象及生命周期版本。等待配置期间离页也让旧守卫失效；配置重试成功会运行页面初始化。

## 第四批可复用接口

`miniprogram/src/api/request.js`：

```js
await waitForSession() // 六秒上限；失败抛可重试错误，要求 authenticated
const version = getSessionVersion()
isSessionCurrent(version) // logout/切换后为 false
await recoverSession(version, failedToken) // 同会话共享401恢复，返回布尔值
```

`recoverSession()` 无参数兼容原聊天调用；建议第四批每次保存发起版本和失败令牌。同会话晚到的旧令牌 401 直接复用已更新的令牌；不同会话不会等待旧恢复。`waitForSession` 不替代聊天 requestTask 的取消/每请求序号；第四批负责全部聊天 requestTask 生命周期、离页/切模式取消和旧流拒绝，后台隐藏仍不取消聊天任务。

store：`restoreSession({force:false,retry:false})` 返回 `{success,message?}`；`restoreWechatSession` 保持别名。`force` 用于统一401恢复；`retry` 用于用户点击重试。

## Red / Green 证据

测试用 Node VM 加载实际 JS、Pinia/Vue 和页面 setup；只伪造 uni 网络/原生登录/存储/计时，未调用真实网络、数据库或模型。模板权限回归用实际 Vue SFC parser/compiler 渲染 VNode，非源码字符串检查。

命令均在 `miniprogram` 执行：

```powershell
node --experimental-vm-modules --test tests/session.test.cjs
node --experimental-vm-modules --test tests/pages.test.cjs
node --experimental-vm-modules --test tests/session.test.cjs tests/pages.test.cjs
```

- 初始会话四项回归：4 fail，准确触发缓存授权、游客请求、退出复活、串号。
- 加入登录/回填401后：7 fail；修复后7 pass。
- 页面初始回归：5 fail（主题晚读、缺补加载、默认运势、游客聊天、配置失败）；修复后5 pass。
- 扩展到20项：17 pass / 3 fail（H5断网后丢令牌、原生超时旧code仍交换、聊天隐藏未取消退页）；修复后20 pass。
- 后续真实回归进一步复现旧账号恢复promise阻塞新账号、等待配置期间离页、配置重试未初始化、已resolve资料在logout后重画；分别修复后最终29 pass / 0 fail。
- 测试加载器曾用简易regex截取含嵌套template的页面失败，改为实际 `@vue/compiler-sfc.parse` 后验证通过；此属测试加载错误，不作为业务red证据。

最终覆盖：正常微信冷启动、断网后前台恢复、H5有效/过期令牌、并发及晚到401、登录/注册/回填401、原生登录/交换超时、冷却有限重试、退出期间登录、账号切换后旧资料与回填、个人中心直开、主题弱网启动、聊天同步和拒绝游客降级、配置未知/失败/重试与退页生命周期。

构建命令（`miniprogram`）：

```powershell
node node_modules/@dcloudio/vite-plugin-uni/bin/uni.js build -p h5
node node_modules/@dcloudio/vite-plugin-uni/bin/uni.js build -p mp-weixin
```

均 `DONE Build complete`，exit 0。仅输出 uni-app 版本更新提示，无编译错误。`dist/` 不提交。

后端保持现状（`server`）：

```powershell
node node_modules/jest/bin/jest.js --runInBand --testMatch '**/tests/**/*.test.js'
```

9 suites / 147 tests passed。根目录 `git diff --check` exit 0。

## 限制及审查注意

- 未执行真机微信网络、真实账号切换/模型/数据库验收；VM覆盖可控行为并由双端编译验证产物。
- Node VM 需要 `--experimental-vm-modules`，会输出 Node ExperimentalWarning；未新增测试框架或依赖。
- 本批只处理聊天会话等待和资料同步；聊天稳定/流式请求的保存、abort、旧回调拒绝和模式切换属于第四批。
- 缓存生辰回填仍保留原有“服务端为空才回填”语义；显式退出/切换清空备份，自动恢复保留本机备份。服务端身份保留由第二批负责。
- 独立审查由控制器实施。没有发布、数据库迁移、凭据变更、真实消息或模型调用。保留未知 `graphify-out/`，未提交。
