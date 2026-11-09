process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret-not-for-production-use';

const crypto = require('crypto');
const axios = require('axios');
const User = require('../src/models/User');
const wechatConfig = require('../src/config/wechat');
const userService = require('../src/services/userService');
const pushService = require('../src/services/pushService');

const originalEnv = { ...process.env };
const credentials = [wechatConfig.appId, wechatConfig.appSecret];
let users;
let writes;
let httpCalls;

// Keep real services and schema; replace only database storage and external WeChat HTTP.
function seed(data) {
  const user = { _id: `user-${users.length + 1}`, ...data };
  user.save = async () => { writes.push({ ...user }); return user; };
  users.push(user);
  return user;
}

beforeEach(() => {
  users = [];
  writes = [];
  httpCalls = [];
  process.env.NODE_ENV = 'production';
  delete process.env.ALLOW_MOCK_LOGIN;
  delete process.env.ADMIN_USER_IDS;
  process.env.ADMIN_PHONES = '13530147144';
  process.env.MOCK_BIND_PHONE = '13530147144';
  wechatConfig.appId = 'wx1234567890abcdef';
  wechatConfig.appSecret = 'real-test-secret';
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(User, 'findOne').mockImplementation(async (query) => users.find(user =>
    Object.entries(query).every(([key, value]) => user[key] === value)) || null);
  jest.spyOn(User, 'create').mockImplementation(async data => { writes.push(data); return seed(data); });
  jest.spyOn(User, 'findByIdAndUpdate').mockImplementation(async (id, update) => {
    const user = users.find(item => item._id === id);
    if (!user) return null;
    writes.push(update);
    Object.assign(user, update.$set);
    return user;
  });
  jest.spyOn(axios, 'get').mockImplementation(async url => {
    httpCalls.push({ method: 'get', url });
    return { data: { access_token: 'fake-access-token', expires_in: 7200 } };
  });
  jest.spyOn(axios, 'post').mockImplementation(async (url, body) => {
    httpCalls.push({ method: 'post', url, body });
    return { data: { errcode: 0, errmsg: 'ok', phone_info: {
      phoneNumber: '13530147144', purePhoneNumber: '13530147144', countryCode: '86',
      watermark: { appid: 'wx1234567890abcdef', timestamp: 1794153600 },
    } } };
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  process.env = { ...originalEnv };
  [wechatConfig.appId, wechatConfig.appSecret] = credentials;
});

describe('phone verification source', () => {
  test('production h5- phone code is rejected without writes or upstream calls', async () => {
    const user = seed({ openid: 'real-openid', authSource: 'wechat' });
    await expect(userService.bindPhone(user._id, 'h5-attacker-controlled')).rejects.toMatchObject({ status: 400 });
    expect(writes).toEqual([]);
    expect(httpCalls).toEqual([]);
    expect(user.phone).toBeUndefined();
  });

  test('development mock phone matching the whitelist stays non-admin and clears verification', async () => {
    process.env.NODE_ENV = 'development';
    process.env.ALLOW_MOCK_LOGIN = 'true';
    const user = seed({ authSource: 'dev_mock', phoneVerifiedSource: 'wechat' });
    const result = await userService.bindPhone(user._id, 'mock-phone-code');
    expect(result).toMatchObject({ phone: '13530147144', isAdmin: false });
    expect(user.phoneVerifiedSource).toBe('mock');
    expect(httpCalls).toEqual([]);
  });

  test('complete real WeChat response marks verified even for a historical synthetic-looking openid', async () => {
    const user = seed({ openid: 'dev_openid_h5-old', authSource: 'unknown' });
    const result = await userService.bindPhone(user._id, 'real-phone-grant');
    expect(user.phoneVerifiedSource).toBe('wechat');
    expect(user.authSource).toBe('unknown');
    expect(result.isAdmin).toBe(true);
    expect(httpCalls.map(call => call.method)).toEqual(['get', 'post']);
  });

  test.each([
    { errcode: 40029, errmsg: 'invalid code' },
    { errcode: 0, errmsg: 'ok' },
    { errcode: 0, errmsg: 'ok', phone_info: {} },
    { errcode: 0, errmsg: 'ok', phone_info: { phoneNumber: '' } },
    { errcode: 0, errmsg: 'ok', phone_info: { phoneNumber: '   ' } },
    { errcode: 0, errmsg: 'ok', phone_info: { phoneNumber: 'not-a-phone' } },
    { phone_info: { phoneNumber: '13530147144' } },
  ])('malformed or unsuccessful response cannot verify a phone: %p', async data => {
    const user = seed({ authSource: 'wechat', phone: '13000000000', phoneVerifiedSource: '' });
    axios.post.mockResolvedValue({ data });
    await expect(userService.bindPhone(user._id, 'real-phone-grant')).rejects.toThrow();
    expect(user).toMatchObject({ phone: '13000000000', phoneVerifiedSource: '' });
    expect(writes).toEqual([]);
  });

  test('production flag cannot turn failed WeChat verification into mock binding', async () => {
    process.env.ALLOW_MOCK_LOGIN = 'true';
    const user = seed({ authSource: 'wechat' });
    axios.post.mockRejectedValue(new Error('network failure'));
    await expect(userService.bindPhone(user._id, 'real-phone-grant')).rejects.toThrow('network failure');
    expect(writes).toEqual([]);
  });
});

describe('server-owned auth sources', () => {
  test('schema defaults legacy identity to unknown and does not mark phone verified', () => {
    const user = new User({ openid: 'legacy-wechat-openid', phone: '13530147144' });
    expect(user.authSource).toBe('unknown');
    expect(user.phoneVerifiedSource).toBe('');
  });

  test('profile cannot alter phone, authentication or verification fields', async () => {
    const user = seed({ authSource: 'h5_guest', phone: '13000000000', phoneVerifiedSource: '' });
    const result = await userService.updateProfile(user._id, {
      nickname: 'new name', phone: '13530147144', authSource: 'wechat', phoneVerifiedSource: 'wechat',
    });
    expect(user).toMatchObject({ nickname: 'new name', authSource: 'h5_guest', phone: '13000000000', phoneVerifiedSource: '' });
    expect(result.isAdmin).toBe(false);
  });

  test('real WeChat login marks source after successful exchange and reuses legacy profile', async () => {
    const user = seed({ openid: 'real-openid', nickname: 'old name', birthInfo: { solarDate: '1990-01-01' } });
    axios.get.mockResolvedValue({ data: { openid: 'real-openid', unionid: 'real-unionid', session_key: 'real-session' } });
    const first = await userService.wxLogin('real-login-code');
    const second = await userService.wxLogin('another-code');
    expect(users).toHaveLength(1);
    expect(user.authSource).toBe('wechat');
    expect(first.userInfo).toMatchObject({ userId: user._id, nickname: 'old name', birthInfo: { solarDate: '1990-01-01' } });
    expect(second.userInfo.userId).toBe(user._id);
    expect(user.phoneVerifiedSource).toBeUndefined();
  });

  test.each([
    {}, { openid: '' }, { openid: '   ' }, { openid: 123 },
    { errcode: 40029, errmsg: 'invalid code', openid: 'real-openid' },
  ])('invalid WeChat login response cannot create or reclassify users: %p', async data => {
    axios.get.mockResolvedValue({ data });
    await expect(userService.wxLogin('real-login-code')).rejects.toThrow();
    expect(users).toEqual([]);
    expect(writes).toEqual([]);
  });

  test('H5 guest login retains the historical cleaning and 32-character suffix, and existing data', async () => {
    const openid = 'dev_openid_h5-12345678901234567890123456789';
    const user = seed({ openid, nickname: 'legacy name', birthInfo: { solarDate: '1990-01-01' } });
    const first = await userService.wxLogin('h5-123456789012345678901234567890!@#$');
    const second = await userService.wxLogin('h5-123456789012345678901234567890!@#$');
    expect(users).toHaveLength(1);
    expect(user).toMatchObject({ openid, authSource: 'h5_guest', nickname: 'legacy name' });
    expect(first.userInfo.birthInfo.solarDate).toBe('1990-01-01');
    expect(second.userInfo.userId).toBe(user._id);
    expect(httpCalls).toEqual([]);
  });

  test('a development mock identity has explicit source', async () => {
    process.env.NODE_ENV = 'development';
    process.env.ALLOW_MOCK_LOGIN = 'true';
    const result = await userService.wxLogin('dev-code');
    expect(users[0]).toMatchObject({ openid: 'dev_openid_dev-code', authSource: 'dev_mock' });
    expect(result.userInfo.isAdmin).toBe(false);
    expect(httpCalls).toEqual([]);
  });

  test('registered accounts persist account source', async () => {
    await userService.register('alice', 'secret123');
    expect(users[0].authSource).toBe('account');
  });

  test('successful account login sets source on the same historical user', async () => {
    const user = seed({ username: 'alice', openid: 'h5_openid_alice_old', nickname: 'Alice',
      password: crypto.createHash('sha256').update('secret123').digest('hex') });
    const result = await userService.loginAccount('alice', 'secret123');
    expect(result.userInfo.userId).toBe(user._id);
    expect(user.authSource).toBe('account');
    expect(users).toHaveLength(1);
  });

  test('failed account authentication leaves unknown source unchanged', async () => {
    const user = seed({ username: 'alice', authSource: 'unknown',
      password: crypto.createHash('sha256').update('secret123').digest('hex') });
    await expect(userService.loginAccount('alice', 'wrong')).rejects.toThrow();
    expect(user.authSource).toBe('unknown');
    expect(writes).toEqual([]);
  });
});
