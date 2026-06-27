# DigitalOcean Droplet Runbook

Guia para mover CatalogoHN a un Droplet con costo predecible.

## 1. Objetivo

Arquitectura inicial:

- Ubuntu LTS en un Droplet basico.
- Nginx sirve el frontend React/Vite.
- Node.js ejecuta el backend Express.
- PostgreSQL corre localmente en el mismo Droplet.
- `backend/uploads/` guarda imagenes y logos.
- Certbot genera HTTPS gratis con Let's Encrypt.

Esta opcion evita RDS, NAT Gateway, Load Balancer, S3 y otros cargos variables de AWS.

## 2. Antes de apagar AWS

No borrar nada sin respaldo.

Checklist:

- Crear snapshot de RDS.
- Exportar base de datos actual si ya hay datos reales.
- Descargar o respaldar imagenes si existen en S3 o `uploads`.
- Confirmar credenciales SMTP.
- Guardar variables de entorno actuales.
- Apagar AWS despues de validar DigitalOcean.

## 2.1 Exportar datos desde AWS

El snapshot de RDS sirve como seguro dentro de AWS. Para migrar a DigitalOcean se necesita un archivo `.sql`.

Desde la EC2 que corre el backend, buscar primero las variables:

```bash
sudo find /etc /opt -maxdepth 4 -type f \( -name "*.env" -o -name "*catalogohn*" \) 2>/dev/null
```

Luego revisar el archivo correcto, normalmente uno de estos:

```bash
sudo cat /etc/catalogohn/backend-preview.env
sudo cat /opt/catalogohn/backend/.env
```

Guardar en un lugar seguro estos valores:

```text
DATABASE_URL
JWT_SECRET
CORS_ORIGIN
PUBLIC_API_URL
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASS
EMAIL_FROM
EMAIL_ADMIN_NOTIFY
```

Instalar cliente PostgreSQL si hace falta:

```bash
sudo apt update
sudo apt install -y postgresql-client
```

Exportar la base usando el `DATABASE_URL` real:

```bash
mkdir -p ~/catalogohn-migration
pg_dump "$DATABASE_URL" > ~/catalogohn-migration/catalogohn-aws.sql
```

Si la variable no esta cargada en la terminal, usar el valor completo:

```bash
pg_dump "postgres://<user>:<password>@<rds-endpoint>:5432/<db-name>" > ~/catalogohn-migration/catalogohn-aws.sql
```

Verificar que el dump no este vacio:

```bash
ls -lh ~/catalogohn-migration/catalogohn-aws.sql
head -20 ~/catalogohn-migration/catalogohn-aws.sql
```

Respaldar uploads locales si existen:

```bash
if [ -d /opt/catalogohn/backend/uploads ]; then
  tar -czf ~/catalogohn-migration/uploads-aws.tar.gz -C /opt/catalogohn/backend uploads
fi
```

Si las imagenes estan en S3, descargarlas antes de apagar AWS:

```bash
aws s3 sync s3://<bucket-name> ~/catalogohn-migration/s3-assets
tar -czf ~/catalogohn-migration/s3-assets.tar.gz -C ~/catalogohn-migration s3-assets
```

Copiar los respaldos a tu computadora o directo al Droplet:

```bash
scp ~/catalogohn-migration/catalogohn-aws.sql root@<droplet-ip>:/root/
scp ~/catalogohn-migration/uploads-aws.tar.gz root@<droplet-ip>:/root/
```

No detener ni borrar RDS hasta importar y probar la base en DigitalOcean.

## 3. Crear Droplet

Recomendado para MVP:

```text
Image: Ubuntu LTS
Size: Basic 1 GB RAM minimo; 2 GB si el presupuesto lo permite
Region: la mas cercana a Honduras, normalmente New York
Authentication: SSH key
Backups: activarlos si el presupuesto lo permite
```

Evitar al inicio:

```text
Load balancer
Managed database
Spaces
Kubernetes
```

## 4. Instalar paquetes

En el servidor:

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y nginx postgresql postgresql-contrib git ufw curl ca-certificates
```

Instalar Node.js 20 LTS:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pnpm
```

Firewall:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

## 5. Crear usuario y carpetas

```bash
sudo adduser --system --group --home /opt/catalogohn catalogohn
sudo mkdir -p /opt/catalogohn /var/www/catalogohn /etc/catalogohn
sudo chown -R catalogohn:catalogohn /opt/catalogohn /var/www/catalogohn
```

Clonar repo:

```bash
sudo -u catalogohn git clone https://github.com/diegoavalle14-svg/CatalogoHN.git /opt/catalogohn
```

## 6. PostgreSQL

Crear usuario y base:

```bash
sudo -u postgres psql
```

Dentro de `psql`:

```sql
CREATE USER catalogohn WITH PASSWORD '<password-largo>';
CREATE DATABASE catalogohn OWNER catalogohn;
\q
```

La URL queda:

```text
DATABASE_URL=postgres://catalogohn:<password-largo>@localhost:5432/catalogohn
```

PostgreSQL debe quedarse local. No abrir puerto `5432` al publico.

## 7. Variables del backend

Crear:

```bash
sudo nano /etc/catalogohn/backend.env
```

Contenido base:

