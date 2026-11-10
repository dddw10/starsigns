// No application bootstrap, dotenv, database writes on import, or automatic index creation.
const mongoose = require('mongoose');
const { EJSON } = require('bson');
const { createHash } = require('crypto');
const fs = require('fs');
const { canReceiveWechatPush } = require('../src/services/identity');
const { hasUniqueSubscriptionIndex } = require('../src/models/PushSubscription');
const encode = value => EJSON.stringify(value, { relaxed: false });
const fingerprint = value => createHash('sha256').update(encode(value)).digest('hex');
const validDate = value => value instanceof Date && Number.isFinite(value.getTime());
const validDay = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const latest = values => values.filter(Boolean).sort().at(-1) || '';
const dateExtreme = (values, direction) => {
  const dates = values.filter(validDate);
  return dates.length ? new Date(Math[direction](...dates.map(Number))) : null;
};

function buildPreview(snapshot) {
  const users = new Map(snapshot.users.map(user => [String(user._id), user]));
  const groups = new Map();
  for (const row of snapshot.subscriptions) {
    const key = JSON.stringify([String(row.userId), row.templateId]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const preview = { version: 1, snapshot, duplicates: [], changes: [], manual: [],
    uniqueIndexPresent: hasUniqueSubscriptionIndex(snapshot.indexes) };
  if (!preview.uniqueIndexPresent && snapshot.indexes.some(index => index.name === 'userId_1_templateId_1')) {
    preview.manual.push({ key: 'indexes', reasons: ['index name conflict'] });
  }
  for (const [key, rows] of groups) {
    const first = rows[0];
    const reasons = new Set();
    const user = users.get(String(first.userId));
    if (rows.length > 1) preview.duplicates.push({ key, ids: rows.map(row => row._id) });
    if (!first.userId || first.userId._bsontype !== 'ObjectId' || typeof first.templateId !== 'string' || !first.templateId.trim()) reasons.add('invalid key');
    if (!canReceiveWechatPush(user) || rows.some(row => row.openid !== user.openid)) reasons.add('identity unverified or conflicting');
    if (new Set(rows.map(row => row.status)).size > 1 || (user?.pushSettings?.pushEnabled === false && rows.some(row => row.status === 'active'))) reasons.add('cancellation/status conflict');
    for (const row of rows) {
      if (!['active', 'inactive', 'expired'].includes(row.status)) reasons.add('invalid status');
      if (!Number.isInteger(row.remainingQuota) || row.remainingQuota < 0 || row.remainingQuota > 7) reasons.add('invalid quota');
      if (row.status !== 'active' && row.remainingQuota > 0) reasons.add('canceled row has positive quota');
      if (!validDate(row.expireAt)) reasons.add('invalid expiry');
      if (row.lastPushDate && !validDay(row.lastPushDate)) reasons.add('invalid successful date');
      if (row.lastAttemptDate && !validDay(row.lastAttemptDate)) reasons.add('invalid attempt date');
      if (row.lastPushAt != null && !validDate(row.lastPushAt)) reasons.add('invalid successful timestamp');
      if ((row.lastPushAt || row.pushCount > 0 || row.sendState === 'success') && !row.lastPushDate) reasons.add('successful date missing');
      if (row.sendState && !['idle', 'success', 'failed'].includes(row.sendState)) reasons.add('unresolved delivery');
      if ((row.sendToken || row.claimedAt) && !['success', 'failed'].includes(row.sendState)) reasons.add('unclassified claim');
      if (rows.length > 1 && row.sendToken) reasons.add('delivery tokens require manual reconciliation');
      for (const field of ['pushCount', 'cancelEpoch', 'authEpoch']) {
        if (row[field] != null && (!Number.isSafeInteger(row[field]) || row[field] < 0)) reasons.add(`invalid ${field}`);
      }
    }
    const proposed = { ...first,
      remainingQuota: first.status === 'active' ? Math.min(...rows.map(row => row.remainingQuota)) : 0,
      lastPushDate: latest(rows.map(row => row.lastPushDate)),
      lastAttemptDate: latest(rows.map(row => row.lastAttemptDate)),
      lastPushAt: dateExtreme(rows.map(row => row.lastPushAt), 'max'),
      expireAt: dateExtreme(rows.map(row => row.expireAt), 'min'),
      subscribedAt: dateExtreme(rows.map(row => row.subscribedAt), 'max'),
      pushCount: Math.max(...rows.map(row => row.pushCount || 0)),
      cancelEpoch: Math.max(...rows.map(row => row.cancelEpoch || 0)),
      authEpoch: Math.max(...rows.map(row => row.authEpoch || 0)),
      sendState: first.sendState || 'idle', sendToken: first.sendToken || '',
    };
    if (reasons.size) {
      preview.manual.push({ key, ids: rows.map(row => row._id), reasons: [...reasons],
        // Suggest only; originals and all history remain in the snapshot. Never auto-apply this.
        suggested: { ...proposed, status: 'inactive', remainingQuota: 0, sendState: 'unknown' } });
    } else if (rows.length > 1 || encode(proposed) !== encode(first)) {
      preview.changes.push({ keepId: first._id, deleteIds: rows.slice(1).map(row => row._id), replacement: proposed });
    }
  }
  preview.hash = fingerprint(preview);
  return preview;
}

async function dryRun(database) {
  const collections = await database.listCollections({}, { nameOnly: true }).toArray();
  const has = name => collections.some(collection => collection.name === name);
  const subscriptions = has('pushsubscriptions')
    ? await database.collection('pushsubscriptions').find({}).sort({ _id: 1 }).toArray() : [];
  const indexes = has('pushsubscriptions') ? await database.collection('pushsubscriptions').indexes() : [];
  const ids = [...new Map(subscriptions.filter(row => row.userId).map(row => [String(row.userId), row.userId])).values()];
  const users = has('users') && ids.length
    ? await database.collection('users').find({ _id: { $in: ids } }, { projection: { openid: 1, authSource: 1, pushSettings: 1, subscribeAccepted: 1 } }).sort({ _id: 1 }).toArray() : [];
  return buildPreview({ database: database.databaseName, subscriptions, indexes, users });
}

async function applyPreview(database, preview, options = {}) {
  if (!options.paused) throw new Error('必须确认所有订阅写入和发送已暂停 (paused)');
  if (preview.manual?.length) throw new Error('预览含人工 (manual) 处理项，禁止自动 apply');
  if (!options.backupReviewed || !options.backupPath) throw new Error('必须提供并确认已审阅的备份');
  const rebuilt = buildPreview(preview.snapshot);
  if (options.expectedHash !== preview.hash || encode(rebuilt) !== encode(preview)) throw new Error('预览内容或 hash 已变更，重新 dry-run');
  const backup = EJSON.parse(fs.readFileSync(options.backupPath, 'utf8'));
  if (encode(backup) !== encode(preview.snapshot)) throw new Error('备份与预览快照不一致');
  const current = await dryRun(database);
  if (current.hash !== preview.hash) throw new Error('数据库已变更，预览过期；保持暂停并重新 dry-run');

  const collection = database.collection('pushsubscriptions');
  // The pause is operational, not a Mongo lock. Never run alongside old workers/writers.
  for (const change of preview.changes) {
    const result = await collection.replaceOne({ _id: change.keepId }, change.replacement);
    if (result.matchedCount !== 1) throw new Error('迁移记录发生变化，保持暂停并使用备份核验');
    if (change.deleteIds.length) {
      const deleted = await collection.deleteMany({ _id: { $in: change.deleteIds } });
      if (deleted.deletedCount !== change.deleteIds.length) throw new Error('重复记录发生变化，保持暂停并使用备份核验');
    }
  }
  // All duplicate cleanup completes before creating the unique constraint.
  if (!preview.uniqueIndexPresent) await collection.createIndex({ userId: 1, templateId: 1 }, { unique: true, name: 'userId_1_templateId_1' });
  const final = await dryRun(database);
  if (!final.uniqueIndexPresent || final.duplicates.length || final.manual.length) throw new Error('迁移后预检失败，保持暂停');
  return { applied: preview.changes.length, uniqueIndexPresent: true, hash: final.hash };
}

async function main(args = process.argv.slice(2)) {
  const allowed = new Set(['--apply', '--preview', '--backup', '--confirm-paused', '--confirm-backup-reviewed', '--expected-hash']);
  const values = {};
  for (let i = 0; i < args.length; i++) {
    if (!allowed.has(args[i])) throw new Error(`未知参数 ${args[i]}`);
    const name = args[i];
    values[name] = ['--apply', '--confirm-paused', '--confirm-backup-reviewed'].includes(name) ? true : args[++i];
    if (!values[name] || String(values[name]).startsWith('--')) throw new Error(`缺少参数值 ${name}`);
  }
  if (!process.env.PUSH_MIGRATION_URI || !values['--preview'] || !values['--backup']) {
    throw new Error('设置 PUSH_MIGRATION_URI，并指定 --preview <文件> --backup <文件>；默认只读 dry-run');
  }
  // Explicitly disable BOTH options: even a model imported later must not create data/indexes.
  const connection = mongoose.createConnection(process.env.PUSH_MIGRATION_URI, {
    autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000,
  });
  try {
    await connection.asPromise();
    if (values['--apply']) {
      const preview = EJSON.parse(fs.readFileSync(values['--preview'], 'utf8'));
      console.log(JSON.stringify(await applyPreview(connection.db, preview, {
        paused: values['--confirm-paused'], backupReviewed: values['--confirm-backup-reviewed'],
        expectedHash: values['--expected-hash'], backupPath: values['--backup'],
      })));
    } else {
      const preview = await dryRun(connection.db);
      fs.writeFileSync(values['--backup'], EJSON.stringify(preview.snapshot, null, 2, { relaxed: false }), { flag: 'wx', mode: 0o600 });
      fs.writeFileSync(values['--preview'], EJSON.stringify(preview, null, 2, { relaxed: false }), { flag: 'wx', mode: 0o600 });
      console.log(JSON.stringify({ mode: 'dry-run', records: preview.snapshot.subscriptions.length,
        duplicateGroups: preview.duplicates.length, manualGroups: preview.manual.length,
        proposedChanges: preview.changes.length, uniqueIndexPresent: preview.uniqueIndexPresent, hash: preview.hash }));
    }
  } finally { await connection.close(); }
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { buildPreview, dryRun, applyPreview, main };
