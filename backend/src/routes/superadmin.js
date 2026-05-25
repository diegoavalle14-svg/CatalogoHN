const express = require('express');
const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// Super Admin: global tenant management (cross-tenant).
router.get('/superadmin/tenants', authenticate, requireRole('superadmin'), async (req, res) => {
  const result = await db.query(
    `SELECT id, nombre, slug, logo_url, color_primario, color_secundario, fuente, activa, created_at, updated_at
     FROM empresas
     ORDER BY created_at DESC`
  );
  res.json({ tenants: result.rows });
});

router.post('/superadmin/tenants', authenticate, requireRole('superadmin'), async (req, res) => {
  const { nombre, slug } = req.body || {};

  if (!nombre || !slug) {
    return res.status(400).json({ message: 'Nombre y slug son requeridos' });
  }

  const safeSlug = String(slug).trim().toLowerCase();
  if (!/^[a-z0-9-]{2,50}$/.test(safeSlug) || safeSlug.startsWith('-') || safeSlug.endsWith('-')) {
    return res.status(400).json({ message: 'Slug invalido (usa letras, numeros y guiones)' });
  }

  const result = await db.query(
    `INSERT INTO empresas (nombre, slug, activa)
     VALUES ($1, $2, true)
     RETURNING id, nombre, slug, logo_url, color_primario, color_secundario, fuente, activa, created_at, updated_at`,
    [String(nombre).trim(), safeSlug]
  );

  res.status(201).json({ tenant: result.rows[0] });
});

router.patch('/superadmin/tenants/:id', authenticate, requireRole('superadmin'), async (req, res) => {
  const { activa } = req.body || {};
  if (typeof activa !== 'boolean') {
    return res.status(400).json({ message: 'Campo "activa" es requerido' });
  }

  const result = await db.query(
    `UPDATE empresas
     SET activa = $1,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2
     RETURNING id, nombre, slug, logo_url, color_primario, color_secundario, fuente, activa, created_at, updated_at`,
    [activa, req.params.id]
  );

  if (!result.rows[0]) {
    return res.status(404).json({ message: 'Tenant no encontrado' });
  }

  res.json({ tenant: result.rows[0] });
});

module.exports = router;

