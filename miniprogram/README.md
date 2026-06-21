# 算命小程序前端

基于 uni-app + Vue3 开发的微信小程序前端。

## 功能特性

- 八字排盘分析
- 星座运势查询
- 塔罗牌占卜
- 姓名测算
- 风水分析
- 每日运势推送
- VIP 会员系统
- 多主题切换

## 快速开始

### 环境要求

- Node.js >= 18.0.0
- HBuilderX（推荐）
- 微信开发者工具

### 安装依赖

```bash
npm install
```

### 开发运行

```bash
# 使用 HBuilderX
打开项目 → 运行 → 运行到小程序模拟器 → 微信开发者工具

# 使用命令行
npm run dev:mp-weixin
```

### 构建发布

```bash
npm run build:mp-weixin
```

## 项目结构

```
miniprogram/
├── src/
│   ├── pages/              # 页面
│   │   ├── home/           # 首页
│   │   ├── fortune/        # 算命功能（分包）
│   │   ├── profile/        # 个人中心（分包）
│   │   ├── activity/       # 活动页面（分包）
│   │   └── legal/          # 法律相关（分包）
│   ├── components/         # 公共组件
│   ├── store/              # Pinia 状态管理
│   ├── api/                # API 接口
│   ├── styles/             # 样式
│   ├── utils/              # 工具函数
│   └── static/             # 静态资源
├── package.json
└── manifest.json
```

## 分包策略

为了控制主包体积在 2MB 以内，采用分包策略：

| 分包 | 内容 | 预加载 |
|------|------|--------|
| 主包 | 首页、个人中心、tabBar | - |
| fortune | 算命功能页面 | 进入首页时 |
| profile | 设置、历史记录等 | - |
| activity | 每日运势、抽签等 | 进入首页时 |
| legal | 免责声明、隐私政策 | 进入个人中心时 |

## 主题系统

支持 4 种主题切换：

1. **中国风**（默认）- 传统红色配色
2. **现代简约** - 清新淡雅配色
3. **神秘暗黑** - 深色神秘配色
4. **卡通可爱** - 粉色可爱配色

## API 配置

编辑 `src/api/request.js` 配置后端 API 地址：

```javascript
const BASE_URL = 'https://your-api-domain.com'
```

## 构建发布

### 1. 构建小程序

```bash
npm run build:mp-weixin
```

### 2. 导入微信开发者工具

1. 打开微信开发者工具
2. 导入项目，选择 `dist/build/mp-weixin` 目录
3. 配置 AppID
4. 上传代码

### 3. 提交审核

1. 在微信公众平台提交审核
2. 填写相关信息和说明
3. 等待审核通过

## 注意事项

1. 主包体积控制在 2MB 以内
2. 图片资源尽量使用 CDN
3. 遵守微信小程序审核规范
4. 添加必要的免责声明

## License

MIT
