# Deployment Guide

Guia inicial para publicar CatalogoHN usando GitHub y AWS.

## 1. GitHub

El proyecto ya es un repositorio Git local, pero todavia no tiene remoto.

### Opcion recomendada con GitHub web

1. Entra a GitHub y crea un repositorio nuevo.
2. No agregues README, `.gitignore` ni licencia desde GitHub, porque este proyecto ya los tiene.
3. Copia la URL del repo, por ejemplo:

```bash
https://github.com/tu-usuario/catalogohn.git
```

4. En esta carpeta ejecuta:

```bash
git add .
git commit -m "Initial CatalogoHN app"
git branch -M main
git remote add origin https://github.com/tu-usuario/catalogohn.git
git push -u origin main
```

> Importante: `.env` esta ignorado y no debe subirse. Solo se suben `.env.example`.

## 2. AWS recomendado

Para mantenerlo simple al inicio:

- Frontend React/Vite: AWS Amplify Hosting.
- Backend Node/Express: AWS Elastic Beanstalk.
- Base de datos: Amazon RDS PostgreSQL.

Esta arquitectura separa el sitio estatico, la API y la base de datos.

## 3. Frontend en Amplify

Configuracion:

- App root: `frontend`
- Build command: `pnpm run build`
- Output directory: `dist`

Variables de entorno en Amplify:

```text
VITE_API_URL=https://api.tu-dominio.com/api
VITE_TENANT_SLUG=kolben
```

Si primero despliegas sin dominio propio, `VITE_API_URL` puede apuntar temporalmente a la URL publica del backend.

## 4. Backend en Elastic Beanstalk

El backend se despliega desde la carpeta `backend`.

Variables de entorno necesarias:

```text
PORT=3001
NODE_ENV=production
JWT_SECRET=un-secreto-largo-y-aleatorio
DATABASE_URL=postgres://usuario:password@host-rds:5432/catalogohn
CORS_ORIGIN=https://url-del-frontend-amplify
```

Elastic Beanstalk usa el script:

```bash
npm start
```

## 5. Base de datos RDS PostgreSQL

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

En produccion conviene ejecutar esta tarea una sola vez y con cuidado.

## 6. Checklist antes de produccion

- Cambiar `JWT_SECRET` por un valor largo y privado.
- Configurar `CORS_ORIGIN` con la URL real del frontend.
- Confirmar que `.env` no se subio a GitHub.
- Activar backups en RDS.
- Revisar reglas de red para que la base no quede publica innecesariamente.
- Conectar dominio propio cuando Amplify y backend esten estables.

## 7. Pendiente para CatalogoHN

- Persistir CRUD del panel admin en endpoints reales.
- Implementar subida de imagenes a almacenamiento estable.
- Agregar flujo real de recuperacion de contrasena.
- Permitir al superadmin asignar admins por empresa.
