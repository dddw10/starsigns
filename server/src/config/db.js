const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/fortune-miniprogram';

mongoose.set('strictQuery', false);

async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI, {
      autoIndex: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('MongoDB 连接成功');

    mongoose.connection.on('error', (err) => {
      console.error('MongoDB 连接错误:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB 连接断开，正在重连...');
    });
  } catch (error) {
    console.error('MongoDB 连接失败:', error);
    throw error;
  }
}

module.exports = { connectDB, mongoose };
