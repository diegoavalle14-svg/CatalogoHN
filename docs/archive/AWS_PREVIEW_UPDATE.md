# Actualizar Preview AWS Existente

Guia paso a paso para actualizar un preview de CatalogoHN que ya fue levantado antes.

Objetivo final:

- Frontend: `https://preview.catalogohn.com`
- Backend: `https://api-preview.catalogohn.com`
- Region AWS: `us-east-1`
- Tenant inicial: `kolben`
- Sin modo demo
- Backend conectado a RDS PostgreSQL y S3 preview

## 0. Preparar tu maquina local

Abre PowerShell en Windows y entra al proyecto:

```powershell
cd C:\Users\User\Desktop\CatalogoHN
```

Revisa si hay cambios locales:

```powershell
git status
```

Corre el check de preview:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\preview-hardening-check.ps1
```

Debe terminar con:

```text
Preview hardening checks passed.
```

Si falla, no actualices AWS todavia.

## 1. Confirmar en que region estas trabajando

En AWS Console:

1. Mira arriba a la derecha, donde aparece la region.
2. Cambia a:

```text
N. Virginia / us-east-1
```

Todo lo siguiente debe revisarse en `us-east-1`, salvo que confirmes que el preview anterior fue creado en otra region.

## 2. Revisar si el backend anterior es EC2 o Elastic Beanstalk

### Opcion A: Revisar EC2

En AWS Console:

1. Ve a `EC2`.
2. En el menu izquierdo, entra a `Instances`.
3. Busca una instancia con nombre parecido a:

```text
catalogohn
catalogohn-preview
catalogohn-api
api-preview
```

Abre la instancia y revisa:

- `Instance state`: debe estar `Running`.
- `Public IPv4 address`: anotalo si existe.
- `Security groups`: anota el nombre.
- `IAM role`: debe existir si quieres usar S3 sin access keys.
- `Key pair name`: solo para saber con que llave se entra por SSH.

Luego entra al security group de esa instancia y revisa `Inbound rules`:

```text
HTTP 80 abierto a 0.0.0.0/0
HTTPS 443 abierto a 0.0.0.0/0
SSH 22 solo desde tu IP, no abierto a 0.0.0.0/0
```

Si el backend corre directo por puerto `3001`, idealmente ese puerto no debe estar publico. Debe estar detras de Nginx/Apache/Load Balancer con HTTPS.

### Opcion B: Revisar Elastic Beanstalk

En AWS Console:

1. Ve a `Elastic Beanstalk`.
2. Revisa si hay una aplicacion/entorno llamado parecido a:

```text
catalogohn-api-preview
catalogohn-backend-preview
```

Si existe:

- Entra al environment.
- Revisa `Health`: debe estar `Ok` o `Green`.
- En `Configuration`, revisa `Software` para ver variables de entorno.
- En `Configuration`, revisa `Instance security groups`.

### Decision

Usa EC2 si ya existe y funciona. Usa Elastic Beanstalk solo si ese fue el preview anterior o si decides recrearlo limpio.

## 3. Revisar DNS de los dominios preview

En AWS Console:

1. Ve a `Route 53`.
2. Entra a `Hosted zones`.
3. Abre la zona de:

```text
catalogohn.com
```

Busca estos records:

```text
preview.catalogohn.com
api-preview.catalogohn.com
```

Que revisar:

- `preview.catalogohn.com` debe apuntar a Amplify o CloudFront.
- `api-preview.catalogohn.com` debe apuntar al backend, Load Balancer, CloudFront, Beanstalk o IP/alias correspondiente.
- Ambos deben resolver con HTTPS.

Prueba desde PowerShell:

```powershell
nslookup preview.catalogohn.com
nslookup api-preview.catalogohn.com
```

## 4. Revisar certificados HTTPS

En AWS Console:

1. Ve a `Certificate Manager`.
2. Confirma que estas en `us-east-1`.
3. Busca certificados para:

```text
preview.catalogohn.com
api-preview.catalogohn.com
*.catalogohn.com
```

Que revisar:

- `Status`: debe ser `Issued`.
- Si esta `Pending validation`, falta validar DNS.
- Si usas Load Balancer o CloudFront, confirma que ese certificado esta asociado.

## 5. Revisar RDS preview

En AWS Console:

1. Ve a `RDS`.
2. Entra a `Databases`.
3. Busca la base preview, algo como:

```text
catalogohn-preview
catalogohn
```

Abre la base y revisa:

- `DB instance status`: `Available`.
- `Engine`: PostgreSQL.
- `Endpoint`: copialo, se usa en `DATABASE_URL`.
- `DB name`: debe ser `catalogohn_preview` o el nombre que usaste.
- `Public access`: idealmente `No`.
- `VPC security groups`: anota el nombre.

En el security group de RDS revisa `Inbound rules`:

```text
PostgreSQL 5432 permitido desde el security group del backend
No debe estar abierto a 0.0.0.0/0
```

Antes de actualizar, crea snapshot:

1. RDS -> Databases.
2. Selecciona la DB preview.
3. `Actions` -> `Take snapshot`.
4. Nombre sugerido:

```text
catalogohn-preview-before-update-YYYYMMDD
```

## 6. Revisar S3 preview

En AWS Console:

1. Ve a `S3`.
2. Busca el bucket:

```text
catalogohn-assets-preview
```

Revisa:

- `Block public access`: no debe permitir escritura publica.
- `Objects`: puede tener carpetas por tenant, por ejemplo `kolben/product/...`.
- `Permissions`: no debe haber policy que permita `PutObject` publico.

Si el backend usa IAM role:

1. Ve a `IAM`.
2. Entra a `Roles`.
3. Busca el role asociado al EC2/Beanstalk.
4. Confirma una policy con permisos minimos:

```json
{
  "Effect": "Allow",
  "Action": ["s3:PutObject", "s3:GetObject"],
  "Resource": "arn:aws:s3:::catalogohn-assets-preview/*"
}
```

No uses `AWS_ACCESS_KEY_ID` ni `AWS_SECRET_ACCESS_KEY` si ya tienes IAM role.

## 7. Revisar Amplify frontend

En AWS Console:

1. Ve a `AWS Amplify`.
2. Abre la app de CatalogoHN.
3. Entra a la rama preview, normalmente:

```text
develop
```

Revisa `Build settings`:

```text
App root: frontend
Build command: pnpm run build
Output directory: dist
```

Revisa `Environment variables` de esa rama:

```text
VITE_API_URL=https://api-preview.catalogohn.com/api
VITE_TENANT_SLUG=kolben
VITE_DEMO_MODE=false
```

Si `VITE_DEMO_MODE` aparece como `true`, cambialo a `false`.

## 8. Entrar al servidor backend

Si usas EC2:

1. Ve a `EC2` -> `Instances`.
2. Selecciona la instancia backend.
3. Usa `Connect`.
4. Puedes usar `EC2 Instance Connect` si esta disponible, o SSH con tu llave.

Una vez dentro, busca la carpeta del proyecto. Comandos utiles:

```bash
pwd
ls
ls /opt
ls /var/www
```

Rutas comunes:

```text
/opt/catalogohn
/var/www/catalogohn
/home/ec2-user/CatalogoHN
/home/ubuntu/CatalogoHN
```

Cuando encuentres el repo:

```bash
cd /opt/catalogohn
git status
```

Si `git status` funciona, estas en la carpeta correcta.

## 9. Identificar como corre el backend

Dentro del servidor:

```bash
sudo systemctl list-units --type=service | grep -i catalog
sudo systemctl list-units --type=service | grep -i node
pm2 status
ps aux | grep node
```

Interpretacion:

- Si ves `catalogohn-api-preview.service`, usa systemd.
- Si `pm2 status` muestra un proceso, usa PM2.
- Si no aparece nada claro, el backend puede estar corriendo manualmente o por Beanstalk.

Si usa systemd, revisa el servicio:

```bash
sudo systemctl status catalogohn-api-preview
sudo journalctl -u catalogohn-api-preview -n 50 --no-pager
```

Si usa PM2:

```bash
pm2 status
pm2 logs catalogohn-api-preview --lines 50
```

## 10. Revisar variables del backend

### Si usa systemd

Revisa el archivo del servicio:

```bash
sudo systemctl cat catalogohn-api-preview
```

Busca una linea como:

```text
EnvironmentFile=/etc/catalogohn/backend-preview.env
```

Abre ese archivo:

```bash
sudo nano /etc/catalogohn/backend-preview.env
```

Debe tener:

```text
PORT=3001
NODE_ENV=production
JWT_SECRET=<secreto-largo-preview>
DATABASE_URL=postgres://<user>:<password>@<rds-endpoint>:5432/catalogohn_preview
CORS_ORIGIN=https://preview.catalogohn.com
PUBLIC_API_URL=https://api-preview.catalogohn.com
DB_SETUP_SKIP_CREATE_DATABASE=true
AWS_REGION=us-east-1
S3_BUCKET=catalogohn-assets-preview
S3_PUBLIC_URL=https://catalogohn-assets-preview.s3.us-east-1.amazonaws.com
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=300
RATE_LIMIT_AUTH_WINDOW_MS=60000
RATE_LIMIT_AUTH_MAX=30
```

### Si usa PM2

Revisa:

```bash
pm2 show catalogohn-api-preview
pm2 env <process-id>
```

Si PM2 usa un ecosystem file, buscalo:

```bash
find . -iname "*ecosystem*"
```

Edita las variables ahi o en el `.env` que cargue el proceso.

### Si usa Elastic Beanstalk

En AWS Console:

1. Elastic Beanstalk.
2. Abre el environment.
3. `Configuration`.
4. `Software`.
5. `Environment properties`.

Actualiza las mismas variables.

## 11. Actualizar codigo del backend

En el servidor, en la carpeta del repo:

```bash
cd /opt/catalogohn
git fetch origin
git checkout develop
git pull origin develop
cd backend
npm install
```

Si la carpeta real no es `/opt/catalogohn`, usa la que encontraste en el paso 8.

## 12. Reiniciar backend

### Si usa systemd

```bash
sudo systemctl daemon-reload
sudo systemctl restart catalogohn-api-preview
sudo systemctl status catalogohn-api-preview
```

### Si usa PM2

```bash
pm2 restart catalogohn-api-preview
pm2 status
```

### Si usa Beanstalk

Haz deploy desde Elastic Beanstalk o desde el flujo que usaste antes para subir la app.

## 13. Base de datos: decidir si resetear o conservar

No ejecutes `db:setup` automaticamente.

### Si quieres conservar datos

No corras:

```bash
npm run db:setup
```

El backend creara bajo demanda tablas nuevas como:

```text
api_keys
api_request_logs
webhook_endpoints
webhook_deliveries
```

Para forzar creacion de algunas tablas, usa las pantallas/endpoints de superadmin relacionados con API keys o webhooks.

### Si puedes resetear preview

Solo despues de snapshot RDS:

```bash
cd /opt/catalogohn/backend
export DB_SETUP_SKIP_CREATE_DATABASE=true
npm run db:setup
```

Esto recrea tablas y deja seed minimo.

## 14. Probar backend desde tu maquina

En PowerShell:

```powershell
Invoke-RestMethod https://api-preview.catalogohn.com/health
```

Debe devolver:

```json
{
  "ok": true,
  "tenant": "kolben",
  "dbFallback": false
}
```

Probar API publica sin key:

```powershell
try {
  Invoke-WebRequest https://api-preview.catalogohn.com/api/v1/catalog
} catch {
  $_.Exception.Response.StatusCode.value__
  $_.ErrorDetails.Message
}
```

Debe salir:

```text
401
{"message":"API key requerida"}
```

## 15. Actualizar frontend en Amplify

En AWS Console:

1. Ve a `AWS Amplify`.
2. Abre la app CatalogoHN.
3. Entra a la rama `develop` o la rama preview.
4. Abre `Environment variables`.
5. Confirma:

```text
VITE_API_URL=https://api-preview.catalogohn.com/api
VITE_TENANT_SLUG=kolben
VITE_DEMO_MODE=false
```

6. Guarda cambios.
7. Ve a `Hosting` -> la rama preview.
8. Ejecuta `Redeploy this version` o inicia un nuevo build desde el ultimo commit.

Cuando termine el build, abre:

```text
https://preview.catalogohn.com
```

## 16. Probar flujo web

En `https://preview.catalogohn.com`:

