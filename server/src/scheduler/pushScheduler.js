const schedule = require('node-schedule');
const pushService = require('../services/pushService');

// 初始化定时任务
function initScheduler() {
  // 每天早上 8 点推送每日运势
  schedule.scheduleJob('0 8 * * *', async () => {
    console.log(`[${new Date().toISOString()}] 开始推送每日运势...`);
    try {
      const result = await pushService.triggerDailyPush();
      console.log(`每日运势推送完成: 成功${result.success}条，失败${result.failed}条`);
    } catch (error) {
      console.error('每日运势推送失败:', error);
    }
  });

  // 每天中午 12 点检查订阅过期
  schedule.scheduleJob('0 12 * * *', async () => {
    console.log(`[${new Date().toISOString()}] 检查订阅过期...`);
    try {
      await checkExpiredSubscriptions();
      console.log('订阅过期检查完成');
    } catch (error) {
      console.error('订阅过期检查失败:', error);
    }
  });

  // 每天凌晨 2 点清理过期订单
  schedule.scheduleJob('0 2 * * *', async () => {
    console.log(`[${new Date().toISOString()}] 清理过期订单...`);
    try {
      await cleanExpiredOrders();
      console.log('过期订单清理完成');
    } catch (error) {
      console.error('过期订单清理失败:', error);
    }
  });

  console.log('定时任务初始化完成');
}

// 检查订阅过期
async function checkExpiredSubscriptions() {
  const PushSubscription = require('../models/PushSubscription');

  const result = await PushSubscription.updateMany(
    {
      status: 'active',
      expireAt: { $lt: new Date() },
    },
    {
      $set: { status: 'expired' },
    }
  );

  console.log(`已将 ${result.modifiedCount} 个订阅标记为过期`);
}

// 清理过期订单
async function cleanExpiredOrders() {
  const Order = require('../models/Order');

  const result = await Order.updateMany(
    {
      status: 'pending',
      expireAt: { $lt: new Date() },
    },
    {
      $set: { status: 'expired' },
    }
  );

  console.log(`已将 ${result.modifiedCount} 个订单标记为过期`);
}

// 手动触发每日运势推送
async function triggerDailyPush() {
  return pushService.triggerDailyPush();
}

module.exports = {
  initScheduler,
  triggerDailyPush,
};
