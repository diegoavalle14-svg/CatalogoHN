-- Drop tables if they exist (for easy resetting/seeding)
DROP TABLE IF EXISTS accesos_log CASCADE;
DROP TABLE IF EXISTS webhook_deliveries CASCADE;
DROP TABLE IF EXISTS webhook_endpoints CASCADE;
DROP TABLE IF EXISTS api_request_logs CASCADE;
DROP TABLE IF EXISTS api_keys CASCADE;
DROP TABLE IF EXISTS superadmin_eventos CASCADE;
DROP TABLE IF EXISTS solicitudes_registro CASCADE;
DROP TABLE IF EXISTS pedido_items CASCADE;
DROP TABLE IF EXISTS pedidos CASCADE;
DROP TABLE IF EXISTS cliente_lista_precio CASCADE;
DROP TABLE IF EXISTS precios CASCADE;
DROP TABLE IF EXISTS listas_precios CASCADE;
DROP TABLE IF EXISTS producto_imagenes CASCADE;
DROP TABLE IF EXISTS productos CASCADE;
DROP TABLE IF EXISTS categorias CASCADE;
DROP TABLE IF EXISTS marcas CASCADE;
DROP TABLE IF EXISTS sucursales CASCADE;
DROP TABLE IF EXISTS clientes CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;
DROP TABLE IF EXISTS empresas CASCADE;

-- 1. Empresas (Tenants)
CREATE TABLE empresas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    subnombre VARCHAR(140) DEFAULT '',
    slug VARCHAR(50) UNIQUE NOT NULL,
    logo_url TEXT,
    color_primario VARCHAR(7) DEFAULT '#f0f0f0', -- Hex colors
    color_secundario VARCHAR(7) DEFAULT '#111111',
    fuente VARCHAR(50) DEFAULT 'Aptos',
    activa BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Usuarios
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    empresa_id INT REFERENCES empresas(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    username VARCHAR(60),
    email VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    rol VARCHAR(20) NOT NULL CHECK (rol IN ('superadmin', 'admin', 'cliente')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_email_per_tenant UNIQUE (empresa_id, email),
    CONSTRAINT unique_username_per_tenant UNIQUE (empresa_id, username)
);

-- 3. Clientes Mayoristas
CREATE TABLE clientes (
    id SERIAL PRIMARY KEY,
    usuario_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    empresa_id INT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    condicion_credito VARCHAR(50) DEFAULT 'Contado',
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_usuario_cliente UNIQUE (usuario_id)
);

-- 4. Sucursales de Clientes
CREATE TABLE sucursales (
    id SERIAL PRIMARY KEY,
    cliente_id INT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    direccion TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Marcas
CREATE TABLE marcas (
    id SERIAL PRIMARY KEY,
    empresa_id INT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    logo_url TEXT,
    posicion INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_marca_name_per_tenant UNIQUE (empresa_id, nombre)
);

-- 6. Categorías
CREATE TABLE categorias (
    id SERIAL PRIMARY KEY,
    empresa_id INT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    color VARCHAR(20),
    imagen_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_categoria_name_per_tenant UNIQUE (empresa_id, nombre)
);

-- 7. Productos
CREATE TABLE productos (
    id SERIAL PRIMARY KEY,
    empresa_id INT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    marca_id INT REFERENCES marcas(id) ON DELETE SET NULL,
    categoria_id INT REFERENCES categorias(id) ON DELETE SET NULL,
    sku VARCHAR(50) NOT NULL,
    descripcion TEXT NOT NULL,
    specs JSONB, -- Storing vehicle applications, technical specs, etc.
    stock_actual INT NOT NULL DEFAULT 0,
    stock_minimo INT NOT NULL DEFAULT 0,
    visible BOOLEAN DEFAULT TRUE,
    en_promocion BOOLEAN DEFAULT FALSE,
    posicion INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_sku_per_tenant UNIQUE (empresa_id, sku)
);

-- 8. Imágenes de Productos (Múltiples)
CREATE TABLE producto_imagenes (
    id SERIAL PRIMARY KEY,
    producto_id INT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    orden INT DEFAULT 0
);

-- 9. Listas de Precios (Segmentación de Clientes)
CREATE TABLE listas_precios (
    id SERIAL PRIMARY KEY,
    empresa_id INT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_lista_name_per_tenant UNIQUE (empresa_id, nombre)
);

-- 10. Precios de Productos en Listas
CREATE TABLE precios (
    id SERIAL PRIMARY KEY,
    producto_id INT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    lista_precio_id INT NOT NULL REFERENCES listas_precios(id) ON DELETE CASCADE,
    precio NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    precio_promocion NUMERIC(12, 2) DEFAULT NULL,
    visible_cliente BOOLEAN DEFAULT TRUE,
    CONSTRAINT unique_precio_por_producto_y_lista UNIQUE (producto_id, lista_precio_id)
);

-- 11. Relación Cliente -> Lista de Precios
CREATE TABLE cliente_lista_precio (
    cliente_id INT PRIMARY KEY REFERENCES clientes(id) ON DELETE CASCADE,
    lista_precio_id INT NOT NULL REFERENCES listas_precios(id) ON DELETE CASCADE
);

-- 12. Pedidos
CREATE TABLE pedidos (
    id SERIAL PRIMARY KEY,
    empresa_id INT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    cliente_id INT NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
    numero VARCHAR(50) NOT NULL,
    estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'preparando', 'enviado')),
    total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    isv NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_pedido_numero UNIQUE (numero)
);

