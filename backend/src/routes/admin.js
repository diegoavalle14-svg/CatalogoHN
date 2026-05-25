const express = require('express');
const db = require('../config/database');
const mock = require('../services/mockData');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/admin/summary', authenticate, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const [products, clients, orders, access] = await Promise.all([
      db.query('SELECT count(*)::int AS total FROM productos WHERE empresa_id = $1', [req.tenant.id]),
      db.query('SELECT count(*)::int AS total FROM clientes WHERE empresa_id = $1', [req.tenant.id]),
      db.query('SELECT count(*)::int AS total FROM pedidos WHERE empresa_id = $1', [req.tenant.id]),
      db.query(
        `SELECT u.nombre, u.email, a.fecha, a.ip, a.user_agent, a.geolocalizacion
         FROM accesos_log a
         JOIN usuarios u ON u.id = a.usuario_id
         WHERE u.empresa_id = $1
         ORDER BY a.fecha DESC
         LIMIT 10`,
        [req.tenant.id]
      )
    ]);

    res.json({
      totals: {
        productos: products.rows[0].total,
        clientes: clients.rows[0].total,
        pedidos: orders.rows[0].total
      },
      accesos: access.rows,
      tenant: req.tenant
    });
  } catch (error) {
    res.json({
      totals: { productos: mock.productos.length, clientes: 1, pedidos: mock.pedidos.length },
      accesos: [
        {
          nombre: 'Auto Repuestos El Centro',
          email: 'cliente1@autorepuestos.com',
          fecha: new Date().toISOString(),
          ip: '190.0.0.10',
          user_agent: 'iPhone / Safari',
          geolocalizacion: 'Tegucigalpa, Honduras'
        }
      ],
      tenant: mock.empresa,
      mode: 'mock'
    });
  }
});

router.patch('/admin/brand', authenticate, requireRole('admin', 'superadmin'), async (req, res) => {
  const { logo_url, color_primario, color_secundario, fuente } = req.body;
  try {
    const result = await db.query(
      `UPDATE empresas
       SET logo_url = COALESCE($1, logo_url),
           color_primario = COALESCE($2, color_primario),
           color_secundario = COALESCE($3, color_secundario),
           fuente = COALESCE($4, fuente),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [logo_url, color_primario, color_secundario, fuente, req.tenant.id]
    );
    res.json({ tenant: result.rows[0] });
  } catch (error) {
    res.json({ tenant: { ...mock.empresa, logo_url, color_primario, color_secundario, fuente }, mode: 'mock' });
  }
});

module.exports = router;
