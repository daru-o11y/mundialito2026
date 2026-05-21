# ⚽ Álbum Mundial 2026 — Guía de Deploy

Stack: Node.js + Express · Supabase (PostgreSQL) · Render

---

## Paso 1 — Crear la base de datos en Supabase (gratis)

1. Ir a **https://supabase.com** → crear cuenta → **New project**
2. Ponerle nombre: `mundial2026`, elegir región más cercana, crear contraseña (guardala)
3. Esperar ~2 minutos a que levante
4. Ir a **SQL Editor** → **New query** → pegar el contenido de `supabase_schema.sql` → **Run**
5. Ir a **Project Settings → API**:
   - Copiar **Project URL** → es tu `SUPABASE_URL`
   - Copiar **service_role key** (la de abajo, no la anon) → es tu `SUPABASE_SERVICE_KEY`

---

## Paso 2 — Subir el código a GitHub

```bash
# En tu computadora, en la carpeta del proyecto
git init
git add .
git commit -m "Mundial 2026 Album"

# Crear repo en github.com (botón New repository)
# Luego conectar:
git remote add origin https://github.com/TU_USUARIO/mundial2026.git
git push -u origin main
```

---

## Paso 3 — Deploy en Render (gratis)

1. Ir a **https://render.com** → crear cuenta
2. **New → Web Service**
3. Conectar tu repo de GitHub
4. Configurar:
   - **Name:** `mundial2026-album`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free`
5. En **Environment Variables** agregar:
   ```
   SUPABASE_URL        = (tu URL de Supabase)
   SUPABASE_SERVICE_KEY = (tu service_role key)
   JWT_SECRET          = (un string random largo, ej: corré `openssl rand -hex 32`)
   ```
6. Click **Create Web Service** → esperar ~3 minutos
7. Tu app queda en: `https://mundial2026-album.onrender.com`

---

## Variables de entorno necesarias

| Variable | Dónde obtenerla |
|---|---|
| `SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `SUPABASE_SERVICE_KEY` | Supabase → Settings → API → service_role (secret) |
| `JWT_SECRET` | Cualquier string random largo (mínimo 32 chars) |

---

## Estructura del proyecto

```
mundial2026/
├── server/
│   └── index.js          ← Backend Express
├── public/
│   └── index.html        ← Frontend (todo en uno)
├── supabase_schema.sql   ← Ejecutar en Supabase
├── package.json
├── .env.example          ← Copiar a .env (nunca subir .env a git)
└── README.md
```

---

## API Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/register` | Crear cuenta |
| POST | `/api/login` | Ingresar |
| GET | `/api/album` | Cargar álbum (auth) |
| PUT | `/api/album` | Guardar álbum completo (auth) |
| PATCH | `/api/album/sticker` | Actualizar una figurita (auth) |
| GET | `/api/usuarios` | Ranking público |
| POST | `/api/change-password` | Cambiar contraseña (auth) |

---

## Notas

- El plan **Free de Render** hiberna el servidor tras 15 minutos de inactividad. El primer request después puede tardar ~30 segundos. Para evitar esto, podés upgradear a Starter ($7/mes) o usar un servicio como **UptimeRobot** para hacer ping cada 10 minutos.
- **Supabase Free** tiene límite de 500MB de base de datos y 50.000 requests/mes, más que suficiente para 100 usuarios.
- El `.env` nunca debe subirse a GitHub (ya está en `.gitignore`).
# mundialito2026
