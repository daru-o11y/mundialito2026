# 📒 Álbum de Figuritas — Mundial 2026
## Documentación del proyecto

---

## ¿Para qué sirve?

Aplicación web para llevar el registro de un álbum de figuritas del Mundial 2026. Permite a múltiples usuarios cargar sus figuritas, ver su progreso, exportar listas de faltantes y repetidas, y compararse en un ranking grupal.

---

## Infraestructura

```
┌─────────────────────────────────────────────────────┐
│                    USUARIO (browser)                │
└────────────────────────┬────────────────────────────┘
                         │ HTTPS
┌────────────────────────▼────────────────────────────┐
│              RENDER (Web Service - Free)            │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │         Node.js + Express (server/)         │   │
│  │                                             │   │
│  │  • Sirve el frontend (public/index.html)    │   │
│  │  • API REST en /api/*                       │   │
│  │  • Auth con JWT (30 días)                   │   │
│  │  • Bcrypt para contraseñas                  │   │
│  └──────────────────┬──────────────────────────┘   │
└─────────────────────┼───────────────────────────────┘
                      │ Supabase JS Client
┌─────────────────────▼───────────────────────────────┐
│           SUPABASE (Base de datos - Free)           │
│                                                     │
│  Tabla: usuarios                                    │
│  Tabla: logs                                        │
└─────────────────────────────────────────────────────┘
```

### Tecnologías

| Capa | Tecnología | Plan |
|---|---|---|
| Frontend | HTML + CSS + JavaScript (vanilla) | — |
| Backend | Node.js 18+ · Express 4 | — |
| Auth | JWT (jsonwebtoken) + Bcrypt | — |
| Base de datos | Supabase (PostgreSQL) | Free (500MB) |
| Hosting | Render Web Service | Free |
| Repositorio | GitHub | Free |

### URLs

| Ambiente | URL |
|---|---|
| Producción | `https://mundial2026-figusintercambio.onrender.com` |
| Repositorio | `https://github.com/TU_USUARIO/mundial2026` |
| Supabase | `https://supabase.com/dashboard` |
| Render | `https://dashboard.render.com` |

---

## Estructura del proyecto

```
mundial2026/
├── server/
│   └── index.js          ← Backend: API REST, auth, rutas admin
├── public/
│   └── index.html        ← Frontend completo (HTML + CSS + JS)
├── supabase_schema.sql   ← Crear tabla usuarios
├── supabase_add_rol.sql  ← Agregar columna rol
├── supabase_logs.sql     ← Crear tabla logs
├── package.json          ← Dependencias Node.js
├── .env.example          ← Variables de entorno de ejemplo
├── .gitignore
└── README.md
```

---

## Base de datos

### Tabla `usuarios`

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID (PK) | Identificador único |
| `nombre` | TEXT UNIQUE | Nombre del coleccionista |
| `password_hash` | TEXT | Contraseña hasheada con bcrypt |
| `rol` | TEXT | `admin` o `coleccionista` |
| `estado` | JSONB | Progreso del álbum `{"G__Equipo__PT1": "tengo"}` |
| `created_at` | TIMESTAMPTZ | Fecha de registro |
| `updated_at` | TIMESTAMPTZ | Última actualización del álbum |

### Tabla `logs`

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID (PK) | Identificador único |
| `usuario_id` | UUID (FK) | Referencia a usuarios |
| `usuario_nombre` | TEXT | Nombre al momento del log |
| `accion` | TEXT | `login`, `registro` |
| `detalle` | TEXT | Descripción del evento |
| `created_at` | TIMESTAMPTZ | Fecha y hora del evento |

---

## API Endpoints

### Públicos

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/register` | Crear cuenta nueva |
| `POST` | `/api/login` | Iniciar sesión → devuelve JWT |
| `GET` | `/api/usuarios` | Ranking público de coleccionistas |
| `GET` | `/api/health` | Estado del servidor y conexión a BD |

### Autenticados (requieren `Authorization: Bearer <token>`)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/album` | Cargar álbum del usuario actual |
| `PUT` | `/api/album` | Guardar álbum completo |
| `PATCH` | `/api/album/sticker` | Actualizar una figurita |
| `POST` | `/api/change-password` | Cambiar contraseña propia |

