const { recordApiRequest } = require('../services/apiAudit');

function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.ip || req.socket?.remoteAddress || '';
}

function auditPublicApi(req, res, next) {
  const startedAt = Date.now();

  res.on('finish', () => {
    recordApiRequest({
      empresaId: req.apiKey?.empresa_id || req.tenant?.id || null,
      apiKeyId: req.apiKey?.id || null,
      method: req.method,
      path: req.originalUrl || req.url,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
      ip: clientIp(req),
      userAgent: req.header('user-agent') || ''
    }).catch((error) => {
      console.error('No se pudo registrar auditoria de API:', error.message);
    });
  });

  next();
}

module.exports = {
  auditPublicApi
};
