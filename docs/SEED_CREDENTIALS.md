# Credenciales Seed

Credenciales iniciales creadas por `npm run db:setup`. Solo para desarrollo y preview.

> **Importante**: cambiar estas contraseñas inmediatamente después del primer login en cualquier entorno publicado.

## Usuarios

| Rol | Usuario | Contraseña Inicial | Correo compatible |
|-----|---------|-------------------|-------------------|
| Cliente | `cliente1` | *(Configurada en seed local)* | `cliente1@autorepuestos.com` |
| Admin Kolben | `admin` | *(Configurada en seed local)* | `admin@kolben.com` |
| Superadmin | `superadmin` | *(Configurada en seed local)* | `superadmin@catalogohn.com` |

## Uso

```bash
cd backend
npm run db:setup
```

El seed crea estos usuarios con las contraseñas hasheadas. También crea datos de ejemplo para el inquilino KOLBEN (marcas, categorías, productos).