### Solo Admin

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/admin/usuarios` | Lista completa de usuarios con stats |
| `GET` | `/api/admin/album/:id` | Ver álbum de cualquier usuario |
| `POST` | `/api/admin/reset/:id` | Resetear álbum de un usuario |
| `POST` | `/api/admin/change-password/:id` | Cambiar contraseña de cualquier usuario |
| `DELETE` | `/api/admin/usuario/:id` | Eliminar usuario |
| `GET` | `/api/admin/stats` | Estadísticas globales |
| `GET` | `/api/admin/logs` | Historial de accesos |

---

## Variables de entorno

Configuradas en **Render → Environment**. Nunca commitear al repositorio.

| Variable | Descripción | Dónde obtenerla |
|---|---|---|
| `SUPABASE_URL` | URL del proyecto Supabase | Supabase → Settings → API → Project URL |
| `SUPABASE_SERVICE_KEY` | Clave de servicio (secret) | Supabase → Settings → API → service_role |
| `JWT_SECRET` | String random para firmar tokens | Inventado (mínimo 32 chars) |
| `PORT` | Puerto del servidor | Render lo setea automáticamente |

---

## Roles de usuario

### Coleccionista (rol por defecto)
- Ve y edita **su propio álbum**
- Accede a: Álbum · Estadios · Progreso propio · Info
- Puede exportar sus faltantes y repetidas en CSV
- Puede exportar/importar su progreso en JSON

### Admin
- Ve todo lo del coleccionista
- Accede además a: panel **⚙️ Admin**
- Puede ver el álbum de cualquier usuario
- Puede resetear o eliminar usuarios
- Puede cambiar contraseñas
- Ve estadísticas globales y logs de acceso

#### Cómo asignar rol admin
En **Supabase → SQL Editor**:
```sql
UPDATE usuarios SET rol = 'admin' WHERE nombre = 'TU_NOMBRE';
```

---

## Comandos útiles

### Desarrollo local

```bash
# Instalar dependencias
npm install

# Copiar variables de entorno
cp .env.example .env
# (editar .env con tus valores reales)

# Correr el servidor en modo desarrollo
npm run dev

# La app queda en http://localhost:3000
```

### Git / Deploy

```bash
# Ver estado de cambios
git status

# Agregar y commitear cambios
git add public/index.html server/index.js
git commit -m "descripción del cambio"
git push

# Render redeploya automáticamente al hacer push a main
```

### Supabase — Consultas útiles

```sql
-- Ver todos los usuarios
SELECT id, nombre, rol, created_at FROM usuarios ORDER BY created_at;

-- Hacer admin a un usuario
UPDATE usuarios SET rol = 'admin' WHERE nombre = 'TU_NOMBRE';

-- Ver últimos logins
SELECT usuario_nombre, accion, created_at 
FROM logs ORDER BY created_at DESC LIMIT 20;

-- Ver progreso de un usuario específico
SELECT nombre, 
  jsonb_object_keys(estado) as figurita
FROM usuarios WHERE nombre = 'TU_NOMBRE';

-- Contar figuritas por estado de un usuario
SELECT 
  COUNT(*) FILTER (WHERE value = 'tengo') as tengo,
  COUNT(*) FILTER (WHERE value = 'repetida') as repetidas
FROM usuarios, jsonb_each_text(estado)
WHERE nombre = 'TU_NOMBRE';

-- Resetear álbum de un usuario desde Supabase
UPDATE usuarios SET estado = '{}' WHERE nombre = 'TU_NOMBRE';
```

---

## Seguridad

- Las contraseñas se almacenan hasheadas con **bcrypt** (cost factor 10)
- Los tokens JWT expiran a los **30 días**
- La sesión se cierra automáticamente tras **10 minutos de inactividad**
- El `SUPABASE_SERVICE_KEY` nunca debe exponerse al cliente
- Las rutas `/api/admin/*` verifican rol admin en el servidor, no solo en el frontend
- El `.env` está en `.gitignore` y nunca se sube al repositorio

---

## Limitaciones del plan gratuito

| Servicio | Límite free | Estado actual |
|---|---|---|
| Render | Hiberna tras 15 min sin visitas | El primer request puede tardar ~30s |
| Supabase DB | 500 MB | Muy por debajo del límite |
| Supabase requests | 50.000/mes | Suficiente para 20-100 usuarios |

### Solución para la hibernación de Render
Usar **UptimeRobot** (gratuito) para hacer ping cada 10 minutos:
1. Registrarse en [uptimerobot.com](https://uptimerobot.com)
2. New Monitor → HTTP(s)
3. URL: `https://mundial2026-figusintercambio.onrender.com/api/health`
4. Intervalo: 10 minutos

---

## Diagrama de flujo — Login

```
Usuario ingresa nombre + contraseña
        ↓
POST /api/login
        ↓
Supabase busca usuario por nombre (case-insensitive)
        ↓
Bcrypt compara contraseña con hash
        ↓
Genera JWT con { userId, userName, userRol }
        ↓
Registra log en tabla logs
        ↓
Responde con { token, nombre, rol, estado }
        ↓
Frontend guarda token en localStorage
        ↓
setRol(rol) → muestra/oculta secciones según rol
        ↓
Carga álbum y renderiza
```

---

## Contacto y mantenimiento

- **Proyecto:** Álbum de Figuritas Mundial 2026
- **Stack:** Node.js · Express · Supabase · Render
- **Versión:** 1.0
- **Última actualización:** Mayo 2026
