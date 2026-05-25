require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { resolveTenant } = require('./services/tenant');
const authRoutes = require('./routes/auth');
const catalogRoutes = require('./routes/catalog');
const orderRoutes = require('./routes/orders');
const adminRoutes = require('./routes/admin');
const superadminRoutes = require('./routes/superadmin');

const app = express();
const port = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true,
  credentials: true
}));
app.use(express.json({ limit: '2mb' }));
app.use(resolveTenant);

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    tenant: req.tenant?.slug || 'kolben',
    dbFallback: Boolean(req.dbUnavailable)
  });
});

app.use('/api/auth', authRoutes);
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
});
