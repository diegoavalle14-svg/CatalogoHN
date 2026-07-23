function validationError(message, details = []) {
  const error = new Error(message);
  error.statusCode = 400;
  error.details = details;
  return error;
}

function asObject(value, message = 'Payload invalido') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw validationError(message);
  }
  return value;
}

function optionalString(value, { max = 255, trim = true } = {}) {
  if (value === undefined || value === null) return '';
  const text = trim ? String(value).trim() : String(value);
  return text.slice(0, max);
}

function requiredString(value, { field, max = 255 } = {}) {
  const text = optionalString(value, { max });
  if (!text) throw validationError(`${field || 'Campo'} es requerido`);
  return text;
}

function positiveInt(value, { field, max = Number.MAX_SAFE_INTEGER } = {}) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0 || number > max) {
    throw validationError(`${field || 'Valor'} debe ser un entero positivo`);
  }
  return number;
}

function enumValue(value, allowed, { field = 'Valor' } = {}) {
  if (!allowed.includes(value)) {
    throw validationError(`${field} invalido`);
  }
  return value;
}

function stringArray(value, { field = 'Valores', maxItems = 20, maxLength = 80, allowed = null } = {}) {
  if (!Array.isArray(value)) throw validationError(`${field} debe ser una lista`);
  if (value.length > maxItems) throw validationError(`${field} excede el limite permitido`);
  const clean = [...new Set(value.map((item) => optionalString(item, { max: maxLength }).toLowerCase()).filter(Boolean))];
  if (allowed) {
    const invalid = clean.filter((item) => !allowed.includes(item));
    if (invalid.length) throw validationError(`${field} contiene valores no permitidos`, invalid);
  }
  return clean;
}

function validateOrderItems(input) {
  const body = asObject(input);
  const items = body.items;
  if (!Array.isArray(items) || items.length === 0) {
    throw validationError('El pedido no contiene productos');
  }
  if (items.length > 200) {
    throw validationError('El pedido excede el limite de lineas permitido');
  }

  return items.map((item) => {
    const row = asObject(item, 'Linea de pedido invalida');
    return {
      producto_id: positiveInt(row.producto_id, { field: 'Producto' }),
      sucursal_id: positiveInt(row.sucursal_id, { field: 'Sucursal' }),
      cantidad: positiveInt(row.cantidad, { field: 'Cantidad', max: 9999 })
    };
  });
}

function validatePublicOrderPayload(input) {
  const body = asObject(input);
  return {
    cliente_id: positiveInt(body.cliente_id, { field: 'Cliente' }),
    items: validateOrderItems(body)
  };
}

function validateApiKeyPayload(input) {
  const body = asObject(input);
  const allowedScopes = ['catalog:read', 'orders:read', 'orders:write', 'stock:read', '*'];
  return {
    nombre: requiredString(body.nombre, { field: 'Nombre de API key', max: 120 }),
    scopes: stringArray(body.scopes || ['catalog:read'], {
      field: 'Permisos',
      maxItems: 10,
      maxLength: 60,
      allowed: allowedScopes
    })
  };
}

function validateWebhookPayload(input, allowedEvents = []) {
  const body = asObject(input);
  const nombre = requiredString(body.nombre, { field: 'Nombre de webhook', max: 120 });
  const url = requiredString(body.url, { field: 'URL de webhook', max: 1000 });
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw validationError('URL de webhook invalida');
  }
  const allowedProtocols = process.env.NODE_ENV === 'production' ? ['https:'] : ['http:', 'https:'];
  if (!allowedProtocols.includes(parsed.protocol)) {
    throw validationError(process.env.NODE_ENV === 'production' ? 'La URL de webhook debe usar HTTPS' : 'La URL de webhook debe usar HTTP o HTTPS');
  }
  const events = stringArray(body.events || [], {
    field: 'Eventos',
    maxItems: 10,
    maxLength: 80,
    allowed: allowedEvents
  });
  if (!events.length) throw validationError('Debe asignar al menos un evento');
  return { nombre, url: parsed.toString(), events };
}

function handleValidationError(error, res, fallback = 'Datos invalidos') {
  if (error?.statusCode === 400) {
    return res.status(400).json({
      message: error.message || fallback,
      ...(error.details?.length ? { details: error.details } : {})
    });
  }
  throw error;
}

module.exports = {
  enumValue,
  handleValidationError,
  optionalString,
  positiveInt,
  requiredString,
  validateApiKeyPayload,
  validatePublicOrderPayload,
  validateWebhookPayload,
  validateOrderItems,
  validationError
};
