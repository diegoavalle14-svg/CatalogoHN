const express = require('express');
const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { sendMail } = require('../services/mailer');
const { buildAdminNewOrderEmail, buildClientStatusEmail, buildAdminEditedOrderEmail, buildAdminDeletedOrderEmail } = require('../services/orderEmails');
const { ensureProductInventoryColumns, ensurePricePromoActiveColumn, ensureBranchActiveColumn } = require('../services/schemaGuards');
const { enumValue, handleValidationError, positiveInt, validateOrderItems } = require('../services/validators');
const { dispatchWebhookEvent } = require('../services/webhooks');

const router = express.Router();

async function queryOrderEmailContext(tenantId, orderId) {
  const orderRes = await db.query(
    `SELECT p.*, u.nombre AS cliente_nombre, u.email AS cliente_email, e.nombre AS tenant_nombre, e.email_notificaciones, e.notificaciones_activas
     FROM pedidos p
     JOIN clientes c ON c.id = p.cliente_id
     JOIN usuarios u ON u.id = c.usuario_id
     JOIN empresas e ON e.id = p.empresa_id
     WHERE p.empresa_id = $1 AND p.id = $2
     LIMIT 1`,
    [tenantId, orderId]
  );
  const order = orderRes.rows[0];
  if (!order) return null;

  const itemsRes = await db.query(
    `SELECT pi.*, pr.sku, pr.descripcion, s.nombre AS sucursal
     FROM pedido_items pi
     JOIN productos pr ON pr.id = pi.producto_id
     JOIN sucursales s ON s.id = pi.sucursal_id
     WHERE pi.pedido_id = $1
     ORDER BY pr.sku, s.id`,
    [orderId]
  );

  return { order, items: itemsRes.rows };
}

async function decrementOrderStock(client, tenantId, orderId) {
  const items = await client.query(
    `SELECT pi.producto_id,
            pr.sku,
            pr.descripcion,
            SUM(pi.cantidad)::int AS cantidad
     FROM pedido_items pi
     JOIN productos pr ON pr.id = pi.producto_id
     JOIN pedidos p ON p.id = pi.pedido_id
     WHERE p.id = $1 AND p.empresa_id = $2
     GROUP BY pi.producto_id, pr.sku, pr.descripcion`,
    [orderId, tenantId]
  );

  for (const item of items.rows) {
    const stock = await client.query(
      `UPDATE productos
       SET stock_actual = stock_actual - $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
         AND empresa_id = $3
         AND visible = true
         AND stock_actual >= $1
       RETURNING stock_actual`,
      [item.cantidad, item.producto_id, tenantId]
    );

    if (!stock.rows[0]) {
      const error = new Error(`Stock insuficiente para ${item.sku || item.descripcion || 'este producto'}`);
      error.statusCode = 409;
      throw error;
    }
  }
}

async function incrementOrderStock(client, tenantId, orderId) {
  const items = await client.query(
    `SELECT pi.producto_id,
            pr.sku,
            pr.descripcion,
            SUM(pi.cantidad)::int AS cantidad
     FROM pedido_items pi
     JOIN productos pr ON pr.id = pi.producto_id
     JOIN pedidos p ON p.id = pi.pedido_id
     WHERE p.id = $1 AND p.empresa_id = $2
     GROUP BY pi.producto_id, pr.sku, pr.descripcion`,
    [orderId, tenantId]
  );

  for (const item of items.rows) {
    await client.query(
      `UPDATE productos
       SET stock_actual = stock_actual + $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
         AND empresa_id = $3`,
      [item.cantidad, item.producto_id, tenantId]
    );
  }
}

