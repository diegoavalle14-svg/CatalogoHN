const { findApiKey, markApiKeyUsed } = require('../services/apiKeys');

function readApiKey(req) {
  const direct = req.header('x-api-key');
  if (direct) return direct.trim();

  const auth = req.header('authorization') || '';
  if (auth.toLowerCase().startsWith('apikey ')) {
    return auth.slice(7).trim();
  }

  return '';
}

function requireApiKey(...requiredScopes) {
  return async (req, res, next) => {
    const plainKey = readApiKey(req);
    if (!plainKey) {
      return res.status(401).json({ message: 'API key requerida' });
    }

    try {
      const apiKey = await findApiKey(plainKey);
      if (!apiKey || apiKey.activa === false || apiKey.revoked_at) {
        return res.status(401).json({ message: 'API key invalida o revocada' });
      }
      if (apiKey.tenant_activa === false) {
        return res.status(403).json({ message: 'Tenant inactivo' });
      }

      const scopes = Array.isArray(apiKey.scopes) ? apiKey.scopes : [];
      const allowed = requiredScopes.length === 0
        || scopes.includes('*')
        || requiredScopes.every((scope) => scopes.includes(scope));
      if (!allowed) {
        return res.status(403).json({ message: 'API key sin permisos suficientes' });
      }

      req.apiKey = apiKey;
      req.tenant = {
        id: apiKey.empresa_id,
        slug: apiKey.tenant_slug,
        nombre: apiKey.tenant_nombre,
        activa: apiKey.tenant_activa
      };
      markApiKeyUsed(apiKey.id);
      return next();
    } catch (error) {
      return res.status(500).json({ message: 'No se pudo validar la API key' });
    }
  };
}

module.exports = {
  requireApiKey
};
