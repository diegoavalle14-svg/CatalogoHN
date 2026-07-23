require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');
const db = require('./config/database');
const { resolveTenant } = require('./services/tenant');
const { createRateLimiter, readPositiveInt } = require('./middleware/rateLimit');
const { auditPublicApi } = require('./middleware/apiAudit');
const authRoutes = require('./routes/auth');
const catalogRoutes = require('./routes/catalog');
const orderRoutes = require('./routes/orders');
const adminRoutes = require('./routes/admin');
const superadminRoutes = require('./routes/superadmin');
const publicApiRoutes = require('./routes/publicApi');

const app = express();
const port = process.env.PORT || 3001;

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

function resolveCorsOrigin() {
  const origins = String(process.env.CORS_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return (requestOrigin, callback) => {
    if (!requestOrigin) return callback(null, true);
    if (origins.includes(requestOrigin) || requestOrigin.endsWith('.catalogohn.com') || requestOrigin.includes('catalogohn')) {
      return callback(null, requestOrigin);
    }
    if (origins.length) {
      return callback(null, origins.includes(requestOrigin) ? requestOrigin : origins[0]);
    }
    callback(null, true);
  };
}

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
app.use(resolveTenant);

const apiRateLimiter = createRateLimiter({
  windowMs: readPositiveInt('RATE_LIMIT_WINDOW_MS', 60_000),
  max: readPositiveInt('RATE_LIMIT_MAX', 300),
  keyPrefix: 'api'
});
const authRateLimiter = createRateLimiter({
  windowMs: readPositiveInt('RATE_LIMIT_AUTH_WINDOW_MS', readPositiveInt('RATE_LIMIT_WINDOW_MS', 60_000)),
  max: readPositiveInt('RATE_LIMIT_AUTH_MAX', 30),
  keyPrefix: 'auth'
});

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    tenant: req.tenant?.slug || 'kolben',
    dbFallback: Boolean(req.dbUnavailable)
  });
});

app.use('/api/auth', authRateLimiter, authRoutes);
app.use('/api', apiRateLimiter);
app.use('/api/v1', auditPublicApi);
app.use('/api', publicApiRoutes);
app.use('/api', catalogRoutes);
app.use('/api', orderRoutes);
app.use('/api', adminRoutes);
app.use('/api', superadminRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Ruta no encontrada' });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ message: 'Error interno del servidor' });
});

app.listen(port, () => {
  console.log(`CatalogoHN API escuchando en http://localhost:${port}`);
  db.query('ALTER TABLE clientes ADD COLUMN IF NOT EXISTS aplica_isv BOOLEAN DEFAULT TRUE;').catch(() => {});
  db.query(`
    CREATE TABLE IF NOT EXISTS carrito_items (
      id SERIAL PRIMARY KEY,
      cliente_id INT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
      producto_id INT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
      sucursal_id INT NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
      cantidad INT NOT NULL CHECK (cantidad > 0),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT unique_carrito_item UNIQUE (cliente_id, producto_id, sucursal_id)
    );
    CREATE INDEX IF NOT EXISTS idx_carrito_items_cliente ON carrito_items(cliente_id);
  `).catch(() => {});
});
