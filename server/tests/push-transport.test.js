jest.mock('../src/config/redis', () => ({ getRedis: () => null }));
const axios = require('axios');
const push = require('../src/services/pushService');

beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

test('access token failure occurs before dispatch and is a definite failure', async () => {
  jest.spyOn(axios, 'get').mockRejectedValue(new Error('token unavailable'));
  const sent = [];
  jest.spyOn(axios, 'post').mockImplementation(async body => { sent.push(body); });
  expect(await push.sendSubscribeMessage('fake-openid', 'fake-template', {})).toMatchObject({ success: false, outcome: 'failed' });
  expect(sent).toEqual([]);
});
test.each([
  [{ data: { errcode: 0 } }, 'success'],
  [{ data: { errcode: 43101 } }, 'failed'],
  [{ data: { errcode: -1, errmsg: 'system busy' } }, 'failed'],
  [{ data: {} }, 'unknown'],
])('classifies the actual WeChat response %#', async (response, outcome) => {
  jest.spyOn(axios, 'get').mockResolvedValue({ data: { access_token: 'fake-token' } });
  jest.spyOn(axios, 'post').mockResolvedValue(response);
  expect((await push.sendSubscribeMessage('fake-openid', 'fake-template', {})).outcome).toBe(outcome);
});
test('a timeout after dispatch is unknown, never a definite rejection', async () => {
  jest.spyOn(axios, 'get').mockResolvedValue({ data: { access_token: 'fake-token' } });
  jest.spyOn(axios, 'post').mockRejectedValue(new Error('timeout'));
  expect(await push.sendSubscribeMessage('fake-openid', 'fake-template', {})).toMatchObject({ success: false, outcome: 'unknown' });
});
test('send preflight runs after token retrieval and a revoked claim never reaches POST', async () => {
  let active = true;
  const sent = [];
  jest.spyOn(axios, 'get').mockImplementation(async () => {
    active = false;
    return { data: { access_token: 'fake-token' } };
  });
  jest.spyOn(axios, 'post').mockImplementation(async () => { sent.push('message'); return { data: { errcode: 0 } }; });
  expect(await push.sendSubscribeMessage('fake-openid', 'fake-template', {}, { beforeSend: async () => active }))
    .toMatchObject({ success: false, outcome: 'failed' });
  expect(sent).toEqual([]);
});
