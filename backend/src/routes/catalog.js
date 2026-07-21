const express = require('express');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { ensureProductInventoryColumns, ensureCategoryImageColumn, ensurePriceVisibilityColumn, ensurePricePromoActiveColumn, ensureBranchActiveColumn } = require('../services/schemaGuards');
const { sendMail } = require('../services/mailer');

const router = express.Router();
let tenantProfileColumnsReady = false;
let registrationRequestsReady = false;
let supportRequestsReady = false;

async function ensureTenantProfileColumns() {
  if (tenantProfileColumnsReady) return;
  await db.query(`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS subnombre VARCHAR(140) DEFAULT ''`);
  await db.query(`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS subnombre_size INT DEFAULT 18`);
  tenantProfileColumnsReady = true;
}

async function ensureRegistrationRequestsTable() {
  if (registrationRequestsReady) return;
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
  registrationRequestsReady = true;
}

async function ensureSupportRequestsTable() {
  if (supportRequestsReady) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS solicitudes_soporte (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(140) NOT NULL,
      contacto VARCHAR(140) NOT NULL,
      tipo_problema VARCHAR(100) DEFAULT 'Acceso / Contraseña',
      descripcion TEXT NOT NULL,
      estado VARCHAR(30) DEFAULT 'pendiente',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  supportRequestsReady = true;
}

router.get('/tenants/public', async (req, res) => {
  try {
    await ensureTenantProfileColumns();
    const result = await db.query(
      `SELECT id, nombre, subnombre, subnombre_size, slug, logo_url, color_primario, color_secundario, fuente, activa
       FROM empresas
       WHERE activa = true
       ORDER BY created_at ASC`
    );
    res.json({ tenants: result.rows });
  } catch (error) {
    res.status(500).json({ message: 'No se pudieron cargar las empresas' });
  }
});

router.post('/registration-requests', async (req, res) => {
  try {
    await ensureRegistrationRequestsTable();
    const empresaNombre = String(req.body?.empresa_nombre || '').trim();
    const contacto = String(req.body?.contacto || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const telefono = String(req.body?.telefono || '').trim();
    const rubro = String(req.body?.rubro || '').trim();
    const mensaje = String(req.body?.mensaje || '').trim();

    if (!empresaNombre || !contacto || (!email && !telefono)) {
      return res.status(400).json({ message: 'Empresa, contacto y correo o teléfono son requeridos' });
    }

    const result = await db.query(
      `INSERT INTO solicitudes_registro (empresa_nombre, contacto, email, telefono, rubro, mensaje)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, empresa_nombre, contacto, email, telefono, rubro, mensaje, estado, created_at`,
      [
        empresaNombre.slice(0, 140),
        contacto.slice(0, 140),
        email.slice(0, 140),
        telefono.slice(0, 40),
        rubro.slice(0, 120),
        mensaje.slice(0, 1000)
      ]
    );

    const newRequest = result.rows[0];

    // Enviar notificación por correo
    const notifyEmail = process.env.EMAIL_ADMIN_NOTIFY || process.env.SMTP_USER;
    if (notifyEmail) {
      sendMail({
        to: notifyEmail,
        subject: `📋 Nueva Solicitud de Acceso: ${empresaNombre}`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #111;">
            <h2 style="color: #ff6820;">Nueva Solicitud de Acceso a CatalogoHN</h2>
            <p><strong>Empresa:</strong> ${empresaNombre}</p>
            <p><strong>Contacto:</strong> ${contacto}</p>
            <p><strong>Correo:</strong> ${email || 'N/A'}</p>
            <p><strong>Teléfono:</strong> ${telefono || 'N/A'}</p>
            <p><strong>Rubro:</strong> ${rubro || 'N/A'}</p>
            <p><strong>Mensaje:</strong></p>
            <blockquote style="background: #f4f5f8; padding: 12px; border-left: 4px solid #ff6820; margin: 0;">
              ${(mensaje || 'Sin mensaje adicional').replace(/\n/g, '<br/>')}
            </blockquote>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;"/>
            <small style="color: #666;">Enviado automáticamente desde CatalogoHN</small>
          </div>
        `
      }).catch(err => console.error('[Registration Mail Error]:', err));
    }

    res.status(201).json({ request: newRequest });
  } catch (error) {
    res.status(500).json({ message: 'No se pudo registrar la solicitud' });
  }
});

router.post('/support-requests', async (req, res) => {
  try {
    await ensureSupportRequestsTable();
    const nombre = String(req.body?.nombre || '').trim();
    const contacto = String(req.body?.contacto || '').trim();
    const tipoProblema = String(req.body?.tipo_problema || 'Acceso / Contraseña').trim();
    const descripcion = String(req.body?.descripcion || '').trim();

    if (!nombre || !contacto || !descripcion) {
      return res.status(400).json({ message: 'Nombre, contacto (correo/teléfono) y descripción son requeridos' });
    }

    const result = await db.query(
      `INSERT INTO solicitudes_soporte (nombre, contacto, tipo_problema, descripcion)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nombre, contacto, tipo_problema, descripcion, estado, created_at`,
      [
        nombre.slice(0, 140),
        contacto.slice(0, 140),
        tipoProblema.slice(0, 100),
        descripcion.slice(0, 1000)
      ]
    );

    const newRequest = result.rows[0];

    // Enviar notificación por correo
    const notifyEmail = process.env.EMAIL_ADMIN_NOTIFY || process.env.SMTP_USER;
    if (notifyEmail) {
      sendMail({
        to: notifyEmail,
        subject: `🆘 Nueva Solicitud de Soporte: ${nombre}`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #111;">
            <h2 style="color: #ff6820;">Nueva Solicitud de Soporte Técnico</h2>
            <p><strong>Nombre / Empresa:</strong> ${nombre}</p>
            <p><strong>Contacto (Correo/Tel):</strong> ${contacto}</p>
            <p><strong>Tipo de Problema:</strong> ${tipoProblema}</p>
            <p><strong>Descripción del Problema:</strong></p>
            <blockquote style="background: #f4f5f8; padding: 12px; border-left: 4px solid #ff6820; margin: 0;">
              ${descripcion.replace(/\n/g, '<br/>')}
            </blockquote>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;"/>
            <small style="color: #666;">Enviado automáticamente desde CatalogoHN</small>
          </div>
        `
      }).catch(err => console.error('[Support Mail Error]:', err));
    }

    res.status(201).json({ request: newRequest });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'No se pudo registrar la solicitud de soporte' });
  }
});

