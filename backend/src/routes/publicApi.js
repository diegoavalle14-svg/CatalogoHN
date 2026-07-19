const express = require('express');
const db = require('../config/database');
const { requireApiKey } = require('../middleware/apiKeyAuth');
const { ensureProductInventoryColumns, ensureCategoryImageColumn, ensurePricePromoActiveColumn, ensureBranchActiveColumn } = require('../services/schemaGuards');
const { dispatchWebhookEvent } = require('../services/webhooks');
const { handleValidationError, validatePublicOrderPayload } = require('../services/validators');

const router = express.Router();

const ORDER_STATES = ['pendiente', 'preparando', 'enviado'];

async function nextOrderNumber(dbClient, empresaId) {
  const result = await dbClient.query(
    `SELECT numero FROM pedidos WHERE empresa_id = $1 ORDER BY id DESC LIMIT 200`,
    [empresaId]
  );
  let maxNum = 0;
  for (const row of result.rows) {
    const match = row.numero?.match(/^PED-(\d{1,5})$/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }
  const next = maxNum + 1;
  return `PED-${String(next).padStart(4, '0')}`;
}

router.get('/v1/catalog', requireApiKey('catalog:read'), async (req, res) => {
  try {
    await ensureProductInventoryColumns();
    await ensureCategoryImageColumn();
    await ensurePricePromoActiveColumn();
    await ensureBranchActiveColumn();
    const [brands, categories, products] = await Promise.all([
      db.query(
        `SELECT id, nombre, logo_url, posicion
         FROM marcas
         WHERE empresa_id = $1
         ORDER BY posicion, nombre`,
        [req.tenant.id]
      ),
      db.query(
        `SELECT id, nombre, color, imagen_url, posicion
         FROM categorias
         WHERE empresa_id = $1
         ORDER BY posicion, nombre`,
        [req.tenant.id]
      ),
      db.query(
        `SELECT p.id,
                p.sku,
                p.descripcion,
                p.specs,
                p.stock_actual,
                p.stock_minimo,
                p.visible,
                p.en_promocion,
                p.posicion,
                m.nombre AS marca,
                c.nombre AS categoria,
                COALESCE(json_agg(DISTINCT pi.url) FILTER (WHERE pi.url IS NOT NULL), '[]') AS imagenes
         FROM productos p
         LEFT JOIN marcas m ON m.id = p.marca_id
         LEFT JOIN categorias c ON c.id = p.categoria_id
         LEFT JOIN producto_imagenes pi ON pi.producto_id = p.id
         WHERE p.empresa_id = $1
           AND p.visible = true
         GROUP BY p.id, m.nombre, c.nombre
         ORDER BY p.posicion, p.created_at DESC`,
        [req.tenant.id]
      )
    ]);

    res.json({
      version: 'v1',
      tenant: {
        id: req.tenant.id,
        slug: req.tenant.slug,
        nombre: req.tenant.nombre
      },
      marcas: brands.rows,
      categorias: categories.rows,
      productos: products.rows
    });
  } catch (error) {
    res.status(500).json({ message: 'No se pudo cargar el catalogo publico' });
  }
});

router.post('/v1/orders', requireApiKey('orders:write'), async (req, res) => {
  let payload;
  try {
    payload = validatePublicOrderPayload(req.body);
  } catch (error) {
    return handleValidationError(error, res, 'Pedido invalido');
  }

  let client;
  try {
    await ensureProductInventoryColumns();
    await ensurePricePromoActiveColumn();
    await ensureBranchActiveColumn();
    client = await db.pool.connect();
    await client.query('BEGIN');

    const customer = await client.query(
      `SELECT c.id, c.empresa_id, c.activo, c.aplica_isv, u.nombre AS cliente_nombre
       FROM clientes c
       JOIN usuarios u ON u.id = c.usuario_id
       WHERE c.id = $1
         AND c.empresa_id = $2
       LIMIT 1`,
      [payload.cliente_id, req.tenant.id]
    );
    if (!customer.rows[0]) {
      const error = new Error('Cliente no encontrado para este tenant');
      error.statusCode = 404;
      throw error;
    }
    if (customer.rows[0].activo === false) {
      const error = new Error('Cliente inactivo');
      error.statusCode = 403;
      throw error;
    }

    const validatedItems = [];
    for (const item of payload.items) {
      const product = await client.query(
        `SELECT p.id AS producto_id,
                p.sku,
                p.descripcion,
                s.id AS sucursal_id,
                CASE
                  WHEN COALESCE(pr.promo_activa, false) = true AND pr.precio_promocion IS NOT NULL THEN pr.precio_promocion
                  ELSE pr.precio
                END AS precio_unitario
         FROM productos p
         JOIN sucursales s ON s.id = $2 AND s.cliente_id = $3 AND COALESCE(s.activo, true) = true
         LEFT JOIN cliente_lista_precio clp ON clp.cliente_id = $3
         LEFT JOIN precios pr ON pr.producto_id = p.id AND pr.lista_precio_id = clp.lista_precio_id
         WHERE p.id = $1
           AND p.empresa_id = $4
           AND p.visible = true
         LIMIT 1`,
        [item.producto_id, item.sucursal_id, payload.cliente_id, req.tenant.id]
      );

      if (!product.rows[0] || product.rows[0].precio_unitario === null) {
        const error = new Error('Producto, sucursal o precio no valido para este cliente');
        error.statusCode = 400;
        throw error;
      }

      validatedItems.push({
        producto_id: product.rows[0].producto_id,
        sku: product.rows[0].sku,
        descripcion: product.rows[0].descripcion,
        sucursal_id: product.rows[0].sucursal_id,
        cantidad: item.cantidad,
        precio_unitario: Number(product.rows[0].precio_unitario)
      });
    }

    const requestedByProduct = validatedItems.reduce((map, item) => {
      const current = map.get(item.producto_id) || { cantidad: 0, sku: item.sku, descripcion: item.descripcion };
      current.cantidad += item.cantidad;
      map.set(item.producto_id, current);
      return map;
    }, new Map());

    for (const [productId, request] of requestedByProduct.entries()) {
      const stock = await client.query(
        `SELECT stock_actual
         FROM productos
         WHERE id = $1
           AND empresa_id = $2
           AND visible = true`,
        [productId, req.tenant.id]
      );
      if (!stock.rows[0] || Number(stock.rows[0].stock_actual) < request.cantidad) {
        const error = new Error(`Stock insuficiente para ${request.sku || request.descripcion || 'este producto'}`);
        error.statusCode = 409;
        throw error;
      }
    }

    const aplicaIsv = customer.rows[0].aplica_isv === true;
    const subtotal = validatedItems.reduce((sum, item) => sum + item.precio_unitario * item.cantidad, 0);
    const isv = aplicaIsv ? subtotal * 0.15 : 0;
    const total = subtotal + isv;
    const numero = await nextOrderNumber(client, req.tenant.id);
    const order = await client.query(
      `INSERT INTO pedidos (empresa_id, cliente_id, numero, estado, total, isv)
       VALUES ($1, $2, $3, 'pendiente', $4, $5)
       RETURNING *`,
      [req.tenant.id, payload.cliente_id, numero, total, isv]
    );

    for (const item of validatedItems) {
      await client.query(
        `INSERT INTO pedido_items (pedido_id, producto_id, sucursal_id, cantidad, precio_unitario)
         VALUES ($1, $2, $3, $4, $5)`,
        [order.rows[0].id, item.producto_id, item.sucursal_id, item.cantidad, item.precio_unitario]
      );
    }

    await client.query('COMMIT');

    dispatchWebhookEvent({
      empresaId: req.tenant.id,
      eventType: 'order.created',
      payload: {
        order: order.rows[0],
        items: validatedItems,
        source: 'public_api'
      }
    }).catch((err) => console.warn('[webhooks] public order.created failed:', err.message || err));

    res.status(201).json({
      order: order.rows[0],
      items: validatedItems
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'No se pudo crear el pedido' });
  } finally {
    if (client) client.release();
  }
});

router.get('/v1/orders', requireApiKey('orders:read'), async (req, res) => {
  try {
    const params = [req.tenant.id];
    const filters = [];

    const clienteId = Number(req.query.cliente_id);
    if (Number.isInteger(clienteId) && clienteId > 0) {
      params.push(clienteId);
      filters.push(`p.cliente_id = $${params.length}`);
    }

    const estado = String(req.query.estado || '').trim().toLowerCase();
    if (estado) {
      if (!ORDER_STATES.includes(estado)) {
        return res.status(400).json({ message: 'Estado invalido' });
      }
      params.push(estado);
      filters.push(`p.estado = $${params.length}`);
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    params.push(limit);

    const result = await db.query(
      `SELECT p.id,
              p.empresa_id,
              p.cliente_id,
              p.numero,
              p.estado,
              p.total,
              p.isv,
              p.fecha,
              u.nombre AS cliente_nombre
       FROM pedidos p
       JOIN clientes c ON c.id = p.cliente_id
       JOIN usuarios u ON u.id = c.usuario_id
       WHERE p.empresa_id = $1
         ${filters.length ? `AND ${filters.join(' AND ')}` : ''}
       ORDER BY p.fecha DESC
       LIMIT $${params.length}`,
      params
    );

    res.json({
      version: 'v1',
      orders: result.rows
    });
  } catch (error) {
    res.status(500).json({ message: 'No se pudieron cargar los pedidos' });
  }
});

router.get('/v1/orders/:id', requireApiKey('orders:read'), async (req, res) => {
  const orderId = Number(req.params.id);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return res.status(400).json({ message: 'Pedido invalido' });
  }

  try {
    const order = await db.query(
      `SELECT p.id,
              p.empresa_id,
              p.cliente_id,
              p.numero,
              p.estado,
              p.total,
              p.isv,
              p.fecha,
              u.nombre AS cliente_nombre
       FROM pedidos p
       JOIN clientes c ON c.id = p.cliente_id
       JOIN usuarios u ON u.id = c.usuario_id
       WHERE p.id = $1
         AND p.empresa_id = $2
       LIMIT 1`,
      [orderId, req.tenant.id]
    );
    if (!order.rows[0]) return res.status(404).json({ message: 'Pedido no encontrado' });

    const items = await db.query(
      `SELECT pi.id,
              pi.pedido_id,
              pi.producto_id,
              pi.sucursal_id,
              pi.cantidad,
              pi.precio_unitario,
              pr.sku,
              pr.descripcion,
              s.nombre AS sucursal
       FROM pedido_items pi
       JOIN productos pr ON pr.id = pi.producto_id
       JOIN sucursales s ON s.id = pi.sucursal_id
       WHERE pi.pedido_id = $1
       ORDER BY pi.id`,
      [orderId]
    );

    res.json({
      version: 'v1',
      order: {
        ...order.rows[0],
        items: items.rows
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'No se pudo cargar el pedido' });
  }
});

module.exports = router;
