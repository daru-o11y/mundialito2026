# ⚽ Álbum Mundial 2026 — Estado del Proyecto
> Checkpoint: Mayo 2026 · Branch activo: `main` · Producción: `mvp4_final1_intercambios`

---

## 🔴 CRÍTICOS — Bloquean funcionalidad principal

| # | Descripción | Detalle | Estado |
|---|---|---|---|
| C1 | **Filtros no funcionan después de importar JSON** | `countTeam` genera keys como `A__M_xico` pero el JSON viejo tiene `A__Rep`, `A__M_xico`, etc. La función `resolveTeamKey` y el remap en el import no resuelven todos los casos. México, Sudáfrica y Rep. Checa no se agrupan en Completos/Incompletos. | 🔴 En progreso |
| C2 | **Keys inconsistentes en producción** | Los estados en Supabase tienen formato viejo (`ESC` + `PT1-PT20`, nombres con acentos). El frontend nuevo usa `PT1-PT20` sin `ESC`. Genera mismatch permanente hasta migración. | 🔴 Sin resolver |

---

## 🟡 BUGS CONOCIDOS

| # | Descripción | Detalle | Estado |
|---|---|---|---|
| B1 | **Nombres de países rotos en intercambios** | "lr n (GG) #20" en vez de "Irán (GG) #20". El `keyToDesc` no traduce bien los nombres con acentos guardados en keys viejas. | 🟡 Pendiente |
| B2 | **Export JSON** | En algunos casos el export toma el nombre del localStorage en vez del nombre real del usuario logueado. | 🟡 Parcialmente resuelto |
| B3 | **Import JSON: keys duplicadas** | JSONs exportados con versiones anteriores tienen 49 equipos (uno de más) con keys truncadas y duplicadas (`A__Rep` + `A__Rep__Checa`). | 🟡 En progreso |
| B4 | **Figuritas `PT20` en algunos datos viejos** | Datos exportados antes del cambio a 20 figuritas tienen `PT20:ESP`. Al importar, la figurita #20 (DT) puede no mapearse bien. | 🟡 Pendiente |
| B5 | **Panel Admin visible para visor** | El usuario visor veía el Panel de Administración. Fix aplicado en última versión. | 🟢 Resuelto en mvp4 |

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

---

## 🔵 EVOLUTIVOS — Próximas funcionalidades

| # | Descripción | Detalle | Prioridad |
|---|---|---|---|
| E1 | **Figuritas FWC / Especiales** | Sección nueva antes de los grupos A-L. 20 figuritas generales (portada, mascota, trofeo, estadios). Mismo diseño visual. Listado de nombres siempre visible (sin dropdown). Animación especial para figuritas especiales. | 🔵 Alta |
| E2 | **Migración de nombres sin acentos** | Cambiar nombres en `DB_GRUPOS`: México→Mexico, Japón→Japon, etc. Requiere SQL de migración en Supabase para renombrar keys en `estado` de todos los usuarios. Resuelve de raíz los bugs de keys. | 🔵 Alta |
| E3 | **Migración de keys ESC → PT1** | Script SQL para convertir `{"ESC": "tengo"}` → `{"PT1": "tengo"}` en todos los estados de Supabase. | 🔵 Alta (antes de E2) |
| E4 | **Nueva tabla para FWC y futuras colecciones** | Evaluar separar colecciones (FWC, equipos) en tablas propias en Supabase en vez de todo en el JSONB de `usuarios`. Necesario si se agregan álbumes por temporada. | 🔵 Media |
| E5 | **Chat / Feed de actividad** | Feed híbrido: mensajes + eventos automáticos (intercambio aceptado, usuario completó un equipo). Polling cada 30 segundos. | 🔵 Baja |

---

## ⚪ ESTÉTICOS

| # | Descripción | Estado |
|---|---|---|
| S1 | Nombres de países con caracteres especiales visibles en la UI (acentos, puntos) | ⚪ Pendiente con E2 |
| S2 | Figuritas FWC sin diseño especial (animación para especiales/mascota/trofeo) | ⚪ Pendiente con E1 |
| S3 | Header: logo MUNDIAL 2026 con countdown a inicio del mundial y próximo partido ARG | 🟢 Implementado |
| S4 | Equalizador de figuritas (tengo/faltan/repetidas/reservadas) | 🟢 Implementado |
| S5 | Perfil de usuario con avatar animado | 🟢 Implementado |

---

## 📋 ORDEN DE TRABAJO SUGERIDO

```
1. 🔴 C2 + E3  → Migración SQL: ESC→PT1 en Supabase (resuelve C1 de raíz)
2. 🔴 C2 + E2  → Migración SQL: nombres sin acentos (resuelve B1, B3, C1)
3. 🔵 E1       → Sección FWC Especiales
4. 🟡 B1       → Fix keyToDesc con nombres normalizados
5. 🔵 E4       → Evaluar nueva tabla para colecciones
```

---

## 🌿 BRANCHES

| Branch | Descripción | URL |
|---|---|---|
| `main` | Desarrollo activo | `mundialito2026-main.onrender.com` |
| `mvp5_preprd` | Pre-producción | `mundialito2026-preprd.onrender.com` |
| `mvp4_final1_intercambios` | **Producción** | `mundialito2026-figusintercambio.onrender.com` |
| `backup/main-antes-refactor-figuritas` | Backup pre-cambio 20 figuritas | — |

---

## 🗄️ BASE DE DATOS

| Tabla | Descripción |
|---|---|
| `usuarios` | id, nombre, password_hash, rol, estado (JSONB), created_at, updated_at |
| `intercambios` | id, solicitante_id/nom, receptor_id/nom, pide_key/desc, ofrece_keys/descs, estado, contraoferta_keys/descs, expires_at |
| `logs` | id, usuario_id, usuario_nombre, accion, detalle, created_at |
| `usuarios_backup_pre_refactor` | Backup antes del cambio de 21→20 figuritas |

**Formato de keys en estado (producción actual):**
```json
{
  "A__M_xico": { "ESC": "tengo", "PT1": "tengo", "PT2": "repetida" },
  "L__Croacia": { "ESC": "tengo", "PT1": "tengo", ... }
}
```
⚠️ Mezcla de `ESC` + `PT1-PT20` (21 entradas). Pendiente migración a `PT1-PT20` puro.

---

*Última actualización: Mayo 2026*
