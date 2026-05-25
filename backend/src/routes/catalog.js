const express = require('express');
const db = require('../config/database');
const mock = require('../services/mockData');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/tenant', (req, res) => {
  res.json({ tenant: req.tenant });
});

router.get('/catalog', authenticate, async (req, res) => {
  try {
    const [brands, categories, products, branches] = await Promise.all([
      db.query('SELECT * FROM marcas WHERE empresa_id = $1 ORDER BY posicion, nombre', [req.tenant.id]),
      db.query('SELECT * FROM categorias WHERE empresa_id = $1 ORDER BY nombre', [req.tenant.id]),
      db.query(
        `SELECT p.*, m.nombre AS marca, c.nombre AS categoria,
          COALESCE(json_agg(DISTINCT pi.url) FILTER (WHERE pi.url IS NOT NULL), '[]') AS imagenes,
          pr.precio,
          COALESCE(pr.precio_promocion, pr.precio) AS precio_final
        FROM productos p
        LEFT JOIN marcas m ON m.id = p.marca_id
        LEFT JOIN categorias c ON c.id = p.categoria_id
        LEFT JOIN producto_imagenes pi ON pi.producto_id = p.id
        LEFT JOIN cliente_lista_precio clp ON clp.cliente_id = $2
        LEFT JOIN precios pr ON pr.producto_id = p.id AND pr.lista_precio_id = clp.lista_precio_id
        WHERE p.empresa_id = $1 AND p.visible = true
        GROUP BY p.id, m.nombre, c.nombre, pr.precio, pr.precio_promocion
        ORDER BY p.posicion, p.created_at DESC`,
        [req.tenant.id, req.user.cliente_id]
      ),
      req.user.cliente_id
        ? db.query('SELECT * FROM sucursales WHERE cliente_id = $1 ORDER BY nombre', [req.user.cliente_id])
        : Promise.resolve({ rows: [] })
    ]);

    res.json({
      tenant: req.tenant,
      marcas: brands.rows,
      categorias: categories.rows,
      productos: products.rows,
      sucursales: branches.rows
    });
  } catch (error) {
    res.json({
      tenant: mock.empresa,
      marcas: mock.marcas,
      categorias: mock.categorias,
      productos: mock.productos.map((product) => decorateMockProduct(product)),
      sucursales: mock.sucursales,
      mode: 'mock'
    });
  }
});

function decorateMockProduct(product) {
  const marca = mock.marcas.find((item) => item.id === product.marca_id);
  const categoria = mock.categorias.find((item) => item.id === product.categoria_id);
  return {
    ...product,
    marca: marca?.nombre || '',
    categoria: categoria?.nombre || '',
    precio: product.precios.mayorista,
    precio_final: product.precios.promocion || product.precios.mayorista
  };
}

module.exports = router;
