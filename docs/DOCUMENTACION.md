# 📒 Álbum de Figuritas — Mundial 2026
## Documentación v2.0 — Mayo 2026

---

## ¿Para qué sirve?

Aplicación web para llevar el registro de un álbum de figuritas del Mundial 2026. Permite a múltiples usuarios cargar sus figuritas, ver su progreso, exportar listas de faltantes y repetidas, intercambiar figuritas entre usuarios y compararse en un ranking grupal.

---

## Ambientes

| Ambiente | Branch | URL | Base de datos |
|---|---|---|---|
| **Desarrollo** | `main` | `mundialito2026-main.onrender.com` | Supabase dev |
| **Pre-producción** | `mvp5_preprd` | `mundialito2026-preprd.onrender.com` | Supabase preprod |
| **Producción** | `mvp4` | `mundialito2026-figusintercambio.onrender.com` | Supabase prod |

> ⚠️ Banner morado aparece automáticamente si la URL contiene `main`, `dev` o `localhost`.

### Flujo de promoción

```bash
# Dev → Preprod
git checkout mvp5_preprd && git merge main && git push origin mvp5_preprd

# Preprod → Prod
git checkout mvp4 && git merge mvp5_preprd && git push origin mvp4
```

---

## Infraestructura

```
Browser → Render (Node.js + Express) → Supabase (PostgreSQL)
```

| Capa | Tecnología | Plan |
|---|---|---|
| Frontend | HTML + CSS + JS vanilla | — |
| Backend | Node.js 18 + Express 4 | — |
| Auth | JWT 30 días + Bcrypt | — |
| Base de datos | Supabase PostgreSQL | Free 500MB |
| Hosting | Render Web Service | Free |

---

## Estructura del proyecto

```
mundial2026/
├── server/index.js              ← API REST completa
├── public/index.html            ← Frontend completo (HTML+CSS+JS)
├── supabase_schema.sql          ← Tabla usuarios
├── supabase_add_rol.sql         ← Columna rol
├── supabase_logs.sql            ← Tabla logs
├── supabase_intercambios.sql    ← Tabla intercambios (base)
├── supabase_intercambios_v2.sql ← Columnas ofrece_keys[], contraoferta_keys[]
├── supabase_intercambios_v3.sql ← Columna expires_at
├── package.json
├── .env.example
└── DOCUMENTACION.md
```

---

## Base de datos — tablas completas

### `usuarios`
| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID PK | Identificador único |
| `nombre` | TEXT UNIQUE | Nombre del coleccionista |
| `password_hash` | TEXT | Bcrypt hash |
| `rol` | TEXT | `admin` o `coleccionista` |
| `estado` | JSONB | `{"A__Mexico": {"ESC": "tengo", "PT1": "repetida"}}` |
| `created_at` | TIMESTAMPTZ | Fecha registro |
| `updated_at` | TIMESTAMPTZ | Última actualización |

### `logs`
| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID PK | — |
| `usuario_id` | UUID FK | Referencia a usuarios |
| `usuario_nombre` | TEXT | Nombre al momento del log |
| `accion` | TEXT | `login`, `registro` |
| `detalle` | TEXT | Descripción |
| `created_at` | TIMESTAMPTZ | Fecha y hora |

### `intercambios`
| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID PK | — |
| `solicitante_id` | UUID FK | Usuario B (hace la oferta) |
| `solicitante_nom` | TEXT | Nombre B |
| `receptor_id` | UUID FK | Usuario A (recibe la oferta) |
| `receptor_nom` | TEXT | Nombre A |
| `pide_key` | TEXT | Key de la figurita que B quiere de A |
| `pide_desc` | TEXT | Descripción legible |
| `ofrece_key` | TEXT | (legacy, default '') |
| `ofrece_desc` | TEXT | (legacy, default '') |
| `ofrece_keys` | TEXT[] | Keys de figuritas que B ofrece |
| `ofrece_descs` | TEXT[] | Descripciones de figuritas ofrecidas |
| `contraoferta_keys` | TEXT[] | Keys de contraoferta de A |
| `contraoferta_descs` | TEXT[] | Descripciones de contraoferta |
| `estado` | TEXT | Ver estados abajo |
| `expires_at` | TIMESTAMPTZ | Vencimiento (7 días desde aceptado) |
| `created_at` | TIMESTAMPTZ | Creación |
| `updated_at` | TIMESTAMPTZ | Última actualización |

