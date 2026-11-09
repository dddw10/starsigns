// 管理员白名单：简洁模式开关等后台能力都靠它放行，
// 判错一次要么管理员进不去，要么普通用户拿到管理权限。
const { isAdminUser, normalizePhone } = require('../src/config/admin');

const ADMIN_PHONE = '13530147144';
const ADMIN_ID = '65f000000000000000000001';

describe('normalizePhone', () => {
  test.each([
    ['13530147144', '13530147144'],
    ['135 3014 7144', '13530147144'],
    ['135-3014-7144', '13530147144'],
    ['+8613530147144', '13530147144'],
    ['8613530147144', '13530147144'],
    ['(135)30147144', '13530147144'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  test.each([undefined, null, '', 0])('空值 %p 归一化为空串', (input) => {
    expect(normalizePhone(input)).toBe('');
  });
});

describe('isAdminUser', () => {
  const OLD_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...OLD_ENV };
  });

  test('手机号命中白名单', () => {
    process.env.ADMIN_PHONES = ADMIN_PHONE;
    expect(isAdminUser({ phone: ADMIN_PHONE, phoneVerifiedSource: 'wechat' })).toBe(true);
    // 带国家码、带分隔符的写法一样能命中
    expect(isAdminUser({ phone: '+86 135-3014-7144', phoneVerifiedSource: 'wechat' })).toBe(true);
  });

  test('手机号没命中就不是管理员', () => {
    process.env.ADMIN_PHONES = ADMIN_PHONE;
    expect(isAdminUser({ phone: '13000000000' })).toBe(false);
    expect(isAdminUser({ phone: '' })).toBe(false);
    expect(isAdminUser({})).toBe(false);
    expect(isAdminUser(null)).toBe(false);
  });

  test.each([
    { phone: ADMIN_PHONE },
    { phone: ADMIN_PHONE, phoneVerifiedSource: '' },
    { phone: ADMIN_PHONE, phoneVerifiedSource: 'mock', authSource: 'wechat' },
    { phone: ADMIN_PHONE, phoneVerifiedSource: 'wechat', authSource: 'dev_mock' },
  ])('旧号码或模拟来源不能通过手机白名单: %p', (user) => {
    process.env.ADMIN_PHONES = ADMIN_PHONE;
    expect(isAdminUser(user)).toBe(false);
  });

  test('ID 白名单独立于手机号可信状态和模拟身份', () => {
    process.env.ADMIN_USER_IDS = ADMIN_ID;
    expect(isAdminUser({ _id: ADMIN_ID, phone: ADMIN_PHONE, authSource: 'dev_mock', phoneVerifiedSource: 'mock' })).toBe(true);
  });

  test('用户 ID 命中白名单', () => {
    process.env.ADMIN_USER_IDS = ADMIN_ID;
    expect(isAdminUser({ _id: ADMIN_ID })).toBe(true);
    // _id 通常是 ObjectId，会先 toString
    expect(isAdminUser({ _id: { toString: () => ADMIN_ID } })).toBe(true);
    expect(isAdminUser({ _id: '65f000000000000000000002' })).toBe(false);
  });

  test('白名单为空时谁都不是管理员', () => {
    delete process.env.ADMIN_PHONES;
    delete process.env.ADMIN_USER_IDS;
    expect(isAdminUser({ phone: ADMIN_PHONE, _id: ADMIN_ID })).toBe(false);
  });

  test('多个白名单项按逗号分隔，容忍空格', () => {
    process.env.ADMIN_PHONES = ` 13000000000 , ${ADMIN_PHONE} ,`;
    expect(isAdminUser({ phone: ADMIN_PHONE, phoneVerifiedSource: 'wechat' })).toBe(true);
    expect(isAdminUser({ phone: '13000000000', phoneVerifiedSource: 'wechat' })).toBe(true);
  });

  // 白名单是每次调用时读环境变量的，改配置不用重启进程外的东西
  test('运行时改环境变量立刻生效', () => {
    process.env.ADMIN_PHONES = '';
    expect(isAdminUser({ phone: ADMIN_PHONE })).toBe(false);
    process.env.ADMIN_PHONES = ADMIN_PHONE;
    expect(isAdminUser({ phone: ADMIN_PHONE, phoneVerifiedSource: 'wechat' })).toBe(true);
  });
});
