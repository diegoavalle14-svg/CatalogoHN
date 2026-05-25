const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'catalogohn-dev-secret-change-me';

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
    return res.status(401).json({ message: 'Sesion requerida' });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Sesion invalida o expirada' });
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
