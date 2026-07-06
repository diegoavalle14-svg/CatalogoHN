const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const multer = require('multer');
const sharp = require('sharp');
const { ensureProductInventoryColumns, ensureCategoryImageColumn, ensurePriceVisibilityColumn, ensurePricePromoActiveColumn, ensureBranchActiveColumn } = require('../services/schemaGuards');

const router = express.Router();
let tenantProfileColumnsReady = false;
let clientPriceListConstraintReady = false;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Solo se permiten imagenes'));
    cb(null, true);
  }
});

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
    res.status(500).json({ message: 'No se pudo cargar el resumen administrativo' });
  }
});

router.patch('/admin/brand', authenticate, requireRole('admin', 'superadmin'), async (req, res) => {
  const { nombre, subnombre, logo_url, color_primario, color_secundario, fuente } = req.body;
  try {
    if (!tenantProfileColumnsReady) {
      await db.query(`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS subnombre VARCHAR(140) DEFAULT ''`);
      tenantProfileColumnsReady = true;
    }
    const result = await db.query(
      `UPDATE empresas
       SET nombre = COALESCE($1, nombre),
           subnombre = COALESCE($2, subnombre),
           logo_url = COALESCE($3, logo_url),
           color_primario = COALESCE($4, color_primario),
           color_secundario = COALESCE($5, color_secundario),
           fuente = COALESCE($6, fuente),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING *`,
      [
        nombre ? String(nombre).trim() : null,
        subnombre === undefined ? null : String(subnombre || '').trim(),
        logo_url,
        color_primario,
        color_secundario,
        fuente,
        req.tenant.id
      ]
    );
    res.json({ tenant: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: 'No se pudo actualizar la configuración de la empresa' });
  }
});

router.post('/admin/uploads', authenticate, requireRole('admin', 'superadmin'), upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Imagen requerida' });

  const purpose = ['product', 'brand', 'category', 'tenant'].includes(req.body?.purpose) ? req.body.purpose : 'product';
  try {
    const optimized = await optimizeImage(req.file.buffer);
    const key = `${req.tenant.slug}/${purpose}/${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${optimized.ext}`;
    const localPublicBaseUrl = process.env.PUBLIC_API_URL || `${req.protocol}://${req.get('host')}`;
    const stored = await storeImage(key, optimized.buffer, optimized.contentType, localPublicBaseUrl);

    res.status(201).json({
      url: stored.url,
      key,
      content_type: optimized.contentType,
      size: optimized.buffer.length,
      storage: stored.storage
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'No se pudo procesar la imagen' });
  }
});

router.get('/admin/catalog', authenticate, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    await ensureProductInventoryColumns();
    await ensureCategoryImageColumn();
    const [brands, categories, products] = await Promise.all([
      db.query('SELECT * FROM marcas WHERE empresa_id = $1 ORDER BY posicion, nombre', [req.tenant.id]),
      db.query('SELECT * FROM categorias WHERE empresa_id = $1 ORDER BY posicion, nombre', [req.tenant.id]),
      queryAdminProducts(req.tenant.id)
    ]);

    res.json({
      tenant: req.tenant,
      marcas: brands.rows,
      categorias: categories.rows,
      productos: products.rows
    });
  } catch (error) {
    res.status(500).json({ message: 'No se pudo cargar el catálogo administrativo' });
  }
});

router.get('/admin/clients', authenticate, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    await ensureBranchActiveColumn();
    const clients = await queryAdminClients(req.tenant.id);
    res.json({ clientes: clients.rows });
  } catch (error) {
    res.status(500).json({ message: 'No se pudieron cargar los clientes' });
  }
});

