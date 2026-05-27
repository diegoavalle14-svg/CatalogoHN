# AWS Preview Runbook

Guia corta para levantar el primer preview de CatalogoHN en AWS sin mezclarlo con produccion.

## 1. Orden recomendado

1. Activar MFA en el usuario root de AWS.
2. Crear budget mensual y alerta de uso.
3. Crear RDS PostgreSQL preview.
4. Crear bucket S3 preview para imagenes.
5. Publicar backend preview.
6. Publicar frontend preview en Amplify.
7. Ejecutar seed inicial y probar login.

## 2. Variables backend preview

Configurar estas variables en el entorno donde corra el backend:

```text
PORT=3001
NODE_ENV=production
JWT_SECRET=<secreto-largo>
DATABASE_URL=postgres://<usuario>:<password>@<endpoint-rds>:5432/catalogohn_preview
CORS_ORIGIN=https://<amplify-preview-url>,http://localhost:5173
PUBLIC_API_URL=https://<api-preview-url>
AWS_REGION=us-east-1
S3_BUCKET=catalogohn-assets-preview
S3_PUBLIC_URL=https://<bucket-o-cloudfront-url>
AWS_ACCESS_KEY_ID=<access-key>
AWS_SECRET_ACCESS_KEY=<secret-key>
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<correo>
SMTP_PASS=<app-password>
EMAIL_FROM="CatalogoHN <correo>"
EMAIL_ADMIN_NOTIFY=<correo-admin>
```

## 3. Variables frontend preview

Configurar estas variables en Amplify para la rama `develop`:

```text
VITE_API_URL=https://<api-preview-url>/api
VITE_TENANT_SLUG=kolben
VITE_DEMO_MODE=false
```

Si el frontend preview se publica antes que el backend preview, usar temporalmente:

```text
VITE_DEMO_MODE=true
```

Cuando `api-preview.catalogohn.com` este listo, volver a `false` y configurar `VITE_API_URL`.

## 4. RDS PostgreSQL

Crear una base `catalogohn_preview` y correr una sola vez:

```bash
cd backend
pnpm install --frozen-lockfile
pnpm run db:setup
```

`db:setup` recrea tablas y seed; usarlo solo en preview o ambientes donde sea aceptable resetear datos.

## 5. S3 preview

Bucket sugerido:

```text
catalogohn-assets-preview
```

El backend guarda imagenes con prefijo:

```text
<tenant-slug>/<purpose>/<timestamp>-<hash>.webp
```

Para preview se puede usar URL publica del bucket o CloudFront. Para produccion conviene CloudFront.

## 6. Amplify

Este repo ya incluye `amplify.yml` para monorepo:

- App root: `frontend`
- Build: `pnpm run build`
- Output: `dist`

Conectar Amplify a la rama `develop` para preview.

## 7. Backend

El backend incluye `backend/Procfile`:

```text
web: npm start
```

Eso permite usar Elastic Beanstalk desde la carpeta `backend`. Si usamos EC2 directo, correrlo con PM2 o systemd.

## 8. Smoke test

Probar:

```text
GET /health
POST /api/auth/login
GET /api/catalog
POST /api/admin/uploads
```

Credenciales seed:

```text
superadmin / SuperAdminPassword123
admin / KolbenAdminPassword123
cliente1 / ClientPassword123
```
