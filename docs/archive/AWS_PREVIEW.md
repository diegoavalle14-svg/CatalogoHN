# AWS Preview Runbook

Guia corta para levantar el primer preview de CatalogoHN en AWS sin mezclarlo con produccion.

## 1. Orden recomendado

1. Activar MFA en el usuario root de AWS.
2. Crear budget mensual y alerta de uso.
3. Auditar EC2 existente para decidir si se reutiliza.
4. Crear RDS PostgreSQL preview.
5. Crear bucket S3 preview para imagenes.
6. Publicar backend preview.
7. Publicar frontend preview en Amplify.
8. Ejecutar seed inicial y probar login.

## 1.1 Auditoria EC2 existente

Reutilizar el EC2 solo si cumple:

```text
Region: us-east-1
Node.js: >=18
Backend path: carpeta backend del repo
Process manager: systemd o PM2
Security group inbound: 80/443 publicos, SSH solo IP administradora
Security group outbound: permitido hacia RDS/S3/SMTP si aplica
IAM role: permiso minimo para S3 preview
Dominio: api-preview.catalogohn.com apunta al host o load balancer
HTTPS: certificado valido para api-preview.catalogohn.com
```

Si falla Node, proceso, red o HTTPS y no se corrige rapido, crear un entorno limpio equivalente antes de conectar Amplify.

Plantillas incluidas:

```text
deploy/env/backend-preview.env.example
deploy/systemd/catalogohn-api-preview.service
```

## 2. Variables backend preview

Configurar estas variables en el entorno donde corra el backend:

```text
PORT=3001
NODE_ENV=production
JWT_SECRET=<secreto-largo>
DATABASE_URL=postgres://<usuario>:<password>@<endpoint-rds>:5432/catalogohn_preview
CORS_ORIGIN=https://<amplify-preview-url>,http://localhost:5173
PUBLIC_API_URL=https://<api-preview-url>
DB_SETUP_SKIP_CREATE_DATABASE=true
AWS_REGION=us-east-1
S3_BUCKET=catalogohn-assets-preview
S3_PUBLIC_URL=https://<bucket-o-cloudfront-url>
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<correo>
SMTP_PASS=<app-password>
EMAIL_FROM="CatalogoHN <correo>"
EMAIL_ADMIN_NOTIFY=<correo-admin>
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=300
RATE_LIMIT_AUTH_WINDOW_MS=60000
RATE_LIMIT_AUTH_MAX=30
```

Usar IAM role para S3 en EC2/Beanstalk. No configurar `AWS_ACCESS_KEY_ID` ni `AWS_SECRET_ACCESS_KEY` en preview salvo emergencia temporal.

## 3. Variables frontend preview

Configurar estas variables en Amplify para la rama `develop`:

```text
VITE_API_URL=https://<api-preview-url>/api
VITE_TENANT_SLUG=kolben
VITE_DEMO_MODE=false
```

No publicar preview sin backend real. `VITE_API_URL` debe apuntar a la API preview y `VITE_DEMO_MODE` debe quedarse en `false`.

## 4. RDS PostgreSQL

Crear una base `catalogohn_preview` y correr una sola vez:

```bash
cd backend
pnpm install --frozen-lockfile
$env:DB_SETUP_SKIP_CREATE_DATABASE='true'
pnpm run db:setup
```

`db:setup` recrea tablas y seed; usarlo solo en preview o ambientes donde sea aceptable resetear datos.
RDS debe aceptar conexiones solo desde el security group del backend.

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

Permisos minimos del IAM role del backend:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject"],
      "Resource": "arn:aws:s3:::catalogohn-assets-preview/*"
    }
  ]
}
```

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
GET /api/v1/catalog
GET /api/v1/orders
POST /api/v1/orders
```

Credenciales seed:

```text
superadmin / SuperAdminPassword123
admin / KolbenAdminPassword123
cliente1 / ClientPassword123
```

Cambiar estas contrasenas inmediatamente despues del primer login de preview.

## 8.1 Check local antes de deploy

Desde la raiz del repo:

```powershell
.\scripts\preview-hardening-check.ps1
```

## 9. API pública inicial

Las integraciones externas deben usar API keys, no credenciales de usuario. Una API key se crea desde endpoints de superadmin y se muestra una sola vez.

Headers:

```text
X-API-Key=<api-key>
```

Endpoint disponible:

```text
GET /api/v1/catalog
GET /api/v1/orders
GET /api/v1/orders/:id
POST /api/v1/orders
```

Permiso requerido:

```text
catalog:read
orders:read
orders:write
```

## 10. Webhooks iniciales

Crear webhooks desde superadmin para integraciones externas:

```text
POST /api/superadmin/tenants/:id/webhooks
GET /api/superadmin/tenants/:id/webhook-deliveries
```

Eventos disponibles:

```text
order.created
order.status_changed
catalog.updated
stock.updated
```

Las entregas se firman con `X-CatalogoHN-Signature` usando HMAC SHA-256 sobre:

```text
<timestamp>.<body-json>
```
