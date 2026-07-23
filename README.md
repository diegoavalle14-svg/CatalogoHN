# CatalogoHN

Plataforma SaaS multi-tenant para distribuidoras en Honduras. El primer inquilino es **KOLBEN**, con una experiencia mobile-first para clientes mayoristas y un panel administrativo propio para gestionar el catalogo.

## Estado Actual

- Catalogo privado para clientes con buscador, marcas/categorias superiores, productos en 2 columnas en movil, cantidades por sucursal y pedido.
- Login por `usuario` y `contrasena`, con boton visual de recuperacion de contrasena.
- Panel Admin Kolben separado del catalogo del cliente.
- Panel Admin con 4 secciones: `Pedidos`, `Catalogo`, `Clientes` y `C. Precios`.
- Configuracion del inquilino desde admin: nombre, subnombre, logo, colores, fuente y vista previa.
- CRUD de admin para productos, marcas y categorias conectado a endpoints backend reales.
- Subida de imagenes desde admin con compresion a WebP/JPEG y limite objetivo de 300 KB.
- Almacenamiento local de imagenes en desarrollo/preview y soporte opcional para S3-compatible object storage mas adelante.
- CRUD de clientes, listas de precios y precios conectado al backend.
- Superadmin separado para control de empresas/inquilinos.

> Nota: productos, marcas, categorias y subida de imagenes ya tienen endpoints base. Clientes, precios y configuracion final de almacenamiento son el siguiente bloque.

## Roles

### Cliente

Accede al catalogo privado del inquilino, busca productos, filtra por marca, agrega cantidades y envia pedidos.

### Admin de Empresa

Administra el sitio de su empresa/inquilino. Para KOLBEN puede:

- Revisar pedidos y cambiar estados.
- Gestionar catalogo, productos, marcas y categorias con persistencia en backend.
- Subir imagenes/logos desde formularios del panel.
- Gestionar clientes y condiciones.
- Revisar y editar precios por cliente/lista.

### Superadmin CatalogoHN

Gestiona empresas/inquilinos y debe ser el unico rol con capacidad de asignar o controlar admins de empresas.

## Credenciales Seed

El seed inicial crea usuarios de prueba para desarrollo y preview. Ver [docs/SEED_CREDENTIALS.md](docs/SEED_CREDENTIALS.md) para detalles.

## Estructura

- `backend/`: API REST Node.js + Express + PostgreSQL.
- `frontend/`: SPA React + Vite para catalogo, carrito, panel admin y superadmin.
- `frontend/public/`: assets publicos como imagenes de producto, logos o marcas.

## Ejecucion

### Backend

```bash
cd backend
npm install
npm run db:setup
npm run dev
```

API: `http://localhost:3001`

### Frontend

```bash
cd frontend
pnpm install
pnpm run dev
```

Frontend: `http://localhost:5173`

Variables publicas:

```bash
VITE_API_URL=http://localhost:3001/api
VITE_TENANT_SLUG=kolben
VITE_DEMO_MODE=false
```

## GitHub y DigitalOcean

La guia de publicacion esta en [DEPLOYMENT.md](DEPLOYMENT.md) y el runbook inicial para DigitalOcean esta en [docs/DIGITALOCEAN_DROPLET.md](docs/DIGITALOCEAN_DROPLET.md). El camino recomendado por ahora es:

- GitHub para versionar el monorepo.
- DigitalOcean Droplet para frontend, backend y PostgreSQL en una sola maquina.
- Nginx para servir el frontend y hacer proxy al backend.
- PostgreSQL local para evitar costos administrados mientras el MVP valida mercado.
- Backups/snapshots del Droplet y respaldos de PostgreSQL/uploads.

El despliegue debe manejar dos entornos:

- `develop`: rama de integracion conectada a preview.
- `main`: rama de produccion conectada al dominio principal.