router.post('/admin/clients', authenticate, requireRole('admin', 'superadmin'), async (req, res) => {
  await ensureClientPriceListConstraint();
  await ensureBranchActiveColumn();
  let payload;
  try {
    payload = normalizeClientPayload(req.body || {});
  } catch (error) {
    return res.status(error.statusCode || 400).json({ message: error.message || 'Datos de cliente inválidos' });
  }
  if (!payload.nombre || !payload.username) {
    return res.status(400).json({ message: 'Nombre y usuario son requeridos' });
  }

  let client;
  try {
    client = await db.pool.connect();
    await client.query('BEGIN');
    const passwordHash = await bcrypt.hash(payload.password || 'ClientPassword123', 10);
    const userResult = await client.query(
      `INSERT INTO usuarios (empresa_id, nombre, username, email, password_hash, rol)
       VALUES ($1, $2, $3, $4, $5, 'cliente')
       RETURNING id`,
      [req.tenant.id, payload.nombre, payload.username, payload.email, passwordHash]
    );
    const customerResult = await client.query(
      `INSERT INTO clientes (usuario_id, empresa_id, condicion_credito, activo, aplica_isv)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [userResult.rows[0].id, req.tenant.id, payload.condicion_credito, payload.activo, payload.aplica_isv]
    );
    await assignClientPriceList(client, req.tenant.id, customerResult.rows[0].id, payload.lista_precio_id);
    await replaceClientBranches(client, customerResult.rows[0].id, payload.sucursales);
    await client.query('COMMIT');

    const saved = await getAdminClient(req.tenant.id, customerResult.rows[0].id);
    res.status(201).json({ cliente: saved });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    res.status(error.statusCode || (error.code === '23505' ? 409 : 500)).json({
      message: error.statusCode ? error.message : (error.code === '23505' ? 'Ya existe un cliente con ese usuario' : 'No se pudo crear el cliente')
    });
  } finally {
    if (client) client.release();
  }
});

router.patch('/admin/clients/:id', authenticate, requireRole('admin', 'superadmin'), async (req, res) => {
  await ensureClientPriceListConstraint();
  await ensureBranchActiveColumn();
  let payload;
  try {
    payload = normalizeClientPayload(req.body || {}, true);
  } catch (error) {
    return res.status(error.statusCode || 400).json({ message: error.message || 'Datos de cliente inválidos' });
  }
  let client;

  try {
    client = await db.pool.connect();
    await client.query('BEGIN');
    const current = await client.query(
      `SELECT c.id, c.usuario_id
       FROM clientes c
       WHERE c.id = $1 AND c.empresa_id = $2
       LIMIT 1`,
      [req.params.id, req.tenant.id]
    );
    if (!current.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }

    let passwordHash = null;
    if (payload.password) passwordHash = await bcrypt.hash(payload.password, 10);

    await client.query(
      `UPDATE usuarios
       SET nombre = COALESCE($1, nombre),
           username = COALESCE($2, username),
           email = COALESCE($3, email),
           password_hash = COALESCE($4, password_hash),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 AND empresa_id = $6`,
      [payload.nombre, payload.username, payload.email, passwordHash, current.rows[0].usuario_id, req.tenant.id]
    );
    await client.query(
      `UPDATE clientes
       SET condicion_credito = COALESCE($1, condicion_credito),
           activo = COALESCE($2::boolean, activo),
           aplica_isv = COALESCE($3::boolean, aplica_isv),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 AND empresa_id = $5`,
      [payload.condicion_credito, payload.activo, payload.aplica_isv, req.params.id, req.tenant.id]
    );
    if (payload.lista_precio_id !== undefined) {
      await assignClientPriceList(client, req.tenant.id, req.params.id, payload.lista_precio_id);
    }
    if (Array.isArray(payload.sucursales)) {
      await replaceClientBranches(client, req.params.id, payload.sucursales);
    }
    await client.query('COMMIT');

    const saved = await getAdminClient(req.tenant.id, req.params.id);
    if (!saved) return res.status(404).json({ message: 'Cliente actualizado, pero no se pudo recargar' });
    res.json({ cliente: saved, password_changed: Boolean(payload.password) });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    res.status(error.statusCode || (error.code === '23505' ? 409 : 500)).json({
      message: error.statusCode ? error.message : (error.code === '23505' ? 'Ya existe un cliente con ese usuario' : 'No se pudo actualizar el cliente')
    });
  } finally {
    if (client) client.release();
  }
});

router.patch('/admin/clients/:id/status', authenticate, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE clientes
       SET activo = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND empresa_id = $3
       RETURNING id`,
      [Boolean(req.body.activo), req.params.id, req.tenant.id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Cliente no encontrado' });
    res.json({ cliente: await getAdminClient(req.tenant.id, req.params.id) });
  } catch (error) {
    res.status(500).json({ message: 'No se pudo cambiar el estado del cliente' });
  }
});

router.delete('/admin/clients/:id', authenticate, requireRole('admin', 'superadmin'), async (req, res) => {
  let client;
  try {
    client = await db.pool.connect();
    await client.query('BEGIN');
    const current = await client.query(
      `SELECT c.id, c.usuario_id,
              EXISTS (
                SELECT 1
                FROM pedidos p
                WHERE p.cliente_id = c.id
              ) AS has_orders
       FROM clientes c
       WHERE c.id = $1 AND c.empresa_id = $2
       LIMIT 1`,
      [req.params.id, req.tenant.id]
    );
    const target = current.rows[0];
    if (!target) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }
    if (target.has_orders) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'Este cliente tiene pedidos. Desactivalo para conservar el historial.' });
    }

    await client.query('DELETE FROM accesos_log WHERE usuario_id = $1', [target.usuario_id]);
    await client.query('DELETE FROM sucursales WHERE cliente_id = $1', [target.id]);
    await client.query('DELETE FROM cliente_lista_precio WHERE cliente_id = $1', [target.id]);
    await client.query('DELETE FROM clientes WHERE id = $1 AND empresa_id = $2', [target.id, req.tenant.id]);
    await client.query('DELETE FROM usuarios WHERE id = $1 AND empresa_id = $2 AND rol = $3', [target.usuario_id, req.tenant.id, 'cliente']);
    await client.query('COMMIT');
    res.status(204).end();
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ message: 'No se pudo eliminar el cliente' });
  } finally {
    if (client) client.release();
  }
});

router.get('/admin/price-lists', authenticate, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT lp.*,
              count(DISTINCT clp.cliente_id)::int AS clientes,
              count(DISTINCT pr.producto_id)::int AS productos_con_precio
       FROM listas_precios lp
       LEFT JOIN cliente_lista_precio clp ON clp.lista_precio_id = lp.id
       LEFT JOIN precios pr ON pr.lista_precio_id = lp.id
       WHERE lp.empresa_id = $1
       GROUP BY lp.id
       ORDER BY lp.nombre`,
      [req.tenant.id]
    );
    res.json({ listas: result.rows });
  } catch (error) {
    res.status(500).json({ message: 'No se pudieron cargar las listas de precios' });
  }
});

router.post('/admin/price-lists', authenticate, requireRole('admin', 'superadmin'), async (req, res) => {
  const nombre = String(req.body?.nombre || '').trim();
  if (!nombre) return res.status(400).json({ message: 'Nombre de lista requerido' });

  let client;
  try {
    client = await db.pool.connect();
    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO listas_precios (empresa_id, nombre)
       VALUES ($1, $2)
       RETURNING *`,
      [req.tenant.id, nombre]
    );
    await replacePriceListClients(client, req.tenant.id, result.rows[0].id, req.body?.cliente_ids);
    await client.query('COMMIT');
    res.status(201).json({ lista: result.rows[0] });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    res.status(error.code === '23505' ? 409 : 500).json({ message: error.code === '23505' ? 'La lista ya existe' : 'No se pudo crear la lista' });
  } finally {
    if (client) client.release();
  }
});