router.get('/orders', authenticate, async (req, res) => {
  try {
    const params = [req.tenant.id];
    let clientFilter = '';
    if (req.user.rol === 'cliente') {
      params.push(req.user.cliente_id);
      clientFilter = `AND p.cliente_id = $${params.length}`;
    }

    const orders = await db.query(
      `SELECT p.*, u.nombre AS cliente_nombre, c.aplica_isv
       FROM pedidos p
       JOIN clientes c ON c.id = p.cliente_id
       JOIN usuarios u ON u.id = c.usuario_id
       WHERE p.empresa_id = $1 ${clientFilter}
       ORDER BY p.fecha DESC`,
      params
    );

    const items = await db.query(
      `SELECT pi.*, pr.sku, pr.descripcion, s.nombre AS sucursal
       FROM pedido_items pi
       JOIN productos pr ON pr.id = pi.producto_id
       JOIN sucursales s ON s.id = pi.sucursal_id
       JOIN pedidos p ON p.id = pi.pedido_id
       WHERE p.empresa_id = $1
       ORDER BY pr.sku, s.id`,
      [req.tenant.id]
    );

    const payload = orders.rows.map((order) => {
      const orderItems = items.rows.filter((item) => item.pedido_id === order.id);
      return {
        ...order,
        isv: Number(order.isv) || 0,
        total: Number(order.total) || 0,
        items: orderItems
      };
    });

    res.json({ pedidos: payload });
  } catch (error) {
    res.status(500).json({ message: 'No se pudieron cargar los pedidos' });
  }
});

router.post('/orders', authenticate, requireRole('cliente'), async (req, res) => {
  try {
    req.body = { ...(req.body || {}), items: validateOrderItems(req.body) };
  } catch (error) {
    return handleValidationError(error, res, 'El pedido contiene lineas invalidas');
  }

  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'El pedido no contiene productos' });
  }
  if (items.some((item) => !Number.isInteger(Number(item.cantidad)) || Number(item.cantidad) <= 0 || !item.producto_id || !item.sucursal_id)) {
    return res.status(400).json({ message: 'El pedido contiene líneas inválidas' });
  }

  try {
    await ensureProductInventoryColumns();
    await ensurePricePromoActiveColumn();
    await ensureBranchActiveColumn();
    const created = await db.pool.connect();
    try {
      await created.query('BEGIN');
      const validatedItems = [];

      for (const item of items) {
        const quantity = Number(item.cantidad);
        if (!Number.isInteger(quantity) || quantity <= 0) {
          const error = new Error('Cantidad inválida en el pedido');
          error.statusCode = 400;
          throw error;
        }

        const product = await created.query(
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
          [item.producto_id, item.sucursal_id, req.user.cliente_id, req.tenant.id]
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
          cantidad: quantity,
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
        const stock = await created.query(
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

      const clientRes = await created.query(
        `SELECT aplica_isv FROM clientes WHERE id = $1 AND empresa_id = $2`,
        [req.user.cliente_id, req.tenant.id]
      );
      const aplicaIsv = clientRes.rows[0]?.aplica_isv === true;

      const subtotal = validatedItems.reduce((sum, item) => sum + item.precio_unitario * item.cantidad, 0);
      const isv = aplicaIsv ? subtotal * 0.15 : 0;
      const total = subtotal + isv;
      const numero = `PED-${Date.now().toString().slice(-6)}`;
      const order = await created.query(
        `INSERT INTO pedidos (empresa_id, cliente_id, numero, estado, total, isv)
         VALUES ($1, $2, $3, 'pendiente', $4, $5)
         RETURNING *`,
        [req.tenant.id, req.user.cliente_id, numero, total, isv]
      );

      for (const item of validatedItems) {
        await created.query(
          `INSERT INTO pedido_items (pedido_id, producto_id, sucursal_id, cantidad, precio_unitario)
           VALUES ($1, $2, $3, $4, $5)`,
          [order.rows[0].id, item.producto_id, item.sucursal_id, item.cantidad, item.precio_unitario]
        );
      }

      await created.query('COMMIT');
      res.status(201).json({ pedido: order.rows[0] });

      dispatchWebhookEvent({
        empresaId: req.tenant.id,
        eventType: 'order.created',
        payload: {
          order: order.rows[0],
          items: validatedItems
        }
      }).catch((err) => console.warn('[webhooks] order.created failed:', err.message || err));

      // Notify admins asynchronously (do not block the checkout UX).
      (async () => {
        try {
          const ctx = await queryOrderEmailContext(req.tenant.id, order.rows[0].id);
          if (!ctx) return;
          const admins = await db.query(
            `SELECT email
             FROM usuarios
             WHERE empresa_id = $1 AND rol IN ('admin')
             ORDER BY id`,
            [req.tenant.id]
          );
           const to = Array.from(new Set([
             ...admins.rows.map((row) => row.email).filter(Boolean),
             (ctx.order.notificaciones_activas !== false && ctx.order.email_notificaciones) ? ctx.order.email_notificaciones : null
           ].filter(Boolean)))
           .filter((email) => !email.endsWith('.local'));

          console.log('[DEBUG] [orders] New Order - to:', to, 'notif_active:', ctx.order.notificaciones_activas, 'email_notif:', ctx.order.email_notificaciones);

          const email = buildAdminNewOrderEmail({
            tenantName: ctx.order.tenant_nombre,
            order: ctx.order,
            clientName: ctx.order.cliente_nombre,
            items: ctx.items
          });

          const { generateOrderPDF } = require('../services/pdfGenerator');
          const pdfBuffer = await generateOrderPDF(ctx.order, ctx.items);
          const pdfAttachment = [{
            filename: `pedido-${ctx.order.numero || 'nuevo'}.pdf`,
            content: pdfBuffer
          }];

          for (const recipient of to) {
            try {
              await sendMail({ to: recipient, subject: email.subject, html: email.html, attachments: pdfAttachment });
              console.log('[mailer] Sent new order email with PDF to:', recipient);
            } catch (err) {
              console.warn('[mailer] Failed to send new order email to:', recipient, err.message || err);
            }
          }
        } catch (err) {
          console.warn('[orders] admin email failed:', err.message || err);
        }
      })();
    } catch (error) {
      await created.query('ROLLBACK');
      throw error;
    } finally {
      created.release();
    }
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'No se pudo crear el pedido' });
  }
});

