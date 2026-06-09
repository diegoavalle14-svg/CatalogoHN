const jwt = require('jsonwebtoken');

function resolveJwtSecret() {
  const secret = process.env.JWT_SECRET || '';
  if (secret.trim()) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET es obligatorio cuando NODE_ENV=production');
  }
  return 'catalogohn-dev-secret-change-me';
}

const JWT_SECRET = resolveJwtSecret();

function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      empresa_id: user.empresa_id,
      rol: user.rol,
      cliente_id: user.cliente_id || null
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function authenticate(req, res, next) {
  const header = req.header('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Sesión requerida' });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    if (
      req.tenant?.id
      && req.user.rol !== 'superadmin'
      && req.user.empresa_id
      && Number(req.tenant.id) !== Number(req.user.empresa_id)
    ) {
      return res.status(403).json({ message: 'La sesión no pertenece a esta empresa' });
    }
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Sesión inválida o expirada' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.rol)) {
      return res.status(403).json({ message: 'No autorizado' });
    }
    next();
  };
}

module.exports = {
  authenticate,
  requireRole,
  signToken
};
