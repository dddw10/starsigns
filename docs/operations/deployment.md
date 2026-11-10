# 部署预检与基础设施变更

应用发布与数据库鉴权迁移必须分开安排。下面的迁移步骤是维护者执行清单；本次源码修复没有连接生产服务器、变更凭据、迁移真实数据或发布。

容器运行时/镜像升级同样独立于鉴权迁移：先保留现有 Mongo 主版本、Compose 项目名和卷名完成鉴权验收；若后续升级 Node、Mongo 或 Redis 镜像，另安排备份恢复演练、版本兼容验证和回滚计划。不要用鉴权变更顺带替换数据库主版本或数据卷。

应用 JWT 过渡与数据库账户迁移分别核验。已有 `JWT_SECRET` 不轮换；维护者在应用发布前明确决定是否设置 `JWT_LEGACY_ACCEPT_UNTIL`（UTC 截止日）。空值立即拒绝旧无 issuer/audience token，配置只兼容未过期 HS256；错误 claims 不放行。issuer/audience 在所有实例保持一致。密码在成功登录后按需升级，不执行批量数据迁移。Pet 更新依赖现有 `userId` 唯一索引；切换时停止旧版写入实例，再启动新版本，随后验证并发签到、饲料消耗和 503 补发路径。

上线前只读检查 User 的 `openid_1`、`username_1` 均为 unique+sparse、`unionid_1` 为 sparse，以及 Pet 的 `userId_1` 为 unique。还须检查 PushSubscription 的 `{ userId: 1, templateId: 1 }` 为全量、非 sparse、非 partial 的唯一索引；即使当前订阅记录为零，也必须先按 [推送订阅迁移说明](push-subscription-migration.md) 做停写预览、备份和显式迁移，否则新版本会拒绝订阅与发送。模型不会自动建立此约束，也不会自动删除或重建线上索引；若现有约束不一致，先检查重复值并单独预览索引迁移，再由维护者安排执行。新建隔离库的索引验收不代表现有业务库已修复。

## 先确认运行中的配置

| 模板 | Mongo / 服务 | Mongo 卷声明 | Redis 卷声明 | 应用服务 / 构建上下文 |
| --- | --- | --- | --- | --- |
| 根 `docker-compose.yml` | `mongo:7` / `mongodb` | `mongodb_data` | `redis_data` | `server` / `./server` |
| `server/docker-compose.prod.yml` | `mongo:6.0` / `mongo` | `mongo-data` | `redis-data` | `app` / `.` |

两份模板各自保留原版本、服务和卷名，不要用另一份覆盖线上。Compose 项目名也参与真实卷名生成；即便声明名称不变，换目录或项目名仍可能另起空卷。记录当前项目名、Compose 绝对路径、环境文件绝对路径、容器镜像 ID、Mongo 版本、挂载卷的实际名称和数据库名，再评审差异。`docker inspect --format '{{json .Mounts}}' <已确认的容器>` 可只读核对挂载；不要共享完整 `docker inspect` 或 `compose config`，它们含环境凭据。

应用包排除 `.env*`、Compose 文件、证书和私钥。修改本地模板不会修复远端模板，也不会把远端文件覆盖成新模板。远端必须独立应用经过评审的配置差异，否则新预检会拒绝继续发布。

## Mongo / Redis 鉴权变更顺序

1. 保持现有镜像主版本、服务名、卷名和 Compose 项目名。先从外部验证 27017/6379 不可达；安全组和防火墙仅允许必要入口。禁止 `down -v`、删卷或以新项目名重新初始化。
2. 在维护窗口停止业务写入，按当前鉴权状态备份 Mongo 数据、用户/角色和 Redis 持久化文件。把配置、镜像 ID、实际卷名和备份时间登记到受限记录；在独立环境演练恢复并核对关键文档计数，再继续。
3. 对已有非空 Mongo 卷，先用现有管理员会话创建或核验独立应用账户：在**现有业务数据库**中创建用户，仅授予 `{ role: 'readWrite', db: '<现有业务库>' }`。root 与应用的用户名、密码都分开；不要把 root URI 放入应用。创建管理员和应用账户是单独运维动作，需要维护者确认；密码不要写进 shell 历史或工单。
4. `MONGO_INITDB_ROOT_*` 和 `scripts/init-mongo-user.js` 只在官方镜像初始化**空卷**时生效。修改这些变量不会给已有卷创建用户或改密。若已有账户权限过大，先核实依赖，再单独评审收权。
5. 核对 `MONGO_APP_DATABASE`、应用用户名及连接 URI 的 `authSource` 指向同一个实际数据库。模板从 `MONGO_APP_*` 生成 URI；密码使用 URL 安全的随机 hex，避免原始保留字符破坏 URI。已有 `JWT_SECRET` 保持不变。应用环境显式清空 root 变量，数据库容器仍获得管理员初始化配置。
6. 在账户已经验证、备份可恢复后，再启用 `mongod --auth`，同时切换应用到独立凭据。Redis 设置 `--requirepass`，应用 `REDIS_PASSWORD` 与之相同。应用不需要数据库宿主端口；根模板无 DB 发布，生产模板仅保留本机绑定。Redis 密码用户可操作该实例，因此该实例应专用于本应用。
7. 在隔离环境、再在维护窗口内做下面的连接验收。任何一项失败都停止后续发布；不要用“修改环境变量”替代创建现有卷账户。

