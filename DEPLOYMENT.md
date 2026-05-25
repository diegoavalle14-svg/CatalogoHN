# Deployment Guide

Guia inicial para publicar CatalogoHN usando GitHub y AWS, siguiendo la especificacion tecnica del proyecto.

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
- `develop`: integracion y preview. Amplify debe generar previews desde esta rama.
- `feature/nombre-funcion`: ramas temporales para nuevas pantallas o modulos.

Flujo recomendado:

```bash
git checkout develop
git checkout -b feature/nombre-funcion
# trabajar y probar
git push -u origin feature/nombre-funcion
```

Luego se abre Pull Request hacia `develop`. Cuando preview queda aprobado, se fusiona `develop` hacia `main`.

## 2. AWS recomendado

Arquitectura objetivo segun el documento tecnico:

- Frontend React/Vite: AWS Amplify Hosting.
- Backend Node/Express: AWS EC2 `t3.micro`.
- Base de datos: Amazon RDS PostgreSQL.
- Imagenes y logos: AWS S3.
- CDN y HTTPS: CloudFront + ACM.
- Correos transaccionales: Nodemailer + Gmail SMTP.

Esta arquitectura separa el sitio estatico, la API, la base de datos y el almacenamiento de archivos.

## 3. Entornos

CatalogoHN debe manejar dos entornos desde el inicio:

### Preview

Entorno para revisar cambios antes de publicarlos al dominio principal.

- Rama Git sugerida: `develop`
- Frontend: una app/rama de Amplify para preview.
- Backend: EC2 preview o proceso separado, por ejemplo `catalogohn-api-preview`.
- Base de datos: idealmente una RDS separada o una base `catalogohn_preview`.
- Dominio sugerido: `preview.catalogohn.com` o el subdominio temporal de Amplify.

Variables ejemplo:

```text
VITE_API_URL=https://api-preview.catalogohn.com/api
VITE_TENANT_SLUG=kolben
NODE_ENV=production
CORS_ORIGIN=https://preview.catalogohn.com
DATABASE_URL=postgres://usuario:password@host-preview:5432/catalogohn_preview
```

### Produccion

Entorno estable conectado al dominio principal.

- Rama Git sugerida: `main`
- Frontend: Amplify conectado al dominio principal.
- Backend: EC2 `t3.micro` para produccion, por ejemplo `catalogohn-api-prod`.
- Base de datos: RDS de produccion.
- Dominio principal sugerido: `catalogohn.com`
- Dominio de inquilino sugerido: `kolben.catalogohn.com`

Variables ejemplo:

```text
VITE_API_URL=https://api.catalogohn.com/api
VITE_TENANT_SLUG=kolben
NODE_ENV=production
CORS_ORIGIN=https://kolben.catalogohn.com
DATABASE_URL=postgres://usuario:password@host-prod:5432/catalogohn
```

Regla practica: todo cambio entra primero a `develop`; Amplify genera preview; cuando se aprueba, se fusiona a `main` y pasa a produccion.

## 4. Frontend en Amplify

Configuracion:

- App root: `frontend`
- Build command: `pnpm run build`
- Output directory: `dist`

Variables de entorno en Amplify:

```text
VITE_API_URL=https://api.tu-dominio.com/api
VITE_TENANT_SLUG=kolben
```

Configura variables distintas por rama/entorno. Si primero despliegas sin dominio propio, `VITE_API_URL` puede apuntar temporalmente a la URL publica del backend.

## 5. Backend en EC2

El backend se despliega desde la carpeta `backend` en una instancia AWS EC2 `t3.micro`.

Variables de entorno necesarias:

```text
PORT=3001
NODE_ENV=production
JWT_SECRET=un-secreto-largo-y-aleatorio
DATABASE_URL=postgres://usuario:password@host-rds:5432/catalogohn
AWS_REGION=us-east-1
S3_BUCKET=catalogohn-assets-preview-o-prod
AWS_ACCESS_KEY_ID=valor-seguro
AWS_SECRET_ACCESS_KEY=valor-seguro
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=correo@gmail.com
SMTP_PASS=app-password
EMAIL_FROM="CatalogoHN <correo@gmail.com>"
EMAIL_ADMIN_NOTIFY=admin@kolben.com
```

Comandos base en EC2:

```bash
cd backend
npm install
npm start
```

Para mantener el proceso activo se debe usar un process manager como PM2 o un servicio `systemd`.

Crear dos entornos separados: uno para preview y otro para produccion. No reutilices la misma `DATABASE_URL` ni el mismo bucket S3 de produccion en preview.

## 6. Base de datos RDS PostgreSQL

Crear una instancia PostgreSQL en RDS y guardar:

- Host/endpoint.
- Puerto, normalmente `5432`.
- Usuario.
- Password.
- Nombre de base de datos, por ejemplo `catalogohn`.

Luego formar `DATABASE_URL`:

```text
postgres://usuario:password@endpoint-rds:5432/catalogohn
```

Para inicializar tablas y seed:

```bash
cd backend
npm run db:setup
```

En produccion conviene ejecutar esta tarea una sola vez y con cuidado. Para preview se puede resetear con mas libertad.

## 7. S3 para imagenes y logos

El panel admin debe subir a S3:

- Logo de empresa.
- Logos de marcas.
- Imagenes de productos.

Requisitos:

- Convertir/comprimir imagenes a WebP o JPEG.
- Peso maximo recomendado: `300 KB` por archivo de producto.
- Guardar la URL final en PostgreSQL.
- Separar buckets o prefijos por entorno:
  - `catalogohn-assets-preview`
  - `catalogohn-assets-prod`

## 8. CloudFront, ACM y dominio

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

Configurar ACM para certificados HTTPS y CloudFront para redirigir HTTP a HTTPS.

Tambien se debe preparar wildcard DNS para futuros inquilinos:

```text
*.catalogohn.com
```

## 9. Checklist antes de produccion

- Cambiar `JWT_SECRET` por un valor largo y privado.
- Configurar `CORS_ORIGIN` con la URL real del frontend.
- Confirmar que `.env` no se subio a GitHub.
- Activar backups en RDS.
- Revisar reglas de red para que la base no quede publica innecesariamente.
- Conectar dominio propio cuando Amplify y backend esten estables.
- Validar primero en `develop`/preview antes de fusionar a `main`.
- Activar 2FA en GitHub y AWS.
- Guardar llaves `.pem` fuera del repositorio.
- Forzar HTTPS con CloudFront/ACM.

## 10. Pendiente para CatalogoHN

- Persistir CRUD del panel admin en endpoints reales.
- Implementar subida de imagenes a S3 con compresion.
- Agregar flujo real de recuperacion de contrasena.
- Permitir al superadmin asignar admins por empresa.
- Enviar correos HTML estructurados con Nodemailer.
- Fortalecer auditoria de accesos por cliente.
