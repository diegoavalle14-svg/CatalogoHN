const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { authenticate, requireRole, signToken } = require('../middleware/auth');
const { createApiKey, ensureApiKeysTable } = require('../services/apiKeys');
const { ensureApiAuditTable } = require('../services/apiAudit');
const { ALLOWED_EVENTS, createWebhookEndpoint, ensureWebhookTables, listWebhookEndpoints, revokeWebhookEndpoint } = require('../services/webhooks');
const { handleValidationError, validateApiKeyPayload, validateWebhookPayload } = require('../services/validators');

const router = express.Router();

let tenantColumnsReady = false;
let userColumnsReady = false;
let superadminTablesReady = false;
let superadminSubnamesReady = false;

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeName(value) {
  return String(value || '').trim();
}

function slugifyName(name) {
  const normalized = String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  return normalized || 'empresa';
}

async function ensureTenantColumns() {
  if (tenantColumnsReady) return;
  await db.query(`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS subnombre VARCHAR(140) DEFAULT ''`);
  await db.query(`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS email_notificaciones VARCHAR(255) DEFAULT ''`);
  await db.query(`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS notificaciones_activas BOOLEAN DEFAULT TRUE`);
  tenantColumnsReady = true;
}

async function createUniqueSlug(baseSlug) {
  let candidate = baseSlug;
  let suffix = 2;
  while (true) {
    const exists = await db.query('SELECT 1 FROM empresas WHERE slug = $1 LIMIT 1', [candidate]);
    if (!exists.rows[0]) return candidate;
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

async function ensureUserColumns() {
  if (userColumnsReady) return;
  await db.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS username VARCHAR(60)`);
  await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS unique_username_per_tenant ON usuarios(empresa_id, username) WHERE username IS NOT NULL`);
  await db.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS token_version INT DEFAULT 1`);
  userColumnsReady = true;
}

async function ensureSuperadminTables() {
  if (superadminTablesReady) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS solicitudes_registro (
      id SERIAL PRIMARY KEY,
      empresa_nombre VARCHAR(140) NOT NULL,
      contacto VARCHAR(140) NOT NULL,
      email VARCHAR(140),
      telefono VARCHAR(40),
      rubro VARCHAR(120),
      mensaje TEXT,
      estado VARCHAR(30) DEFAULT 'pendiente',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS superadmin_eventos (
      id SERIAL PRIMARY KEY,
      usuario_id INT REFERENCES usuarios(id) ON DELETE SET NULL,
      empresa_id INT REFERENCES empresas(id) ON DELETE SET NULL,
      tipo VARCHAR(80) NOT NULL,
      descripcion TEXT NOT NULL,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  superadminTablesReady = true;
}

async function ensureSuperadminSubnames() {
  if (superadminSubnamesReady) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS superadmin_subnombres (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(140) UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  superadminSubnamesReady = true;
}

async function logSuperadminEvent(req, { tipo, descripcion, empresaId = null, metadata = {} }) {
  try {
    await ensureSuperadminTables();
    await db.query(
      `INSERT INTO superadmin_eventos (usuario_id, empresa_id, tipo, descripcion, metadata)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [req.user?.id || null, empresaId, tipo, descripcion, JSON.stringify(metadata || {})]
    );
  } catch (error) {
    console.error('No se pudo guardar el evento de superadmin:', error.message);
  }
}

function normalizeUsername(value) {
  return String(value || '').trim().replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 60);
}

function randomPassword() {
  // Simple, human-shareable temp password.
  return `Tmp${Math.random().toString(36).slice(2, 6)}${Date.now().toString().slice(-4)}!`;
}

function normalizeSubnombre(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 140);
}

function resolveSubnameIdentifier(value) {
  const normalized = String(value || '').trim();
  const numeric = Number(normalized);
  return Number.isFinite(numeric) && numeric > 0 ? { byId: true, value: numeric } : { byId: false, value: normalized };
}

