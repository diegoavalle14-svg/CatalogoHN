const db = require('../config/database');
const mock = require('./mockData');

function slugFromHost(host = '') {
  const hostname = host.split(':')[0].toLowerCase();
  if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) return 'kolben';
  const [subdomain] = hostname.split('.');
  return subdomain || 'kolben';
}

async function resolveTenant(req, res, next) {
  const requestedSlug = req.header('x-tenant-slug') || req.query.tenant || slugFromHost(req.headers.host);

  try {
    const result = await db.query('SELECT * FROM empresas WHERE slug = $1 AND activa = true LIMIT 1', [requestedSlug]);
    req.tenant = result.rows[0] || mock.empresa;
  } catch (error) {
    req.tenant = mock.empresa;
    req.dbUnavailable = true;
  }

  next();
}

module.exports = {
  resolveTenant,
  slugFromHost
};
