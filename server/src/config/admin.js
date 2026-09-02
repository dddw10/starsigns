// 管理员白名单：支持按用户 ID 或手机号配置
// ADMIN_USER_IDS=<mongo ObjectId>,<...>
// ADMIN_PHONES=13530147144,<...>

// 手机号归一化：去掉空格/横杠/括号，并剥掉 +86 / 86 国家码前缀
function normalizePhone(value) {
  if (!value) return '';
  const digits = String(value).replace(/[^\d]/g, '');
  if (digits.length > 11 && digits.startsWith('86')) {
    return digits.slice(digits.length - 11);
  }
  return digits;
}

function parseList(raw) {
  return new Set(
    String(raw || '')
      .split(',')
      .map(value => value.trim())
      .filter(Boolean)
  );
}

function getAdminUserIds() {
  return parseList(process.env.ADMIN_USER_IDS);
}

function getAdminPhones() {
  return new Set([...parseList(process.env.ADMIN_PHONES)].map(normalizePhone).filter(Boolean));
}

// 判断用户是否为管理员：ID 命中或手机号命中即可
function isAdminUser(user) {
  if (!user) return false;

  const userId = user._id ? user._id.toString() : '';
  if (userId && getAdminUserIds().has(userId)) {
    return true;
  }

  const phone = normalizePhone(user.phone);
  return !!phone && getAdminPhones().has(phone);
}

module.exports = {
  normalizePhone,
  isAdminUser,
};
