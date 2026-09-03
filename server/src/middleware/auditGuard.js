const { getAuditMode } = require('../config/systemConfig');

// 简洁模式（auditMode）下真正把能力关掉的那道门。
//
// 为什么光有前端不够：简洁模式原来只是首页宫格的一个 computed 过滤
// （pages/index/index.vue 的 activeServices），而被过滤掉的那几个页面
// 仍然在 pages.json 里、仍然打进包、路径仍然可以直接打开（真机调试、带 path 的小程序码），
// 接口也照样应答。也就是说「隐藏」只隐藏了图标，功能一直是活的。
// 审核人员按路径开一次就能看到全部功能，这是简洁模式最初没做完的一半。
//
// 放在中间件而不是每个 controller 里判一次：拦点集中在 routes 里一眼能数清，
// 漏一个还是全开，不如让路由表自己说明「简洁模式下哪些能力是关的」。
async function auditGuard(req, res, next) {
  try {
    if (await getAuditMode()) {
      // 403 而不是 404：功能确实存在，只是当前不开放。
      // 全局错误处理器对 4xx 会原样回显 message（见 app.js），所以这句话会到用户眼前。
      const err = new Error('该功能当前未开放');
      err.status = 403;
      return next(err);
    }
    return next();
  } catch (e) {
    // getAuditMode() 内部已对查库失败做了降级（回落到环境变量），
    // 真抛到这里说明是意料之外的错误，交给全局处理器，不要静默放行。
    return next(e);
  }
}

module.exports = { auditGuard };
