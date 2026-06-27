# Credenciales Seed

Credenciales iniciales creadas por `npm run db:setup`. Solo para desarrollo y preview.

> **Importante**: cambiar estas contrasenas inmediatamente despues del primer login en cualquier entorno publicado.

## Usuarios

| Rol | Usuario | Contrasena | Correo compatible |
|-----|---------|------------|-------------------|
| Cliente | `cliente1` | `ClientPassword123` | `cliente1@autorepuestos.com` |
| Admin Kolben | `admin` | `KolbenAdminPassword123` | `admin@kolben.com` |
| Superadmin | `superadmin` | `SuperAdminPassword123` | `superadmin@catalogohn.com` |

## Uso

```bash
cd backend
npm run db:setup
```

El seed crea estos usuarios con las contrasenas hasheadas. Tambien crea datos de ejemplo para el inquilino KOLBEN (marcas, categorias, productos).