1. Debe cargar empresas activas.
2. Entra como superadmin.
3. Entra como admin Kolben.
4. Revisa o crea cliente.
5. Revisa o crea producto con stock y precio.
6. Sube imagen/logo.
7. Confirma que la URL de imagen apunta a S3 o `S3_PUBLIC_URL`.
8. Entra como cliente.
9. Crea pedido.
10. Confirma que el stock no baja al crear pedido.
11. Admin cambia pedido a `preparando`.
12. Confirma que el stock baja al aprobar/cambiar estado.

## 17. Crear API key preview

Desde superadmin, crea una API key para Kolben con scopes:

```text
catalog:read
orders:read
orders:write
```

Guarda la key completa. Solo se muestra una vez.

Prueba desde PowerShell:

```powershell
$headers = @{ "X-API-Key" = "<api-key>" }
Invoke-RestMethod https://api-preview.catalogohn.com/api/v1/catalog -Headers $headers
Invoke-RestMethod https://api-preview.catalogohn.com/api/v1/orders -Headers $headers
```

## 18. Probar pedido por API publica

Usa IDs reales de preview: `cliente_id`, `producto_id`, `sucursal_id`.

```powershell
$headers = @{
  "X-API-Key" = "<api-key>"
  "Content-Type" = "application/json"
}

$body = @{
  cliente_id = 1
  items = @(
    @{
      producto_id = 1
      sucursal_id = 1
      cantidad = 1
    }
  )
} | ConvertTo-Json -Depth 5

Invoke-RestMethod `
  -Uri https://api-preview.catalogohn.com/api/v1/orders `
  -Method Post `
  -Headers $headers `
  -Body $body
