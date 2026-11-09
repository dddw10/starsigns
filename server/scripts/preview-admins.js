const fs = require('fs');
const { normalizePhone, isAdminUser } = require('../src/config/admin');

function configuredIds() {
  return new Set(String(process.env.ADMIN_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean));
}

function buildAdminPreview(users) {
  if (!Array.isArray(users)) throw new Error('输入必须为用户数组');
  const ids = configuredIds();
  const phones = new Set(String(process.env.ADMIN_PHONES || '').split(',').map(normalizePhone).filter(Boolean));
  const records = users.filter(user => user && (ids.has(String(user._id)) || phones.has(normalizePhone(user.phone))))
    .map(user => {
      const phone = normalizePhone(user.phone);
      const currentlyAdmin = isAdminUser(user);
      return {
        userId: String(user._id),
        phone: phone ? phone.slice(0, 3) + '****' + phone.slice(-4) : '',
        authSource: user.authSource || 'unknown',
        phoneVerifiedSource: user.phoneVerifiedSource || '',
        idAllowlisted: ids.has(String(user._id)),
        currentlyAdmin,
        requiresMaintainerVerification: !currentlyAdmin,
      };
    });
  return { mode: 'dry-run', records, note: '旧号码候选须维护者核验；本工具不会修改用户或白名单。' };
}

async function main(args) {
  if (args.length === 2 && args[0] === '--input') {
    return buildAdminPreview(JSON.parse(fs.readFileSync(args[1], 'utf8').replace(/^\uFEFF/, '')));
  }
  if (args.length === 1 && args[0] === '--mongo') {
    if (!process.env.MONGODB_URI) throw new Error('显式只读数据库模式需要 MONGODB_URI');
    const mongoose = require('mongoose');
    const User = require('../src/models/User');
    try {
      await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 5000 });
      const users = await User.find({ $or: [{ phone: { $exists: true, $ne: '' } }, { _id: { $in: [...configuredIds()] } }] })
        .select('_id phone authSource phoneVerifiedSource').lean();
      return buildAdminPreview(users);
    } finally { await mongoose.disconnect(); }
  }
  throw new Error('用法：node scripts/preview-admins.js --input users.json 或 --mongo；仅支持只读预览');
}

if (require.main === module) {
  main(process.argv.slice(2)).then(result => console.log(JSON.stringify(result, null, 2)), () => {
    console.error('管理员只读预览失败：检查输入、参数及数据库连接配置。');
    process.exitCode = 2;
  });
}

module.exports = { buildAdminPreview, main };
