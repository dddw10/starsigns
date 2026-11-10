// Explicit opt-in: run only against the disposable authenticated Docker fixture.
const enabled = process.env.PUSH_TEST_MONGO_URI && process.env.PUSH_TEST_ISOLATED === '1';
const suite = enabled ? describe : describe.skip;
jest.mock('../src/services/fortuneService', () => ({
  getDailyFortune: jest.fn(async () => ({ date: '2026-11-10', level: 'good', score: 80 })),
}));
jest.mock('../src/config/redis', () => ({ getRedis: () => null }));
const mongoose = require('mongoose');
const axios = require('axios');
const PushSubscription = require('../src/models/PushSubscription');
const PushLog = require('../src/models/PushLog');
const User = require('../src/models/User');
const push = require('../src/services/pushService');
const fortune = require('../src/services/fortuneService');
const config = require('../src/config/wechat');
const { getBeijingDateString } = require('../src/utils/date');
const { dryRun, applyPreview } = require('../scripts/migrate-push-subscriptions');
const { EJSON } = require('bson');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

suite('real Mongo push concurrency (isolated opt-in)', () => {
  let userId; let deliveries; let post;
  beforeAll(async () => {
    await mongoose.connect(process.env.PUSH_TEST_MONGO_URI, { autoIndex: false, autoCreate: false });
    config.templates.dailyFortune = 'fake-template';
    config.templates.dailyFortuneFields = [{ field: 'thing1', type: 'thing', kind: 'text', contentKey: 'level' }];
    await PushSubscription.createCollection();
    await User.createCollection();
    await PushLog.createCollection();
  });
  afterAll(async () => { await mongoose.disconnect(); });
  beforeEach(async () => {
    await Promise.all([PushSubscription.deleteMany({}), PushLog.deleteMany({}), User.deleteMany({})]);
    await PushSubscription.collection.createIndex({ userId: 1, templateId: 1 }, { unique: true, name: 'userId_1_templateId_1' });
    userId = new mongoose.Types.ObjectId(); deliveries = [];
    await User.collection.insertOne({ _id: userId, openid: 'verified-wechat', authSource: 'wechat',
      birthInfo: { yearGanZhi: '甲子' }, pushSettings: { pushEnabled: true }, subscribeAccepted: true });
    jest.spyOn(push, 'isPushConfigured').mockReturnValue(true);
    jest.spyOn(axios, 'get').mockResolvedValue({ data: { access_token: 'fake-token', expires_in: 7200 } });
    post = jest.spyOn(axios, 'post').mockImplementation(async (_url, body) => {
      deliveries.push(body); return { data: { errcode: 0, errmsg: 'ok' } };
    });
    jest.spyOn(console, 'error').mockImplementation(() => {});
    fortune.getDailyFortune.mockImplementation(async () => ({ date: getBeijingDateString(), level: 'good', score: 80 }));
  });
  afterEach(() => jest.restoreAllMocks());
  const read = () => PushSubscription.findOne({ userId }).lean();
  const authorize = async n => { for (let i = 0; i < n; i++) await push.subscribe(userId, 'fake-template'); };

  test('concurrent first authorizations create one row and accumulate up to seven', async () => {
    await Promise.all([push.subscribe(userId), push.subscribe(userId)]);
    expect(await PushSubscription.countDocuments({ userId })).toBe(1);
    expect((await read()).remainingQuota).toBe(2);
    await Promise.all(Array.from({ length: 12 }, () => push.subscribe(userId)));
    expect((await read()).remainingQuota).toBe(7);
  });
  test('missing unique index refuses authorization and sends with actionable migration error', async () => {
    await PushSubscription.collection.dropIndex('userId_1_templateId_1');
    await expect(push.subscribe(userId, 'fake-template')).rejects.toMatchObject({ status: 503, code: 'PUSH_MIGRATION_REQUIRED' });
    await expect(push.triggerDailyPush()).rejects.toMatchObject({ code: 'PUSH_MIGRATION_REQUIRED' });
    expect(deliveries).toHaveLength(0);
    expect(await PushSubscription.countDocuments({})).toBe(0);
  });
  test('overlapping regular and forced tasks share one claim and one debit', async () => {
    await authorize(4);
    const entered = deferred(); const finish = deferred();
    post.mockImplementation(async (_url, body) => { deliveries.push(body); entered.resolve(); await finish.promise; return { data: { errcode: 0 } }; });
    const first = push.triggerDailyPush(); await entered.promise;
    await Promise.all([push.triggerDailyPush(), push.triggerDailyPush({ force: true })]);
    finish.resolve(); await first;
    expect(deliveries).toHaveLength(1);
    expect(await read()).toMatchObject({ remainingQuota: 3, pushCount: 1, sendState: 'success', lastPushDate: getBeijingDateString() });
    await push.triggerDailyPush(); expect(deliveries).toHaveLength(1);
    await push.triggerDailyPush({ force: true }); expect(deliveries).toHaveLength(2);
    expect((await read()).remainingQuota).toBe(2);
  });
  test('new authorization during success is retained in current balance', async () => {
    await authorize(2);
    post.mockImplementation(async (_url, body) => { deliveries.push(body); await push.subscribe(userId); return { data: { errcode: 0 } }; });
    await push.triggerDailyPush();
    expect(await read()).toMatchObject({ remainingQuota: 2, status: 'active', pushCount: 1 });
  });
  test('stale forced scans cannot claim again after a fast successful response', async () => {
    await authorize(4);
    const candidates = await PushSubscription.find({ userId }).populate('userId');
    const scan = jest.spyOn(PushSubscription, 'find').mockReturnValue({ populate: async () => candidates });
    await push.triggerDailyPush({ force: true }); await push.triggerDailyPush({ force: true });
    expect(deliveries).toHaveLength(1);
    scan.mockRestore();
    await push.triggerDailyPush({ force: true });
    expect(deliveries).toHaveLength(2);
    expect((await read()).remainingQuota).toBe(2);
  });
  test('old success after cancellation cannot reactivate the canceled subscription', async () => {
    await authorize(4);
    post.mockImplementation(async () => { await push.unsubscribe(userId); return { data: { errcode: 0 } }; });
    await push.triggerDailyPush();
    expect(await read()).toMatchObject({ remainingQuota: 0, status: 'inactive', pushCount: 1, sendState: 'success' });
  });
  test.each(['unsubscribe', 'settings'])('old success cannot overwrite %s cancellation followed by new authorization', async mode => {
    await authorize(4);
    post.mockImplementation(async (_url, body) => {
      deliveries.push(body);
      if (mode === 'settings') await push.updateSettings(userId, { pushEnabled: false });
      else await push.unsubscribe(userId);
      await push.subscribe(userId);
      return { data: { errcode: 0 } };
    });
    await push.triggerDailyPush();
    expect(await read()).toMatchObject({ remainingQuota: 1, status: 'active', pushCount: 1, sendState: 'success' });
  });
  test('cancellation during content generation prevents dispatch', async () => {
    await authorize(2);
    fortune.getDailyFortune.mockImplementation(async () => { await push.unsubscribe(userId); return { level: 'good' }; });
    await push.triggerDailyPush();
    expect(deliveries).toHaveLength(0);
    expect(await read()).toMatchObject({ remainingQuota: 0, status: 'inactive' });
  });
  test.each(['cancel', 'reauthorize', 'expire', 'active'])('token wait rechecks claim before POST: %s', async action => {
    await authorize(2);
    const entered = deferred(); const release = deferred();
    axios.get.mockImplementation(async () => {
      entered.resolve(); await release.promise;
      return { data: { access_token: 'fake-delayed-token', expires_in: 7200 } };
    });
    const running = push.triggerDailyPush();
    await entered.promise;
    try {
      if (action === 'cancel' || action === 'reauthorize') await push.unsubscribe(userId);
      if (action === 'reauthorize') await push.subscribe(userId);
      if (action === 'expire') await PushSubscription.updateOne({ userId }, { $set: { expireAt: new Date(0) } });
    } finally { release.resolve(); }
    const stats = await running;
    if (action === 'active') {
      expect(deliveries).toHaveLength(1);
      expect(await read()).toMatchObject({ remainingQuota: 1, sendState: 'success', pushCount: 1 });
      expect(stats).toMatchObject({ success: 1, failed: 0, unknown: 0 });
    } else {
      expect(deliveries).toHaveLength(0);
      expect(await read()).toMatchObject({ remainingQuota: action === 'cancel' ? 0 : action === 'reauthorize' ? 1 : 2,
        sendState: 'failed', lastPushDate: '' });
      expect(stats).toMatchObject({ success: 0, failed: 1, unknown: 0 });
    }
  });
  test('known cancellation before POST stays failed even if initial settlement write fails', async () => {
    await authorize(2);
    axios.get.mockImplementation(async () => {
      await push.unsubscribe(userId);
      return { data: { access_token: 'fake-token', expires_in: 7200 } };
    });
    const update = PushSubscription.updateOne.bind(PushSubscription);
    jest.spyOn(PushSubscription, 'updateOne').mockImplementation((query, change) => {
      if (Array.isArray(change)) return Promise.reject(new Error('settlement unavailable'));
      return update(query, change);
    });
    const stats = await push.triggerDailyPush();
    expect(deliveries).toHaveLength(0);
    expect(await read()).toMatchObject({ remainingQuota: 0, status: 'inactive', sendState: 'failed' });
    expect(stats).toMatchObject({ success: 0, failed: 1, unknown: 0 });
  });
  test.each([false, true])('refusal settlement failure stays blocked without clearing newer authorization: %s', async reauthorize => {
    await authorize(2);
    post.mockImplementation(async (_url, body) => {
      deliveries.push(body);
      if (reauthorize) await push.subscribe(userId);
      return { data: { errcode: 43101, errmsg: 'user refused' } };
    });
    const update = PushSubscription.updateOne.bind(PushSubscription);
    let failFirstSettlement = true;
    jest.spyOn(PushSubscription, 'updateOne').mockImplementation((query, change) => {
      if (Array.isArray(change) && failFirstSettlement) {
        failFirstSettlement = false;
        return Promise.reject(new Error('settlement unavailable'));
      }
      return update(query, change);
    });
    const stats = await push.triggerDailyPush();
    expect(await read()).toMatchObject({ remainingQuota: reauthorize ? 3 : 2, status: 'active', sendState: 'unknown' });
    expect(stats).toMatchObject({ success: 0, failed: 0, unknown: 1 });
    const diagnostic = console.error.mock.calls.find(([, details]) => details?.errcode === 43101)?.[1];
    expect(diagnostic).toMatchObject({ subscriptionId: String((await read())._id), sendToken: (await read()).sendToken,
      errcode: 43101, errmsg: 'user refused' });
    await push.triggerDailyPush({ force: true });
    await update({ userId }, { $set: { lastAttemptDate: '2000-01-01' } });
    await push.triggerDailyPush();
    expect(deliveries).toHaveLength(1);
  });
  test('stale refusal does not clear a new authorization', async () => {
    await authorize(2);
    post.mockImplementation(async () => { await push.subscribe(userId); return { data: { errcode: 43101 } }; });
    await push.triggerDailyPush();
    expect(await read()).toMatchObject({ remainingQuota: 3, status: 'active', sendState: 'failed' });
  });
  test('definite failure retains quota; normal same-day retry is blocked, force may retry', async () => {
    await authorize(2);
    post.mockImplementation(async (_url, body) => { deliveries.push(body); return { data: { errcode: 47003 } }; });
    await push.triggerDailyPush(); await push.triggerDailyPush();
    expect(deliveries).toHaveLength(1);
    expect(await read()).toMatchObject({ remainingQuota: 2, sendState: 'failed', lastPushDate: '' });
    await push.triggerDailyPush({ force: true }); expect(deliveries).toHaveLength(2);
  });
  test('network uncertainty blocks all future claims including force and reauthorization', async () => {
    await authorize(2);
    post.mockImplementation(async (_url, body) => { deliveries.push(body); throw new Error('response timeout'); });
    await push.triggerDailyPush();
    await push.unsubscribe(userId); await push.subscribe(userId);
    await PushSubscription.updateOne({ userId }, { $set: { lastAttemptDate: '2000-01-01' } });
    await push.triggerDailyPush(); await push.triggerDailyPush({ force: true });
    expect(deliveries).toHaveLength(1);
    expect(await read()).toMatchObject({ remainingQuota: 1, sendState: 'unknown' });
  });
  test('crashed pending claim is never reclaimed even by force', async () => {
    await authorize(2);
    await PushSubscription.collection.updateOne({ userId }, { $set: { sendState: 'pending', sendToken: 'crashed', lastAttemptDate: '2000-01-01' } });
    await push.triggerDailyPush({ force: true });
    expect(deliveries).toHaveLength(0);
    expect((await read()).sendToken).toBe('crashed');
  });
  test('log failure after delivery never releases the claim or loses successful debit', async () => {
    await authorize(2);
    jest.spyOn(PushLog, 'create').mockRejectedValue(new Error('log unavailable'));
    await push.triggerDailyPush(); await push.triggerDailyPush();
    expect(deliveries).toHaveLength(1);
    expect(await read()).toMatchObject({ remainingQuota: 1, pushCount: 1, sendState: 'success' });
  });
  test('legacy rows with no epoch fields remain usable after unique-index preflight', async () => {
    await PushSubscription.collection.insertOne({ userId, openid: 'verified-wechat', templateId: 'fake-template',
      status: 'active', remainingQuota: 2, expireAt: new Date(Date.now() + 86400000) });
    await push.triggerDailyPush();
    expect(deliveries).toHaveLength(1);
    expect((await read()).remainingQuota).toBe(1);
  });
  test('11000 first-upsert competition retries the authorization once', async () => {
    const original = PushSubscription.findOneAndUpdate.bind(PushSubscription);
    let raced = false;
    jest.spyOn(PushSubscription, 'findOneAndUpdate').mockImplementation(async (query, update, options) => {
      if (options.upsert && !raced) {
        raced = true;
        await original(query, update, options); // the competing authorization wins first
        throw Object.assign(new Error('duplicate first insert'), { code: 11000 });
      }
      return original(query, update, options);
    });
    await push.subscribe(userId);
    expect(await PushSubscription.countDocuments({ userId })).toBe(1);
    expect((await read()).remainingQuota).toBe(2);
  });
  test('settlement database failure leaves unknown blocking future force', async () => {
    await authorize(2);
    const original = PushSubscription.updateOne.bind(PushSubscription);
    let failed = false;
    jest.spyOn(PushSubscription, 'updateOne').mockImplementation((query, update) => {
      if (Array.isArray(update) && !failed) { failed = true; return Promise.reject(new Error('settlement unavailable')); }
      return original(query, update);
    });
    await push.triggerDailyPush(); await push.triggerDailyPush({ force: true });
    expect(deliveries).toHaveLength(1);
    expect(await read()).toMatchObject({ remainingQuota: 2, sendState: 'unknown' });
  });
  test('migration dry-run preserves database; reviewed apply merges then enforces uniqueness', async () => {
    await PushSubscription.collection.dropIndex('userId_1_templateId_1');
    await authorizeLegacyDuplicates();
    const before = EJSON.stringify(await PushSubscription.collection.find({}).sort({ _id: 1 }).toArray());
    const indexesBefore = EJSON.stringify(await PushSubscription.collection.indexes());
    const preview = await dryRun(mongoose.connection.db);
    expect(preview.duplicates).toHaveLength(1); expect(preview.manual).toEqual([]);
    expect(EJSON.stringify(await PushSubscription.collection.find({}).sort({ _id: 1 }).toArray())).toBe(before);
    expect(EJSON.stringify(await PushSubscription.collection.indexes())).toBe(indexesBefore);
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'push-migration-'));
    const backupPath = path.join(folder, 'backup.json');
    fs.writeFileSync(backupPath, EJSON.stringify(preview.snapshot));
    try {
      const result = await applyPreview(mongoose.connection.db, preview, {
        paused: true, backupReviewed: true, expectedHash: preview.hash, backupPath,
      });
      expect(result.uniqueIndexPresent).toBe(true);
      expect(await PushSubscription.countDocuments({ userId })).toBe(1);
      expect(await read()).toMatchObject({ remainingQuota: 2, lastPushDate: '2026-11-09' });
      await expect(PushSubscription.collection.insertOne({ userId, templateId: 'fake-template' })).rejects.toMatchObject({ code: 11000 });
    } finally { for (const file of fs.readdirSync(folder)) fs.unlinkSync(path.join(folder, file)); fs.rmdirSync(folder); }
  });
  test('apply rejects stale preview or altered backup without mutations', async () => {
    await authorize(2);
    const preview = await dryRun(mongoose.connection.db);
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'push-migration-'));
    const backupPath = path.join(folder, 'backup.json');
    const options = { paused: true, backupReviewed: true, expectedHash: preview.hash, backupPath };
    try {
      fs.writeFileSync(backupPath, EJSON.stringify({ subscriptions: [] }));
      await expect(applyPreview(mongoose.connection.db, preview, options)).rejects.toThrow(/备份/);
      fs.writeFileSync(backupPath, EJSON.stringify(preview.snapshot));
      await push.subscribe(userId);
      await expect(applyPreview(mongoose.connection.db, preview, options)).rejects.toThrow(/预览过期/);
      expect((await read()).remainingQuota).toBe(3);
    } finally { for (const file of fs.readdirSync(folder)) fs.unlinkSync(path.join(folder, file)); fs.rmdirSync(folder); }
  });
  test('CLI dry-run on empty database creates no collections or indexes', async () => {
    const emptyDb = mongoose.connection.client.db('push_fixture_empty');
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'push-cli-'));
    const uri = process.env.PUSH_TEST_MONGO_URI.replace('/push_fixture?', '/push_fixture_empty?');
    try {
      const output = await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [path.join(__dirname, '../scripts/migrate-push-subscriptions.js'),
          '--preview', path.join(folder, 'preview.json'), '--backup', path.join(folder, 'backup.json')],
        { env: { ...process.env, PUSH_MIGRATION_URI: uri }, windowsHide: true });
        let stdout = ''; let stderr = '';
        child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.on('data', chunk => { stderr += chunk; });
        child.on('error', reject); child.on('close', code => code === 0 ? resolve(stdout) : reject(new Error(stderr)));
      });
      expect(JSON.parse(output)).toMatchObject({ mode: 'dry-run', records: 0, uniqueIndexPresent: false });
      expect(await emptyDb.listCollections().toArray()).toEqual([]);
      expect(fs.existsSync(path.join(folder, 'backup.json'))).toBe(true);
    } finally { for (const file of fs.readdirSync(folder)) fs.unlinkSync(path.join(folder, file)); fs.rmdirSync(folder); }
  });
  async function authorizeLegacyDuplicates() {
    const base = { userId, openid: 'verified-wechat', templateId: 'fake-template', status: 'active',
      remainingQuota: 3, expireAt: new Date(Date.now() + 86400000), lastPushDate: '2026-11-08' };
    await PushSubscription.collection.insertMany([base, { ...base, remainingQuota: 2, lastPushDate: '2026-11-09' }]);
  }
});