```

Debe crear pedido en estado:

```text
pendiente
```

## 19. Probar webhooks

Desde superadmin:

1. Crea webhook para Kolben.
2. Usa una URL HTTPS de prueba.
3. Selecciona eventos:

```text
order.created
order.status_changed
```

Luego:

1. Crea pedido.
2. Revisa entrega `order.created`.
3. Cambia estado del pedido.
4. Revisa entrega `order.status_changed`.

Endpoint para revisar entregas:

```text
GET /api/superadmin/tenants/:id/webhook-deliveries
```

## 20. Checklist final

Backend:

- `GET /health` devuelve `ok:true`.
- `dbFallback:false`.
- `CORS_ORIGIN=https://preview.catalogohn.com`.
- `JWT_SECRET` no es valor local/dev.
- Backend reinicia solo si se cae.

Frontend:

- No usa demo.
- No llama localhost.
- `VITE_API_URL=https://api-preview.catalogohn.com/api`.
- `VITE_DEMO_MODE=false`.

AWS:

- RDS no esta publico abierto.
- S3 no tiene escritura publica.
- Backend usa IAM role para S3.
- HTTPS activo en ambos dominios.
- DNS apunta correctamente.

API publica:

- Sin key responde `401`.
- Key sin scope responde `403`.
- Key con scope correcto funciona.
- Rate limiting devuelve headers `RateLimit-*`.

## 21. Si algo falla

Backend no arranca con systemd:

```bash
sudo journalctl -u catalogohn-api-preview -n 100 --no-pager
```

Backend no arranca con PM2:

```bash
pm2 logs catalogohn-api-preview --lines 100
```

Health falla con DB:

- Revisa `DATABASE_URL`.
- Revisa que RDS este `Available`.
- Revisa que `catalogohn_preview` exista.
- Revisa inbound rule de RDS: PostgreSQL 5432 desde security group del backend.

Frontend llama localhost:

- Revisa variables Amplify.
- Haz redeploy completo.
- Espera invalidacion/cache.

Uploads no funcionan:

- Revisa IAM role del backend.
- Revisa `S3_BUCKET`.
- Revisa `S3_PUBLIC_URL`.
- Revisa logs backend.

Login seed falla:

- Si conservaste datos, la contrasena pudo haber cambiado.
- Resetear desde DB o desde una herramienta segura.
- Solo correr `db:setup` si aceptas resetear preview.
