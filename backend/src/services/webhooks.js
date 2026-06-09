const crypto = require('crypto');
const db = require('../config/database');

let webhooksTableReady = false;

const ALLOWED_EVENTS = [
  'order.created',
  'order.status_changed',
  'catalog.updated',
  'stock.updated'
];

function normalizeEvents(value) {
  const input = Array.isArray(value) ? value : [];
  const clean = [...new Set(input.map((event) => String(event || '').trim().toLowerCase()).filter(Boolean))];
  return clean.filter((event) => ALLOWED_EVENTS.includes(event));
}

function createWebhookSecret() {
  return `whsec_${crypto.randomBytes(32).toString('base64url')}`;
}

function signPayload(secret, timestamp, body) {
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

async function ensureWebhookTables() {
  if (webhooksTableReady) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS webhook_endpoints (
      id SERIAL PRIMARY KEY,
      empresa_id INT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
      nombre VARCHAR(120) NOT NULL,
      url TEXT NOT NULL,
      secret TEXT NOT NULL,
      events TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      activa BOOLEAN DEFAULT TRUE,
      created_by INT REFERENCES usuarios(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      revoked_at TIMESTAMP
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS webhook_deliveries (
      id SERIAL PRIMARY KEY,
      webhook_endpoint_id INT REFERENCES webhook_endpoints(id) ON DELETE SET NULL,
      empresa_id INT REFERENCES empresas(id) ON DELETE SET NULL,
      event_type VARCHAR(80) NOT NULL,
      payload JSONB NOT NULL,
      status_code INT,
      success BOOLEAN DEFAULT FALSE,
      error TEXT,
      duration_ms INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_tenant ON webhook_endpoints(empresa_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_tenant_date ON webhook_deliveries(empresa_id, created_at DESC)`);
  webhooksTableReady = true;
}

async function createWebhookEndpoint({ empresaId, nombre, url, events, createdBy = null }) {
  await ensureWebhookTables();
  const secret = createWebhookSecret();
  const result = await db.query(
    `INSERT INTO webhook_endpoints (empresa_id, nombre, url, secret, events, created_by)
     VALUES ($1, $2, $3, $4, $5::text[], $6)
     RETURNING id, empresa_id, nombre, url, events, activa, created_at, updated_at, revoked_at`,
    [empresaId, nombre, url, secret, normalizeEvents(events), createdBy]
  );
  return { webhook: result.rows[0], secret };
}

async function listWebhookEndpoints(empresaId) {
  await ensureWebhookTables();
  const result = await db.query(
    `SELECT id, empresa_id, nombre, url, events, activa, created_at, updated_at, revoked_at
     FROM webhook_endpoints
     WHERE empresa_id = $1
     ORDER BY created_at DESC`,
    [empresaId]
  );
  return result.rows;
}

async function revokeWebhookEndpoint(id) {
  await ensureWebhookTables();
  const result = await db.query(
    `UPDATE webhook_endpoints
     SET activa = false,
         revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING id, empresa_id, nombre, url, events, activa, created_at, updated_at, revoked_at`,
    [id]
  );
  return result.rows[0] || null;
}

async function dispatchWebhookEvent({ empresaId, eventType, payload }) {
  await ensureWebhookTables();
  const endpoints = await db.query(
    `SELECT id, empresa_id, nombre, url, secret, events
     FROM webhook_endpoints
     WHERE empresa_id = $1
       AND activa = true
       AND revoked_at IS NULL
       AND $2 = ANY(events)`,
    [empresaId, eventType]
  );

  for (const endpoint of endpoints.rows) {
    deliverWebhook(endpoint, eventType, payload).catch((error) => {
      console.warn('[webhooks] delivery failed:', error.message || error);
    });
  }
}

async function deliverWebhook(endpoint, eventType, payload) {
  const body = JSON.stringify({
    id: `evt_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`,
    type: eventType,
    created_at: new Date().toISOString(),
    tenant_id: endpoint.empresa_id,
    data: payload
  });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signPayload(endpoint.secret, timestamp, body);
  const startedAt = Date.now();
  let statusCode = null;
  let success = false;
  let errorMessage = '';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    const response = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CatalogoHN-Event': eventType,
        'X-CatalogoHN-Timestamp': String(timestamp),
        'X-CatalogoHN-Signature': `sha256=${signature}`
      },
      body,
      signal: controller.signal
    });
    clearTimeout(timeout);
    statusCode = response.status;
    success = response.ok;
    if (!success) errorMessage = `HTTP ${response.status}`;
  } catch (error) {
    errorMessage = error.message || 'No se pudo entregar webhook';
  }

  await db.query(
    `INSERT INTO webhook_deliveries (
       webhook_endpoint_id,
       empresa_id,
       event_type,
       payload,
       status_code,
       success,
       error,
       duration_ms
     )
     VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8)`,
    [
      endpoint.id,
      endpoint.empresa_id,
      eventType,
      body,
      statusCode,
      success,
      errorMessage,
      Date.now() - startedAt
    ]
  );
}

module.exports = {
  ALLOWED_EVENTS,
  createWebhookEndpoint,
  dispatchWebhookEvent,
  ensureWebhookTables,
  listWebhookEndpoints,
  normalizeEvents,
  revokeWebhookEndpoint
};