router.put('/orders/:id', authenticate, requireRole('cliente', 'admin', 'superadmin'), async (req, res) => {
  const { items } = req.body;
  console.log('[DEBUG] PUT /orders/:id - items received:', items);
  
  if (!Array.isArray(items) || items.length === 0) {
    console.log('[DEBUG] Validation failed: items is not an array or empty');
    return res.status(400).json({ message: 'El pedido debe tener al menos un producto' });
  }
  
  const invalidItem = items.find((item) => !Number.isInteger(Number(item.cantidad)) || Number(item.cantidad) <= 0 || !item.id);
  if (invalidItem) {
    console.log('[DEBUG] Validation failed: invalid item:', invalidItem);
    return res.status(400).json({ message: 'Líneas del pedido inválidas' });
  }

  try {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const orderRes = await client.query(
        'SELECT * FROM pedidos WHERE id = $1 AND empresa_id = $2 FOR UPDATE',
        [req.params.id, req.tenant.id]
      );
      const order = orderRes.rows[0];
      if (!order) {
        console.log('[DEBUG] Order not found:', req.params.id, req.tenant.id);
        return res.status(404).json({ message: 'Pedido no encontrado' });
      }
      
      // If user is a client, check if they own the order
      if (req.user.role === 'cliente' && order.cliente_id !== req.user.cliente_id) {
        console.log('[DEBUG] Unauthorized: client does not own this order', req.user.cliente_id, 'order.cliente_id:', order.cliente_id);
        return res.status(403).json({ message: 'No tienes permiso para editar este pedido' });
      }

      if (order.estado !== 'pendiente') {
        console.log('[DEBUG] Order state is not pendiente:', order.estado);
        return res.status(400).json({ message: 'Solo se pueden editar pedidos en estado pendiente' });
      }

      // Update the items in the order
      for (const item of items) {
        console.log('[DEBUG] Updating item:', item.id, 'to qty:', item.cantidad);
        const updateRes = await client.query(
          'UPDATE pedido_items SET cantidad = $1 WHERE id = $2 AND pedido_id = $3 RETURNING *',
          [Number(item.cantidad), item.id, order.id]
        );
        console.log('[DEBUG] Update result rows:', updateRes.rows);
      }

      // Recalculate totals
      const currentItems = await client.query(
        'SELECT pi.*, c.aplica_isv FROM pedido_items pi JOIN pedidos p ON p.id = pi.pedido_id JOIN clientes c ON c.id = p.cliente_id WHERE pi.pedido_id = $1',
        [order.id]
      );

      const aplicaIsv = currentItems.rows[0]?.aplica_isv === true;
      const subtotal = currentItems.rows.reduce((sum, row) => sum + Number(row.precio_unitario) * Number(row.cantidad), 0);
      const isv = aplicaIsv ? subtotal * 0.15 : 0;
      const total = subtotal + isv;

      const result = await client.query(
        'UPDATE pedidos SET total = $1, isv = $2 WHERE id = $3 RETURNING *',
        [total, isv, order.id]
      );

      await client.query('COMMIT');
      res.json({ pedido: result.rows[0] });

      // Notify admins asynchronously (do not block client UX)
      (async () => {
        try {
          const ctx = await queryOrderEmailContext(req.tenant.id, order.id);
          if (!ctx) return;
          const admins = await db.query(
            `SELECT email
             FROM usuarios
             WHERE empresa_id = $1 AND rol IN ('admin')
             ORDER BY id`,
            [req.tenant.id]
          );
          const to = Array.from(new Set([
            ...admins.rows.map((row) => row.email).filter(Boolean),
            (ctx.order.notificaciones_activas !== false && ctx.order.email_notificaciones) ? ctx.order.email_notificaciones : null
          ].filter(Boolean)))
          .filter((email) => !email.endsWith('.local'));
          
          console.log('[DEBUG] [orders] Edited Order - to:', to, 'notif_active:', ctx.order.notificaciones_activas, 'email_notif:', ctx.order.email_notificaciones);
          
          const email = buildAdminEditedOrderEmail({
            tenantName: ctx.order.tenant_nombre,
            order: ctx.order,
            clientName: ctx.order.cliente_nombre,
            items: ctx.items
          });

          const { generateOrderPDF } = require('../services/pdfGenerator');
          const pdfBuffer = await generateOrderPDF(ctx.order, ctx.items);
          const pdfAttachment = [{
            filename: `pedido-${ctx.order.numero || 'editado'}.pdf`,
            content: pdfBuffer
          }];

          for (const recipient of to) {
            try {
              await sendMail({ to: recipient, subject: email.subject, html: email.html, attachments: pdfAttachment });
              console.log('[mailer] Sent edit order email with PDF to:', recipient);
            } catch (err) {
              console.warn('[mailer] Failed to send edit order email to:', recipient, err.message || err);
            }
          }
        } catch (err) {
          console.warn('[orders] admin edit email failed:', err.message || err);
        }
      })();
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[DEBUG] DB transaction error:', err);
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[DEBUG] Catch-all error:', error);
    res.status(500).json({ message: error.message || 'No se pudo actualizar el pedido' });
  }
});

