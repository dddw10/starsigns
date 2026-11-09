process.env.JWT_SECRET = 'fixture-secret-32-chars-for-tests';
process.env.WECHAT_APP_ID = 'wx_fixture';
process.env.WECHAT_APP_SECRET = 'fixture-secret';
delete process.env.TRUST_PROXY;
delete process.env.BIND_HOST;
jest.mock('../src/config/db', () => ({ connectDB: async () => {} }));
jest.mock('../src/config/redis', () => ({ connectRedis: async () => {}, getRedis: () => null }));
jest.mock('../src/scheduler/pushScheduler', () => ({ initScheduler() {} }));
for (const route of ['user', 'fortune', 'push', 'pet', 'admin']) {
  jest.doMock(`../src/routes/${route}`, () => require('express').Router());
}
const express = require('express');
jest.spyOn(express.application, 'listen').mockImplementation(() => {});
const app = require('../src/app');
const { createRateLimiter } = require('../src/middleware/rateLimit');
const { trustedProxies } = require('../src/config/proxy');
function request(address, forwarded) {
  const req = Object.create(express.request);
  Object.assign(req, { app, socket: { remoteAddress: address }, headers: { 'x-forwarded-for': forwarded } });
  return req;
}
test('a direct host process defaults to loopback instead of publishing a bypass around Nginx', async () => {
  await new Promise(resolve => setImmediate(resolve));
  expect(express.application.listen).toHaveBeenCalledWith(expect.anything(), '127.0.0.1', expect.any(Function));
});
test('unconfigured proxy cannot use forged forwarding headers to switch rate limit buckets', async () => {
  const limiter = createRateLimiter({ max: 1, keyPrefix: 'deployment-direct' });
  const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  await limiter(request('198.51.100.10', '192.0.2.1'), response, () => {});
  await limiter(request('198.51.100.10', '192.0.2.2'), response, () => {});
  expect(response.status).toHaveBeenCalledWith(429);
});

test.each(['true', '1', '0.0.0.0/0', '::/0', '0:0:0:0:0:0:0:0', '::ffff:0.0.0.0/96', '127.0.0.1,', '192.0.2.0/33'])('rejects unsafe proxy policy %s', value => {
  expect(() => trustedProxies(value)).toThrow();
});

test('a verified proxy CIDR keeps clients in separate buckets and ignores a forged leftmost address', async () => {
  app.set('trust proxy', trustedProxies('172.20.0.0/24,2001:db8:abcd::/64'));
  const limiter = createRateLimiter({ max: 1, keyPrefix: 'deployment-cidr' });
  const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();
  await limiter(request('172.20.0.2', '203.0.113.5, 198.51.100.1'), response, next);
  await limiter(request('2001:db8:abcd::2', '198.51.100.2'), response, next);
  expect(next).toHaveBeenCalledTimes(2);
  await limiter(request('172.20.0.2', '203.0.113.6, 198.51.100.1'), response, next);
  expect(response.status).toHaveBeenCalledWith(429);
  expect(request('172.21.0.2', '198.51.100.3').ip).toBe('172.21.0.2');
});
