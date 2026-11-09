process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret-not-for-production-use';

const axios = require('axios');
const User = require('../src/models/User');
const PushSubscription = require('../src/models/PushSubscription');
const PushLog = require('../src/models/PushLog');
const wechatConfig = require('../src/config/wechat');
const pushService = require('../src/services/pushService');

const originalTemplate = wechatConfig.templates.dailyFortune;
const originalFields = wechatConfig.templates.dailyFortuneFields;
let messages;
let subscriptions;
let user;

beforeEach(() => {
  messages = [];
  subscriptions = [];
  user = { _id: '65f000000000000000000001', openid: 'dev_openid_h5-legacy', authSource: 'h5_guest',
    birthInfo: { yearGanZhi: '甲子', monthGanZhi: '丙寅', dayGanZhi: '戊辰', hourGanZhi: '甲子' },
    pushSettings: { pushEnabled: true }, subscribeAccepted: true, save: async () => user };
  wechatConfig.templates.dailyFortune = 'fake-template';
  wechatConfig.templates.dailyFortuneFields = [{ field: 'thing1', type: 'thing', kind: 'text', contentKey: 'level' }];
  jest.spyOn(pushService, 'isPushConfigured').mockReturnValue(true);
  jest.spyOn(User, 'findById').mockImplementation(() => {
    const result = Promise.resolve(user);
    result.select = () => Promise.resolve(user);
    return result;
  });
  jest.spyOn(PushSubscription, 'findOne').mockImplementation(async () => subscriptions[0] || null);
  jest.spyOn(PushSubscription, 'create').mockImplementation(async data => {
    const sub = { _id: 'sub-1', ...data };
    subscriptions.push(sub);
    return sub;
  });
  jest.spyOn(PushSubscription, 'find').mockImplementation(() => ({ populate: async () => subscriptions }));
  jest.spyOn(PushLog, 'create').mockImplementation(async data => data);
  jest.spyOn(axios, 'get').mockResolvedValue({ data: { access_token: 'fake-access-token', expires_in: 7200 } });
  jest.spyOn(axios, 'post').mockImplementation(async (_url, body) => {
    messages.push(body);
    return { data: { errcode: 0, errmsg: 'ok' } };
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  wechatConfig.templates.dailyFortune = originalTemplate;
  wechatConfig.templates.dailyFortuneFields = originalFields;
});

test.each([
  ['h5_guest', 'dev_openid_h5-legacy'], ['account', 'h5_openid_alice_old'],
  ['dev_mock', 'dev_openid_local'], ['unknown', 'historical-wechat-looking-openid'],
])('%s cannot create a WeChat subscription despite having an openid', async (source, openid) => {
  Object.assign(user, { authSource: source, openid });
  await expect(pushService.subscribe(user._id, 'fake-template')).rejects.toMatchObject({ status: 400 });
  expect(subscriptions).toEqual([]);
  expect(messages).toEqual([]);
});

test('historical H5 active subscriptions are not shown as available or sent', async () => {
  subscriptions.push({ _id: 'sub-1', userId: user, openid: user.openid, templateId: 'fake-template',
    status: 'active', remainingQuota: 3, expireAt: new Date(Date.now() + 86400000), save: async () => {} });
  const settings = await pushService.getSettings(user._id);
  expect(settings).toMatchObject({ pushEnabled: false, remainingQuota: 0, intended: true });
  const stats = await pushService.triggerDailyPush();
  expect(stats).toMatchObject({ success: 0, failed: 0, skipped: 1 });
  expect(messages).toEqual([]);
  expect(subscriptions[0].remainingQuota).toBe(3);
});

test('a current verified WeChat identity can subscribe and receive its message', async () => {
  Object.assign(user, { authSource: 'wechat', openid: 'real-wechat-openid' });
  await pushService.subscribe(user._id, 'fake-template');
  Object.assign(subscriptions[0], { userId: user, pushCount: 0, save: async () => {} });
  const stats = await pushService.triggerDailyPush();
  expect(stats).toMatchObject({ success: 1, failed: 0 });
  expect(messages).toHaveLength(1);
  expect(messages[0]).toMatchObject({ touser: 'real-wechat-openid', template_id: 'fake-template' });
  expect(subscriptions[0].remainingQuota).toBe(0);
});

test('a stale subscription openid cannot route a message to another identity', async () => {
  Object.assign(user, { authSource: 'wechat', openid: 'real-wechat-openid' });
  subscriptions.push({ _id: 'sub-1', userId: user, openid: 'dev_openid_h5-obsolete', templateId: 'fake-template',
    status: 'active', remainingQuota: 3, expireAt: new Date(Date.now() + 86400000), pushCount: 0, save: async () => {} });
  const stats = await pushService.triggerDailyPush();
  expect(stats).toMatchObject({ success: 0, skipped: 1 });
  expect(messages).toEqual([]);
});
