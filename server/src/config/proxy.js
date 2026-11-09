const net = require('net');

function trustedProxies(value = '') {
  if (!value.trim() || value.trim() === 'false') return false;
  const entries = value.split(',').map(item => item.trim());
  for (const entry of entries) {
    const [address, prefix, extra] = entry.split('/');
    const family = net.isIP(address);
    const max = family === 4 ? 32 : 128;
    const canonical = family === 6 ? new URL(`http://[${address}]`).hostname : address;
    const mappedWildcard = canonical.startsWith('[::ffff:') && prefix !== undefined && Number(prefix) <= 96;
    if (!family || extra !== undefined || address === '0.0.0.0' || canonical === '[::]' || mappedWildcard
      || (prefix !== undefined && (!/^\d+$/.test(prefix) || Number(prefix) < 1 || Number(prefix) > max))) {
      throw new Error('TRUST_PROXY must contain verified IP addresses or CIDRs; hop counts and wildcard networks are forbidden');
    }
  }
  return entries;
}

module.exports = { trustedProxies };
