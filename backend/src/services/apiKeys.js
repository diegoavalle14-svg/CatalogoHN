const crypto = require('crypto');
const db = require('../config/database');

let apiKeysTableReady = false;

function hashApiKey(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function createPlainApiKey() {
  const envPrefix = process.env.NODE_ENV === 'production' ? 'live' : 'test';
  return `cthn_${envPrefix}_${crypto.randomBytes(32).toString('base64url')}`;
}

function normalizeScopes(value) {
  const input = Array.isArray(value) ? value : [];
  const clean = input
    .map((scope) => String(scope || '').trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(clean)];
}

async function ensureApiKeysTable() {
  if (apiKeysTableReady) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id SERIAL PRIMARY KEY,
      empresa_id INT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
      nombre VARCHAR(120) NOT NULL,
      key_hash CHAR(64) UNIQUE NOT NULL,
      key_prefix VARCHAR(24) NOT NULL,
      scopes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      activa BOOLEAN DEFAULT TRUE,
      last_used_at TIMESTAMP,
      created_by INT REFERENCES usuarios(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      revoked_at TIMESTAMP
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_api_keys_tenant ON api_keys(empresa_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash)`);
  apiKeysTableReady = true;
}

async function createApiKey({ empresaId, nombre, scopes = [], createdBy = null }) {
  await ensureApiKeysTable();
  const plainKey = createPlainApiKey();
  const keyHash = hashApiKey(plainKey);
  const keyPrefix = plainKey.slice(0, 18);
  const safeScopes = normalizeScopes(scopes);

  const result = await db.query(
    `INSERT INTO api_keys (empresa_id, nombre, key_hash, key_prefix, scopes, created_by)
     VALUES ($1, $2, $3, $4, $5::text[], $6)
     RETURNING id, empresa_id, nombre, key_prefix, scopes, activa, last_used_at, created_at, revoked_at`,
    [empresaId, String(nombre || '').trim().slice(0, 120), keyHash, keyPrefix, safeScopes, createdBy]
  );

  return {
    api_key: result.rows[0],
    plain_key: plainKey
  };
}

async function findApiKey(plainKey) {
  await ensureApiKeysTable();
  const keyHash = hashApiKey(plainKey);
  const result = await db.query(
    `SELECT ak.id,
            ak.empresa_id,
            ak.nombre,
            ak.key_prefix,
            ak.scopes,
            ak.activa,
            ak.last_used_at,
            ak.created_at,
            ak.revoked_at,
            e.slug AS tenant_slug,
            e.nombre AS tenant_nombre,
            e.activa AS tenant_activa
     FROM api_keys ak
     JOIN empresas e ON e.id = ak.empresa_id
     WHERE ak.key_hash = $1
     LIMIT 1`,
    [keyHash]
  );
  return result.rows[0] || null;
}

async function markApiKeyUsed(id) {
  await db.query('UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1', [id]).catch(() => {});
}

module.exports = {
  createApiKey,
  ensureApiKeysTable,
  findApiKey,
  markApiKeyUsed,
  normalizeScopes
};
