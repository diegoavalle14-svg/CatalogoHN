const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { signToken } = require('../middleware/auth');
const { authenticate } = require('../middleware/auth');
const { sendMail, getMailerConfig } = require('../services/mailer');

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
      `SELECT u.*, c.id AS cliente_id, c.condicion_credito, c.activo AS cliente_activo, c.aplica_isv
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

router.post('/forgot-password', async (req, res) => {
  const login = String(req.body?.username || req.body?.email || '').trim().toLowerCase();
  const tenantSlug = String(req.body?.tenantSlug || '').trim().toLowerCase();
  const aliases = {
    cliente1: 'cliente1@autorepuestos.com',
    admin: 'admin@kolben.com',
    superadmin: 'superadmin@catalogohn.com'
  };
  const loginValue = aliases[login] || login;
  const lookupValues = [...new Set([login, loginValue].filter(Boolean))];

  if (!login) {
    return res.status(400).json({ message: 'Usuario o correo requerido' });
  }

  try {
    await ensureUserProfileColumns();
    let tenantId = req.tenant?.id || null;
    if (tenantSlug) {
      const tenantResult = await db.query(
        'SELECT id FROM empresas WHERE lower(slug) = $1 LIMIT 1',
        [tenantSlug]
      );
      tenantId = tenantResult.rows[0]?.id || tenantId;
    }
    const result = await db.query(
      `SELECT u.id, u.nombre, u.username, u.email, u.rol, e.nombre AS empresa_nombre, e.slug AS empresa_slug
       FROM usuarios u
       LEFT JOIN empresas e ON e.id = u.empresa_id
       WHERE (lower(u.email) = ANY($1::text[]) OR lower(COALESCE(u.username, '')) = ANY($1::text[]))
         AND (u.empresa_id = $2 OR u.rol = 'superadmin')
         AND (u.rol = 'superadmin' OR $3 = '' OR lower(COALESCE(e.slug, '')) = $3)
       LIMIT 1`,
      [lookupValues, tenantId, tenantSlug]
    );
    const user = result.rows[0];
    if (!user) {
      return res.json({ ok: true, message: 'Si el usuario existe, se enviará una contraseña temporal.' });
    }

    const tempPassword = randomPassword();
    const recoveryEmail = user.rol === 'superadmin'
      ? String(process.env.SUPERADMIN_RECOVERY_EMAIL || 'diego.avalle14@gmail.com').trim().toLowerCase()
      : String(user.email || '').trim().toLowerCase();

    const mail = {
      to: recoveryEmail,
      subject: 'Recuperación de contraseña CatalogoHN',
      text: `Hola ${user.nombre || user.username || 'usuario'},\n\nTu contraseña temporal es: ${tempPassword}\n\nIngresa a CatalogoHN y cámbiala después de entrar.\n`,
      html: `<p>Hola ${escapeHtml(user.nombre || user.username || 'usuario')},</p><p>Tu contraseña temporal es: <b>${escapeHtml(tempPassword)}</b></p><p>Ingresa a CatalogoHN y cámbiala después de entrar.</p>`
    };

    const mailResult = await sendMail(mail);
    if (!mailResult.ok && !mailResult.skipped) {
      return res.status(500).json({ message: 'No se pudo enviar la recuperación' });
    }

    if (mailResult.skipped || !getMailerConfig().enabled) {
      return res.status(503).json({
        message: 'La recuperación por correo requiere configurar SMTP en el servidor.'
      });
    }

    const passwordHash = await bcrypt.hash(tempPassword, 10);
    await db.query(
      'UPDATE usuarios SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [passwordHash, user.id]
    );

    return res.json({
      ok: true,
      message: 'Se envió una contraseña temporal al correo registrado.'
    });
  } catch (error) {
    return res.status(500).json({ message: 'No se pudo procesar la recuperación' });
  }
});

function sanitizeUser(user) {
  const { password_hash, ...safeUser } = user;
  return safeUser;
}

function randomPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let output = '';
  for (let i = 0; i < 10; i += 1) {
    output += chars[Math.floor(Math.random() * chars.length)];
  }
  return output;
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

module.exports = router;
