const { spawnSync } = require('child_process');
const path = require('path');
const { buildAdminPreview } = require('../scripts/preview-admins');
const originalEnv = { ...process.env };
afterEach(() => { process.env = { ...originalEnv }; });

test('old phone candidates are masked and require a maintainer, never auto-verified', () => {
  process.env.ADMIN_PHONES = '13530147144';
  process.env.ADMIN_USER_IDS = 'existing-id';
  const users = [
    { _id: 'old-id', phone: '+86 135-3014-7144' },
    { _id: 'real-id', phone: '13530147144', phoneVerifiedSource: 'wechat', authSource: 'wechat' },
    { _id: 'existing-id', phone: '', authSource: 'account' },
    { _id: 'other-id', phone: '13000000000' },
  ];
  const before = JSON.stringify(users);
  const result = buildAdminPreview(users);
  expect(result.records).toHaveLength(3);
  expect(result.records[0]).toMatchObject({ userId: 'old-id', currentlyAdmin: false,
    requiresMaintainerVerification: true, phone: '135****7144' });
  expect(result.records[1].currentlyAdmin).toBe(true);
  expect(result.records[2]).toMatchObject({ currentlyAdmin: true, idAllowlisted: true });
  expect(JSON.stringify(users)).toBe(before);
  expect(process.env.ADMIN_USER_IDS).toBe('existing-id');
});

test('default CLI cannot connect or apply without an explicit read source', () => {
  const script = path.join(__dirname, '../scripts/preview-admins.js');
  for (const args of [[], ['--apply']]) {
    const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
    expect(result.status).toBe(2);
    expect(result.stdout).toBe('');
  }
});

test('mongo preview disables writes from actual User model initialization', () => {
  const script = `
    const mongoose = require('mongoose');
    const writes = [];
    mongoose.Model.createCollection = async () => { writes.push('createCollection'); };
    mongoose.Model.ensureIndexes = async () => { writes.push('ensureIndexes'); };
    mongoose.Model.find = () => ({ select: () => ({ lean: async () => [] }) });
    mongoose.connect = async (_uri, options) => {
      Object.assign(mongoose.connection.config, options);
      mongoose.connection.readyState = 1;
      mongoose.connection.emit('connected');
      for (const queued of mongoose.connection._queue.splice(0)) queued.fn();
    };
    mongoose.disconnect = async () => {};
    process.env.MONGODB_URI = 'mongodb://unused/readonly';
    const { main } = require('./scripts/preview-admins');
    main(['--mongo']).then(async () => {
      await mongoose.model('User').init();
      console.log(JSON.stringify(writes));
    }).catch(error => { console.error(error); process.exitCode = 1; });
  `;
  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: path.join(__dirname, '..'), encoding: 'utf8', timeout: 10000,
  });
  expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout.trim())).toEqual([]);
});