---

## Estados de figuritas

| Estado | Color | Descripción |
|---|---|---|
| `vacia` | Gris | No tengo |
| `tengo` | Verde ✓ | Tengo una |
| `repetida` | Amarillo ↺ | Tengo de más, disponible para intercambio |
| `reservada` | Rojo pulsante 🔒 | Comprometida en propuesta pendiente — NO editable |

### Transiciones

```
vacia → tengo → repetida → vacia  (click manual)
                    ↓
            propuesta enviada
                    ↓
                reservada
               /         \
          aceptan       rechazan/cancelan
              ↓               ↓
        sigue reservada    repetida (automático)
        hasta intercambio
        físico manual
```

> ⚠️ La figurita reservada tiene animación de **pulso rojo** con 🔒 y NO puede editarse mientras haya una propuesta pendiente o aceptada.

---

## Sistema de Intercambios — flujo completo

```
1. B entra a "Intercambios" → ve usuarios con repetidas
2. B entra al álbum de repetidas de A
3. B hace click en figurita (chip: #13 Marruecos (GC) + SVG animado)
4. Popup: elige sus repetidas para ofrecer (selección múltiple)
5. B confirma → figuritas de B: repetida → RESERVADA (bloqueadas)
6. A recibe badge 🔔 en header (polling 180 seg)
7. A entra a "Mis propuestas" → ve la oferta
8. A puede:
   a) ✓ Aceptar → intercambio ACEPTADO, expires_at = +7 días
                   figuritas de B siguen RESERVADAS
   b) ↺ Contraoferta → propone otras figuritas de B
   c) ✗ Rechazar → figuritas de B: reservada → repetida (automático)
9. Intercambio físico en persona
10. Cada uno actualiza su álbum manualmente
11. B (solicitante) marca "✓ Marcar terminado" → estado: TERMINADO
    Si pasan 7 días sin marcar → job automático → TERMINADO
12. Si cualquiera cancela antes → figuritas de B: reservada → repetida
```

### Estados de intercambio

| Estado | Descripción | Acciones disponibles |
|---|---|---|
| `pendiente` | Enviado, esperando respuesta | A: responder/contraoferta · B: cancelar |
| `aceptado` | Aceptado, intercambio físico pendiente | B: marcar terminado · Ambos: cancelar |
| `terminado` | Completado ✅ | — |
| `rechazado` | A rechazó | — figuritas B liberadas |
| `cancelado` | Cancelado por cualquiera | — figuritas B liberadas |

> Intercambios `terminado`, `rechazado` o `cancelado` con más de **2 días** se ocultan automáticamente de "Mis propuestas".

### Job automático de vencimiento
- Corre cada hora en el servidor
- Busca intercambios `aceptado` con `expires_at` vencido
- Los marca como `terminado`

---

## Roles de usuario

### Coleccionista
- Álbum propio · Estadios · Progreso · Info · Intercambios
- Exportar CSV (faltantes/repetidas) y JSON
- Notificaciones de propuestas

### Admin
- Todo lo del coleccionista + Ranking
- Panel ⚙️ Admin:
  - Estadísticas globales
  - Tab Usuarios: ver/resetear/eliminar/cambiar contraseña de cualquier usuario
  - Tab Logs: historial de accesos
  - Crear usuarios con cualquier rol
- Cambiar contraseña propia

```sql
-- Asignar rol admin
UPDATE usuarios SET rol = 'admin' WHERE nombre = 'TU_NOMBRE';
```

---

## API Endpoints

### Públicos
| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/login` | Login → JWT |
| `GET` | `/api/usuarios` | Ranking |
| `GET` | `/api/health` | Estado servidor |

### Autenticados
| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/album` | Cargar álbum |
| `PUT` | `/api/album` | Guardar álbum (debounce 1.5s) |
| `PATCH` | `/api/album/sticker` | Actualizar una figurita |
| `POST` | `/api/change-password` | Cambiar contraseña propia |

