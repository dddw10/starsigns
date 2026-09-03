// 订阅配额状态机（纯函数，不碰数据库、不发网络请求）。
//
// 为什么要有配额：微信的一次性订阅消息是「用户授权一次，服务端只能发一条」。
// 旧代码用 status 当开关——发完置 'inactive'，但客户端的 pushEnabled 是
// localStorage 里的布尔值、永远是 true，于是首页那条「开启推送」的横幅再也不出现，
// 用户既不知道已经用完，也没有第二个入口重新授权，结果就是「只可能收到一条，然后永远没有」。
//
// 现在改成计数：授权 +1、成功发送 -1，余额归零才停并重新引导。
// 用户可以连点几次把余额攒起来（微信允许重复授权累积）。

// 单个用户最多累积多少次授权。每天只发一条，攒太多没有意义，封顶一周。
const PUSH_MAX_QUOTA = 7;

// 推送固定在北京时间 08:30。
// 服务端是这个时间的唯一来源：客户端从 GET /api/config 取 pushTimeLabel 渲染，
// 不再两端各写死一份（历史上首页文案写 00:00、cron 实际落在 20:00、
// 用户存在 pushSettings 里的 pushTime 没有任何人读，三个时间互不相干）。
const PUSH_TIME_LABEL = '08:30';
const PUSH_CRON = '30 8 * * *';
// node-schedule 默认按进程时区解释 cron，而容器里 TZ 通常是 UTC。
// 不显式指定时区，'30 8 * * *' 会落在北京时间 16:30。
const PUSH_TZ = 'Asia/Shanghai';

// 微信订阅消息的错误码
// 43101：用户拒收或未订阅——这个用户的余额算错了，直接清零，别再骚扰
// 47003：data 的键与模板参数不一致，或某个字段类型/长度违规，整条被拒
const ERRCODE_USER_REFUSED = 43101;
const ERRCODE_DATA_MISMATCH = 47003;

const toQuota = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.floor(num);
};

/** 用户又授权了一次：余额 +1，封顶 PUSH_MAX_QUOTA */
function nextQuotaAfterSubscribe(current) {
  return Math.min(PUSH_MAX_QUOTA, toQuota(current) + 1);
}

/**
 * 一次发送之后订阅记录该变成什么样。
 *
 * @param {object} input
 * @param {number} input.remainingQuota 发送前的余额
 * @param {boolean} input.success 微信是否 errcode === 0
 * @param {number} [input.errcode] 微信返回的错误码
 * @param {string} input.dateString 北京日期 YYYY-MM-DD（成功才写进 lastPushDate）
 * @returns {{remainingQuota:number, status:string, lastPushDate:(string|null), quotaConsumed:boolean}}
 *          lastPushDate 为 null 表示「不要改动这个字段」
 */
function nextStateAfterSend({ remainingQuota, success, errcode, dateString }) {
  const before = toQuota(remainingQuota);

  // 用户拒收：余额直接清零，等他重新授权
  if (!success && errcode === ERRCODE_USER_REFUSED) {
    return { remainingQuota: 0, status: 'inactive', lastPushDate: null, quotaConsumed: false };
  }

  // 其他失败（access_token 拿不到、网络错、47003 配错字段）不烧配额：
  // 这不是用户的问题，扣了他就白丢一次授权
  if (!success) {
    return {
      remainingQuota: before,
      status: before > 0 ? 'active' : 'inactive',
      lastPushDate: null,
      quotaConsumed: false,
    };
  }

  const after = Math.max(0, before - 1);
  return {
    remainingQuota: after,
    // 余额归零才停；还有余额说明用户攒了多次授权，明天继续
    status: after > 0 ? 'active' : 'inactive',
    lastPushDate: dateString,
    quotaConsumed: true,
  };
}

/** 今天是否已经发过（cluster 重复注册、管理员手动重试都靠这个幂等） */
function alreadyPushedToday(lastPushDate, todayString) {
  return Boolean(lastPushDate) && lastPushDate === todayString;
}

/**
 * 这一条订阅要不要因为「今天已经推过」而跳过。
 *
 * force 只有管理员手动接口 `POST /api/push/trigger-daily` 会传，定时任务永远不传——
 * 去重是 cluster 里 N 个 worker 重复注册时唯一的兜底，定时任务能绕过就等于允许一天发 N 条。
 * 手动接口需要它的场景是真实的：改完字段映射要复验、早上那轮内容发错了要补推、上线自检。
 * 没有它，当天推送跑完之后这个接口就只会回 skipped，而它整个存在的理由就是自检和补推。
 *
 * force 只放开日期这一条：配额照旧要求 > 0、照旧只有成功才扣、43101 照旧清零。
 */
function shouldSkipDuplicate({ lastPushDate, today, force }) {
  if (force) return false;
  return alreadyPushedToday(lastPushDate, today);
}

module.exports = {
  PUSH_MAX_QUOTA,
  PUSH_TIME_LABEL,
  PUSH_CRON,
  PUSH_TZ,
  ERRCODE_USER_REFUSED,
  ERRCODE_DATA_MISMATCH,
  nextQuotaAfterSubscribe,
  nextStateAfterSend,
  alreadyPushedToday,
  shouldSkipDuplicate,
};
