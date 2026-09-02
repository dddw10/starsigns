require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { connectDB } = require('./config/db');
const { connectRedis } = require('./config/redis');
const { initScheduler } = require('./scheduler/pushScheduler');

const userRoutes = require('./routes/user');
const fortuneRoutes = require('./routes/fortune');
const pushRoutes = require('./routes/push');
const petRoutes = require('./routes/pet');
const adminRoutes = require('./routes/admin');

const { rateLimiter } = require('./middleware/rateLimit');
const { getAuditMode } = require('./config/systemConfig');
const wechatConfig = require('./config/wechat');

const app = express();
const PORT = process.env.PORT || 3000;

// nginx 反代在前：不设置的话 req.ip 全站都是同一个网关 IP，限流形同虚设
app.set('trust proxy', 1);
// 接口都是 JSON，不靠 ETag 省流；开着会回 304 空 body，客户端只认 200 → 报「服务器错误: 304」
app.set('etag', false);

// 中间件注册
app.use(helmet({
  contentSecurityPolicy: false
}));
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || 'https://starsigns.online')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS origin is not allowed'));
  },
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// 全局限流
app.use(rateLimiter);

// 路由注册
app.use('/api/user', userRoutes);
app.use('/api/fortune', fortuneRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/pet', petRoutes);
app.use('/api/admin', adminRoutes);

// 获取系统配置（简洁模式开关），读取带 60s 进程内缓存
app.get('/api/config', async (req, res, next) => {
  try {
    const auditMode = await getAuditMode();
    res.json({
      code: 0,
      message: 'success',
      data: {
        auditMode
      }
    });
  } catch (error) {
    next(error);
  }
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 静态网页托管
app.use(express.static(path.join(__dirname, '../public')));

// 未命中的 /api 请求返回 JSON 404，不要落到下面的 SPA 回退里变成一坨 HTML
app.use('/api', (req, res) => {
  res.status(404).json({
    code: 404,
    message: '接口不存在',
  });
});

// 单页应用路由回退 (SPA Routing Fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// 全局错误处理
app.use((err, req, res, next) => {
  const status = err.status || 500;
  console.error('全局错误:', err);
  // 5xx 不回显 err.message：可能带着上游/驱动细节，只进日志
  const message = status >= 500
    ? (process.env.NODE_ENV === 'production' ? '服务器内部错误' : (err.message || '服务器内部错误'))
    : (err.message || '请求有误');
  res.status(status).json({
    code: status,
    message,
  });
});

// 微信凭证缺失是「用户数据莫名丢失」的根因：登录会降级成按一次性 code 造用户。
// 所以启动时就把结论喊出来，而不是等用户发现自己的生辰和历史没了
function checkLoginConfig() {
  if (wechatConfig.hasCredentials()) {
    return;
  }
  const allowMock = process.env.ALLOW_MOCK_LOGIN === 'true';
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd && !allowMock) {
    console.error('='.repeat(72));
    console.error('[启动检查] WECHAT_APP_ID / WECHAT_APP_SECRET 未配置或仍是占位值。');
    console.error('小程序登录接口会直接返回 503，不会降级成 mock 登录。');
    console.error('请在生产环境变量里补全这两项后重启服务。');
    console.error('='.repeat(72));
  } else {
    console.warn('[启动检查] 微信凭证未配置，登录走 mock：openid 由一次性 code 派生，每次冷启动都是新用户。仅本地开发可接受。');
  }
}

// 启动服务
async function bootstrap() {
  try {
    checkLoginConfig();

    try {
      await connectDB();
    } catch (e) {
      console.warn('MongoDB 连接失败，使用内存模式运行:', e.message);
    }
    try {
      await connectRedis();
    } catch (e) {
      console.warn('Redis 连接失败，使用内存模式运行:', e.message);
    }
    try {
      initScheduler();
    } catch (e) {
      console.warn('定时任务启动失败:', e.message);
    }

    app.listen(PORT, () => {
      console.log(`算命小程序后端服务已启动，端口: ${PORT}`);
    });
  } catch (error) {
    console.error('服务启动失败:', error);
    process.exit(1);
  }
}

bootstrap();

module.exports = app;
