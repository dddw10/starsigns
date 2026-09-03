const schedule = require('node-schedule');
const pushService = require('../services/pushService');
const { PUSH_CRON, PUSH_TZ, PUSH_TIME_LABEL } = require('../services/push/quota');

// 一天只有一台机器、一个 worker 该真的发。
// ecosystem.config.js 是 instances:'max' + cluster，initScheduler() 在 bootstrap() 里跑，
// 不加守卫就是 N 个 worker 各注册一遍、各推一遍，微信的 access_token 还会互相顶掉。
// NODE_APP_INSTANCE 由 PM2 cluster 模式自动注入（0 是第一个 worker）。
function isPrimaryInstance() {
  const index = process.env.NODE_APP_INSTANCE;
  return index === undefined || index === '' || index === '0';
}

// 多机部署时再叠一把 Redis 锁：同一天只有抢到锁的那台机器执行。
// 拿不到 Redis 就降级为只靠实例守卫（单机部署下够用）。
async function acquireDailyLock(dateKey) {
  let redis = null;
  try {
    redis = require('../config/redis').getRedis();
  } catch (err) {
    redis = null;
  }
  if (!redis) return true;

  try {
    const ok = await redis.set(`push:daily:${dateKey}`, String(process.pid), 'EX', 3600, 'NX');
    return ok === 'OK' || ok === true;
  } catch (err) {
    console.warn('[push] Redis 锁获取失败，按单机继续:', err.message);
    return true;
  }
}

async function runDailyPush() {
  const { getBeijingDateString } = require('../utils/date');
  const dateKey = getBeijingDateString();

  if (!(await acquireDailyLock(dateKey))) {
    console.log(`[push] ${dateKey} 已有其他实例在推送，本实例跳过`);
    return;
  }

  // 清理排在推送**之前**：否则当天才到期的订阅可能先被用掉、再被标记过期
  try {
    const expired = await pushService.checkExpiredSubscriptions();
    console.log(`[push] 已将 ${expired} 个过期订阅标记为 expired`);
  } catch (error) {
    console.error('[push] 订阅过期检查失败:', error.message);
  }

  try {
    // 不传 force：定时任务必须保留当日去重，它是 cluster 多 worker
    // 重复注册时的最后一道兜底。force 只有管理员手动接口会传
    const result = await pushService.triggerDailyPush();
    if (!result.configured) return;
    console.log(
      `[push] ${result.date} 每日运势推送完成：命中 ${result.total} 条，` +
      `成功 ${result.success}，失败 ${result.failed}，` +
      `跳过 ${result.skipped}（缺生辰 ${result.skippedNoBirthInfo}，当日已推 ${result.skippedAlreadyPushed}）`
    );
  } catch (error) {
    console.error('[push] 每日运势推送失败:', error.message);
  }
}

// 初始化定时任务
function initScheduler() {
  if (process.env.ENABLE_SCHEDULER !== 'true') {
    console.log('定时任务未启用（需要 ENABLE_SCHEDULER=true）');
    return;
  }
  if (!isPrimaryInstance()) {
    console.log(`定时任务已跳过：本实例是 cluster worker #${process.env.NODE_APP_INSTANCE}`);
    return;
  }

  // 过期清理 + 每日运势推送合成一个任务，顺序执行。
  // 必须显式指定 tz：容器里进程时区通常是 UTC，不指定的话这条 cron 会落在北京时间 16:30
  const job = schedule.scheduleJob({ rule: PUSH_CRON, tz: PUSH_TZ }, runDailyPush);

  if (!job) {
    console.error(`定时任务注册失败，请检查 cron 表达式: ${PUSH_CRON}`);
    return;
  }

  const next = job.nextInvocation();
  const nextBeijing = next
    ? new Date(next.getTime ? next.getTime() : next).toLocaleString('zh-CN', { timeZone: PUSH_TZ })
    : '未知';
  console.log(`定时任务初始化完成：每日 ${PUSH_TIME_LABEL}（北京时间）推送，下次触发 ${nextBeijing}`);
}

// 只导出 initScheduler。这里曾经还转出过 triggerDailyPush / checkExpiredSubscriptions
// 两个包装函数，但 controller 一直是直接调 pushService，全项目零引用——
// 留着会让人以为管理员接口走的是调度器这条路
module.exports = { initScheduler };
