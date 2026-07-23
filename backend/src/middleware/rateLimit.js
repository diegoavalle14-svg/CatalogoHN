function readPositiveInt(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.ip || req.socket?.remoteAddress || 'unknown';
}

function createRateLimiter({
  windowMs = readPositiveInt('RATE_LIMIT_WINDOW_MS', 60_000),
  max = readPositiveInt('RATE_LIMIT_MAX', 300),
  keyPrefix = 'api'
} = {}) {
  const hits = new Map();

  return (req, res, next) => {
    const now = Date.now();
    const tenant = req.tenant?.slug || req.header('x-tenant-slug') || 'public';
    const key = `${keyPrefix}:${tenant}:${clientIp(req)}`;
    const current = hits.get(key);

    if (!current || current.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      res.setHeader('RateLimit-Limit', String(max));
      res.setHeader('RateLimit-Remaining', String(max - 1));
      res.setHeader('RateLimit-Reset', String(Math.ceil((now + windowMs) / 1000)));
      return next();
    }

    current.count += 1;
    const remaining = Math.max(max - current.count, 0);
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(Math.ceil(current.resetAt / 1000)));

    if (current.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((current.resetAt - now) / 1000)));
      return res.status(429).json({ message: 'Demasiadas solicitudes. Intenta de nuevo en unos segundos.' });
    }

    if (hits.size > 10_000) {
      for (const [storedKey, value] of hits.entries()) {
        if (value.resetAt <= now) hits.delete(storedKey);
      }
    }

    return next();
  };
}

module.exports = {
  createRateLimiter,
  readPositiveInt
};