```text
PORT=3001
NODE_ENV=production
JWT_SECRET=<secreto-largo-y-aleatorio>
DATABASE_URL=postgres://catalogohn:<password-largo>@localhost:5432/catalogohn
CORS_ORIGIN=https://catalogohn.com,https://kolben.catalogohn.com
PUBLIC_API_URL=https://api.catalogohn.com
DB_SETUP_SKIP_CREATE_DATABASE=true

RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=300
RATE_LIMIT_AUTH_WINDOW_MS=60000
RATE_LIMIT_AUTH_MAX=30

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<smtp-user>
SMTP_PASS=<smtp-app-password>
EMAIL_FROM=CatalogoHN <no-reply@catalogohn.com>
EMAIL_ADMIN_NOTIFY=<admin-email>
```

No configurar `S3_BUCKET` al inicio. Asi el backend usa `backend/uploads/`.

## 8. Instalar backend

```bash
cd /opt/catalogohn/backend
sudo -u catalogohn npm install --omit=dev
sudo -u catalogohn npm run db:setup
```

Si se esta migrando desde AWS, no correr `db:setup` sobre datos reales importados. Primero importar el dump:

```bash
sudo -u postgres psql -d catalogohn -f /root/catalogohn-aws.sql
```

Si tambien se migro `uploads`:

```bash
sudo tar -xzf /root/uploads-aws.tar.gz -C /opt/catalogohn/backend
sudo chown -R catalogohn:catalogohn /opt/catalogohn/backend/uploads
```

## 9. Servicio systemd

Crear:

```bash
sudo nano /etc/systemd/system/catalogohn-api.service
```

Contenido:

```ini
[Unit]
Description=CatalogoHN API
After=network.target postgresql.service

[Service]
Type=simple
WorkingDirectory=/opt/catalogohn/backend
EnvironmentFile=/etc/catalogohn/backend.env
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
User=catalogohn
Group=catalogohn
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Activar:

```bash
sudo systemctl daemon-reload
sudo systemctl enable catalogohn-api
sudo systemctl start catalogohn-api
sudo systemctl status catalogohn-api
```

## 10. Build frontend

En el servidor:

```bash
cd /opt/catalogohn/frontend
sudo -u catalogohn pnpm install --frozen-lockfile
sudo -u catalogohn env VITE_API_URL=https://api.catalogohn.com/api VITE_TENANT_SLUG=kolben VITE_DEMO_MODE=false pnpm run build
sudo rsync -a --delete dist/ /var/www/catalogohn/
sudo chown -R www-data:www-data /var/www/catalogohn
```

## 11. Nginx

Crear:

```bash
sudo nano /etc/nginx/sites-available/catalogohn
```

Contenido inicial sin HTTPS:

```nginx
server {
    listen 80;
    server_name catalogohn.com kolben.catalogohn.com;

    root /var/www/catalogohn;
    index index.html;

    location / {
        try_files $uri /index.html;
    }
}

server {
    listen 80;
    server_name api.catalogohn.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Activar:

```bash
sudo ln -s /etc/nginx/sites-available/catalogohn /etc/nginx/sites-enabled/catalogohn
sudo nginx -t
sudo systemctl reload nginx
```

## 12. DNS

En el proveedor DNS del dominio:

```text
catalogohn.com        A    <droplet-ip>
kolben.catalogohn.com A    <droplet-ip>
api.catalogohn.com    A    <droplet-ip>
```

Cuando haya mas inquilinos, evaluar:

```text
*.catalogohn.com      A    <droplet-ip>
```

## 13. HTTPS

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d catalogohn.com -d kolben.catalogohn.com -d api.catalogohn.com
```

Probar renovacion:

```bash
sudo certbot renew --dry-run
```

## 14. Actualizaciones

Para actualizar desde Git:

```bash
cd /opt/catalogohn
sudo -u catalogohn git pull

cd /opt/catalogohn/backend
sudo -u catalogohn npm install --omit=dev
sudo systemctl restart catalogohn-api

cd /opt/catalogohn/frontend
sudo -u catalogohn pnpm install --frozen-lockfile
sudo -u catalogohn env VITE_API_URL=https://api.catalogohn.com/api VITE_TENANT_SLUG=kolben VITE_DEMO_MODE=false pnpm run build
sudo rsync -a --delete dist/ /var/www/catalogohn/
sudo systemctl reload nginx
```

## 15. Backups

Base de datos:

```bash
mkdir -p ~/catalogohn-backups
pg_dump "postgres://catalogohn:<password-largo>@localhost:5432/catalogohn" > ~/catalogohn-backups/catalogohn-$(date +%F).sql
```

Uploads:

```bash
tar -czf ~/catalogohn-backups/uploads-$(date +%F).tar.gz -C /opt/catalogohn/backend uploads
```

Ademas, activar snapshots/backups del Droplet si el presupuesto lo permite.

## 16. Smoke test

```bash
curl https://api.catalogohn.com/health
```

Probar en navegador:

```text
https://kolben.catalogohn.com
```

Credenciales seed:

```text
superadmin / SuperAdminPassword123
admin / KolbenAdminPassword123
cliente1 / ClientPassword123
```

Cambiar estas contrasenas despues del primer login.
