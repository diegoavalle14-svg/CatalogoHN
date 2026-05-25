const express = require('express');
const db = require('../config/database');
const mock = require('../services/mockData');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/orders', authenticate, async (req, res) => {
  try {
    const params = [req.tenant.id];
    let clientFilter = '';
    if (req.user.rol === 'cliente') {
      params.push(req.user.cliente_id);
      clientFilter = `AND p.cliente_id = $${params.length}`;
    }

    const orders = await db.query(
      `SELECT p.*, u.nombre AS cliente_nombre
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
       WHERE p.empresa_id = $1`,
      [req.tenant.id]
    );

    const payload = orders.rows.map((order) => ({
      ...order,
      items: items.rows.filter((item) => item.pedido_id === order.id)
    }));

    res.json({ pedidos: payload });
  } catch (error) {
    const pedidos = req.user.rol === 'cliente'
      ? mock.pedidos.filter((pedido) => pedido.cliente_id === req.user.cliente_id)
      : mock.pedidos;
    res.json({ pedidos, mode: 'mock' });
  }
});

router.post('/orders', authenticate, requireRole('cliente'), async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'El pedido no contiene productos' });
  }
  if (items.some((item) => !Number.isInteger(Number(item.cantidad)) || Number(item.cantidad) <= 0 || !item.producto_id || !item.sucursal_id)) {
    return res.status(400).json({ message: 'El pedido contiene lineas invalidas' });
  }

  try {
    const created = await db.pool.connect();
    try {
      await created.query('BEGIN');
      const validatedItems = [];

      for (const item of items) {
        const quantity = Number(item.cantidad);
        if (!Number.isInteger(quantity) || quantity <= 0) {
          const error = new Error('Cantidad invalida en el pedido');
          error.statusCode = 400;
          throw error;
        }

        const product = await created.query(
          `SELECT p.id AS producto_id,
                  s.id AS sucursal_id,
                  COALESCE(pr.precio_promocion, pr.precio) AS precio_unitario
           FROM productos p
           JOIN sucursales s ON s.id = $2 AND s.cliente_id = $3
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
          sucursal_id: product.rows[0].sucursal_id,
          cantidad: quantity,
          precio_unitario: Number(product.rows[0].precio_unitario)
        });
      }

      const total = validatedItems.reduce((sum, item) => sum + item.precio_unitario * item.cantidad, 0);
      const isv = total - total / 1.15;
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
    } catch (error) {
      await created.query('ROLLBACK');
      throw error;
    } finally {
      created.release();
    }
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    const total = items.reduce((sum, item) => sum + Number(item.precio_unitario) * Number(item.cantidad), 0);
    const pedido = mock.addPedido({
      id: Date.now(),
      empresa_id: req.tenant.id,
      cliente_id: req.user.cliente_id,
      numero: `PED-${Date.now().toString().slice(-6)}`,
      estado: 'pendiente',
      total,
      isv: total - total / 1.15,
      fecha: new Date().toISOString(),
      items
    });
    res.status(201).json({ pedido, mode: 'mock' });
  }
});

router.patch('/orders/:id/status', authenticate, requireRole('admin', 'superadmin'), async (req, res) => {
  const { estado, confirmacion } = req.body;
  if (confirmacion !== 'CONFIRMAR') {
    return res.status(400).json({ message: 'Se requiere doble confirmacion' });
  }
  if (!['pendiente', 'preparando', 'enviado'].includes(estado)) {
    return res.status(400).json({ message: 'Estado invalido' });
  }

  try {
    const result = await db.query(
      'UPDATE pedidos SET estado = $1 WHERE id = $2 AND empresa_id = $3 RETURNING *',
      [estado, req.params.id, req.tenant.id]
    );
    res.json({ pedido: result.rows[0] });
  } catch (error) {
    res.json({ pedido: mock.updatePedido(Number(req.params.id), { estado }), mode: 'mock' });
  }
});

router.delete('/orders/:id', authenticate, requireRole('admin', 'superadmin'), async (req, res) => {
  if (req.body.confirmacion !== 'ELIMINAR') {
    return res.status(400).json({ message: 'Se requiere doble confirmacion' });
  }

  try {
    await db.query('DELETE FROM pedidos WHERE id = $1 AND empresa_id = $2', [req.params.id, req.tenant.id]);
    res.status(204).send();
  } catch (error) {
    mock.deletePedido(Number(req.params.id));
    res.status(204).send();
  }
});

module.exports = router;
