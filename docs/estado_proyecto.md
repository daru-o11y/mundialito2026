# ⚽ Álbum Mundial 2026 — Estado del Proyecto
> Checkpoint: Mayo 2026 · Branch activo: `main` · Producción: `mvp4_final1_intercambios`

---

## 🌿 Infra — Branches y ambientes

| Branch | Ambiente | URL | Base de datos |
|---|---|---|---|
| `main` | Desarrollo | `mundialito2026-main.onrender.com` | Supabase dev |
| `mvp5_preprd` | Pre-producción | `mundialito2026-preprd.onrender.com` | Supabase preprod |
| `mvp4_final1_intercambios` | **Producción** | `mundialito2026-figusintercambio.onrender.com` | Supabase prod |
| `backup/main-antes-refactor-figuritas` | Backup pre-cambio 20 figuritas | — | — |

**Flujo de promoción:** `main` → `mvp5_preprd` → `mvp4_final1_intercambios`

> Banner morado aparece automáticamente en dev y preprod. En producción no aparece.

---

## 🗄️ Infra — Base de datos (Supabase)

**Tablas:**

| Tabla | Descripción |
|---|---|
| `usuarios` | id, nombre, password_hash, rol, estado (JSONB), created_at, updated_at |
| `intercambios` | id, solicitante_id/nom, receptor_id/nom, pide_key/desc, ofrece_keys/descs, estado, contraoferta_keys/descs, expires_at |
| `logs` | id, usuario_id, usuario_nombre, accion, detalle, created_at |
| `usuarios_backup_pre_refactor` | Backup antes del cambio de 21→20 figuritas |

**Formato actual de keys en `estado` (producción — PROBLEMÁTICO):**
```json
{
  "A__M_xico": { "ESC": "tengo", "PT1": "tengo", "PT2": "repetida" },
  "L__Croacia": { "ESC": "tengo", "PT1": "tengo" }
}
```
⚠️ Mezcla `ESC` + `PT1-PT20` (21 entradas por equipo). Pendiente migración a `PT1-PT20` puro (20 entradas).

**Formato correcto esperado:**
```json
{
  "A__Mexico": { "PT1": "tengo", "PT2": "repetida" }
}
```

---

## 🔴 CRÍTICOS — Bloquean funcionalidad principal

| # | Descripción | Detalle | Estado |
|---|---|---|---|
| ~~C1~~ | ~~**Filtros no funcionan después de importar JSON**~~ | ~~Filtros Completos/Incompletos/Sin empezar no agrupaban bien. Resuelto.~~ | 🟢 Resuelto |
| C2 | **Keys inconsistentes en producción** | Los estados en Supabase tienen formato viejo (`ESC` + `PT1-PT20`, nombres con acentos). El frontend nuevo usa `PT1-PT20` sin `ESC`. Genera mismatch permanente hasta migración. | 🔴 Sin resolver |

**Scripts SQL para resolver C1 y C2:**

```sql
-- Paso 1: Renombrar ESC → PT1 en todos los estados
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

-- Verificar resultado
SELECT nombre, estado->'A__M_xico' FROM usuarios LIMIT 3;

-- Paso 2: Renombrar keys con acentos (ej: A__M_xico → A__Mexico)
-- ⚠️ Ejecutar DESPUÉS del Paso 1. Requiere listar todos los equipos afectados.
-- Ver evolutivo E2 para el script completo.
```

---

## 🟡 BUGS CONOCIDOS

| # | Descripción | Detalle | Estado |
|---|---|---|---|
| B1 | **Nombres de países rotos en intercambios** | "lr n (GG) #20" en vez de "Irán (GG) #20". `keyToDesc` no traduce bien los nombres con acentos guardados en keys viejas. Se resuelve con E2. | 🟡 Pendiente |
| B2 | **Export JSON toma nombre del localStorage** | En algunos casos toma el nombre del localStorage en vez del nombre real del usuario logueado. | 🟡 Parcialmente resuelto |
| B3 | **Import JSON: keys duplicadas** | JSONs exportados con versiones anteriores tienen 49 equipos (uno de más) con keys truncadas y duplicadas (`A__Rep` + `A__Rep__Checa`). Se resuelve con E2. | 🟡 En progreso |
| B4 | **Figuritas `PT20` en datos viejos** | Datos exportados antes del cambio a 20 figuritas tienen `PT20:ESP`. Al importar, la figurita #20 (DT) puede no mapearse bien. | 🟡 Pendiente |
| B5 | **Bugs en módulo de intercambios** | Fase 2 funcional pero con bugs por detallar. Pendiente relevar y documentar. | 🔴 Por detallar |

---

## 🟢 RESUELTOS RECIENTEMENTE