// Super Admin: global tenant management (cross-tenant).
router.get('/superadmin/tenants', authenticate, requireRole('superadmin'), async (req, res) => {
  await ensureTenantColumns();
  await ensureUserColumns();
  await ensureSuperadminTables();
  const [tenants, overview, activity, requests] = await Promise.all([
    db.query(
      `SELECT
         e.id,
         e.nombre,
         e.subnombre,
         e.slug,
         e.logo_url,
         e.color_primario,
         e.color_secundario,
         e.fuente,
         e.activa,
         e.email_notificaciones,
         e.notificaciones_activas,
         e.created_at,
         e.updated_at,
         count(DISTINCT u.id)::int AS admin_count,
         count(DISTINCT c.id)::int AS client_count,
         count(DISTINCT p.id)::int AS product_count,
         count(DISTINCT pe.id)::int AS order_count
       FROM empresas e
       LEFT JOIN usuarios u ON u.empresa_id = e.id AND u.rol = 'admin'
       LEFT JOIN clientes c ON c.empresa_id = e.id
       LEFT JOIN productos p ON p.empresa_id = e.id
       LEFT JOIN pedidos pe ON pe.empresa_id = e.id
       GROUP BY e.id
       ORDER BY e.created_at DESC`
    ),
    db.query(
      `SELECT
         count(*)::int AS empresas_total,
         count(*) FILTER (WHERE activa = true)::int AS empresas_activas,
         (SELECT count(*)::int FROM usuarios WHERE rol = 'admin') AS admins_total,
         (SELECT count(*)::int FROM productos) AS productos_total,
         (SELECT count(*)::int FROM pedidos WHERE fecha >= date_trunc('month', CURRENT_DATE)) AS pedidos_mes
       FROM empresas`
      ),
    db.query(
      `SELECT se.id, se.tipo, se.descripcion, se.empresa_id, e.nombre AS empresa_nombre, se.created_at
       FROM superadmin_eventos se
       LEFT JOIN empresas e ON e.id = se.empresa_id
       ORDER BY se.created_at DESC
       LIMIT 8`
    ),
    db.query(
      `SELECT id, empresa_nombre, contacto, email, telefono, rubro, mensaje, estado, created_at
       FROM solicitudes_registro
       ORDER BY created_at DESC
       LIMIT 6`
    )
  ]);
  res.json({
    tenants: tenants.rows,
    overview: overview.rows[0],
    activity: activity.rows,
    registration_requests: requests.rows
  });
});

router.get('/superadmin/subnames', authenticate, requireRole('superadmin'), async (req, res) => {
  await ensureSuperadminSubnames();
  const result = await db.query('SELECT id, nombre, created_at, updated_at FROM superadmin_subnombres ORDER BY created_at DESC, nombre ASC');
  res.json({ subnames: result.rows });
});

