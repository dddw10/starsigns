// 钉住简洁模式（auditMode）到底关掉了什么。
//
// 背景：简洁模式原来只是首页宫格的一个前端 computed 过滤，被过滤掉的页面仍在包里、
// 路径可以直接打开、接口照样应答。也就是说它只藏图标、不关能力——
// 审核人员用真机调试按路径开一次，全部功能都在。
// 这份用例保证两件事：
//   1. auditGuard 在简洁模式下真的拒（而且默认是拒，配置缺失时不许放行）；
//   2. 该挂守卫的端点一个都不少，不该挂的一个都没多挂
//      （多挂会把简洁模式下本该留着的星座能量/空间美学/每日运势也关掉）。
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret-not-for-production-use';

const { auditGuard } = require('../src/middleware/auditGuard');
const { invalidateAuditModeCache } = require('../src/config/systemConfig');

const ORIGINAL_AUDIT_MODE = process.env.AUDIT_MODE;

// 用例里没连数据库，getAuditMode() 会回落到环境变量，正好用来驱动两种状态。
// 每次改完必须清缓存，否则 60 秒内读到的还是上一个用例的值。
function setAuditMode(value) {
  if (value === undefined) {
    delete process.env.AUDIT_MODE;
  } else {
    process.env.AUDIT_MODE = value;
  }
  invalidateAuditModeCache();
}

// 把 next 的调用结果收成一个可断言的对象
function runGuard() {
  return new Promise(resolve => {
    auditGuard({}, {}, err => resolve(err));
  });
}

afterEach(() => {
  setAuditMode(ORIGINAL_AUDIT_MODE);
});

describe('auditGuard', () => {
  test('简洁模式开启时拒掉请求，状态码 403、带能直接给用户看的话', async () => {
    setAuditMode('true');
    const err = await runGuard();
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(403);
    expect(err.message).toBe('该功能当前未开放');
  });

  test('简洁模式关闭时放行', async () => {
    setAuditMode('false');
    await expect(runGuard()).resolves.toBeUndefined();
  });

  test('AUDIT_MODE 没配时按开启处理——配置缺失不许悄悄放开', async () => {
    setAuditMode(undefined);
    const err = await runGuard();
    expect(err && err.status).toBe(403);
  });
});

describe('路由表：简洁模式下哪些能力是关的', () => {
  // 直接读 routes 源码，而不是 require 它：require 会连带把 controller → aiService →
  // 大模型 SDK 全拉进来（那条链里有动态 import，jest 默认环境下起不来），
  // 而这份用例要钉的只是「哪些端点挂了守卫」这件结构上的事，不需要真的把应用跑起来。
  const fs = require('fs');
  const path = require('path');

  const source = fs.readFileSync(path.join(__dirname, '../src/routes/fortune.js'), 'utf8');

  // router.post('/tarot', auditGuard, authMiddleware, ...); → { '/tarot': 'auditGuard, authMiddleware, ...' }
  function middlewareByPath() {
    const map = new Map();
    const re = /router\.(?:get|post|put|delete)\(\s*'([^']+)'\s*,([^;]*)\);/g;
    let m;
    while ((m = re.exec(source)) !== null) {
      map.set(m[1], m[2]);
    }
    return map;
  }

  const routes = middlewareByPath();

  test('routes 文件解析出来的端点数量对得上，正则没有失灵', () => {
    expect(routes.size).toBeGreaterThanOrEqual(14);
    expect(routes.has('/tarot')).toBe(true);
  });

  test('测算类能力全部挂了 auditGuard', () => {
    for (const p of ['/bazi', '/bazi-match', '/tarot', '/name', '/name-match', '/face-palm', '/ai-chat', '/council']) {
      expect(routes.has(p)).toBe(true);
      expect(routes.get(p)).toContain('auditGuard');
    }
  });

  test('简洁模式下要留着的能力没有被误挂', () => {
    // 星座能量与空间美学是简洁模式下唯一放出的两个板块，
    // 每日运势与历史记录是首页和个人中心都要用的，挂上就等于把简洁模式做成了空壳应用。
    for (const p of ['/daily', '/constellation/:constellation', '/fengshui', '/records', '/record/:id']) {
      expect(routes.has(p)).toBe(true);
      expect(routes.get(p)).not.toContain('auditGuard');
    }
  });

  test('auditGuard 排在鉴权之前——未登录的人也该被同一句话挡住，而不是先被要求登录', () => {
    const args = routes.get('/tarot');
    expect(args.indexOf('auditGuard')).toBeLessThan(args.indexOf('authMiddleware'));
  });
});