router.patch('/admin/price-lists/:id', authenticate, requireRole('admin', 'superadmin'), async (req, res) => {
  const nombre = String(req.body?.nombre || '').trim();
  if (!nombre) return res.status(400).json({ message: 'Nombre de lista requerido' });

  let client;
  try {
    client = await db.pool.connect();
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE listas_precios
       SET nombre = $1
       WHERE id = $2 AND empresa_id = $3
       RETURNING *`,
      [nombre, req.params.id, req.tenant.id]
    );
    if (!result.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Lista no encontrada' });
    }
    await replacePriceListClients(client, req.tenant.id, req.params.id, req.body?.cliente_ids);
    await client.query('COMMIT');
    res.json({ lista: result.rows[0] });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    res.status(error.code === '23505' ? 409 : 500).json({ message: error.code === '23505' ? 'La lista ya existe' : 'No se pudo actualizar la lista' });
  } finally {
    if (client) client.release();
  }
});

router.get('/admin/prices', authenticate, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    await ensurePriceVisibilityColumn();
    await ensurePricePromoActiveColumn();
    res.json(await queryAdminPriceData(req.tenant.id));
  } catch (error) {
    res.status(500).json({ message: 'No se pudieron cargar los precios' });
  }
});

router.post('/admin/price-lists/:id/sync', authenticate, requireRole('admin', 'superadmin'), async (req, res) => {
  const listId = Number(req.params.id);
  if (!listId) return res.status(400).json({ message: 'Lista inválida' });

  try {
    await ensureProductInventoryColumns();
    await ensurePriceVisibilityColumn();
    await ensurePricePromoActiveColumn();
    const list = await db.query('SELECT id FROM listas_precios WHERE id = $1 AND empresa_id = $2', [listId, req.tenant.id]);
    if (!list.rows[0]) return res.status(404).json({ message: 'Lista no encontrada' });

    const result = await db.query(
      `WITH target AS (
         SELECT id
         FROM listas_precios
         WHERE id = $1 AND empresa_id = $2
       ),
       default_lp AS (
         SELECT id
         FROM listas_precios
         WHERE empresa_id = $2
         ORDER BY CASE WHEN nombre = 'Distribuidor Mayorista' THEN 0 ELSE 1 END, id
         LIMIT 1
       )
       INSERT INTO precios (producto_id, lista_precio_id, precio, precio_promocion, promo_activa, visible_cliente)
       SELECT p.id,
              target.id,
              COALESCE(base.precio, 0),
              base.precio_promocion,
              COALESCE(base.promo_activa, false),
              true
       FROM productos p
       CROSS JOIN target
       LEFT JOIN default_lp ON true
       LEFT JOIN precios base ON base.producto_id = p.id AND base.lista_precio_id = default_lp.id
       WHERE p.empresa_id = $2
       ON CONFLICT (producto_id, lista_precio_id) DO NOTHING
       RETURNING producto_id`,
      [listId, req.tenant.id]
    );
    const payload = await queryAdminPriceData(req.tenant.id);
    res.json({ ...payload, sincronizados: result.rowCount });
  } catch (error) {
    res.status(500).json({ message: 'No se pudo sincronizar la lista de precios' });
  }
});

router.put('/admin/price-lists/:id/prices', authenticate, requireRole('admin', 'superadmin'), async (req, res) => {
  const prices = Array.isArray(req.body?.precios) ? req.body.precios : [];
  const listId = Number(req.params.id);
  if (!listId) return res.status(400).json({ message: 'Lista inválida' });

  let client;
  try {
    await ensureProductInventoryColumns();
    await ensurePriceVisibilityColumn();
    await ensurePricePromoActiveColumn();
    client = await db.pool.connect();
    await client.query('BEGIN');
    const list = await client.query('SELECT id FROM listas_precios WHERE id = $1 AND empresa_id = $2', [listId, req.tenant.id]);
    if (!list.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Lista no encontrada' });
    }

    for (const row of prices) {
      const productId = Number(row.producto_id);
      if (!productId) continue;
      const price = Number(row.precio);
      const promo = row.precio_promocion === '' || row.precio_promocion === null || row.precio_promocion === undefined ? null : Number(row.precio_promocion);
      const promoActive = promo !== null && row.promo_activa === true;
      const visible = row.visible_cliente === undefined ? true : Boolean(row.visible_cliente);
      if (!Number.isFinite(price) || price < 0 || (promo !== null && (!Number.isFinite(promo) || promo < 0))) continue;

      await client.query(
        `INSERT INTO precios (producto_id, lista_precio_id, precio, precio_promocion, promo_activa, visible_cliente)
         SELECT p.id, $2, $3, $4, $7, $6
         FROM productos p
         WHERE p.id = $1 AND p.empresa_id = $5
         ON CONFLICT (producto_id, lista_precio_id)
         DO UPDATE SET precio = EXCLUDED.precio,
                       precio_promocion = EXCLUDED.precio_promocion,
                       promo_activa = EXCLUDED.promo_activa,
                       visible_cliente = EXCLUDED.visible_cliente`,
        [productId, listId, price, promo, req.tenant.id, visible, promoActive]
      );
    }

    await client.query('COMMIT');
    const updated = await db.query(
      `SELECT producto_id, lista_precio_id, precio, precio_promocion, COALESCE(promo_activa, false) AS promo_activa, visible_cliente
       FROM precios
       WHERE lista_precio_id = $1`,
      [listId]
    );
    res.json({ precios: updated.rows });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ message: 'No se pudieron guardar los precios' });
  } finally {
    if (client) client.release();
  }
});

router.post('/admin/brands', authenticate, requireRole('admin', 'superadmin'), async (req, res) => {
  const { nombre, logo_url = '', posicion = 0 } = req.body || {};
  if (!nombre) return res.status(400).json({ message: 'Nombre de marca requerido' });

  try {
    const result = await db.query(
      `INSERT INTO marcas (empresa_id, nombre, logo_url, posicion)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.tenant.id, String(nombre).trim(), logo_url, Number(posicion) || 0]
    );
    res.status(201).json({ marca: result.rows[0] });
  } catch (error) {
    res.status(error.code === '23505' ? 409 : 500).json({ message: error.code === '23505' ? 'La marca ya existe' : 'No se pudo crear la marca' });
  }
});

