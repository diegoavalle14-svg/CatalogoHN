const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { signToken } = require('../middleware/auth');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
let userProfileColumnsReady = false;

async function ensureUserProfileColumns() {
  if (userProfileColumnsReady) return;
  await db.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS username VARCHAR(80)`);
  await db.query(`UPDATE usuarios SET username = lower(split_part(email, '@', 1)) WHERE username IS NULL OR username = ''`);
  userProfileColumnsReady = true;
}

router.post('/login', async (req, res) => {
  const { password } = req.body;
  const login = String(req.body.username || req.body.email || '').trim().toLowerCase();
  const aliases = {
    cliente1: 'cliente1@autorepuestos.com',
    admin: 'admin@kolben.com',
    superadmin: 'superadmin@catalogohn.com'
  };
  const loginValue = aliases[login] || login;
  const lookupValues = [...new Set([login, loginValue].filter(Boolean))];

  if (!login || !password) {
    return res.status(400).json({ message: 'Usuario y contraseña son requeridos' });
  }

  try {
    await ensureUserProfileColumns();
    const tenantId = req.tenant?.id || null;
    const result = await db.query(
      `SELECT u.*, c.id AS cliente_id, c.condicion_credito, c.activo AS cliente_activo
       FROM usuarios u
       LEFT JOIN clientes c ON c.usuario_id = u.id
       WHERE (lower(u.email) = ANY($1::text[]) OR lower(COALESCE(u.username, '')) = ANY($1::text[]))
         AND (u.empresa_id = $2 OR u.rol = 'superadmin')
       LIMIT 1`,
      [lookupValues, tenantId]
    );
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }
    if (user.rol === 'cliente' && user.cliente_activo === false) {
      return res.status(403).json({ message: 'Cliente inactivo. Contacte al administrador.' });
    }

    await db.query(
      'INSERT INTO accesos_log (usuario_id, ip, user_agent, geolocalizacion) VALUES ($1, $2, $3, $4)',
      [user.id, req.ip, req.header('user-agent') || '', 'Pendiente de proveedor GeoIP']
    ).catch(() => {});

    return res.json({ token: signToken(user), user: sanitizeUser(user), tenant: user.rol === 'superadmin' ? req.tenant : req.tenant });
  } catch (error) {
    return res.status(500).json({ message: 'No se pudo validar el acceso' });
  }
});

router.post('/change-password', authenticate, async (req, res) => {
  const currentPassword = String(req.body?.current_password || '');
  const nextPassword = String(req.body?.new_password || '');

  if (!currentPassword || !nextPassword) {
    return res.status(400).json({ message: 'Contraseña actual y nueva contraseña son requeridas' });
  }
  if (nextPassword.length < 8) {
    return res.status(400).json({ message: 'La nueva contraseña debe tener al menos 8 caracteres' });
  }

  try {
    const result = await db.query('SELECT id, password_hash FROM usuarios WHERE id = $1 LIMIT 1', [req.user.id]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) {
      return res.status(401).json({ message: 'La contraseña actual no es correcta' });
    }

    const passwordHash = await bcrypt.hash(nextPassword, 10);
    await db.query(
      'UPDATE usuarios SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [passwordHash, req.user.id]
    );
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ message: 'No se pudo cambiar la contraseña' });
  }
});

function sanitizeUser(user) {
  const { password_hash, ...safeUser } = user;
  return safeUser;
}

module.exports = router;