## 连接与端口验收

这些步骤需要运行中的 Docker/数据库和维护者确认。离线 `compose config` 只能验证配置结构，不能证明真实数据库鉴权、角色、卷内容或防火墙已经生效。

- 匿名 Mongo 客户端执行实际受保护的业务库 `findOne`，应收到 Unauthorized；只执行 `ping` 不能验证鉴权。
- 应用凭据在 Compose 内网连接正确服务和 `authSource`，能在临时验收集合插入、读取并删除自己的验收文档；不能读取其他数据库、创建用户或执行管理员命令。结束后删除临时集合。
- 匿名 Redis 客户端执行 GET/SET，应收到 NOAUTH；配置密码的应用客户端可写入带短 TTL 的验收键、读取并删除。密码用交互输入或仅该进程的 `REDISCLI_AUTH`，不要写入命令行参数/共享日志。
- 从外部网络探测 3000、27017、6379 均不可达；从已确认的 Nginx 路径访问健康检查与业务 API 正常。`/health` 只证明 HTTP 进程响应，不能替代上面的数据库验收。
- 用两个不同测试客户端访问限流 API，确认各自的请求独立计数；同一客户端改变自带 `X-Forwarded-For` 不能换桶。此项需要与实际 Nginx 转发规则一起验证。

## 代理与 Node 监听

`TRUST_PROXY` 默认 `false`，只接受维护者确认的 IP 或 CIDR 列表（逗号分隔），拒绝 `true`、跳数和通配网络。不要直接照抄某个 Docker 网段：被信任网段内的节点能够提供转发头，应尽可能只包含代理。代理重建后地址可能变化，先固定/核验拓扑，再修改信任范围。

- **宿主 Nginx → 宿主 Node / PM2：** Node 默认 `BIND_HOST=127.0.0.1`，Nginx 上游使用 `127.0.0.1:3000`。确认 Node 实际看到的对端后配置该 loopback 地址。
- **宿主 Nginx → Docker Node：** 模板容器内 `BIND_HOST=0.0.0.0`，宿主仅发布 `127.0.0.1:3000:3000`。Node 看到的对端可能是 Docker 网关，不能假定为 `127.0.0.1`；核验实际地址后配置。
- **容器 Nginx → Docker Node：** Nginx 与 Node 使用受限的共同网络，上游用实际应用服务名 `app:3000` 或 `server:3000`。通常删除 Node 的宿主端口发布；容器里的 `127.0.0.1` 是容器自身。按实际代理地址/CIDR 配置信任，只向外发布 Nginx 的 80/443。

唯一公网 Nginx 边缘可将 `X-Forwarded-For` 覆盖为 `$remote_addr`，防止客户端自带头进入链路。已有多层代理需逐层核验并配置可信来源，不要把真实地址固定取为最左一项。不要开放 3000 作为联调捷径；临时联调可用已核验主机的 SSH 本地转发。

## 三个发布入口

三入口都使用 `APP_DIR`、`DEPLOY_ENV_FILE`、`DEPLOY_COMPOSE_FILE`。默认分别为 `/opt/fortune-server`、`.env.production`、`docker-compose.prod.yml`。相对配置路径基于 `APP_DIR`；环境文件会解析为绝对路径，同时用于 `--env-file` 插值和 Compose 的 `env_file`，不能混用两个环境文件。