router.patch('/admin/brands/:id', authenticate, requireRole('admin', 'superadmin'), async (req, res) => {
  const { nombre, logo_url, posicion } = req.body || {};
  try {
    const result = await db.query(
      `UPDATE marcas
       SET nombre = COALESCE($1, nombre),
           logo_url = COALESCE($2, logo_url),
           posicion = COALESCE($3, posicion)
       WHERE id = $4 AND empresa_id = $5
       RETURNING *`,
      [nombre ? String(nombre).trim() : null, logo_url ?? null, Number.isFinite(Number(posicion)) ? Number(posicion) : null, req.params.id, req.tenant.id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Marca no encontrada' });
    res.json({ marca: result.rows[0] });
  } catch (error) {
    res.status(error.code === '23505' ? 409 : 500).json({ message: error.code === '23505' ? 'La marca ya existe' : 'No se pudo actualizar la marca' });
  }
});

router.delete('/admin/brands/:id', authenticate, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    await db.query('DELETE FROM marcas WHERE id = $1 AND empresa_id = $2', [req.params.id, req.tenant.id]);
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ message: 'No se pudo eliminar la marca' });
  }
});

router.post('/admin/categories', authenticate, requireRole('admin', 'superadmin'), async (req, res) => {
  const { nombre, color = '#F5C200', imagen_url = '', posicion = 0 } = req.body || {};
  if (!nombre) return res.status(400).json({ message: 'Nombre de categoria requerido' });

  try {
    await ensureCategoryImageColumn();
    const result = await db.query(
      `INSERT INTO categorias (empresa_id, nombre, color, imagen_url, posicion)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.tenant.id, String(nombre).trim(), color, imagen_url, Number(posicion) || 0]
    );
    res.status(201).json({ categoria: result.rows[0] });
  } catch (error) {
    res.status(error.code === '23505' ? 409 : 500).json({ message: error.code === '23505' ? 'La categoria ya existe' : 'No se pudo crear la categoria' });
  }
});

router.patch('/admin/categories/:id', authenticate, requireRole('admin', 'superadmin'), async (req, res) => {
  const { nombre, color, imagen_url, posicion } = req.body || {};
  try {
    await ensureCategoryImageColumn();
    const result = await db.query(
      `UPDATE categorias
       SET nombre = COALESCE($1, nombre),
           color = COALESCE($2, color),
           imagen_url = COALESCE($3, imagen_url),
           posicion = COALESCE($4, posicion)
       WHERE id = $5 AND empresa_id = $6
       RETURNING *`,
      [nombre ? String(nombre).trim() : null, color ?? null, imagen_url ?? null, Number.isFinite(Number(posicion)) ? Number(posicion) : null, req.params.id, req.tenant.id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Categoría no encontrada' });
    res.json({ categoria: result.rows[0] });
  } catch (error) {
    res.status(error.code === '23505' ? 409 : 500).json({ message: error.code === '23505' ? 'La categoria ya existe' : 'No se pudo actualizar la categoria' });
  }
});

router.delete('/admin/categories/:id', authenticate, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    await db.query('DELETE FROM categorias WHERE id = $1 AND empresa_id = $2', [req.params.id, req.tenant.id]);
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ message: 'No se pudo eliminar la categoria' });
  }
});

router.post('/admin/products', authenticate, requireRole('admin', 'superadmin'), async (req, res) => {
  const payload = normalizeProductPayload(req.body || {});
  if (!payload.sku || !payload.descripcion) {
    return res.status(400).json({ message: 'Código y descripción son requeridos' });
  }

  let client;
  try {
    await ensureProductInventoryColumns();
    client = await db.pool.connect();
    await client.query('BEGIN');

    // If position is not provided, assign the next available position (max + 1)
    let posicion = payload.posicion;
    if (posicion === null || posicion === undefined) {
      const maxPosRes = await client.query(
        `SELECT COALESCE(MAX(posicion), -1) as max_pos FROM productos WHERE empresa_id = $1`,
        [req.tenant.id]
      );
      posicion = (maxPosRes.rows[0].max_pos || -1) + 1;
    }

    // Desplazar las posiciones de los productos existentes para hacer espacio
    await client.query(
      `UPDATE productos 
       SET posicion = posicion + 1 
       WHERE empresa_id = $1 AND posicion >= $2`,
      [req.tenant.id, posicion]
    );

    const result = await client.query(
      `INSERT INTO productos (empresa_id, marca_id, categoria_id, sku, descripcion, specs, stock_actual, stock_minimo, visible, en_promocion, posicion)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11)
       RETURNING id`,
      [req.tenant.id, payload.marca_id, payload.categoria_id, payload.sku, payload.descripcion, JSON.stringify(payload.specs), payload.stock_actual, payload.stock_minimo, payload.visible, payload.en_promocion, posicion]
    );

    const newProductId = result.rows[0].id;
    await replaceProductImages(newProductId, payload.imagenes, client);
    await upsertProductPrice(req.tenant.id, newProductId, payload.precio, payload.precio_promocion, client);

    await client.query('COMMIT');
    res.status(201).json({ producto: await getAdminProduct(req.tenant.id, newProductId) });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    res.status(error.code === '23505' ? 409 : 500).json({ message: error.code === '23505' ? 'El codigo ya existe' : 'No se pudo crear el producto' });
  } finally {
    if (client) client.release();
  }
});

router.patch('/admin/products/:id', authenticate, requireRole('admin', 'superadmin'), async (req, res) => {
  const payload = normalizeProductPayload(req.body || {}, true);

  let client;
  try {
    await ensureProductInventoryColumns();
    client = await db.pool.connect();
    await client.query('BEGIN');

    // Obtener producto y su posicion actual
    const currentRes = await client.query(
      `SELECT posicion FROM productos WHERE id = $1 AND empresa_id = $2 LIMIT 1`,
      [req.params.id, req.tenant.id]
    );
    const oldProduct = currentRes.rows[0];
    if (!oldProduct) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    const oldPos = oldProduct.posicion;
    const newPos = payload.posicion;

    // Desplazar las posiciones si la posición cambió
    if (newPos !== null && newPos !== undefined && newPos !== oldPos) {
      if (newPos > oldPos) {
        await client.query(
          `UPDATE productos 
           SET posicion = posicion - 1 
           WHERE empresa_id = $1 AND posicion > $2 AND posicion <= $3`,
          [req.tenant.id, oldPos, newPos]
        );
      } else {
        await client.query(
          `UPDATE productos 
           SET posicion = posicion + 1 
           WHERE empresa_id = $1 AND posicion >= $2 AND posicion < $3`,
          [req.tenant.id, newPos, oldPos]
        );
      }
    }

    const result = await client.query(
      `UPDATE productos
       SET marca_id = COALESCE($1, marca_id),
           categoria_id = COALESCE($2, categoria_id),
           sku = COALESCE($3, sku),
           descripcion = COALESCE($4, descripcion),
           specs = COALESCE($5::jsonb, specs),
           visible = COALESCE($6, visible),
           en_promocion = COALESCE($7, en_promocion),
           posicion = COALESCE($8, posicion),
           stock_actual = COALESCE($9, stock_actual),
           stock_minimo = COALESCE($10, stock_minimo),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $11 AND empresa_id = $12
       RETURNING id`,
      [
        payload.marca_id,
        payload.categoria_id,
        payload.sku,
        payload.descripcion,
        payload.specs ? JSON.stringify(payload.specs) : null,
        payload.visible,
        payload.en_promocion,
        payload.posicion,
        payload.stock_actual,
        payload.stock_minimo,
        req.params.id,
        req.tenant.id
      ]
    );

    if (Array.isArray(payload.imagenes)) {
      await replaceProductImages(req.params.id, payload.imagenes, client);
    }
    if (payload.precio !== null || payload.precio_promocion !== null) {
      await upsertProductPrice(req.tenant.id, req.params.id, payload.precio, payload.precio_promocion, client);
    }

    await client.query('COMMIT');
    res.json({ producto: await getAdminProduct(req.tenant.id, req.params.id) });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    res.status(error.code === '23505' ? 409 : 500).json({ message: error.code === '23505' ? 'El codigo ya existe' : 'No se pudo actualizar el producto' });
  } finally {
    if (client) client.release();
  }
});

router.delete('/admin/products/:id', authenticate, requireRole('admin', 'superadmin'), async (req, res) => {
  let client;
  try {
    client = await db.pool.connect();
    await client.query('BEGIN');
    const current = await client.query(
      `SELECT p.id,
              p.posicion,
              EXISTS (
                SELECT 1
                FROM pedido_items pi
                WHERE pi.producto_id = p.id
              ) AS has_orders
       FROM productos p
       WHERE p.id = $1 AND p.empresa_id = $2
       LIMIT 1`,
      [req.params.id, req.tenant.id]
    );
    const target = current.rows[0];
    if (!target) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Producto no encontrado' });
    }
    if (target.has_orders) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'Este producto tiene pedidos. Ocultalo para conservar el historial.' });
    }

    await client.query('DELETE FROM producto_imagenes WHERE producto_id = $1', [target.id]);
    await client.query('DELETE FROM precios WHERE producto_id = $1', [target.id]);
    await client.query('DELETE FROM productos WHERE id = $1 AND empresa_id = $2', [target.id, req.tenant.id]);

    // Desplazar las posiciones de los productos restantes
    await client.query(
      `UPDATE productos 
       SET posicion = posicion - 1 
       WHERE empresa_id = $1 AND posicion > $2`,
      [req.tenant.id, target.posicion]
    );

    await client.query('COMMIT');
    res.status(204).end();
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ message: 'No se pudo eliminar el producto' });
  } finally {
    if (client) client.release();
  }
});

function normalizeProductPayload(input, partial = false) {
  return {
    marca_id: normalizeId(input.marca_id, partial),
    categoria_id: normalizeId(input.categoria_id, partial),
    sku: input.sku === undefined && partial ? null : String(input.sku || '').trim(),
    descripcion: input.descripcion === undefined && partial ? null : String(input.descripcion || '').trim(),
    specs: input.specs === undefined && partial ? null : (input.specs || {}),
    visible: input.visible === undefined ? (partial ? null : true) : Boolean(input.visible),
    en_promocion: input.en_promocion === undefined ? (partial ? null : false) : Boolean(input.en_promocion),
    posicion: input.posicion === undefined ? (partial ? null : 0) : Number(input.posicion) || 0,
    stock_actual: normalizeStockValue(input.stock_actual, partial),
    stock_minimo: normalizeStockValue(input.stock_minimo, partial),
    imagenes: input.imagenes,
    precio: input.precio === undefined ? null : Number(input.precio) || 0,
    precio_promocion: input.precio_promocion === undefined || input.precio_promocion === '' ? null : Number(input.precio_promocion) || null
  };
}

function normalizePassword(value) {
  const password = String(value || '').trim();
  if (!password) return null;
  if (password.length < 8) {
    const error = new Error('La nueva contraseña debe tener al menos 8 caracteres');
    error.statusCode = 400;
    throw error;
  }
  return password;
}

function normalizeStockValue(value, partial) {
  if (value === undefined && partial) return null;
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? Math.floor(num) : 0;
}

function normalizeId(value, partial) {
  if (value === undefined && partial) return null;
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}

async function queryAdminProducts(tenantId) {
  await ensureProductInventoryColumns();
  await ensurePricePromoActiveColumn();
  return db.query(
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
     LEFT JOIN LATERAL (
       SELECT lp.id
       FROM listas_precios lp
       WHERE lp.empresa_id = p.empresa_id
       ORDER BY CASE WHEN lp.nombre = 'Distribuidor Mayorista' THEN 0 ELSE 1 END, lp.id
       LIMIT 1
     ) default_lp ON true
     LEFT JOIN precios pr ON pr.producto_id = p.id AND pr.lista_precio_id = default_lp.id
     WHERE p.empresa_id = $1
     GROUP BY p.id, m.nombre, m.logo_url, c.nombre, pr.precio, pr.precio_promocion, pr.promo_activa
     ORDER BY p.posicion, p.created_at DESC`,
    [tenantId]
  );
}

async function getAdminProduct(tenantId, productId) {
  await ensureProductInventoryColumns();
  await ensurePricePromoActiveColumn();
  const result = await db.query(
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
     LEFT JOIN LATERAL (
       SELECT lp.id
       FROM listas_precios lp
       WHERE lp.empresa_id = p.empresa_id
       ORDER BY CASE WHEN lp.nombre = 'Distribuidor Mayorista' THEN 0 ELSE 1 END, lp.id
       LIMIT 1
     ) default_lp ON true
     LEFT JOIN precios pr ON pr.producto_id = p.id AND pr.lista_precio_id = default_lp.id
     WHERE p.empresa_id = $1 AND p.id = $2
     GROUP BY p.id, m.nombre, m.logo_url, c.nombre, pr.precio, pr.precio_promocion, pr.promo_activa`,
    [tenantId, productId]
  );
  return result.rows[0];
}

async function queryAdminPriceData(tenantId) {
  await ensureProductInventoryColumns();
  await ensurePriceVisibilityColumn();
  await ensurePricePromoActiveColumn();
  const [lists, products, prices, assignedClients] = await Promise.all([
    db.query('SELECT * FROM listas_precios WHERE empresa_id = $1 ORDER BY nombre', [tenantId]),
    db.query(
      `SELECT p.id, p.sku, p.descripcion, p.visible, p.stock_actual, p.stock_minimo, p.categoria_id, p.marca_id, p.posicion, COALESCE(json_agg(DISTINCT pi.url) FILTER (WHERE pi.url IS NOT NULL), '[]') AS imagenes, m.nombre AS marca, c.nombre AS categoria
       FROM productos p
       LEFT JOIN marcas m ON m.id = p.marca_id
       LEFT JOIN categorias c ON c.id = p.categoria_id
       LEFT JOIN producto_imagenes pi ON pi.producto_id = p.id
       WHERE p.empresa_id = $1
       GROUP BY p.id, m.nombre, c.nombre, p.categoria_id, p.marca_id, p.posicion
       ORDER BY p.posicion, p.sku`,
      [tenantId]
    ),
    db.query(
      `SELECT pr.producto_id, pr.lista_precio_id, pr.precio, pr.precio_promocion, COALESCE(pr.promo_activa, false) AS promo_activa, COALESCE(pr.visible_cliente, true) AS visible_cliente
       FROM precios pr
       JOIN productos p ON p.id = pr.producto_id
       JOIN listas_precios lp ON lp.id = pr.lista_precio_id
       WHERE p.empresa_id = $1 AND lp.empresa_id = $1`,
      [tenantId]
    ),
    db.query(
      `SELECT clp.lista_precio_id, c.id, u.nombre, u.username
       FROM cliente_lista_precio clp
       JOIN clientes c ON c.id = clp.cliente_id
       JOIN usuarios u ON u.id = c.usuario_id
       WHERE c.empresa_id = $1
       ORDER BY u.nombre`,
      [tenantId]
    )
  ]);

  return {
    listas: lists.rows.map((list) => {
      const listPrices = prices.rows.filter((price) => Number(price.lista_precio_id) === Number(list.id));
      const clients = assignedClients.rows.filter((client) => Number(client.lista_precio_id) === Number(list.id));
      return {
        ...list,
        clientes: clients.length,
        clientes_asignados: clients,
        productos_con_precio: listPrices.filter((price) => Number(price.precio) > 0).length,
        productos_faltantes: products.rows.length - listPrices.length,
        precios: listPrices
      };
    }),
    productos: products.rows
  };
}

async function queryAdminClients(tenantId) {
  const result = await db.query(
    `SELECT c.id,
            c.usuario_id,
            c.condicion_credito,
            c.activo,
            c.aplica_isv,
            c.created_at,
            c.updated_at,
            u.nombre,
            u.username,
            u.email,
            lp.id AS lista_precio_id,
            lp.nombre AS lista_precio,
            COALESCE(
              json_agg(
                DISTINCT jsonb_build_object(
                  'id', s.id,
                  'nombre', s.nombre,
                  'direccion', s.direccion
                )
              ) FILTER (WHERE s.id IS NOT NULL),
              '[]'
            ) AS sucursales,
            access.fecha AS ultimo_acceso,
            access.ip AS ultimo_ip,
            access.user_agent AS ultimo_user_agent,
            access.geolocalizacion AS ultimo_geolocalizacion
     FROM clientes c
     JOIN usuarios u ON u.id = c.usuario_id
     LEFT JOIN cliente_lista_precio clp ON clp.cliente_id = c.id
     LEFT JOIN listas_precios lp ON lp.id = clp.lista_precio_id
     LEFT JOIN sucursales s ON s.cliente_id = c.id AND COALESCE(s.activo, true) = true
     LEFT JOIN LATERAL (
       SELECT a.fecha, a.ip, a.user_agent, a.geolocalizacion
       FROM accesos_log a
       WHERE a.usuario_id = u.id
       ORDER BY a.fecha DESC
       LIMIT 1
     ) access ON true
     WHERE c.empresa_id = $1
     GROUP BY c.id, u.id, lp.id, access.fecha, access.ip, access.user_agent, access.geolocalizacion
     ORDER BY c.activo DESC, u.nombre`,
    [tenantId]
  );

  for (const row of result.rows) {
    if (Array.isArray(row.sucursales)) {
      row.sucursales.sort((a, b) => Number(a.id || 0) - Number(b.id || 0));
    }
  }

  return result;
}

async function getAdminClient(tenantId, clientId) {
  const result = await queryAdminClients(tenantId);
  return result.rows.find((client) => Number(client.id) === Number(clientId));
}

function normalizeClientPayload(input, partial = false) {
  const rawUsername = input.username ?? input.usuario ?? input.email;
  const username = rawUsername === undefined && partial ? null : String(rawUsername || '').trim().toLowerCase();
  const rawEmail = input.email === undefined && partial ? null : String(input.email || '').trim().toLowerCase();
  const email = rawEmail || (partial ? null : (username ? `${username}@cliente.local` : null));
  const output = {
    nombre: input.nombre === undefined && partial ? null : String(input.nombre || '').trim(),
    username,
    email,
    password: normalizePassword(input.password),
    condicion_credito: input.condicion_credito === undefined && partial ? null : String(input.condicion_credito || input.credito || 'Contado').trim(),
    activo: input.activo === undefined ? (partial ? null : true) : Boolean(input.activo),
    aplica_isv: input.aplica_isv === undefined ? (partial ? null : true) : Boolean(input.aplica_isv),
    lista_precio_id: input.lista_precio_id === undefined ? undefined : normalizeId(input.lista_precio_id, true),
    sucursales: input.sucursales
  };

  if (!Array.isArray(output.sucursales) && typeof input.sucursales_text === 'string') {
    output.sucursales = input.sucursales_text
      .split('\n')
      .map((line) => {
        const [nombre, ...addressParts] = line.split('|');
        return { nombre: nombre?.trim(), direccion: addressParts.join('|').trim() };
      })
      .filter((branch) => branch.nombre);
  }

  if (Array.isArray(output.sucursales)) {
    const seenBranches = new Set();
    output.sucursales = output.sucursales
      .map((branch) => ({
        id: normalizeId(branch.id, true),
        nombre: String(branch.nombre || '').trim(),
        direccion: String(branch.direccion || '').trim()
      }))
      .filter((branch) => {
        if (!branch.nombre) return false;
        const key = branch.id ? `id:${branch.id}` : `${branch.nombre.toLowerCase()}|${branch.direccion.toLowerCase()}`;
        if (seenBranches.has(key)) return false;
        seenBranches.add(key);
        return true;
      });
  }

  return output;
}

async function assignClientPriceList(client, tenantId, clientId, listId) {
  if (!listId) {
    await client.query('DELETE FROM cliente_lista_precio WHERE cliente_id = $1', [clientId]);
    return;
  }

  const list = await client.query('SELECT id FROM listas_precios WHERE id = $1 AND empresa_id = $2', [listId, tenantId]);
  if (!list.rows[0]) {
    const error = new Error('Lista de precios no encontrada');
    error.statusCode = 400;
    throw error;
  }

  await client.query(
    `INSERT INTO cliente_lista_precio (cliente_id, lista_precio_id)
     VALUES ($1, $2)
     ON CONFLICT (cliente_id)
     DO UPDATE SET lista_precio_id = EXCLUDED.lista_precio_id`,
    [clientId, listId]
  );
}

async function ensureClientPriceListConstraint() {
  if (clientPriceListConstraintReady) return;
  await db.query(`
    DELETE FROM cliente_lista_precio a
    USING cliente_lista_precio b
    WHERE a.ctid < b.ctid
      AND a.cliente_id = b.cliente_id
  `);
  await db.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'cliente_lista_precio'::regclass
          AND contype IN ('p', 'u')
          AND conkey = ARRAY[
            (
              SELECT attnum
              FROM pg_attribute
              WHERE attrelid = 'cliente_lista_precio'::regclass
                AND attname = 'cliente_id'
            )
          ]::smallint[]
      ) THEN
        ALTER TABLE cliente_lista_precio
        ADD CONSTRAINT cliente_lista_precio_cliente_id_unique UNIQUE (cliente_id);
      END IF;
    END $$;
  `);
  clientPriceListConstraintReady = true;
}

async function replacePriceListClients(client, tenantId, listId, clientIds) {
  if (!Array.isArray(clientIds)) return;
  const ids = [...new Set(clientIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))];
  await client.query(
    `DELETE FROM cliente_lista_precio
     WHERE lista_precio_id = $1
       AND cliente_id IN (SELECT id FROM clientes WHERE empresa_id = $2)`,
    [listId, tenantId]
  );
  for (const clientId of ids) {
    const exists = await client.query('SELECT id FROM clientes WHERE id = $1 AND empresa_id = $2', [clientId, tenantId]);
    if (!exists.rows[0]) continue;
    await client.query(
      `INSERT INTO cliente_lista_precio (cliente_id, lista_precio_id)
       VALUES ($1, $2)
       ON CONFLICT (cliente_id)
       DO UPDATE SET lista_precio_id = EXCLUDED.lista_precio_id`,
      [clientId, listId]
    );
  }
}

