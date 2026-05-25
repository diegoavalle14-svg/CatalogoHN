const express = require('express');
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const db = require('../config/database');
const mock = require('../services/mockData');
const { authenticate, requireRole } = require('../middleware/auth');
const multer = require('multer');
const sharp = require('sharp');

const router = express.Router();
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

router.post('/admin/uploads', authenticate, requireRole('admin', 'superadmin'), upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Imagen requerida' });

  const purpose = ['product', 'brand', 'tenant'].includes(req.body?.purpose) ? req.body.purpose : 'product';
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
    const [brands, categories, products] = await Promise.all([
      db.query('SELECT * FROM marcas WHERE empresa_id = $1 ORDER BY posicion, nombre', [req.tenant.id]),
      db.query('SELECT * FROM categorias WHERE empresa_id = $1 ORDER BY nombre', [req.tenant.id]),
      queryAdminProducts(req.tenant.id)
    ]);

    res.json({
      tenant: req.tenant,
      marcas: brands.rows,
      categorias: categories.rows,
      productos: products.rows
    });
  } catch (error) {
    res.json(mockAdminCatalog());
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
  const { nombre, color = '#F5C200' } = req.body || {};
  if (!nombre) return res.status(400).json({ message: 'Nombre de categoria requerido' });

  try {
    const result = await db.query(
      `INSERT INTO categorias (empresa_id, nombre, color)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [req.tenant.id, String(nombre).trim(), color]
    );
    res.status(201).json({ categoria: result.rows[0] });
  } catch (error) {
    res.status(error.code === '23505' ? 409 : 500).json({ message: error.code === '23505' ? 'La categoria ya existe' : 'No se pudo crear la categoria' });
  }
});

router.patch('/admin/categories/:id', authenticate, requireRole('admin', 'superadmin'), async (req, res) => {
  const { nombre, color } = req.body || {};
  try {
    const result = await db.query(
      `UPDATE categorias
       SET nombre = COALESCE($1, nombre),
           color = COALESCE($2, color)
       WHERE id = $3 AND empresa_id = $4
       RETURNING *`,
      [nombre ? String(nombre).trim() : null, color ?? null, req.params.id, req.tenant.id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Categoria no encontrada' });
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
    return res.status(400).json({ message: 'Codigo y descripcion son requeridos' });
  }

  try {
    const result = await db.query(
      `INSERT INTO productos (empresa_id, marca_id, categoria_id, sku, descripcion, specs, visible, en_promocion, posicion)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)
       RETURNING id`,
      [req.tenant.id, payload.marca_id, payload.categoria_id, payload.sku, payload.descripcion, JSON.stringify(payload.specs), payload.visible, payload.en_promocion, payload.posicion]
    );
    await replaceProductImages(result.rows[0].id, payload.imagenes);
    await upsertProductPrice(req.tenant.id, result.rows[0].id, payload.precio, payload.precio_promocion);
    res.status(201).json({ producto: await getAdminProduct(req.tenant.id, result.rows[0].id) });
  } catch (error) {
    res.status(error.code === '23505' ? 409 : 500).json({ message: error.code === '23505' ? 'El codigo ya existe' : 'No se pudo crear el producto' });
  }
});

router.patch('/admin/products/:id', authenticate, requireRole('admin', 'superadmin'), async (req, res) => {
  const payload = normalizeProductPayload(req.body || {}, true);

  try {
    const result = await db.query(
      `UPDATE productos
       SET marca_id = COALESCE($1, marca_id),
           categoria_id = COALESCE($2, categoria_id),
           sku = COALESCE($3, sku),
           descripcion = COALESCE($4, descripcion),
           specs = COALESCE($5::jsonb, specs),
           visible = COALESCE($6, visible),
           en_promocion = COALESCE($7, en_promocion),
           posicion = COALESCE($8, posicion),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $9 AND empresa_id = $10
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
        req.params.id,
        req.tenant.id
      ]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Producto no encontrado' });
    if (Array.isArray(payload.imagenes)) await replaceProductImages(result.rows[0].id, payload.imagenes);
    if (payload.precio !== null || payload.precio_promocion !== null) {
      await upsertProductPrice(req.tenant.id, result.rows[0].id, payload.precio, payload.precio_promocion);
    }
    res.json({ producto: await getAdminProduct(req.tenant.id, result.rows[0].id) });
  } catch (error) {
    res.status(error.code === '23505' ? 409 : 500).json({ message: error.code === '23505' ? 'El codigo ya existe' : 'No se pudo actualizar el producto' });
  }
});