router.post('/superadmin/subnames', authenticate, requireRole('superadmin'), async (req, res) => {
  await ensureSuperadminSubnames();
  const nombre = normalizeSubnombre(req.body?.nombre);
  if (!nombre) {
    return res.status(400).json({ message: 'Subnombre es requerido' });
  }
  try {
    const result = await db.query(
      `INSERT INTO superadmin_subnombres (nombre)
       VALUES ($1)
       RETURNING id, nombre, created_at, updated_at`,
      [nombre]
    );
    res.status(201).json({ subname: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Ese subnombre ya existe' });
    }
    throw error;
  }
});

router.patch('/superadmin/subnames/:id', authenticate, requireRole('superadmin'), async (req, res) => {
  await ensureSuperadminSubnames();
  const nombre = normalizeSubnombre(req.body?.nombre);
  if (!nombre) {
    return res.status(400).json({ message: 'Subnombre es requerido' });
  }
  try {
    const identifier = resolveSubnameIdentifier(req.params.id);
    const result = await db.query(
      `UPDATE superadmin_subnombres
       SET nombre = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE ${identifier.byId ? 'id = $2' : 'nombre = $2'}
       RETURNING id, nombre, created_at, updated_at`,
      identifier.byId ? [nombre, identifier.value] : [nombre, identifier.value]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Subnombre no encontrado' });
    res.json({ subname: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Ese subnombre ya existe' });
    }
    throw error;
  }
});

router.delete('/superadmin/subnames/:id', authenticate, requireRole('superadmin'), async (req, res) => {
  await ensureSuperadminSubnames();
  const identifier = resolveSubnameIdentifier(req.params.id);
  const result = await db.query(
    `DELETE FROM superadmin_subnombres WHERE ${identifier.byId ? 'id = $1' : 'nombre = $1'} RETURNING id`,
    [identifier.value]
  );
  if (!result.rows[0]) {
    return res.status(404).json({ message: 'Subnombre no encontrado' });
  }
  res.status(204).send();
});

router.post('/superadmin/tenants', authenticate, requireRole('superadmin'), async (req, res) => {
  await ensureTenantColumns();
  const { nombre, subnombre } = req.body || {};

  if (!nombre) {
    return res.status(400).json({ message: 'Nombre es requerido' });
  }

  const baseSlug = slugifyName(nombre);
  const safeSlug = await createUniqueSlug(baseSlug);
  const safeSubname = normalizeName(subnombre || '').slice(0, 140);

  const result = await db.query(
    `INSERT INTO empresas (nombre, subnombre, slug, logo_url, color_primario, color_secundario, fuente, activa)
     VALUES ($1, $2, $3, '', '#f0f0f0', '#111111', 'Aptos', true)
     RETURNING id, nombre, subnombre, slug, logo_url, color_primario, color_secundario, fuente, activa, email_notificaciones, notificaciones_activas, created_at, updated_at`,
    [String(nombre).trim(), safeSubname, safeSlug]
  );

  await logSuperadminEvent(req, {
    tipo: 'empresa_creada',
    descripcion: `Empresa ${result.rows[0].nombre} creada`,
    empresaId: result.rows[0].id,
    metadata: { slug: result.rows[0].slug }
  });

  res.status(201).json({ tenant: result.rows[0] });
});

router.patch('/superadmin/tenants/:id', authenticate, requireRole('superadmin'), async (req, res) => {
  await ensureTenantColumns();
  const { activa, notificaciones_activas, email_notificaciones, nombre, subnombre } = req.body || {};

  const updates = [];
  const params = [];
  let paramIdx = 1;

  if (nombre !== undefined) {
    const trimmed = normalizeName(nombre);
    if (!trimmed) {
      return res.status(400).json({ message: 'El nombre no puede estar vacío' });
    }
    updates.push(`nombre = $${paramIdx++}`);
    params.push(trimmed);
  }

  if (subnombre !== undefined) {
    updates.push(`subnombre = $${paramIdx++}`);
    params.push(normalizeSubnombre(subnombre));
  }

  if (activa !== undefined) {
    if (typeof activa !== 'boolean') {
      return res.status(400).json({ message: 'Campo "activa" debe ser booleano' });
    }
    updates.push(`activa = $${paramIdx++}`);
    params.push(activa);
  }

  if (notificaciones_activas !== undefined) {
    if (typeof notificaciones_activas !== 'boolean') {
      return res.status(400).json({ message: 'Campo "notificaciones_activas" debe ser booleano' });
    }
    updates.push(`notificaciones_activas = $${paramIdx++}`);
    params.push(notificaciones_activas);
  }

  if (email_notificaciones !== undefined) {
    updates.push(`email_notificaciones = $${paramIdx++}`);
    params.push(email_notificaciones === null ? '' : String(email_notificaciones).trim());
  }

  if (updates.length === 0) {
    return res.status(400).json({ message: 'Se requiere al menos un campo para actualizar' });
  }

  params.push(req.params.id);
  const result = await db.query(
    `UPDATE empresas
     SET ${updates.join(', ')},
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $${paramIdx}
     RETURNING id, nombre, subnombre, slug, logo_url, color_primario, color_secundario, fuente, activa, email_notificaciones, notificaciones_activas, created_at, updated_at`,
    params
  );

  if (!result.rows[0]) {
    return res.status(404).json({ message: 'Tenant no encontrado' });
  }

  if (activa !== undefined) {
    await logSuperadminEvent(req, {
      tipo: activa ? 'empresa_activada' : 'empresa_desactivada',
      descripcion: `Empresa ${result.rows[0].nombre} ${activa ? 'activada' : 'desactivada'}`,
      empresaId: result.rows[0].id,
      metadata: { slug: result.rows[0].slug }
    });
  }

  if (notificaciones_activas !== undefined) {
    await logSuperadminEvent(req, {
      tipo: notificaciones_activas ? 'notificaciones_activadas' : 'notificaciones_desactivadas',
      descripcion: `Notificaciones de la empresa ${result.rows[0].nombre} ${notificaciones_activas ? 'activadas' : 'desactivadas'}`,
      empresaId: result.rows[0].id,
      metadata: { slug: result.rows[0].slug }
    });
  }

  if (email_notificaciones !== undefined) {
    await logSuperadminEvent(req, {
      tipo: 'config_correo_notificaciones',
      descripcion: `Correo de notificaciones de la empresa ${result.rows[0].nombre} actualizado a: ${result.rows[0].email_notificaciones || 'vacío'}`,
      empresaId: result.rows[0].id,
      metadata: { slug: result.rows[0].slug, email: result.rows[0].email_notificaciones }
    });
  }

  if (nombre !== undefined) {
    await logSuperadminEvent(req, {
      tipo: 'empresa_nombre_editado',
      descripcion: `Nombre de empresa actualizado a: ${result.rows[0].nombre}`,
      empresaId: result.rows[0].id,
      metadata: { slug: result.rows[0].slug, nombre: result.rows[0].nombre }
    });
  }

  if (subnombre !== undefined) {
    await logSuperadminEvent(req, {
      tipo: 'empresa_subnombre_editado',
      descripcion: `Subnombre de empresa ${result.rows[0].nombre} actualizado a: ${result.rows[0].subnombre || 'vacío'}`,
      empresaId: result.rows[0].id,
      metadata: { slug: result.rows[0].slug, subnombre: result.rows[0].subnombre }
    });
  }

  res.json({ tenant: result.rows[0] });
});

router.delete('/superadmin/tenants/:id', authenticate, requireRole('superadmin'), async (req, res) => {
  const tenantId = Number(req.params.id);
  if (!tenantId) return res.status(400).json({ message: 'Tenant inválido' });

  const tenant = await db.query('SELECT id, nombre, slug FROM empresas WHERE id = $1 LIMIT 1', [tenantId]);
  if (!tenant.rows[0]) {
    return res.status(404).json({ message: 'Tenant no encontrado' });
  }

  const confirmacion = String(req.body?.confirmacion || '').trim().toLowerCase();
  if (confirmacion !== tenant.rows[0].slug && confirmacion !== 'borrar') {
    return res.status(400).json({ message: `Escribe "${tenant.rows[0].slug}" para confirmar` });
  }

  const result = await db.query(
    `DELETE FROM empresas
     WHERE id = $1
     RETURNING id, nombre`,
    [tenantId]
  );

  if (!result.rows[0]) {
    return res.status(404).json({ message: 'Tenant no encontrado' });
  }

  await logSuperadminEvent(req, {
    tipo: 'empresa_borrada',
    descripcion: `Empresa ${tenant.rows[0].nombre} borrada`,
    empresaId: null,
    metadata: { slug: tenant.rows[0].slug, tenant_id: tenant.rows[0].id }
  });

  res.json({ tenant: result.rows[0] });
});

router.get('/superadmin/tenants/:id/admins', authenticate, requireRole('superadmin'), async (req, res) => {
  await ensureUserColumns();
  const tenantId = Number(req.params.id);
  if (!tenantId) return res.status(400).json({ message: 'Tenant inválido' });

  const tenant = await db.query('SELECT id, nombre, slug, activa FROM empresas WHERE id = $1', [tenantId]);
  if (!tenant.rows[0]) return res.status(404).json({ message: 'Tenant no encontrado' });

  const admins = await db.query(
    `SELECT id, empresa_id, nombre, username, email, rol, created_at, updated_at
     FROM usuarios
     WHERE empresa_id = $1 AND rol = 'admin'
     ORDER BY created_at DESC`,
    [tenantId]
  );

  res.json({ tenant: tenant.rows[0], admins: admins.rows });
});

router.get('/superadmin/tenants/:id/api-keys', authenticate, requireRole('superadmin'), async (req, res) => {
  await ensureApiKeysTable();
  const tenantId = Number(req.params.id);
  if (!tenantId) return res.status(400).json({ message: 'Tenant inválido' });

  const tenant = await db.query('SELECT id, nombre, slug, activa FROM empresas WHERE id = $1 LIMIT 1', [tenantId]);
  if (!tenant.rows[0]) return res.status(404).json({ message: 'Tenant no encontrado' });

  const result = await db.query(
    `SELECT id, empresa_id, nombre, key_prefix, scopes, activa, last_used_at, created_at, revoked_at
     FROM api_keys
     WHERE empresa_id = $1
     ORDER BY created_at DESC`,
    [tenantId]
  );

  res.json({ tenant: tenant.rows[0], api_keys: result.rows });
});

router.post('/superadmin/tenants/:id/api-keys', authenticate, requireRole('superadmin'), async (req, res) => {
  const tenantId = Number(req.params.id);
  if (!tenantId) return res.status(400).json({ message: 'Tenant inválido' });

  const tenant = await db.query('SELECT id, nombre, slug, activa FROM empresas WHERE id = $1 LIMIT 1', [tenantId]);
  if (!tenant.rows[0]) return res.status(404).json({ message: 'Tenant no encontrado' });

  let payload;
  try {
    payload = validateApiKeyPayload(req.body);
  } catch (error) {
    return handleValidationError(error, res, 'Datos de API key invalidos');
  }

  const created = await createApiKey({
    empresaId: tenantId,
    nombre: payload.nombre,
    scopes: payload.scopes,
    createdBy: req.user.id
  });

  await logSuperadminEvent(req, {
    tipo: 'api_key_creada',
    descripcion: `API key ${created.api_key.nombre} creada`,
    empresaId: tenantId,
    metadata: { api_key_id: created.api_key.id, key_prefix: created.api_key.key_prefix, scopes: payload.scopes }
  });

  res.status(201).json({
    tenant: tenant.rows[0],
    api_key: created.api_key,
    plain_key: created.plain_key,
    warning: 'Guarda esta API key ahora. No se volverá a mostrar.'
  });
});

router.patch('/superadmin/api-keys/:id/revoke', authenticate, requireRole('superadmin'), async (req, res) => {
  await ensureApiKeysTable();
  const apiKeyId = Number(req.params.id);
  if (!apiKeyId) return res.status(400).json({ message: 'API key inválida' });

  const result = await db.query(
    `UPDATE api_keys
     SET activa = false,
         revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP)
     WHERE id = $1
     RETURNING id, empresa_id, nombre, key_prefix, scopes, activa, last_used_at, created_at, revoked_at`,
    [apiKeyId]
  );
  if (!result.rows[0]) return res.status(404).json({ message: 'API key no encontrada' });

  await logSuperadminEvent(req, {
    tipo: 'api_key_revocada',
    descripcion: `API key ${result.rows[0].nombre} revocada`,
    empresaId: result.rows[0].empresa_id,
    metadata: { api_key_id: result.rows[0].id, key_prefix: result.rows[0].key_prefix }
  });

  res.json({ api_key: result.rows[0] });
});

router.get('/superadmin/tenants/:id/api-logs', authenticate, requireRole('superadmin'), async (req, res) => {
  await ensureApiAuditTable();
  const tenantId = Number(req.params.id);
  if (!tenantId) return res.status(400).json({ message: 'Tenant inválido' });

  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
  const result = await db.query(
    `SELECT l.id,
            l.empresa_id,
            l.api_key_id,
            ak.nombre AS api_key_nombre,
            ak.key_prefix,
            l.method,
            l.path,
            l.status_code,
            l.duration_ms,
            l.ip,
            l.user_agent,
            l.created_at
     FROM api_request_logs l
     LEFT JOIN api_keys ak ON ak.id = l.api_key_id
     WHERE l.empresa_id = $1
     ORDER BY l.created_at DESC
     LIMIT $2`,
    [tenantId, limit]
  );

  res.json({ logs: result.rows });
});

router.get('/superadmin/tenants/:id/webhooks', authenticate, requireRole('superadmin'), async (req, res) => {
  await ensureWebhookTables();
  const tenantId = Number(req.params.id);
  if (!tenantId) return res.status(400).json({ message: 'Tenant inválido' });

  const tenant = await db.query('SELECT id, nombre, slug, activa FROM empresas WHERE id = $1 LIMIT 1', [tenantId]);
  if (!tenant.rows[0]) return res.status(404).json({ message: 'Tenant no encontrado' });

  res.json({
    tenant: tenant.rows[0],
    events: ALLOWED_EVENTS,
    webhooks: await listWebhookEndpoints(tenantId)
  });
});

router.post('/superadmin/tenants/:id/webhooks', authenticate, requireRole('superadmin'), async (req, res) => {
  const tenantId = Number(req.params.id);
  if (!tenantId) return res.status(400).json({ message: 'Tenant inválido' });

  const tenant = await db.query('SELECT id, nombre, slug, activa FROM empresas WHERE id = $1 LIMIT 1', [tenantId]);
  if (!tenant.rows[0]) return res.status(404).json({ message: 'Tenant no encontrado' });

  let payload;
  try {
    payload = validateWebhookPayload(req.body, ALLOWED_EVENTS);
  } catch (error) {
    return handleValidationError(error, res, 'Datos de webhook invalidos');
  }

  const created = await createWebhookEndpoint({
    empresaId: tenantId,
    nombre: payload.nombre,
    url: payload.url,
    events: payload.events,
    createdBy: req.user.id
  });

  await logSuperadminEvent(req, {
    tipo: 'webhook_creado',
    descripcion: `Webhook ${created.webhook.nombre} creado`,
    empresaId: tenantId,
    metadata: { webhook_id: created.webhook.id, events: payload.events }
  });

  res.status(201).json({
    tenant: tenant.rows[0],
    webhook: created.webhook,
    secret: created.secret,
    warning: 'Guarda este secreto ahora. No se volverá a mostrar.'
  });
});

router.patch('/superadmin/webhooks/:id/revoke', authenticate, requireRole('superadmin'), async (req, res) => {
  const webhookId = Number(req.params.id);
  if (!webhookId) return res.status(400).json({ message: 'Webhook inválido' });

  const webhook = await revokeWebhookEndpoint(webhookId);
  if (!webhook) return res.status(404).json({ message: 'Webhook no encontrado' });

  await logSuperadminEvent(req, {
    tipo: 'webhook_revocado',
    descripcion: `Webhook ${webhook.nombre} revocado`,
    empresaId: webhook.empresa_id,
    metadata: { webhook_id: webhook.id }
  });

  res.json({ webhook });
});

router.get('/superadmin/tenants/:id/webhook-deliveries', authenticate, requireRole('superadmin'), async (req, res) => {
  await ensureWebhookTables();
  const tenantId = Number(req.params.id);
  if (!tenantId) return res.status(400).json({ message: 'Tenant inválido' });
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);

  const result = await db.query(
    `SELECT d.id,
            d.webhook_endpoint_id,
            we.nombre AS webhook_nombre,
            d.event_type,
            d.status_code,
            d.success,
            d.error,
            d.duration_ms,
            d.created_at
     FROM webhook_deliveries d
     LEFT JOIN webhook_endpoints we ON we.id = d.webhook_endpoint_id
     WHERE d.empresa_id = $1
     ORDER BY d.created_at DESC
     LIMIT $2`,
    [tenantId, limit]
  );

  res.json({ deliveries: result.rows });
});

router.post('/superadmin/tenants/:id/open-admin', authenticate, requireRole('superadmin'), async (req, res) => {
  await ensureUserColumns();
  const tenantId = Number(req.params.id);
  if (!tenantId) return res.status(400).json({ message: 'Tenant inválido' });

  const tenant = await db.query('SELECT id, nombre, slug, activa FROM empresas WHERE id = $1 LIMIT 1', [tenantId]);
  if (!tenant.rows[0]) return res.status(404).json({ message: 'Tenant no encontrado' });

  const admins = await db.query(
    `SELECT u.id, u.empresa_id, u.nombre, u.username, u.email, u.rol, c.id AS cliente_id
     FROM usuarios u
     LEFT JOIN clientes c ON c.usuario_id = u.id
     WHERE u.empresa_id = $1 AND u.rol = 'admin'
     ORDER BY u.created_at ASC
     LIMIT 1`,
    [tenantId]
  );

  const admin = admins.rows[0];
  if (!admin) {
    return res.status(404).json({ message: 'La empresa no tiene un admin para abrir' });
  }

  const payload = {
    id: admin.id,
    empresa_id: admin.empresa_id,
    rol: admin.rol,
    cliente_id: admin.cliente_id || null
  };

  const token = signToken(payload);

  await logSuperadminEvent(req, {
    tipo: 'admin_abierto',
    descripcion: `Sesión de admin abierta para ${tenant.rows[0].nombre}`,
    empresaId: tenantId,
    metadata: { admin_id: admin.id }
  });

  res.json({
    token,
    user: {
      id: admin.id,
      empresa_id: admin.empresa_id,
      nombre: admin.nombre,
      username: admin.username,
      email: admin.email,
      rol: admin.rol,
      cliente_id: admin.cliente_id || null
    },
    tenant: tenant.rows[0],
    impersonation: {
      superadmin_id: req.user.id,
      tenant_id: tenantId,
      admin_id: admin.id
    }
  });
});

router.post('/superadmin/tenants/:id/admins', authenticate, requireRole('superadmin'), async (req, res) => {
  await ensureUserColumns();
  const tenantId = Number(req.params.id);
  if (!tenantId) return res.status(400).json({ message: 'Tenant inválido' });

  const tenant = await db.query('SELECT id, nombre, slug, activa FROM empresas WHERE id = $1', [tenantId]);
  if (!tenant.rows[0]) return res.status(404).json({ message: 'Tenant no encontrado' });

  const nombre = normalizeName(req.body?.nombre);
  const username = normalizeUsername(req.body?.username);
  const email = normalizeEmail(req.body?.email || `${username}@${tenant.rows[0].slug}.local`);
  const password = String(req.body?.password || '').trim() || randomPassword();

  if (!nombre || !username) return res.status(400).json({ message: 'Nombre y usuario son requeridos' });

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const created = await db.query(
      `INSERT INTO usuarios (empresa_id, nombre, username, email, password_hash, rol)
       VALUES ($1, $2, $3, $4, $5, 'admin')
       RETURNING id, empresa_id, nombre, username, email, rol, created_at, updated_at`,
      [tenantId, nombre, username, email, passwordHash]
    );

    await logSuperadminEvent(req, {
      tipo: 'admin_creado',
      descripcion: `Admin ${created.rows[0].username || created.rows[0].nombre} creado`,
      empresaId: tenantId,
      metadata: { admin_id: created.rows[0].id }
    });

    res.status(201).json({
      tenant: tenant.rows[0],
      admin: created.rows[0],
      temp_password: password
    });
  } catch (error) {
    res.status(error.code === '23505' ? 409 : 500).json({
      message: error.code === '23505' ? 'Ya existe ese usuario en este tenant' : 'No se pudo crear el admin'
    });
  }
});

router.post('/superadmin/admins/:id/reset-password', authenticate, requireRole('superadmin'), async (req, res) => {
  const userId = Number(req.params.id);
  if (!userId) return res.status(400).json({ message: 'Admin inválido' });

  const password = String(req.body?.password || '').trim() || randomPassword();
  if (password.length < 8) {
    return res.status(400).json({ message: 'La nueva contraseña debe tener al menos 8 caracteres' });
  }
  const passwordHash = await bcrypt.hash(password, 10);

  const result = await db.query(
    `UPDATE usuarios
     SET password_hash = $1,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2 AND rol = 'admin'
     RETURNING id, empresa_id, nombre, username, email, rol, created_at, updated_at`,
    [passwordHash, userId]
  );

  if (!result.rows[0]) return res.status(404).json({ message: 'Admin no encontrado' });

  await logSuperadminEvent(req, {
    tipo: 'admin_password',
    descripcion: `Contraseña temporal regenerada para ${result.rows[0].username || result.rows[0].nombre}`,
    empresaId: result.rows[0].empresa_id,
    metadata: { admin_id: result.rows[0].id }
  });

  res.json({ admin: result.rows[0], temp_password: password });
});

router.patch('/superadmin/admins/:id', authenticate, requireRole('superadmin'), async (req, res) => {
  await ensureUserColumns();
  const userId = Number(req.params.id);
  if (!userId) return res.status(400).json({ message: 'Admin inválido' });

  const current = await db.query(
    `SELECT id, empresa_id, nombre, username, email
     FROM usuarios
     WHERE id = $1 AND rol = 'admin'
     LIMIT 1`,
    [userId]
  );
  if (!current.rows[0]) return res.status(404).json({ message: 'Admin no encontrado' });

  const curr = current.rows[0];
  const nombre = normalizeName(req.body?.nombre) || curr.nombre;
  const username = normalizeUsername(req.body?.username) || curr.username;
  const password = String(req.body?.password || '').trim();

  if (!username) return res.status(400).json({ message: 'Usuario inválido' });
  if (password && password.length < 8) {
    return res.status(400).json({ message: 'La nueva contraseña debe tener al menos 8 caracteres' });
  }

  const tenant = await db.query('SELECT slug FROM empresas WHERE id = $1 LIMIT 1', [curr.empresa_id]);
  const safeSlug = tenant.rows[0]?.slug || 'empresa';
  const email = normalizeEmail(req.body?.email || `${username}@${safeSlug}.local`);

  try {
    let result;
    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      result = await db.query(
        `UPDATE usuarios
         SET nombre = $1,
             username = $2,
             email = $3,
             password_hash = $4,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $5 AND rol = 'admin'
         RETURNING id, empresa_id, nombre, username, email, rol, created_at, updated_at`,
        [nombre, username, email, passwordHash, userId]
      );
    } else {
      result = await db.query(
        `UPDATE usuarios
         SET nombre = $1,
             username = $2,
             email = $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4 AND rol = 'admin'
         RETURNING id, empresa_id, nombre, username, email, rol, created_at, updated_at`,
        [nombre, username, email, userId]
      );
    }
    await logSuperadminEvent(req, {
      tipo: 'admin_actualizado',
      descripcion: `Admin ${result.rows[0].username || result.rows[0].nombre} actualizado`,
      empresaId: result.rows[0].empresa_id,
      metadata: { admin_id: result.rows[0].id, password_changed: Boolean(password) }
    });

    res.json({ admin: result.rows[0], temp_password: password || null });
  } catch (error) {
    res.status(error.code === '23505' ? 409 : 500).json({
      message: error.code === '23505' ? 'Ya existe ese usuario en este tenant' : 'No se pudo actualizar el admin'
    });
  }
});

router.delete('/superadmin/admins/:id', authenticate, requireRole('superadmin'), async (req, res) => {
  const userId = Number(req.params.id);
  if (!userId) return res.status(400).json({ message: 'Admin inválido' });

  const result = await db.query(
    `DELETE FROM usuarios
     WHERE id = $1 AND rol = 'admin'
     RETURNING id, empresa_id, username, nombre`,
    [userId]
  );
  if (!result.rows[0]) return res.status(404).json({ message: 'Admin no encontrado' });
  await logSuperadminEvent(req, {
    tipo: 'admin_eliminado',
    descripcion: `Admin ${result.rows[0].username || result.rows[0].nombre} eliminado`,
    empresaId: result.rows[0].empresa_id,
    metadata: { admin_id: result.rows[0].id }
  });
  return res.status(204).send();
});

module.exports = router;