router.get('/tenant', (req, res) => {
  res.json({ tenant: req.tenant });
});

router.get('/catalog', authenticate, async (req, res) => {
  try {
    await ensureProductInventoryColumns();
    await ensureCategoryImageColumn();
    await ensurePriceVisibilityColumn();
    await ensurePricePromoActiveColumn();
    await ensureBranchActiveColumn();
    const [brands, categories, products, branches, currentUser] = await Promise.all([
      db.query('SELECT * FROM marcas WHERE empresa_id = $1 ORDER BY posicion, nombre', [req.tenant.id]),
      db.query('SELECT * FROM categorias WHERE empresa_id = $1 ORDER BY posicion, nombre', [req.tenant.id]),
      db.query(
        `SELECT p.*, m.nombre AS marca, m.logo_url AS marca_logo_url, c.nombre AS categoria,
          COALESCE(json_agg(DISTINCT pi.url) FILTER (WHERE pi.url IS NOT NULL), '[]') AS imagenes,
          pr.precio,
          pr.precio_promocion,
          COALESCE(pr.promo_activa, false) AS promo_activa,
          CASE
            WHEN COALESCE(pr.promo_activa, false) = true AND pr.precio_promocion IS NOT NULL THEN pr.precio_promocion
            ELSE pr.precio
          END AS precio_final,
          (COALESCE(pr.promo_activa, false) = true AND pr.precio_promocion IS NOT NULL) AS en_promocion
        FROM productos p
        LEFT JOIN marcas m ON m.id = p.marca_id
        LEFT JOIN categorias c ON c.id = p.categoria_id
        LEFT JOIN producto_imagenes pi ON pi.producto_id = p.id
        LEFT JOIN cliente_lista_precio clp ON clp.cliente_id = $2
        LEFT JOIN precios pr ON pr.producto_id = p.id AND pr.lista_precio_id = clp.lista_precio_id
        WHERE p.empresa_id = $1
          AND p.visible = true
          AND COALESCE(pr.visible_cliente, true) = true
        GROUP BY p.id, m.nombre, m.logo_url, c.nombre, pr.precio, pr.precio_promocion, pr.promo_activa
        ORDER BY p.posicion, p.created_at DESC`,
        [req.tenant.id, req.user.cliente_id]
      ),
      req.user.cliente_id
        ? queryClientBranches(req.user.cliente_id)
        : Promise.resolve({ rows: [] }),
      queryCatalogUser(req.user.id)
    ]);

    res.json({
      tenant: req.tenant,
      user: currentUser,
      marcas: brands.rows,
      categorias: categories.rows,
      productos: products.rows,
      sucursales: branches.rows
    });
  } catch (error) {
    res.status(500).json({ message: 'No se pudo cargar el catálogo' });
  }
});

async function queryCatalogUser(userId) {
  const result = await db.query(
    `SELECT u.id,
            u.empresa_id,
            u.nombre,
            u.username,
            u.email,
            u.rol,
            c.id AS cliente_id,
            c.condicion_credito,
            c.activo AS cliente_activo,
            c.aplica_isv
     FROM usuarios u
     LEFT JOIN clientes c ON c.usuario_id = u.id
     WHERE u.id = $1
     LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
}

async function queryClientBranches(clientId) {
  const branches = await db.query('SELECT * FROM sucursales WHERE cliente_id = $1 AND COALESCE(activo, true) = true ORDER BY id', [clientId]);
  if (branches.rows.length > 0) return branches;
  const created = await db.query(
    `INSERT INTO sucursales (cliente_id, nombre, direccion)
     VALUES ($1, 'Principal', 'Dirección pendiente')
     RETURNING *`,
    [clientId]
  );
  return created;
}

module.exports = router;