async function replaceClientBranches(client, clientId, branches = []) {
  if (!Array.isArray(branches)) return;
  const keepIds = [];
  for (const branch of branches) {
    const branchId = normalizeId(branch.id, true);
    if (branchId) {
      const updated = await client.query(
        `UPDATE sucursales
         SET nombre = $1,
             direccion = $2,
             activo = true,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND cliente_id = $4
         RETURNING id`,
        [branch.nombre, branch.direccion || 'Direccion pendiente', branchId, clientId]
      );
      if (updated.rows[0]) {
        keepIds.push(updated.rows[0].id);
        continue;
      }
    }
    const inserted = await client.query(
      'INSERT INTO sucursales (cliente_id, nombre, direccion, activo) VALUES ($1, $2, $3, true) RETURNING id',
      [clientId, branch.nombre, branch.direccion || 'Direccion pendiente']
    );
    keepIds.push(inserted.rows[0].id);
  }

  if (keepIds.length > 0) {
    await client.query(
      `UPDATE sucursales s
       SET activo = false,
           updated_at = CURRENT_TIMESTAMP
       WHERE s.cliente_id = $1
         AND s.id <> ALL($2::int[])
         AND EXISTS (
           SELECT 1
           FROM pedido_items pi
           WHERE pi.sucursal_id = s.id
         )`,
      [clientId, keepIds]
    );
    await client.query(
      `DELETE FROM sucursales s
       WHERE s.cliente_id = $1
         AND s.id <> ALL($2::int[])
         AND NOT EXISTS (
           SELECT 1
           FROM pedido_items pi
           WHERE pi.sucursal_id = s.id
         )`,
      [clientId, keepIds]
    );
  } else {
    await client.query(
      `DELETE FROM sucursales s
       WHERE s.cliente_id = $1
         AND NOT EXISTS (
           SELECT 1
           FROM pedido_items pi
           WHERE pi.sucursal_id = s.id
         )`,
      [clientId]
    );
    await client.query(
      `UPDATE sucursales s
       SET activo = false,
           updated_at = CURRENT_TIMESTAMP
       WHERE s.cliente_id = $1
         AND EXISTS (
           SELECT 1
           FROM pedido_items pi
           WHERE pi.sucursal_id = s.id
         )`,
      [clientId]
    );
  }
}

