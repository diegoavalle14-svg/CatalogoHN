require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');
const db = require('./models/db');
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

  if (process.env.NODE_ENV === 'production') {
    if (!origins.length) {
      throw new Error('CORS_ORIGIN es obligatorio cuando NODE_ENV=production');
    }
    return origins;
  }

  return origins.length ? origins : true;
}

app.use(cors({
  origin: resolveCorsOrigin(),
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
});
