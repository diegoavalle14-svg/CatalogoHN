const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

let tenantColumnsReady = false;
let userColumnsReady = false;

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
  userColumnsReady = true;
}

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 60);
}

function randomPassword() {
  // Simple, human-shareable temp password.
  return `Tmp${Math.random().toString(36).slice(2, 6)}${Date.now().toString().slice(-4)}!`;
}

// Super Admin: global tenant management (cross-tenant).
router.get('/superadmin/tenants', authenticate, requireRole('superadmin'), async (req, res) => {
  await ensureTenantColumns();
  const result = await db.query(
    `SELECT id, nombre, subnombre, slug, logo_url, color_primario, color_secundario, fuente, activa, created_at, updated_at
     FROM empresas
     ORDER BY created_at DESC`
  );
  res.json({ tenants: result.rows });
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
     VALUES ($1, $2, $3, '', '#F5C200', '#111111', 'Barlow', true)
     RETURNING id, nombre, subnombre, slug, logo_url, color_primario, color_secundario, fuente, activa, created_at, updated_at`,
    [String(nombre).trim(), safeSubname, safeSlug]
  );

  res.status(201).json({ tenant: result.rows[0] });
});

router.patch('/superadmin/tenants/:id', authenticate, requireRole('superadmin'), async (req, res) => {
  await ensureTenantColumns();
  const { activa } = req.body || {};
  if (typeof activa !== 'boolean') {
    return res.status(400).json({ message: 'Campo "activa" es requerido' });
  }

  const result = await db.query(
    `UPDATE empresas
     SET activa = $1,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2
     RETURNING id, nombre, subnombre, slug, logo_url, color_primario, color_secundario, fuente, activa, created_at, updated_at`,
    [activa, req.params.id]
  );

  if (!result.rows[0]) {
    return res.status(404).json({ message: 'Tenant no encontrado' });
  }

  res.json({ tenant: result.rows[0] });
});

router.get('/superadmin/tenants/:id/admins', authenticate, requireRole('superadmin'), async (req, res) => {
  await ensureUserColumns();
  const tenantId = Number(req.params.id);
  if (!tenantId) return res.status(400).json({ message: 'Tenant invalido' });

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

router.post('/superadmin/tenants/:id/admins', authenticate, requireRole('superadmin'), async (req, res) => {
  await ensureUserColumns();
  const tenantId = Number(req.params.id);
  if (!tenantId) return res.status(400).json({ message: 'Tenant invalido' });

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
  if (!userId) return res.status(400).json({ message: 'Admin invalido' });

  const password = String(req.body?.password || '').trim() || randomPassword();
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

  res.json({ admin: result.rows[0], temp_password: password });
});

router.patch('/superadmin/admins/:id', authenticate, requireRole('superadmin'), async (req, res) => {
  await ensureUserColumns();
  const userId = Number(req.params.id);
  if (!userId) return res.status(400).json({ message: 'Admin invalido' });

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

  if (!username) return res.status(400).json({ message: 'Usuario invalido' });

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
    res.json({ admin: result.rows[0] });
  } catch (error) {
    res.status(error.code === '23505' ? 409 : 500).json({
      message: error.code === '23505' ? 'Ya existe ese usuario en este tenant' : 'No se pudo actualizar el admin'
    });
  }
});

router.delete('/superadmin/admins/:id', authenticate, requireRole('superadmin'), async (req, res) => {
  const userId = Number(req.params.id);
  if (!userId) return res.status(400).json({ message: 'Admin invalido' });

  const result = await db.query(
    `DELETE FROM usuarios
     WHERE id = $1 AND rol = 'admin'
     RETURNING id`,
    [userId]
  );
  if (!result.rows[0]) return res.status(404).json({ message: 'Admin no encontrado' });
  return res.status(204).send();
});

module.exports = router;