router.patch('/orders/:id/status', authenticate, requireRole('admin', 'superadmin'), async (req, res) => {
  const { estado, confirmacion } = req.body;
  if (confirmacion !== 'CONFIRMAR') {
    return res.status(400).json({ message: 'Se requiere doble confirmación' });
  }
  if (!['pendiente', 'preparando', 'enviado'].includes(estado)) {
    return res.status(400).json({ message: 'Estado inválido' });
  }

  try {
    await ensureProductInventoryColumns();
    const client = await db.pool.connect();
    let pedido;
    try {
      await client.query('BEGIN');
      const current = await client.query(
        'SELECT * FROM pedidos WHERE id = $1 AND empresa_id = $2 FOR UPDATE',
        [req.params.id, req.tenant.id]
      );

      if (!current.rows[0]) {
        const error = new Error('Pedido no encontrado');
        error.statusCode = 404;
        throw error;
      }

      const previousStatus = current.rows[0].estado;
      const shouldDiscountStock = previousStatus === 'pendiente' && ['preparando', 'enviado'].includes(estado);
      const shouldRevertStock = ['preparando', 'enviado'].includes(previousStatus) && estado === 'pendiente';
      
      if (shouldDiscountStock) {
        await decrementOrderStock(client, req.tenant.id, req.params.id);
      } else if (shouldRevertStock) {
        await incrementOrderStock(client, req.tenant.id, req.params.id);
      }

      const result = await client.query(
        'UPDATE pedidos SET estado = $1 WHERE id = $2 AND empresa_id = $3 RETURNING *',
        [estado, req.params.id, req.tenant.id]
      );
      pedido = result.rows[0];
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    res.json({ pedido });

    dispatchWebhookEvent({
      empresaId: req.tenant.id,
      eventType: 'order.status_changed',
      payload: {
        order: pedido,
        status: pedido.estado
      }
    }).catch((err) => console.warn('[webhooks] order.status_changed failed:', err.message || err));

    // Notify client when state changes to preparing/shipped.
    if (['preparando', 'enviado'].includes(estado)) {
      (async () => {
        try {
          const ctx = await queryOrderEmailContext(req.tenant.id, pedido.id);
          if (!ctx) return;
          if (!ctx.order.cliente_email) return;
          if (ctx.order.cliente_email.endsWith('.local')) return;
          const email = buildClientStatusEmail({
            tenantName: ctx.order.tenant_nombre,
            order: ctx.order,
            clientName: ctx.order.cliente_nombre,
            items: ctx.items
          });

          const { generateOrderPDF } = require('../services/pdfGenerator');
          const pdfBuffer = await generateOrderPDF(ctx.order, ctx.items);
          const pdfAttachment = [{
            filename: `pedido-${ctx.order.numero || 'estado'}.pdf`,
            content: pdfBuffer
          }];

          await sendMail({ to: ctx.order.cliente_email, subject: email.subject, html: email.html, attachments: pdfAttachment });
        } catch (err) {
          console.warn('[orders] client email failed:', err.message || err);
        }
      })();
    }
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'No se pudo cambiar el estado del pedido' });
  }
});