### Intercambios
| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/intercambios` | Mis propuestas |
| `GET` | `/api/intercambios/pendientes-count` | Count para badge |
| `GET` | `/api/intercambios/usuarios` | Usuarios con repetidas |
| `POST` | `/api/intercambios` | Crear propuesta (reserva figuritas) |
| `PATCH` | `/api/intercambios/:id` | Aceptar/rechazar/cancelar/contraoferta/terminado |

### Admin
| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/admin/usuarios` | Lista con stats |
| `GET` | `/api/admin/album/:id` | Ver álbum de usuario |
| `POST` | `/api/admin/reset/:id` | Resetear álbum |
| `POST` | `/api/admin/change-password/:id` | Cambiar contraseña |
| `POST` | `/api/admin/crear-usuario` | Crear usuario |
| `DELETE` | `/api/admin/usuario/:id` | Eliminar usuario |
| `GET` | `/api/admin/stats` | Estadísticas globales |
| `GET` | `/api/admin/logs` | Logs de acceso |

---

## Variables de entorno (Render)

| Variable | Descripción |
|---|---|
| `SUPABASE_URL` | `https://xxx.supabase.co` (sin barra final) |
| `SUPABASE_SERVICE_KEY` | service_role key (NO la anon key) |
| `JWT_SECRET` | String random 32+ chars |

---

## Comandos útiles

### Git
```bash
git status
git add public/index.html server/index.js
git commit -m "descripción"
git push
```

### Supabase — queries útiles
```sql
-- Ver usuarios
SELECT id, nombre, rol, created_at FROM usuarios ORDER BY created_at;

-- Hacer admin
UPDATE usuarios SET rol = 'admin' WHERE nombre = 'NOMBRE';

-- Resetear contraseña (hash de "password")
UPDATE usuarios
SET password_hash = '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'
WHERE nombre = 'NOMBRE';

-- Ver intercambios pendientes
SELECT solicitante_nom, receptor_nom, pide_desc, estado, expires_at
FROM intercambios WHERE estado IN ('pendiente','aceptado') ORDER BY created_at DESC;

-- Liberar figuritas reservadas de emergencia
UPDATE usuarios
SET estado = (
  SELECT jsonb_object_agg(
    key, jsonb_object_agg(
      ikey, CASE WHEN ival = 'reservada' THEN 'repetida' ELSE ival END
    )
  )
  FROM jsonb_each(estado) AS t(key, val),
       jsonb_each_text(val) AS s(ikey, ival)
)
WHERE nombre = 'NOMBRE';

-- Ver logs recientes
SELECT usuario_nombre, accion, created_at
FROM logs ORDER BY created_at DESC LIMIT 20;
```

---

## Seguridad

- Bcrypt (cost 10) para contraseñas
- JWT 30 días
- Inactividad: cierre automático a los 10 minutos
- Registro público deshabilitado — solo admin crea usuarios
- Rutas `/api/admin/*` verifican rol en servidor
- Sanitización de inputs antes de guardar en BD
- `.env` en `.gitignore`

---

## Limitaciones plan gratuito

| Servicio | Límite | Solución |
|---|---|---|
| Render | Hiberna 15 min sin visitas | UptimeRobot cada 10 min → `/api/health` |
| Supabase | 500MB · 50k req/mes | Suficiente para 20-100 usuarios |

---

## Roadmap

### ✅ Fase 1 — MVP
- Álbum 12 grupos, 48 equipos, 1008 figuritas (1-21 por equipo)
- Estados: vacía, tengo, repetida, **reservada** (con animación pulso rojo)
- Guardado automático debounce 1.5s + indicador visual
- Login, roles admin/coleccionista, JWT, timeout 10min
- Panel admin completo
- Exportar CSV/JSON

### ✅ Fase 2 — Intercambios
- Flujo completo: propuesta → reserva → aceptar/rechazar/contraoferta/terminado
- Badge 🔔 con polling 180 seg
- Vencimiento automático 7 días
- SVG animado como ícono de intercambio
- Chips con formato `#NRO Nacion (Grupo)`
- Filtro: ocultar resueltos con +2 días

### 💡 Fase 3 — Chat/Feed (planificado)
- Feed híbrido: mensajes + eventos automáticos
- Polling 30 seg

---

## Notas operativas

- **Cambiar branch en Render:** Settings → Branch → Save → redeploya
- **Banner dev:** aparece si URL contiene `main`, `dev` o `localhost`
- **Crear usuario:** solo desde panel Admin → + Crear usuario
- **Recuperar contraseña:** admin resetea desde panel o SQL
- **Emergencia figuritas bloqueadas:** query SQL de liberación arriba

---

*Stack: Node.js · Express · Supabase · Render · v2.0 · Mayo 2026*