Regla practica: trabajar en ramas `feature/...`, fusionar a `develop`, probar en preview, aprobar y luego fusionar a `main`.

## Inquilinos

KOLBEN es el inquilino inicial. En produccion deberia operar como:

```text
kolben.catalogohn.com
```

En desarrollo y despliegue inicial el inquilino se resuelve con:

- `VITE_TENANT_SLUG=kolben` en frontend.
- Header `x-tenant-slug` hacia la API.

## Imagenes y Logos

La direccion correcta del producto es que los admins suban imagenes desde el Panel Admin de su empresa:

- Logo de empresa y personalizacion: boton `Configurar` del header admin.
- Logos de marcas: seccion `Catalogo` -> `Marcas`.
- Imagenes de productos: seccion `Catalogo` -> `+ Nuevo` o `Editar`.

Las imagenes se guardan en `backend/uploads/` y Git las ignora. En DigitalOcean Droplet esta es la opcion inicial para controlar costos. Cuando haya mas trafico, se puede mover a DigitalOcean Spaces (S3-compatible) u otro almacenamiento de objetos.

## Pendientes Tecnicos

- Configurar DigitalOcean Droplet, Nginx, PostgreSQL local y Certbot.
- Definir rutina de backups de PostgreSQL y `backend/uploads/`.
- Crear flujo real de recuperacion de contrasena.
- Agregar gestion de admins de empresa desde superadmin.
- Reemplazar datos seed por datos reales administrables desde UI.
- Revisar permisos por rol en cada endpoint de admin.

## Seguridad

Los archivos `.env`, `.env.local`, `node_modules/`, `dist/` y `*.pem` estan excluidos en `.gitignore`. Las credenciales reales deben configurarse en `/etc/catalogohn/backend.env` u otro entorno seguro y nunca guardarse en el repositorio. En `NODE_ENV=production`, el backend requiere `JWT_SECRET` y `CORS_ORIGIN`; no debe arrancar con valores abiertos o de desarrollo.

Rate limiting backend:

```bash
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=300
RATE_LIMIT_AUTH_WINDOW_MS=60000
RATE_LIMIT_AUTH_MAX=30
```

## API Publica

La API vendible debe usar API keys por integracion. Las llaves se guardan hasheadas y solo se muestran una vez al crearlas desde superadmin.

Primer endpoint versionado:

```bash
GET /api/v1/catalog
X-API-Key=<api-key>
```

Permiso requerido: `catalog:read`.

Crear pedidos desde integraciones:

```bash
POST /api/v1/orders
X-API-Key=<api-key>
Content-Type: application/json
```

```json
{
  "cliente_id": 1,
  "items": [
    { "producto_id": 10, "sucursal_id": 3, "cantidad": 2 }
  ]
}
```

Permiso requerido: `orders:write`.

Consultar pedidos desde integraciones:

```bash
GET /api/v1/orders
GET /api/v1/orders/:id
X-API-Key=<api-key>
```

Filtros opcionales para listado:

```text
cliente_id
estado
limit
```

Permiso requerido: `orders:read`.

Scopes aceptados actualmente:

```text
catalog:read
orders:read
orders:write
stock:read
*
```

El superadmin puede revisar uso reciente por tenant:

```bash
GET /api/superadmin/tenants/:id/api-logs
```

## Webhooks

Los webhooks permiten notificar a integraciones externas sin que tengan que consultar la API constantemente.

Eventos disponibles:

```text
order.created
order.status_changed
catalog.updated
stock.updated
```

Endpoints superadmin:

```bash
GET /api/superadmin/tenants/:id/webhooks
POST /api/superadmin/tenants/:id/webhooks
PATCH /api/superadmin/webhooks/:id/revoke
GET /api/superadmin/tenants/:id/webhook-deliveries
```

Cada entrega incluye firma HMAC:

```text
X-CatalogoHN-Event
X-CatalogoHN-Timestamp
X-CatalogoHN-Signature
```
