# CatalogoHN

Plataforma SaaS multi-tenant para distribuidoras en Honduras. El primer inquilino es **KOLBEN**, con una experiencia mobile-first para clientes mayoristas y un panel administrativo propio para gestionar el catalogo.

## Estado Actual

- Catalogo privado para clientes con buscador, marcas/categorias superiores, productos en 2 columnas en movil, cantidades por sucursal y pedido.
- Login por `usuario` y `contrasena`, con boton visual de recuperacion de contrasena.
- Panel Admin Kolben separado del catalogo del cliente.
- Panel Admin con 4 secciones: `Pedidos`, `Catalogo`, `Clientes` y `C. Precios`.
- Configuracion del sitio desde admin: logo, colores y fuente.
- CRUD visual/local para productos, marcas, categorias, clientes y precios.
- Superadmin separado para control de empresas/inquilinos.

> Nota: varios CRUD del panel admin ya estan maquetados y funcionan en estado local del frontend. La persistencia completa en backend para productos, marcas, categorias, clientes, precios e imagenes es el siguiente paso.

## Roles

### Cliente

Accede al catalogo privado del inquilino, busca productos, filtra por marca, agrega cantidades y envia pedidos.

### Admin de Empresa

Administra el sitio de su empresa/inquilino. Para KOLBEN puede:

- Revisar pedidos y cambiar estados.
- Gestionar catalogo, productos, marcas y categorias.
- Subir imagenes/logos desde formularios del panel.
- Gestionar clientes y condiciones.
- Revisar y editar precios por cliente/lista.

### Superadmin CatalogoHN

Gestiona empresas/inquilinos y debe ser el unico rol con capacidad de asignar o controlar admins de empresas.

## Credenciales Demo

El login principal usa usuario corto:

- Cliente: `cliente1` / `ClientPassword123`
- Admin Kolben: `admin` / `KolbenAdminPassword123`
- Superadmin: `superadmin` / `SuperAdminPassword123`

Tambien se mantiene compatibilidad con correos:

- `cliente1@autorepuestos.com`
- `admin@kolben.com`
- `superadmin@catalogohn.com`

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
```

## GitHub y AWS

La guia de publicacion esta en [DEPLOYMENT.md](DEPLOYMENT.md). El camino recomendado por ahora es:

- GitHub para versionar el monorepo.
- AWS Amplify Hosting para el frontend.
- AWS Elastic Beanstalk para el backend Node/Express.
- Amazon RDS PostgreSQL para la base de datos.

## Inquilinos

KOLBEN es el inquilino inicial. En produccion deberia operar como:

```text
kolben.catalogohn.com
```

En desarrollo el inquilino se resuelve con:

- `VITE_TENANT_SLUG=kolben` en frontend.
- Header `x-tenant-slug` hacia la API.

## Imagenes y Logos

La direccion correcta del producto es que los admins suban imagenes desde el Panel Admin de su empresa:

- Logo de empresa: boton `Logo` del header admin.
- Logos de marcas: seccion `Catalogo` -> `Marcas`.
- Imagenes de productos: seccion `Catalogo` -> `+ Nuevo` o `Editar`.

Actualmente los formularios aceptan archivos en frontend. Falta conectar esas subidas a almacenamiento real y guardar la URL en backend.

## Pendientes Tecnicos

- Persistir CRUD admin en endpoints reales.
- Implementar subida de imagenes con almacenamiento estable.
- Crear flujo real de recuperacion de contrasena.
- Agregar gestion de admins de empresa desde superadmin.
- Reemplazar datos seed/mock por datos reales administrables desde UI.
- Revisar permisos por rol en cada endpoint de admin.

## Seguridad

Los archivos `.env`, `.env.local`, `node_modules/`, `dist/` y `*.pem` estan excluidos en `.gitignore`. Las credenciales reales deben inyectarse en AWS Amplify/EC2 u otro entorno seguro y nunca guardarse en el repositorio.
