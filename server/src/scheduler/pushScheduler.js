const schedule = require('node-schedule');
const pushService = require('../services/pushService');

// 初始化定时任务
function initScheduler() {
  if (process.env.ENABLE_SCHEDULER !== 'true') {
    console.log('定时任务未启用');
    return;
  }
  // 每天中午发送已授权但尚未发送的单次订阅消息。
  schedule.scheduleJob('0 12 * * *', async () => {
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

// 手动触发每日运势推送
async function triggerDailyPush() {
  return pushService.triggerDailyPush();
}

module.exports = {
  initScheduler,
  triggerDailyPush,
};
