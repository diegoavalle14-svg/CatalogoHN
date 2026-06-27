# Deployment Guide

Guia inicial para publicar CatalogoHN usando GitHub y DigitalOcean con costos previsibles.

Este documento funciona como guia general de arquitectura y despliegue.

Usar el runbook correcto segun el caso:

- Para el primer servidor DigitalOcean, usar [docs/DIGITALOCEAN_DROPLET.md](docs/DIGITALOCEAN_DROPLET.md).
- Los documentos AWS anteriores estan archivados en [docs/archive/](docs/archive/) como referencia historica.

## 1. GitHub

El proyecto ya esta conectado al repositorio privado:

```text
https://github.com/diegoavalle14-svg/CatalogoHN.git
```

### Opcion recomendada con GitHub web

1. Entra a GitHub y crea un repositorio nuevo.
2. No agregues README, `.gitignore` ni licencia desde GitHub, porque este proyecto ya los tiene.
3. Copia la URL del repo, por ejemplo:

```bash
https://github.com/tu-usuario/catalogohn.git
```

Si se necesita recrear el remoto en otra maquina, ejecutar:

```bash
git remote add origin https://github.com/tu-usuario/catalogohn.git
git push -u origin main
```

> Importante: `.env` esta ignorado y no debe subirse. Solo se suben `.env.example`.

### Git Flow simplificado

- `main`: produccion. Solo codigo probado y aprobado.
- `develop`: integracion y preview.
- `feature/nombre-funcion`: ramas temporales para nuevas pantallas o modulos.

Flujo recomendado:

```bash
git checkout develop
git checkout -b feature/nombre-funcion
# trabajar y probar
git push -u origin feature/nombre-funcion
```

Luego se abre Pull Request hacia `develop`. Cuando preview queda aprobado, se fusiona `develop` hacia `main`.

## 2. DigitalOcean recomendado

Arquitectura inicial recomendada para controlar costos:

- Servidor: DigitalOcean Droplet Ubuntu LTS.
- Frontend React/Vite: build estatico servido por Nginx.
- Backend Node/Express: proceso `systemd` en el mismo Droplet.
- Base de datos: PostgreSQL local en el mismo Droplet.
- Imagenes y logos: `backend/uploads/` en disco local.
- HTTPS: Nginx + Certbot/Let's Encrypt.
- Correos transaccionales: Nodemailer + Gmail SMTP.

Esta arquitectura prioriza un costo mensual estable. Cuando CatalogoHN tenga mas clientes, se puede separar PostgreSQL, imagenes y backend en servicios administrados.

## 3. Entornos

CatalogoHN debe manejar dos entornos desde el inicio:

### Preview

Entorno para revisar cambios antes de publicarlos al dominio principal.

- Rama Git sugerida: `develop`
- Frontend: Nginx sirviendo `frontend/dist`.
- Backend: servicio `systemd`, por ejemplo `catalogohn-api-preview`.
- Base de datos: PostgreSQL local, base `catalogohn_preview`.
- Dominio sugerido: `preview.catalogohn.com`.

Variables ejemplo:

```text
VITE_API_URL=https://api-preview.catalogohn.com/api
VITE_TENANT_SLUG=kolben
NODE_ENV=production
CORS_ORIGIN=https://preview.catalogohn.com
DATABASE_URL=postgres://catalogohn:<password>@localhost:5432/catalogohn_preview
```

### Produccion

Entorno estable conectado al dominio principal.

- Rama Git sugerida: `main`
- Frontend: Nginx sirviendo `frontend/dist`.
- Backend: servicio `systemd`, por ejemplo `catalogohn-api-prod`.
- Base de datos: PostgreSQL local, base `catalogohn`.
- Dominio principal sugerido: `catalogohn.com`
- Dominio de inquilino sugerido: `kolben.catalogohn.com`

Variables ejemplo:

```text
VITE_API_URL=https://api.catalogohn.com/api
VITE_TENANT_SLUG=kolben
NODE_ENV=production
CORS_ORIGIN=https://kolben.catalogohn.com
DATABASE_URL=postgres://catalogohn:<password>@localhost:5432/catalogohn
```

Regla practica: todo cambio entra primero a `develop`; se actualiza preview; cuando se aprueba, se fusiona a `main` y pasa a produccion.

## 4. Frontend en DigitalOcean

Configuracion:

- App root local: `frontend`
- Build command: `pnpm run build`
- Output directory local: `frontend/dist`
- Directorio en servidor sugerido: `/var/www/catalogohn`

Variables de entorno al compilar:

```text
VITE_API_URL=https://api.tu-dominio.com/api
VITE_TENANT_SLUG=kolben
VITE_DEMO_MODE=false
```

Configura variables distintas por entorno. `VITE_API_URL` es obligatorio para builds de preview/produccion y debe apuntar a la URL publica real del backend. `VITE_DEMO_MODE` debe permanecer en `false`; el frontend no debe publicarse con datos demo.

## 5. Backend en DigitalOcean

El backend se despliega desde la carpeta `backend` y se mantiene activo con `systemd`.

Variables de entorno necesarias:

```text
PORT=3001
NODE_ENV=production
JWT_SECRET=un-secreto-largo-y-aleatorio
DATABASE_URL=postgres://catalogohn:password@localhost:5432/catalogohn
PUBLIC_API_URL=https://api-preview-o-api-produccion.catalogohn.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=correo@gmail.com
SMTP_PASS=app-password
EMAIL_FROM="CatalogoHN <correo@gmail.com>"
EMAIL_ADMIN_NOTIFY=admin@kolben.com
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=300
RATE_LIMIT_AUTH_WINDOW_MS=60000
RATE_LIMIT_AUTH_MAX=30
```

Si `S3_BUCKET` no esta configurado, el backend usa `backend/uploads/` como almacenamiento local. En DigitalOcean Droplet esta es la opcion inicial recomendada para no agregar costos.

Comandos base:

```bash
cd backend
npm install
npm start
```

Para mantener el proceso activo se debe usar un servicio `systemd`.

## 6. Base de datos PostgreSQL local

Crear PostgreSQL en el Droplet y guardar:

- Usuario.
- Password.
- Nombre de base de datos, por ejemplo `catalogohn`.

Luego formar `DATABASE_URL`:

```text
postgres://catalogohn:password@localhost:5432/catalogohn
```

Para inicializar tablas y seed:

```bash
cd backend
npm run db:setup
```

En produccion conviene ejecutar esta tarea una sola vez y con cuidado. Para preview se puede resetear con mas libertad.

## 7. Imagenes y logos

El panel admin debe subir a almacenamiento local inicialmente:

- Logo de empresa.
- Logos de marcas.
- Imagenes de productos.

Requisitos:

- Convertir/comprimir imagenes a WebP o JPEG.
- Peso maximo recomendado: `300 KB` por archivo de producto.
- Guardar la URL final en PostgreSQL.
- Respaldar `backend/uploads/` junto con la base de datos.

Cuando haya mas trafico, se puede mover a DigitalOcean Spaces u otro object storage.

## 8. Nginx, Certbot y dominio

El dominio principal ya comprado es:

```text
catalogohn.com
```

Dominios sugeridos:

- Produccion CatalogoHN: `catalogohn.com`
- Inquilino Kolben: `kolben.catalogohn.com`
- API produccion: `api.catalogohn.com`
- Preview: `preview.catalogohn.com`
- API preview: `api-preview.catalogohn.com`

En DigitalOcean se usara Certbot/Let's Encrypt para certificados HTTPS y Nginx para redirigir HTTP a HTTPS.

Tambien se debe preparar wildcard DNS para futuros inquilinos cuando se decida activar multi-tenant por subdominios:

```text
*.catalogohn.com
```

## 9. Checklist antes de produccion

- Cambiar `JWT_SECRET` por un valor largo y privado.
- Configurar `CORS_ORIGIN` con la URL real del frontend.
- Confirmar que `VITE_API_URL` apunta al backend real y `VITE_DEMO_MODE=false`.
- Configurar rate limiting para API general y login.
- Confirmar que `.env` no se subio a GitHub.
- Activar backups del Droplet o snapshots programados.
- Respaldar PostgreSQL y `backend/uploads/`.
- Confirmar que PostgreSQL solo escucha localmente.
- Conectar dominio propio cuando Nginx y backend esten estables.
- Validar primero en `develop`/preview antes de fusionar a `main`.
- Activar 2FA en GitHub y DigitalOcean.
- Guardar llaves SSH fuera del repositorio.
- Forzar HTTPS con Nginx/Certbot.

## 10. Pendiente para CatalogoHN

- Conectar preview real de DigitalOcean.
- Configurar dominio/subdominios en DNS.
- Fortalecer auditoria de accesos por cliente.