远端需安装 Node >=18、Docker Compose v2、sh 和 tar，且 `APP_DIR`、真实环境文件及 Compose 文件已由维护者准备好。自动发布上传的是 `server/` 内容，适配应用目录内 `build.context: .` 的生产布局；根模板用于完整仓库布局，不可把仅含 `server/` 的包解到根模板的 `./server` 上层。

在仓库根目录设置连接信息后选择一个入口：

```powershell
$env:DEPLOY_HOST = '<已核验主机>'
$env:DEPLOY_USER = '<发布账户>'
$env:DEPLOY_KNOWN_HOSTS = '<已审核的 known_hosts 文件绝对路径>'
$env:DEPLOY_KEY_PATH = '<本地私钥绝对路径>'
$env:APP_DIR = '/opt/fortune-server'
$env:DEPLOY_ENV_FILE = '.env.production'
$env:DEPLOY_COMPOSE_FILE = 'docker-compose.prod.yml'
node deploy.js --dry-run
# 或：python deploy_helper.py --dry-run
```

`DEPLOY_PORT` 默认 22。Python 也可使用 `DEPLOY_PASSWORD`，不得写入脚本或日志；优先采用受限发布密钥。系统/指定 known_hosts 中必须已有通过独立可信渠道确认的主机公钥。未知或不匹配的主机密钥直接失败；不要用本次待连接端点的 `ssh-keyscan` 输出自动建立信任。Python 上传与远程执行共用一个校验过的 `SSHClient`。

已在服务器应用目录、使用完整仓库或已解包的应用时，可运行 shell 入口：

```sh
APP_DIR=/opt/fortune-server \
DEPLOY_ENV_FILE=.env.production \
DEPLOY_COMPOSE_FILE=docker-compose.prod.yml \
sh /opt/fortune-server/deploy-cloud.sh --dry-run
```

`--dry-run` 不构建、上传、挪动 `src/public`、创建日志目录或启动容器，但 Node/Python 入口会建立已校验的 SSH 连接读取远端配置。预检仅输出固定摘要与变量名，拒绝缺文件、占位/空白凭据、root 复用、无鉴权数据库、不安全端口或代理配置，不自动复制 `.env.example`。

维护者批准正式发布后才去掉 `--dry-run`。Node/Python 先预检，再本地构建与上传；远端解包到临时目录后再次预检，再把旧 `src/public` 移到新的 `backup.*`，解包并运行 `docker compose --env-file ... -f ... up -d --build` 和 `ps`。任一构建、上传或发布失败返回非零。Docker 启动失败时保留备份供人工回滚，不自动宣称恢复成功。

## 回滚准备

发布前保存完整应用版本/包、镜像 ID 和配置版本。`backup.*` 只保留 `src/public`，不能替代完整应用或数据库备份；包中的 package 文件、Dockerfile、脚本也可能变化。发布失败先保留现场，核对错误与当前容器状态，再用已验证的上一版应用包/镜像和原配置恢复，运行同样的预检和业务验收。不要只把 `src/public` 搬回后就视为回滚完成。

鉴权迁移失败与应用发布失败分别处理：使用维护窗口前备份、原镜像主版本和原卷标识在隔离环境恢复核验，再由维护者决定生产恢复。不得在公网暴露数据库、删卷重建或降级 Mongo 数据文件版本来绕过失败。已有 JWT 不轮换，现有用户身份和数据库名称不改变。

## 本地验证范围

```sh
cd server
node node_modules/jest/bin/jest.js --runInBand --testMatch '**/tests/deployment*.test.js'
cd ..
python -m unittest discover -s server/tests -p test_deploy_helper.py
```

默认测试使用假 SSH/Docker 边界、真实 shell/tar 与离线 Compose 解析；不会连接生产或发送微信/模型请求。另有显式启用的隔离数据库验收：

```powershell
cd server
$env:RUN_DEPLOYMENT_DB_TESTS = '1'
node node_modules/jest/bin/jest.js --runInBand --testMatch '**/tests/deployment-database.test.js'
```

该用例只用本机已有 `mongo:7` 和 `redis:7-alpine`（不拉镜像），创建独立内部网络和无宿主端口的临时容器，验证真实初始化脚本、匿名拒绝、应用读写与越权拒绝，并清理本次容器/匿名卷和网络。Docker 不可用时不要运行。Mongo 6.0 / Redis 7.2 的真实连接、现有卷迁移与生产网络仍须在对应环境单独验收；模板离线解析不能替代这些验证。