| # | Descripción |
|---|---|
| R1 | Intercambios daban 500 — columnas faltantes en producción (`ofrece_keys`, `ofrece_descs`, etc.) |
| R2 | `ofrece_key NOT NULL` constraint rota el POST de intercambios |
| R3 | `loadMisPropuestas` no mostraba propuestas (faltaba `listDiv.innerHTML = rendered`) |
| R4 | Panel Admin → Usuarios daba "Error de conexión" (línea `listDiv` fuera de contexto) |
| R5 | Figuritas de 21 → 20 por equipo (eliminado `PT20:ESP`) |
| R6 | Usuario visor implementado (solo lectura, ve álbum del admin configurado) |
| R7 | Equalizador en header reemplazó chips planos |
| R8 | Panel Admin visible para usuario visor — fix aplicado en mvp4 |
| R9 | Sección Especiales (FWC + COK) implementada antes de los grupos A-L |
| R10 | Filtros Completos / Incompletos / Sin empezar — funcionando correctamente |
| R11 | ⚠️ Filtro "Incompletos" y "Sin empezar" removidos — solo quedan **Todos** y **Completos** |

---

## 🔵 EVOLUTIVOS — Próximas funcionalidades

| # | Descripción | Detalle | Prioridad |
|---|---|---|---|
| ~~E0~~ | ~~**Fase 2 — Intercambios**~~ | ~~Flujo completo propuesta → reserva → aceptar/rechazar/contraoferta. Badge + polling. Reserva y liberación automática de figuritas.~~ | 🟢 Completo |
| ~~E1~~ | ~~**Figuritas FWC / Especiales**~~ | ~~Sección especiales implementada con grupos FWC y COK antes de A-L. Grupos por países en su lugar.~~ | 🟢 Completo |
| E2 | **Migración de nombres sin acentos** | Cambiar nombres en `DB_GRUPOS`: México→Mexico, Japón→Japon, etc. + script SQL para renombrar keys en `estado` de todos los usuarios en Supabase. Resuelve de raíz B1, B3, C1. Ejecutar después de E3. | 🔵 Alta |
| E3 | **Migración de keys ESC → PT1** | Script SQL para convertir `{"ESC": "tengo"}` → `{"PT1": "tengo"}` en todos los estados de Supabase. **Ejecutar primero, antes de E2.** Script listo arriba en sección Críticos. | 🔵 Alta |
| E4 | **Nueva tabla para FWC y futuras colecciones** | Evaluar separar colecciones (FWC, equipos) en tablas propias en Supabase en vez de todo en el JSONB de `usuarios`. Necesario si se agregan álbumes por temporada. | 🔵 Media |
| E5 | **Chat / Feed de actividad** | Feed híbrido: mensajes + eventos automáticos (intercambio aceptado, usuario completó un equipo). Polling cada 30 segundos. | 🔵 Baja |
| E6 | **Modularización del frontend** | Separar `index.html` monolito (~3300 líneas) en módulos ES6 nativos (`type="module"`). Estructura: `css/` (base, album, especiales) + `js/` (db, state, album, especiales, intercambios, stats, auth). Sin bundlers ni build steps — Express ya lo soporta. **Hacerlo en una sesión dedicada solo a refactor, sin features nuevas en paralelo.** Orden de carga crítico: `db.js` → `state.js` → resto. | ⏸ Pendiente — hacer después de que especiales quede estable |

---

## ⚪ ESTÉTICOS

| # | Descripción | Estado |
|---|---|---|
| S1 | Nombres de países con caracteres especiales en la UI (acentos, puntos) | ⚪ Pendiente — se resuelve con E2 |
| S2 | Figuritas FWC / especiales — diseño y sección | 🟢 Implementado |
| S3 | Animación reservada demasiado agresiva (pulso rojo + 🔒) | ⚪ Pendiente |
| S4 | Estado vacío en figuritas foil sin tratamiento visual diferenciado | ⚪ Pendiente |
| S5 | Grid de figuritas: 10 columnas fijas puede quedar apretado en mobile pequeño | ⚪ Pendiente |
| S6 | Sección Intercambios marcada 🚧 en texto de ayuda (funcionalidad ya operativa) | ⚪ Pendiente |
| S7 | Header: countdown a inicio del mundial + próximo partido ARG | 🟢 Implementado |
| S8 | Equalizador de figuritas (tengo/faltan/repetidas/reservadas) | 🟢 Implementado |
| S9 | Perfil de usuario con avatar animado | 🟢 Implementado |

---

## 📋 ORDEN DE TRABAJO SUGERIDO

```
1. 🔴 E3       → SQL: ESC→PT1 en Supabase                  (desbloquea C2, C1)
2. 🔴 E2       → SQL: nombres sin acentos en Supabase       (resuelve B1, B3, C1 de raíz)
3. 🟡 B1       → Fix keyToDesc (si queda algo post-E2)
4. 🟡 B2, B4   → Fixes de import/export JSON
5. 🔵 E4       → Evaluar nueva tabla para colecciones
7. ⚪ S3-S6    → Mejoras estéticas / UX
8. 🔵 E5       → Chat / Feed de actividad
```

---

*Última actualización: Mayo 2026 — Fase 2 completa · Especiales (FWC+COK) implementado · Filtros resueltos · Solo quedan filtros Todos/Completos*