router.delete('/orders/:id', authenticate, requireRole('cliente', 'admin', 'superadmin'), async (req, res) => {
  if (req.body.confirmacion !== 'ELIMINAR') {
    return res.status(400).json({ message: 'Se requiere doble confirmación' });
  }

  try {
    const orderRes = await db.query('SELECT estado, cliente_id FROM pedidos WHERE id = $1 AND empresa_id = $2', [req.params.id, req.tenant.id]);
    const order = orderRes.rows[0];
    if (!order) {
      return res.status(404).json({ message: 'Pedido no encontrado' });
    }

    if (req.user.rol === 'cliente') {
      if (order.cliente_id !== req.user.cliente_id) {
        return res.status(403).json({ message: 'No tienes permiso para eliminar este pedido' });
      }
      if (order.estado !== 'pendiente') {
        return res.status(400).json({ message: 'Solo se pueden eliminar pedidos en estado pendiente' });
      }
    }

    // Get context for notification email before deletion
    let emailCtx = null;
    try {
      emailCtx = await queryOrderEmailContext(req.tenant.id, req.params.id);
    } catch (e) {
      console.warn('[orders] failed to query context for deletion notification:', e.message);
    }

    await db.query('DELETE FROM pedidos WHERE id = $1 AND empresa_id = $2', [req.params.id, req.tenant.id]);
    res.status(204).send();

    if (emailCtx) {
      (async () => {
        try {
          const admins = await db.query(
            `SELECT email
             FROM usuarios
             WHERE empresa_id = $1 AND rol IN ('admin')
             ORDER BY id`,
            [req.tenant.id]
          );
          const to = Array.from(new Set([
            ...admins.rows.map((row) => row.email).filter(Boolean),
            (emailCtx.order.notificaciones_activas !== false && emailCtx.order.email_notificaciones) ? emailCtx.order.email_notificaciones : null
          ].filter(Boolean)))
          .filter((email) => !email.endsWith('.local'));
          
          console.log('[DEBUG] [orders] Deleted Order - to:', to, 'notif_active:', emailCtx.order.notificaciones_activas, 'email_notif:', emailCtx.order.email_notificaciones);
          
          const email = buildAdminDeletedOrderEmail({
            tenantName: emailCtx.order.tenant_nombre,
            order: emailCtx.order,
            clientName: emailCtx.order.cliente_nombre,
            items: emailCtx.items
          });

          for (const recipient of to) {
            try {
              await sendMail({ to: recipient, subject: email.subject, html: email.html });
              console.log('[mailer] Sent delete order email to:', recipient);
            } catch (err) {
              console.warn('[mailer] Failed to send delete order email to:', recipient, err.message || err);
            }
          }
        } catch (err) {
          console.warn('[orders] admin delete notification email failed:', err.message || err);
        }
      })();
    }
  } catch (error) {
    res.status(500).json({ message: 'No se pudo eliminar el pedido' });
  }
});

module.exports = router;