async function replaceProductImages(productId, images = [], client = db) {
  if (!Array.isArray(images)) return;
  await client.query('DELETE FROM producto_imagenes WHERE producto_id = $1', [productId]);
  for (const [index, url] of images.filter(Boolean).entries()) {
    await client.query('INSERT INTO producto_imagenes (producto_id, url, orden) VALUES ($1, $2, $3)', [productId, url, index + 1]);
  }
}

async function upsertProductPrice(tenantId, productId, price, promoPrice, client = db) {
  await ensurePriceVisibilityColumn();
  await ensurePricePromoActiveColumn();
  if (price === null && promoPrice === null) return;
  const listResult = await client.query(
    `INSERT INTO listas_precios (empresa_id, nombre)
     VALUES ($1, 'Distribuidor Mayorista')
     ON CONFLICT (empresa_id, nombre)
     DO UPDATE SET nombre = EXCLUDED.nombre
     RETURNING id`,
    [tenantId]
  );
  const listId = listResult.rows[0].id;
  await client.query(
    `INSERT INTO precios (producto_id, lista_precio_id, precio, precio_promocion, promo_activa, visible_cliente)
     VALUES ($1, $2, $3, $4, false, true)
     ON CONFLICT (producto_id, lista_precio_id)
     DO UPDATE SET precio = COALESCE(EXCLUDED.precio, precios.precio),
                   precio_promocion = EXCLUDED.precio_promocion,
                   promo_activa = CASE WHEN EXCLUDED.precio_promocion IS NULL THEN false ELSE precios.promo_activa END`,
    [productId, listId, price, promoPrice]
  );
}