router.delete('/admin/products/:id', authenticate, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    await db.query('DELETE FROM productos WHERE id = $1 AND empresa_id = $2', [req.params.id, req.tenant.id]);
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ message: 'No se pudo eliminar el producto' });
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
    imagenes: input.imagenes,
    precio: input.precio === undefined ? null : Number(input.precio) || 0,
    precio_promocion: input.precio_promocion === undefined || input.precio_promocion === '' ? null : Number(input.precio_promocion) || null
  };
}

function normalizeId(value, partial) {
  if (value === undefined && partial) return null;
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}

async function queryAdminProducts(tenantId) {
  return db.query(
    `SELECT p.*, m.nombre AS marca, c.nombre AS categoria,
      COALESCE(json_agg(DISTINCT pi.url) FILTER (WHERE pi.url IS NOT NULL), '[]') AS imagenes,
      pr.precio,
      pr.precio_promocion,
      COALESCE(pr.precio_promocion, pr.precio) AS precio_final
     FROM productos p
     LEFT JOIN marcas m ON m.id = p.marca_id
     LEFT JOIN categorias c ON c.id = p.categoria_id
     LEFT JOIN producto_imagenes pi ON pi.producto_id = p.id
     LEFT JOIN precios pr ON pr.producto_id = p.id
     WHERE p.empresa_id = $1
     GROUP BY p.id, m.nombre, c.nombre, pr.precio, pr.precio_promocion
     ORDER BY p.posicion, p.created_at DESC`,
    [tenantId]
  );
}

async function getAdminProduct(tenantId, productId) {
  const result = await db.query(
    `SELECT p.*, m.nombre AS marca, c.nombre AS categoria,
      COALESCE(json_agg(DISTINCT pi.url) FILTER (WHERE pi.url IS NOT NULL), '[]') AS imagenes,
      pr.precio,
      pr.precio_promocion,
      COALESCE(pr.precio_promocion, pr.precio) AS precio_final
     FROM productos p
     LEFT JOIN marcas m ON m.id = p.marca_id
     LEFT JOIN categorias c ON c.id = p.categoria_id
     LEFT JOIN producto_imagenes pi ON pi.producto_id = p.id
     LEFT JOIN precios pr ON pr.producto_id = p.id
     WHERE p.empresa_id = $1 AND p.id = $2
     GROUP BY p.id, m.nombre, c.nombre, pr.precio, pr.precio_promocion`,
    [tenantId, productId]
  );
  return result.rows[0];
}

async function replaceProductImages(productId, images = []) {
  if (!Array.isArray(images)) return;
  await db.query('DELETE FROM producto_imagenes WHERE producto_id = $1', [productId]);
  for (const [index, url] of images.filter(Boolean).entries()) {
    await db.query('INSERT INTO producto_imagenes (producto_id, url, orden) VALUES ($1, $2, $3)', [productId, url, index + 1]);
  }
}

async function upsertProductPrice(tenantId, productId, price, promoPrice) {
  if (price === null && promoPrice === null) return;
  const listResult = await db.query(
    `INSERT INTO listas_precios (empresa_id, nombre)
     VALUES ($1, 'Distribuidor Mayorista')
     ON CONFLICT (empresa_id, nombre)
     DO UPDATE SET nombre = EXCLUDED.nombre
     RETURNING id`,
    [tenantId]
  );
  const listId = listResult.rows[0].id;
  await db.query(
    `INSERT INTO precios (producto_id, lista_precio_id, precio, precio_promocion)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (producto_id, lista_precio_id)
     DO UPDATE SET precio = COALESCE(EXCLUDED.precio, precios.precio),
                   precio_promocion = EXCLUDED.precio_promocion`,
    [productId, listId, price, promoPrice]
  );
}

function mockAdminCatalog() {
  return {
    tenant: mock.empresa,
    marcas: mock.marcas,
    categorias: mock.categorias,
    productos: mock.productos.map((product) => {
      const marca = mock.marcas.find((item) => item.id === product.marca_id);
      const categoria = mock.categorias.find((item) => item.id === product.categoria_id);
      return {
        ...product,
        marca: marca?.nombre || '',
        categoria: categoria?.nombre || '',
        precio: product.precios.mayorista,
        precio_final: product.precios.promocion || product.precios.mayorista
      };
    }),
    mode: 'mock'
  };
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
  return { url: `${localPublicBaseUrl}/uploads/${key.replace(/\\/g, '/')}`, storage: 'local' };
}

module.exports = router;
