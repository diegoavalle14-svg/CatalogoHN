const db = require('../config/database');

let apiAuditTableReady = false;

async function ensureApiAuditTable() {
  if (apiAuditTableReady) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS api_request_logs (
      id SERIAL PRIMARY KEY,
      empresa_id INT REFERENCES empresas(id) ON DELETE SET NULL,
      api_key_id INT REFERENCES api_keys(id) ON DELETE SET NULL,
      method VARCHAR(10) NOT NULL,
      path TEXT NOT NULL,
      status_code INT NOT NULL,
      duration_ms INT NOT NULL,
      ip VARCHAR(80),
      user_agent TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_api_request_logs_tenant_date ON api_request_logs(empresa_id, created_at DESC)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_api_request_logs_key_date ON api_request_logs(api_key_id, created_at DESC)`);
  apiAuditTableReady = true;
}

async function recordApiRequest(entry) {
  await ensureApiAuditTable();
  await db.query(
    `INSERT INTO api_request_logs (
       empresa_id,
       api_key_id,
       method,
       path,
       status_code,
       duration_ms,
       ip,
       user_agent
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      entry.empresaId || null,
      entry.apiKeyId || null,
      String(entry.method || '').slice(0, 10),
      String(entry.path || '').slice(0, 500),
      Number(entry.statusCode || 0),
      Number(entry.durationMs || 0),
      String(entry.ip || '').slice(0, 80),
      String(entry.userAgent || '').slice(0, 500)
    ]
  );
}

module.exports = {
  ensureApiAuditTable,
  recordApiRequest
};
