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
const paymentRoutes = require('./routes/payment');
const pushRoutes = require('./routes/push');
const memberRoutes = require('./routes/member');
const petRoutes = require('./routes/pet');
const adminRoutes = require('./routes/admin');

const { rateLimiter } = require('./middleware/rateLimit');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件注册
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// 全局限流
app.use(rateLimiter);

// 路由注册
app.use('/api/user', userRoutes);
app.use('/api/fortune', fortuneRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/member', memberRoutes);
app.use('/api/pet', petRoutes);
app.use('/api/admin', adminRoutes);

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 静态网页托管
app.use(express.static(path.join(__dirname, '../public')));

// 单页应用路由回退 (SPA Routing Fallback)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// 全局错误处理
app.use((err, req, res, next) => {
  console.error('全局错误:', err);
  res.status(err.status || 500).json({
    code: err.status || 500,
    message: err.message || '服务器内部错误',
  });
});

// 启动服务
async function bootstrap() {
  try {
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