async function optimizeImage(buffer) {
  const metadata = await sharp(buffer).metadata();
  const base = sharp(buffer)
    .rotate()
    .resize({
      width: Math.min(metadata.width || 1200, 1200),
      height: Math.min(metadata.height || 1200, 1200),
      fit: 'inside',
      withoutEnlargement: true
    });

  const attempts = [
    { format: 'webp', quality: 82, ext: 'webp', contentType: 'image/webp' },
    { format: 'webp', quality: 72, ext: 'webp', contentType: 'image/webp' },
    { format: 'jpeg', quality: 78, ext: 'jpg', contentType: 'image/jpeg' },
    { format: 'jpeg', quality: 68, ext: 'jpg', contentType: 'image/jpeg' }
  ];

  for (const attempt of attempts) {
    const output = attempt.format === 'webp'
      ? await base.clone().webp({ quality: attempt.quality }).toBuffer()
      : await base.clone().jpeg({ quality: attempt.quality, mozjpeg: true }).toBuffer();
    if (output.length <= 300 * 1024 || attempt === attempts[attempts.length - 1]) {
      return { buffer: output, ext: attempt.ext, contentType: attempt.contentType };
    }
  }
}

async function storeImage(key, buffer, contentType, localPublicBaseUrl) {
  if (process.env.S3_BUCKET && process.env.AWS_REGION) {
    try {
      const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
      const client = new S3Client({ region: process.env.AWS_REGION });
      await client.send(new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable'
      }));
      const publicBaseUrl = process.env.S3_PUBLIC_URL || `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com`;
      return { url: `${publicBaseUrl}/${key}`, storage: 's3' };
    } catch (error) {
      if (process.env.NODE_ENV === 'production') throw error;
    }
  }

  const uploadRoot = path.join(__dirname, '..', '..', 'uploads');
  const filePath = path.join(uploadRoot, key);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, buffer);
  return { url: `/uploads/${key.replace(/\\/g, '/')}`, storage: 'local' };
}

module.exports = router;
