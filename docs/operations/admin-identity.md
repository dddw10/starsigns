# 管理员与身份来源迁移

新授权规则保留 ADMIN_USER_IDS；ADMIN_PHONES 只接受服务端微信手机号接口成功验证且非开发模拟的记录。旧 phone 字段不会自动升级，因此发布前先准备 ID 白名单兼容现有管理员。

1. 从已维护的 ADMIN_PHONES 和 ADMIN_USER_IDS 准备只读预览。可导出最小字段 `_id/phone/authSource/phoneVerifiedSource` 为 JSON，在 server 目录执行 `node scripts/preview-admins.js --input users.json`；显式 `--mongo` 使用已提供的 MONGODB_URI，只查询且禁止 autoIndex。
2. 对 `requiresMaintainerVerification=true` 的候选经维护者现有可信渠道核验；旧手机号本身不作为身份已可信的证据。预览只输出掩码手机号和需要配置的用户 ID。
3. 核验通过的旧管理员 ID 由维护者加入 ADMIN_USER_IDS。保存配置变更前后副本并用该账号检查权限，再部署新版授权规则；此步骤不由预览工具自动执行。
4. 真实微信登录成功后才写 authSource=wechat；旧未知身份不按 openid 外观推断来源。开发模拟、H5 访客、账号密码登录不能走微信推送，真实手机号验证与登录来源独立维护。
5. H5 的旧 `dev_openid_h5-...` 和 `h5_openid_...` 保留原用户 ID/资料；不批量重建账号，不调整旧 UUID 规范化派生规则。客户端资料更新不能自设认证/手机验证来源。

工具没有 apply 模式，不修改用户、真实环境配置或管理员白名单。本次仅用离线夹具验证；现有管理员名单与真实数据需维护者在发布前核验。