-- 13. Ítems de Pedidos (Multi-sucursal a nivel de ítem)
CREATE TABLE pedido_items (
    id SERIAL PRIMARY KEY,
    pedido_id INT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    producto_id INT NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
    sucursal_id INT NOT NULL REFERENCES sucursales(id) ON DELETE RESTRICT,
    cantidad INT NOT NULL CHECK (cantidad > 0),
    precio_unitario NUMERIC(12, 2) NOT NULL
);

-- 14. Logs de Accesos (Auditoría para administración)
CREATE TABLE accesos_log (
    id SERIAL PRIMARY KEY,
    usuario_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip VARCHAR(45),
    user_agent TEXT,
    geolocalizacion TEXT
);

-- 15. API keys para integraciones externas
CREATE TABLE api_keys (
    id SERIAL PRIMARY KEY,
    empresa_id INT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    nombre VARCHAR(120) NOT NULL,
    key_hash CHAR(64) UNIQUE NOT NULL,
    key_prefix VARCHAR(24) NOT NULL,
    scopes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    activa BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMP,
    created_by INT REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP
);

-- 16. Auditoria de API publica
CREATE TABLE api_request_logs (
    id SERIAL PRIMARY KEY,
    empresa_id INT REFERENCES empresas(id) ON DELETE SET NULL,
    api_key_id INT REFERENCES api_keys(id) ON DELETE SET NULL,
    method VARCHAR(10) NOT NULL,
    path TEXT NOT NULL,
    status_code INT NOT NULL,
    duration_ms INT NOT NULL,
    ip VARCHAR(80),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 17. Webhooks para integraciones
CREATE TABLE webhook_endpoints (
    id SERIAL PRIMARY KEY,
    empresa_id INT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    nombre VARCHAR(120) NOT NULL,
    url TEXT NOT NULL,
    secret TEXT NOT NULL,
    events TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    activa BOOLEAN DEFAULT TRUE,
    created_by INT REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP
);

CREATE TABLE webhook_deliveries (
    id SERIAL PRIMARY KEY,
    webhook_endpoint_id INT REFERENCES webhook_endpoints(id) ON DELETE SET NULL,
    empresa_id INT REFERENCES empresas(id) ON DELETE SET NULL,
    event_type VARCHAR(80) NOT NULL,
    payload JSONB NOT NULL,
    status_code INT,
    success BOOLEAN DEFAULT FALSE,
    error TEXT,
    duration_ms INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 18. Solicitudes públicas de registro
CREATE TABLE solicitudes_registro (
    id SERIAL PRIMARY KEY,
    empresa_nombre VARCHAR(140) NOT NULL,
    contacto VARCHAR(140) NOT NULL,
    email VARCHAR(140),
    telefono VARCHAR(40),
    rubro VARCHAR(120),
    mensaje TEXT,
    estado VARCHAR(30) DEFAULT 'pendiente',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE superadmin_subnombres (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(140) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 19. Historial de acciones del superadmin
CREATE TABLE superadmin_eventos (
    id SERIAL PRIMARY KEY,
    usuario_id INT REFERENCES usuarios(id) ON DELETE SET NULL,
    empresa_id INT REFERENCES empresas(id) ON DELETE SET NULL,
    tipo VARCHAR(80) NOT NULL,
    descripcion TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_productos_tenant_sku ON productos(empresa_id, sku);
CREATE INDEX idx_productos_visible ON productos(visible);
CREATE INDEX idx_precios_lookup ON precios(producto_id, lista_precio_id);
CREATE INDEX idx_pedidos_tenant_cliente ON pedidos(empresa_id, cliente_id);
CREATE INDEX idx_api_keys_tenant ON api_keys(empresa_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_request_logs_tenant_date ON api_request_logs(empresa_id, created_at DESC);
CREATE INDEX idx_api_request_logs_key_date ON api_request_logs(api_key_id, created_at DESC);
CREATE INDEX idx_webhook_endpoints_tenant ON webhook_endpoints(empresa_id);
CREATE INDEX idx_webhook_deliveries_tenant_date ON webhook_deliveries(empresa_id, created_at DESC);
