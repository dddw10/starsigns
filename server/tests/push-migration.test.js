const mongoose = require('mongoose');
const { buildPreview, dryRun, applyPreview } = require('../scripts/migrate-push-subscriptions');
const uid = new mongoose.Types.ObjectId('65f000000000000000000001');
const oid = n => new mongoose.Types.ObjectId(`65f0000000000000000000${String(n).padStart(2, '0')}`);
const user = { _id: uid, openid: 'verified', authSource: 'wechat' };
const row = (n, extra = {}) => ({ _id: oid(n), userId: uid, templateId: 'tpl', openid: 'verified',
  status: 'active', remainingQuota: 3, lastPushDate: '', pushCount: 0,
  expireAt: new Date('2027-01-01'), subscribedAt: new Date('2026-10-01'), ...extra });

test('safe duplicate merge never adds authorizations; retains latest successful date and earliest expiry', () => {
  const preview = buildPreview({ subscriptions: [row(2, { lastPushDate: '2026-11-09', pushCount: 2 }),
    row(3, { remainingQuota: 2, lastPushDate: '2026-11-10', lastPushAt: new Date('2026-11-10'), expireAt: new Date('2026-12-01') })], users: [user], indexes: [] });
  expect(preview.manual).toEqual([]);
  expect(preview.duplicates).toHaveLength(1);
  expect(preview.changes[0].replacement).toMatchObject({ remainingQuota: 2, lastPushDate: '2026-11-10',
    pushCount: 2, expireAt: new Date('2026-12-01'), lastPushAt: new Date('2026-11-10') });
});
test.each([
  [{ status: 'inactive', remainingQuota: 0 }, 'cancellation'],
  [{ openid: 'different' }, 'identity'],
  [{ sendState: 'unknown', sendToken: 'unknown-token' }, 'unresolved'],
  [{ sendState: 'pending', sendToken: 'pending-token' }, 'unresolved'],
  [{ remainingQuota: 8 }, 'quota'],
])('ambiguous duplicate preserves originals and requires manual action (%s)', (extra) => {
  const records = [row(2), row(3, extra)];
  const preview = buildPreview({ subscriptions: records, users: [user], indexes: [] });
  expect(preview.manual).toHaveLength(1);
  expect(preview.changes).toEqual([]);
  expect(preview.manual[0].suggested.remainingQuota).toBe(0);
  expect(preview.snapshot.subscriptions).toEqual(records);
});
test('matching canceled duplicates keep cancellation and zero quota', () => {
  const preview = buildPreview({ subscriptions: [row(2, { status: 'inactive', remainingQuota: 0 }), row(3, { status: 'inactive', remainingQuota: 0 })], users: [user], indexes: [] });
  expect(preview.changes[0].replacement).toMatchObject({ status: 'inactive', remainingQuota: 0 });
});
test('unknown identity or corrupt legacy state is manual even for a single row', () => {
  const preview = buildPreview({ subscriptions: [row(2)], users: [{ ...user, authSource: 'unknown' }], indexes: [] });
  expect(preview.manual).toHaveLength(1);
  expect(preview.changes).toEqual([]);
});
test.each([
  { pushCount: 1, lastPushAt: new Date('2026-11-10'), lastPushDate: '' },
  { lastPushDate: '2026-99-40' },
  { sendToken: 'unclassified-claim' },
  { sendState: 'success', lastPushDate: '' },
])('incomplete successful history or claim metadata is manual (%s)', extra => {
  const preview = buildPreview({ subscriptions: [row(2, extra)], users: [user], indexes: [] });
  expect(preview.manual).toHaveLength(1);
  expect(preview.changes).toEqual([]);
});
test('a conflicting index name is surfaced for manual review before destructive merging', () => {
  const preview = buildPreview({ subscriptions: [row(2), row(3)], users: [user],
    indexes: [{ name: 'userId_1_templateId_1', key: { userId: 1, templateId: 1 } }] });
  expect(preview.manual.some(item => item.reasons.includes('index name conflict'))).toBe(true);
});
test('dry-run only reads existing collections and never creates indexes or collections', async () => {
  const writes = [];
  const database = { listCollections: () => ({ toArray: async () => [{ name: 'pushsubscriptions' }, { name: 'users' }] }),
    collection: name => ({
      find: () => ({ sort: () => ({ toArray: async () => name === 'users' ? [user] : [row(2)] }) }),
      indexes: async () => [{ name: '_id_', key: { _id: 1 } }],
      createIndex: () => writes.push('index'), replaceOne: () => writes.push('replace'), deleteMany: () => writes.push('delete'),
    }) };
  const preview = await dryRun(database);
  expect(preview.snapshot.subscriptions).toHaveLength(1);
  expect(writes).toEqual([]);
});
test('apply rejects absent pause confirmation and manual conflicts before any writes', async () => {
  await expect(applyPreview({}, {}, {})).rejects.toThrow(/暂停|paused/);
  const preview = buildPreview({ subscriptions: [row(2, { sendState: 'unknown' })], users: [user], indexes: [] });
  await expect(applyPreview({}, preview, { paused: true, backupReviewed: true })).rejects.toThrow(/人工|manual/);
});
