# 🧠 Contexto del Proyecto — Para nuevo chat
> Pegá este archivo al inicio de una nueva conversación para retomar el contexto

---

## ¿Qué es este proyecto?

**Álbum de Figuritas del Mundial 2026** — App web multi-usuario para llevar el registro de figuritas del álbum Panini. Los usuarios marcan sus figuritas (tengo/repetida/reservada), intercambian entre sí, y un admin gestiona el grupo.

---

## Stack técnico

```
Frontend:  HTML + CSS + JavaScript vanilla (todo en public/index.html)
Backend:   Node.js 18 + Express 4 (server/index.js)
Auth:      JWT (30 días) + Bcrypt
Base datos: Supabase (PostgreSQL) — columna estado JSONB por usuario
Hosting:   Render (Free tier)
Repo:      GitHub
```

---

## Estructura clave

```
mundial2026/
├── server/index.js       ← API REST + auth + lógica de intercambios
├── public/index.html     ← Frontend completo (DB de figuritas incluida)
└── supabase_schema.sql   ← Schema de la BD
```

---

## Cómo funciona el álbum

**960 figuritas** en total: 48 equipos × 20 figuritas por equipo.

Cada figurita tiene un código `PT1` a `PT20`:
- PT1 = Escudo, PT2 = Arquero, PT3-PT6 = Defensores, PT7-PT10 = Mediocampistas
- PT11-PT13 = Delanteros, PT14-PT18 = Suplentes, PT19 = Capitán, PT20 = DT

**Las figuritas se identifican con keys como:**
```
"A__M_xico||PT5"   ← Grupo A, México, figurita 5
"L__Croacia||PT1"  ← Grupo L, Croacia, escudo
```

⚠️ **Problema activo:** Los datos en Supabase usan formato viejo con `ESC` (código del escudo) en lugar de `PT1`, y nombres con acentos (`M_xico` en vez de `Mexico`). Hay una migración SQL pendiente.

---

## Roles de usuario

| Rol | Puede hacer |
|---|---|
| `admin` | Todo + panel admin + ranking + crear usuarios |
| `coleccionista` | Álbum propio + intercambios + progreso |
| `visor` | Solo lectura del álbum de un admin (configurable al crear) |

---

## Funcionalidades implementadas

✅ Login / registro (solo admin puede crear usuarios)
✅ Álbum con 12 grupos (A-L), 48 equipos, 20 figuritas por equipo
✅ Estados: vacía → tengo → repetida (click para ciclar)
✅ Estado `reservada` (bloqueada en intercambio pendiente)
✅ Guardado automático en Supabase con debounce 1.5s
✅ Export/Import JSON del progreso
✅ Export CSV de faltantes y repetidas
✅ Filtros: Todos / Incompletos / Completos / Sin empezar
✅ Intercambios: proponer / aceptar / rechazar / contraoferta
✅ Notificaciones de intercambios pendientes (polling 3 min)
✅ Panel Admin: stats, lista de usuarios, expand con progreso por grupo
✅ Ranking (solo admin)
✅ Usuario Visor: solo lectura del álbum de un admin
✅ Countdown en header: inicio del mundial + próximo partido ARG
✅ Equalizador visual de figuritas en header
✅ 3 ambientes: main (dev) / mvp5_preprd / mvp4_final1_intercambios (prod)

---

## Bugs activos (prioridad)

🔴 **CRÍTICO — Filtros post-import no funcionan:** Después de importar un JSON viejo, los filtros Completos/Incompletos no muestran bien los equipos. Causa: mismatch de keys entre formato viejo del JSON (`A__M_xico||ESC`) y formato actual del sistema (`A__M_xico||PT1`). La función `resolveTeamKey` y el remap del import no cubren todos los casos.

🔴 **CRÍTICO — Keys inconsistentes en producción:** Los estados en Supabase tienen `ESC` como código del escudo, pero el frontend usa `PT1`. También los nombres tienen acentos (`M_xico`) mientras el nuevo `teamKey` genera `Mexico`. **Requiere migración SQL.**

🟡 **Nombres rotos en intercambios:** "lr n (GG) #20" en vez de "Irán (GG) #20". `keyToDesc` no traduce nombres con acentos.

---

## Migraciones SQL pendientes

Ejecutar en Supabase para resolver los bugs de keys:

```sql
-- 1. Renombrar ESC → PT1 en todos los estados
UPDATE usuarios
SET estado = (
  SELECT jsonb_object_agg(
    key,
    CASE
      WHEN jsonb_typeof(value) = 'object'
      THEN (
        SELECT jsonb_object_agg(
          CASE WHEN k = 'ESC' THEN 'PT1' ELSE k END,
          v
        )
        FROM jsonb_each_text(value) AS t(k,v)
      )
      ELSE value
    END
  )
  FROM jsonb_each(estado)
)
WHERE estado IS NOT NULL;

-- 2. Verificar resultado
SELECT nombre, estado->'A__M_xico' FROM usuarios LIMIT 3;
```

---

## Próximas funcionalidades planeadas

1. **Figuritas FWC / Especiales** — 20 figuritas generales (portada, mascota, trofeo) en sección separada antes de los grupos. Mismo diseño, sin dropdown (listado siempre visible). Animación especial para las figuritas especiales.

2. **Nombres sin acentos** — Renombrar en `DB_GRUPOS`: México→Mexico, Japón→Japon, etc. + migración SQL de keys en Supabase. Resuelve bugs de keys de raíz.

3. **Nueva tabla en Supabase** para colecciones futuras (en lugar de meter todo en JSONB de usuarios).

---

## Archivos más importantes para editar

Cuando el usuario trae cambios, siempre pedir:
- `public/index.html` — para cambios de frontend
- `server/index.js` — para cambios de backend/API
- Ambos si el cambio es de un flujo completo (ej: intercambios)

Los archivos se editan con Python usando `str.replace()` para cambios quirúrgicos.

---

## URLs de producción

| Ambiente | URL |
|---|---|
| Producción | https://mundialito2026-figusintercambio.onrender.com |
| Pre-prod | https://mundialito2026-preprd.onrender.com |
| Dev | https://mundialito2026-main.onrender.com |

---

*Proyecto activo · Stack: Node.js + Supabase + Render · Mayo 2026*
