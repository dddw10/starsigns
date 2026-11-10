process.env.JWT_SECRET = 'test-only-secret-not-for-production-use';
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../src/models/User');
const service = require('../src/services/userService');
const { generateToken, verifyToken } = require('../src/middleware/auth');
const env = { ...process.env };
afterEach(() => { jest.restoreAllMocks(); process.env = { ...env }; });

test('registration uses independent salts and never stores a SHA256 password', async () => {
  jest.spyOn(User, 'findOne').mockResolvedValue(null);
  const records = [];
  jest.spyOn(User, 'create').mockImplementation(async data => { records.push(data); return { ...data, _id: 'user' }; });
  await service.register('one', 'password'); await service.register('two', 'password');
  expect(records[0].password).toMatch(/^scrypt\$16384\$8\$1\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
  expect(records[0].password).not.toBe(records[1].password);
});

test('successful legacy login upgrades password while failed login never writes', async () => {
  const user = { _id: 'user', openid: 'old-openid', username: 'old',
    password: crypto.createHash('sha256').update('password').digest('hex'), save: jest.fn() };
  jest.spyOn(User, 'findOne').mockResolvedValue(user);
  await expect(service.loginAccount('old', 'wrong')).rejects.toThrow('账号或密码错误');
  expect(user.save).not.toHaveBeenCalled();
  await service.loginAccount('old', 'password');
  expect(user.password).toMatch(/^scrypt\$/); expect(user.save).toHaveBeenCalledTimes(1);
  const stored = user.password;
  await service.loginAccount('old', 'password'); expect(user.password).toBe(stored);
});

test('new JWT fixes HS256 issuer and audience', () => {
  const token = generateToken({ userId: 'user', openid: 'openid' });
  expect(jwt.decode(token, { complete: true })).toMatchObject({ header: { alg: 'HS256' },
    payload: { iss: 'fortune-miniprogram', aud: 'fortune-client' } });
  expect(verifyToken(token).userId).toBe('user');
});

test.each([
  [{ issuer: 'wrong', audience: 'fortune-client' }, 'HS256'],
  [{ issuer: 'fortune-miniprogram', audience: 'wrong' }, 'HS256'],
  [{ issuer: 'fortune-miniprogram', audience: 'fortune-client' }, 'HS384'],
  [{ issuer: 'wrong' }, 'HS256'],
])('wrong claims or algorithm never pass a legacy window (%p)', (claims, algorithm) => {
  process.env.JWT_LEGACY_ACCEPT_UNTIL = new Date(Date.now() + 60000).toISOString();
  const token = jwt.sign({ userId: 'user' }, process.env.JWT_SECRET, { ...claims, algorithm, expiresIn: '1h' });
  expect(() => verifyToken(token)).toThrow();
});

test('legacy tokens require an explicit unexpired cutoff and their own expiration', () => {
  const token = jwt.sign({ userId: 'user' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  delete process.env.JWT_LEGACY_ACCEPT_UNTIL;
  expect(() => verifyToken(token)).toThrow();
  process.env.JWT_LEGACY_ACCEPT_UNTIL = new Date(Date.now() + 60000).toISOString();
  expect(verifyToken(token).userId).toBe('user');
  process.env.JWT_LEGACY_ACCEPT_UNTIL = new Date(Date.now() - 1000).toISOString();
  expect(() => verifyToken(token)).toThrow();
  process.env.JWT_LEGACY_ACCEPT_UNTIL = 'not-a-date';
  expect(() => verifyToken(token)).toThrow();
});

test('an impossible calendar cutoff cannot enable legacy tokens', () => {
  process.env.JWT_LEGACY_ACCEPT_UNTIL = '2099-02-30T00:00:00Z';
  const token = jwt.sign({ userId: 'user' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  expect(() => verifyToken(token)).toThrow();
});

test('legacy tokens without expiration or with expired identity remain rejected', () => {
  process.env.JWT_LEGACY_ACCEPT_UNTIL = new Date(Date.now() + 60000).toISOString();
  expect(() => verifyToken(jwt.sign({ userId: 'user' }, process.env.JWT_SECRET))).toThrow();
  expect(() => verifyToken(jwt.sign({ userId: 'user' }, process.env.JWT_SECRET, { expiresIn: -1 }))).toThrow();
});

test('malformed or excessive stored scrypt costs are rejected before key derivation', async () => {
  const { verifyPassword } = require('../src/utils/password');
  for (const stored of ['scrypt$1073741824$8$1$' + 'a'.repeat(32) + '$' + 'b'.repeat(64),
    'scrypt$16384$8$1$bad$' + 'b'.repeat(64), 'a'.repeat(65)]) {
    expect(await verifyPassword('password', stored)).toBe(false);
  }
});
