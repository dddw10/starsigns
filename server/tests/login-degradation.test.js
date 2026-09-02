// 钉住登录降级规则。
// 背景：mock 登录的 openid 是拿一次性的微信 code 拼出来的（dev_openid_<code>），
// 小程序每次冷启动 code 都不一样 —— 也就是每次都换一个新用户。
// 线上真出过这事：WECHAT_APP_SECRET 还是占位值，_shouldUseMockLogin() 于是返回 true，
// 用户每次进小程序都是新账号，生辰、历史记录、神兽全都对不上，表现就是「数据没了」。
// 这份用例保证生产环境不会再悄悄降级：宁可登录报错，也不能发一个换了人的身份出去。
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret-not-for-production-use';

const wechatConfig = require('../src/config/wechat');
const userService = require('../src/services/userService');

const ORIGINAL_ENV = process.env.NODE_ENV;
const ORIGINAL_ID = wechatConfig.appId;
const ORIGINAL_SECRET = wechatConfig.appSecret;

function setCredentials(appId, appSecret) {
  wechatConfig.appId = appId;
  wechatConfig.appSecret = appSecret;
}

beforeEach(() => {
  delete process.env.ALLOW_MOCK_LOGIN;
});

afterEach(() => {
  process.env.NODE_ENV = ORIGINAL_ENV;
  setCredentials(ORIGINAL_ID, ORIGINAL_SECRET);
  delete process.env.ALLOW_MOCK_LOGIN;
});

describe('wechatConfig.hasCredentials', () => {
  test.each([
    ['两项都是占位值', 'your_app_id', 'your_app_secret', false],
    ['只有 AppID 是真的', 'wx1234567890abcdef', 'your_app_secret', false],
    ['只有 AppSecret 是真的', 'your_app_id', 'abcdef1234567890abcdef1234567890', false],
    ['AppSecret 为空', 'wx1234567890abcdef', '', false],
    ['两项都是真的', 'wx1234567890abcdef', 'abcdef1234567890abcdef1234567890', true],
  ])('%s', (_label, appId, appSecret, expected) => {
    setCredentials(appId, appSecret);
    expect(wechatConfig.hasCredentials()).toBe(expected);
  });
});

describe('_shouldUseMockLogin', () => {
  test('生产环境凭证缺失时绝不降级', () => {
    process.env.NODE_ENV = 'production';
    setCredentials('wx1234567890abcdef', 'your_app_secret');
    expect(userService._shouldUseMockLogin()).toBe(false);
  });

  test('生产环境凭证齐全时走真实登录', () => {
    process.env.NODE_ENV = 'production';
    setCredentials('wx1234567890abcdef', 'abcdef1234567890abcdef1234567890');
    expect(userService._shouldUseMockLogin()).toBe(false);
  });

  test('本地开发凭证缺失时才允许 mock', () => {
    process.env.NODE_ENV = 'development';
    setCredentials('your_app_id', 'your_app_secret');
    expect(userService._shouldUseMockLogin()).toBe(true);
  });

  test('凭证齐全就一律走真实登录，开发环境也一样', () => {
    process.env.NODE_ENV = 'development';
    setCredentials('wx1234567890abcdef', 'abcdef1234567890abcdef1234567890');
    expect(userService._shouldUseMockLogin()).toBe(false);
  });

  test('ALLOW_MOCK_LOGIN=true 是唯一的显式逃生门', () => {
    process.env.NODE_ENV = 'production';
    setCredentials('wx1234567890abcdef', 'your_app_secret');
    process.env.ALLOW_MOCK_LOGIN = 'true';
    expect(userService._shouldUseMockLogin()).toBe(true);
  });
});

describe('wxLogin', () => {
  test('生产环境缺凭证时返回 503 而不是造一个新用户', async () => {
    process.env.NODE_ENV = 'production';
    setCredentials('wx1234567890abcdef', 'your_app_secret');
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // 不连库：走到建用户那步就说明降级了，这里应该在之前就抛出来
    await expect(userService.wxLogin('0a1b2c3d')).rejects.toMatchObject({ status: 503 });
    // 运维要能从日志里直接看出该配什么
    expect(errorSpy.mock.calls.flat().join('')).toContain('WECHAT_APP_SECRET');

    errorSpy.mockRestore();
  });
});
