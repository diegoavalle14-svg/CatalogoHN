const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const mock = require('../services/mockData');
const { signToken } = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { password } = req.body;
  const login = String(req.body.username || req.body.email || '').trim().toLowerCase();
  const aliases = {
    cliente1: 'cliente1@autorepuestos.com',
    admin: 'admin@kolben.com',
    superadmin: 'superadmin@catalogohn.com'
  };
  const email = aliases[login] || login;

  if (!login || !password) {
    return res.status(400).json({ message: 'Usuario y contrasena son requeridos' });
  }

  try {
    const result = await db.query(
      `SELECT u.*, c.id AS cliente_id, c.condicion_credito
       FROM usuarios u
       LEFT JOIN clientes c ON c.usuario_id = u.id
       WHERE lower(u.email) = lower($1)
         AND (u.empresa_id = $2 OR u.rol = 'superadmin')
       LIMIT 1`,
      [email, req.tenant.id]
    );
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ message: 'Credenciales invalidas' });
    }

    await db.query(
      'INSERT INTO accesos_log (usuario_id, ip, user_agent, geolocalizacion) VALUES ($1, $2, $3, $4)',
      [user.id, req.ip, req.header('user-agent') || '', 'Pendiente de proveedor GeoIP']
    ).catch(() => {});

    return res.json({ token: signToken(user), user: sanitizeUser(user), tenant: req.tenant });
  } catch (error) {
    const user = mock.usuarios.find((candidate) => candidate.email.toLowerCase() === email.toLowerCase());
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ message: 'Credenciales invalidas' });
    }

    return res.json({ token: signToken(user), user: sanitizeUser(user), tenant: mock.empresa, mode: 'mock' });
  }
});

function sanitizeUser(user) {
  const { password_hash, ...safeUser } = user;
  return safeUser;
}

module.exports = router;
