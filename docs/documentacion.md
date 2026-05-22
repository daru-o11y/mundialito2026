\# 📒 Álbum de Figuritas — Mundial 2026

\## Documentación del proyecto v2.0



\---



\## ¿Para qué sirve?



Aplicación web para llevar el registro de un álbum de figuritas del Mundial 2026. Permite a múltiples usuarios cargar sus figuritas, ver su progreso, exportar listas de faltantes y repetidas, intercambiar figuritas entre usuarios y compararse en un ranking grupal.



\---



\## Ambientes



| Ambiente | Branch | URL | Base de datos | Uso |

|---|---|---|---|---|

| \*\*Desarrollo\*\* | `main` | `mundialito2026-main.onrender.com` | Supabase dev | Probar nuevas funcionalidades |

| \*\*Pre-producción\*\* | `mvp5\_preprd` | `mundialito2026-preprd.onrender.com` | Supabase preprod | Validar antes de prod |

| \*\*Producción\*\* | `mvp4` | `mundialito2026-figusintercambio.onrender.com` | Supabase prod | Usuarios reales |



> ⚠️ Un banner morado aparece automáticamente en dev y preprod. En producción no aparece.



\### Flujo de promoción entre ambientes



```

main (dev) → mvp5\_preprd (validación) → mvp4 (producción)

```



```bash

\# De dev a preprod

git checkout mvp5\_preprd

git merge main

git push origin mvp5\_preprd



\# De preprod a prod

git checkout mvp4

git merge mvp5\_preprd

git push origin mvp4

```



\---



\## Infraestructura



```

┌─────────────────────────────────────────────────────┐

│                    USUARIO (browser)                │

└────────────────────────┬────────────────────────────┘

&#x20;                        │ HTTPS

┌────────────────────────▼────────────────────────────┐

│              RENDER (Web Service - Free)            │

│  Node.js + Express                                  │

│  • Sirve public/index.html                          │

│  • API REST /api/\*                                  │

│  • JWT Auth + Bcrypt                                │

└──────────────────┬──────────────────────────────────┘

&#x20;                  │ Supabase JS Client

┌──────────────────▼──────────────────────────────────┐

│           SUPABASE (PostgreSQL - Free)              │

│  usuarios · logs · intercambios                     │

└─────────────────────────────────────────────────────┘

```



\### Tecnologías



| Capa | Tecnología | Plan |

|---|---|---|

| Frontend | HTML + CSS + JavaScript vanilla | — |

| Backend | Node.js 18+ · Express 4 | — |

| Auth | JWT + Bcrypt | — |

| Base de datos | Supabase (PostgreSQL) | Free 500MB |

| Hosting | Render Web Service | Free |

| Repositorio | GitHub | Free |



\---



\## Estructura del proyecto



```

mundial2026/

├── server/

│   └── index.js              ← API REST, auth, admin, intercambios

├── public/

│   └── index.html            ← Frontend completo

├── supabase\_schema.sql       ← Tabla usuarios

├── supabase\_add\_rol.sql      ← Columna rol

├── supabase\_logs.sql         ← Tabla logs

├── supabase\_intercambios.sql ← Tabla intercambios

├── package.json

├── .env.example

├── .gitignore

└── DOCUMENTACION.md

```



\---



\## Base de datos



\### Tabla `usuarios`



| Columna | Tipo | Descripción |

|---|---|---|

| `id` | UUID PK | Identificador único |

| `nombre` | TEXT UNIQUE | Nombre del coleccionista |

| `password\_hash` | TEXT | Contraseña hasheada bcrypt |

| `rol` | TEXT | `admin` o `coleccionista` |

| `estado` | JSONB | `{"A\_\_Mexico": {"ESC": "tengo"}}` |

| `created\_at` | TIMESTAMPTZ | Fecha de registro |

| `updated\_at` | TIMESTAMPTZ | Última actualización |



\### Tabla `logs`



| Columna | Tipo | Descripción |

|---|---|---|

| `id` | UUID PK | Identificador único |

| `usuario\_id` | UUID FK | Referencia a usuarios |

| `usuario\_nombre` | TEXT | Nombre al momento del log |

| `accion` | TEXT | `login`, `registro` |

| `detalle` | TEXT | Descripción del evento |

| `created\_at` | TIMESTAMPTZ | Fecha y hora |



\### Tabla `intercambios`



| Columna | Tipo | Descripción |

|---|---|---|

| `id` | UUID PK | Identificador único |

| `solicitante\_id` | UUID FK | Usuario B (hace la oferta) |

| `solicitante\_nom` | TEXT | Nombre del solicitante |

| `receptor\_id` | UUID FK | Usuario A (recibe la oferta) |

| `receptor\_nom` | TEXT | Nombre del receptor |

| `pide\_key` | TEXT | Key de la figurita que B quiere de A |

| `pide\_desc` | TEXT | Descripción legible |

| `ofrece\_keys` | TEXT\[] | Array de keys que B ofrece |

| `ofrece\_descs` | TEXT\[] | Array de descripciones ofrecidas |

| `contraoferta\_keys` | TEXT\[] | Keys de contraoferta de A |

| `contraoferta\_descs` | TEXT\[] | Descripciones de contraoferta |

| `estado` | TEXT | `pendiente`, `aceptado`, `rechazado`, `cancelado` |

| `created\_at` | TIMESTAMPTZ | Fecha de creación |

| `updated\_at` | TIMESTAMPTZ | Última actualización |



\---



\## Estados de figuritas



| Estado | Color | Descripción | Quién lo asigna |

|---|---|---|---|

| `vacia` | Gris | No tengo la figurita | Usuario (click) |

| `tengo` | Verde ✓ | Tengo exactamente una | Usuario (click) |

| `repetida` | Amarillo ↺ | Tengo de más, disponible para intercambio | Usuario (click) |

| `reservada` | Gris/Rojo 🔒 | Comprometida en una propuesta pendiente | Sistema automático |



\### Transiciones de estado



```

vacia ──click──→ tengo ──click──→ repetida ──click──→ vacia

&#x20;                                     │

&#x20;                              propuesta enviada

&#x20;                              (Sistema automático)

&#x20;                                     ↓

&#x20;                                 reservada

&#x20;                                 /       \\

&#x20;                          aceptan       rechazan/cancelan

&#x20;                             ↓                ↓

&#x20;                    queda reservada        repetida

&#x20;                    (intercambio           (liberada)

&#x20;                     registrado)

```



> ⚠️ Una figurita `reservada` no puede ser editada manualmente por el usuario. Se libera solo cuando la propuesta es rechazada o cancelada.



\---



\## Flujo de Intercambios



```

1\. B entra a "Intercambios" → ve usuarios con repetidas disponibles

2\. B entra al álbum de repetidas de A

3\. B hace click en una figurita que le interesa

4\. Popup: "¿Querés intercambiar esta figurita?"

&#x20;        SI ──→ se abre listado de repetidas de B para ofrecer

&#x20;        NO ──→ se cancela, sin cambios

5\. B selecciona una o varias figuritas para ofrecer

6\. B confirma la propuesta

&#x20;       ↓

&#x20;  ✅ Figuritas de B → estado "reservada" (bloqueadas)

&#x20;  ✅ Figuritas de A → sin cambio (pueden recibir más propuestas)

&#x20;       ↓

7\. A recibe badge 🔔 en el header (polling cada 180 seg)

8\. A entra a "Mis propuestas" y ve la oferta de B

9\. A puede:

&#x20;  a) Aceptar todo → intercambio confirmado, queda registrado

&#x20;  b) Elegir cuáles acepta de las que ofrece B

&#x20;  c) Hacer contraoferta → proponer otras figuritas de B

&#x20;  d) Rechazar → figuritas de B vuelven a "repetida"

&#x20;       ↓

&#x20;  Si acepta o contraoferta aceptada:

&#x20;  → Intercambio en estado "aceptado"

&#x20;  → Los usuarios coordinan el intercambio físico en persona

&#x20;  → Las figuritas NO se mueven automáticamente en el álbum

&#x20;     (cada uno las actualiza manualmente después del intercambio físico)



&#x20;  Si rechaza o cancela:

&#x20;  → Figuritas de B: "reservada" → "repetida" (liberadas automáticamente)

```



\### Estados de una propuesta



| Estado | Descripción | Acciones disponibles |

|---|---|---|

| `pendiente` | Enviada, esperando respuesta | A: aceptar/rechazar/contraoferta · B: cancelar |

| `aceptado` | A aceptó | — finalizado |

| `rechazado` | A rechazó | — figuritas de B liberadas |

| `cancelado` | B canceló | — figuritas de B liberadas |



\---



\## Roles de usuario



\### Coleccionista

\- Edita su propio álbum

\- Álbum · Estadios · Progreso · Info · Intercambios

\- Exportar CSV (faltantes y repetidas) y JSON

\- Recibe notificaciones de propuestas



\### Admin

\- Todo lo del coleccionista

\- Panel Admin · Ranking

\- Ver/resetear álbum de cualquier usuario

\- Cambiar contraseña de cualquier usuario (incluyendo la propia)

\- Eliminar usuarios

\- Crear usuarios con cualquier rol

\- Estadísticas globales y logs de acceso



\#### Asignar rol admin

```sql

UPDATE usuarios SET rol = 'admin' WHERE nombre = 'TU\_NOMBRE';

```



\---



\## API Endpoints



\### Públicos

| Método | Ruta | Descripción |

|---|---|---|

| `POST` | `/api/login` | Login → devuelve JWT |

| `GET` | `/api/usuarios` | Ranking público |

| `GET` | `/api/health` | Estado del servidor |



> `POST /api/register` existe pero está deshabilitado en el frontend. Solo admin crea usuarios.



\### Autenticados

| Método | Ruta | Descripción |

|---|---|---|

| `GET` | `/api/album` | Cargar álbum propio |

| `PUT` | `/api/album` | Guardar álbum (debounce 1.5s) |

| `PATCH` | `/api/album/sticker` | Actualizar una figurita |

| `POST` | `/api/change-password` | Cambiar contraseña propia |



\### Intercambios

| Método | Ruta | Descripción |

|---|---|---|

| `GET` | `/api/intercambios` | Mis propuestas |

| `GET` | `/api/intercambios/usuarios` | Usuarios con repetidas |

| `POST` | `/api/intercambios` | Crear propuesta |

| `PATCH` | `/api/intercambios/:id` | Aceptar/rechazar/cancelar |



\### Solo Admin

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



\---



\## Variables de entorno



| Variable | Descripción | Dónde obtenerla |

|---|---|---|

| `SUPABASE\_URL` | URL del proyecto | Supabase → Settings → API → Project URL |

| `SUPABASE\_SERVICE\_KEY` | Clave service\_role | Supabase → Settings → API → service\_role |

| `JWT\_SECRET` | String random 32+ chars | Inventado |

| `PORT` | Puerto | Render lo setea automático |



\---



\## Comandos útiles



\### Git

```bash

git status                        # Ver cambios

git add public/index.html server/index.js

git commit -m "descripción"

git push



\# Render redeploya automático al pushear al branch configurado

```



\### Supabase

```sql

\-- Ver usuarios

SELECT id, nombre, rol, created\_at FROM usuarios ORDER BY created\_at;



\-- Hacer admin

UPDATE usuarios SET rol = 'admin' WHERE nombre = 'TU\_NOMBRE';



\-- Resetear contraseña (hash de "password")

UPDATE usuarios

SET password\_hash = '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'

WHERE nombre = 'TU\_NOMBRE';



\-- Ver intercambios pendientes

SELECT solicitante\_nom, receptor\_nom, pide\_desc, estado, created\_at

FROM intercambios WHERE estado = 'pendiente' ORDER BY created\_at DESC;



\-- Ver progreso de un usuario

SELECT nombre,

&#x20; COUNT(\*) FILTER (WHERE value = 'tengo') as tengo,

&#x20; COUNT(\*) FILTER (WHERE value = 'repetida') as repetidas,

&#x20; COUNT(\*) FILTER (WHERE value = 'reservada') as reservadas

FROM usuarios, jsonb\_each\_text(estado)

WHERE nombre = 'TU\_NOMBRE'

GROUP BY nombre;



\-- Liberar figuritas reservadas de un usuario (emergencia)

UPDATE usuarios

SET estado = (

&#x20; SELECT jsonb\_object\_agg(key,

&#x20;   CASE WHEN value = 'reservada' THEN 'repetida' ELSE value END

&#x20; )

&#x20; FROM jsonb\_each\_text(estado)

)

WHERE nombre = 'TU\_NOMBRE';



\-- Resetear álbum completo

UPDATE usuarios SET estado = '{}' WHERE nombre = 'TU\_NOMBRE';

```



\---



\## Seguridad



\- Contraseñas hasheadas con \*\*bcrypt\*\* (cost 10)

\- Tokens JWT con expiración de \*\*30 días\*\*

\- Sesión se cierra por \*\*inactividad de 10 minutos\*\*

\- `SUPABASE\_SERVICE\_KEY` nunca expuesto al cliente

\- Rutas `/api/admin/\*` verifican rol en servidor

\- Registro público deshabilitado

\- Inputs sanitizados antes de guardar en BD

\- `.env` en `.gitignore`



\---



\## Limitaciones plan gratuito



| Servicio | Límite | Nota |

|---|---|---|

| Render | Hiberna tras 15 min | Primer request \~30s · Usar UptimeRobot |

| Supabase DB | 500 MB | Suficiente para 100 usuarios |

| Supabase requests | 50.000/mes | Suficiente para uso normal |



\### UptimeRobot (evitar hibernación)

1\. \[uptimerobot.com](https://uptimerobot.com) → New Monitor → HTTP(s)

2\. URL: `https://mundialito2026-figusintercambio.onrender.com/api/health`

3\. Intervalo: 10 minutos



\---



\## Roadmap



\### ✅ Fase 1 — MVP

\- Álbum con 12 grupos, 48 equipos, 1008 figuritas

\- Estados: vacía, tengo, repetida

\- Guardado automático con debounce + indicador visual

\- Exportar CSV y JSON

\- Login, roles, panel admin

\- Logs, ranking, 3 ambientes



\### 🔄 Fase 2 — Intercambios completos (en desarrollo)

\- Estado `reservada` para figuritas comprometidas

\- Flujo: propuesta → reserva → aceptar/rechazar/contraoferta

\- Notificaciones con badge y polling 180 segundos

\- Figuritas de quien ofrece se bloquean automáticamente

\- Al rechazar/cancelar: figuritas vuelven a `repetida`



\### 💡 Fase 3 — Chat/Feed (planificado)

\- Feed híbrido: mensajes + eventos automáticos del sistema

\- Historial de intercambios visibles para todos

\- Polling cada 30 segundos



\---



\## Notas de operación



\- \*\*Cambiar branch en Render:\*\* Settings → Branch → guardar → redeploya

\- \*\*Banner dev/preprod:\*\* aparece si URL contiene `main`, `dev` o `localhost`

\- \*\*Crear usuario:\*\* solo desde panel Admin → + Crear usuario

\- \*\*Recuperar contraseña:\*\* admin la resetea desde panel o SQL

\- \*\*Backup:\*\* Supabase guarda backups automáticos 7 días en plan free



\---



\*Proyecto: Álbum de Figuritas Mundial 2026 · Stack: Node.js · Express · Supabase · Render · Versión: 2.0 · Mayo 2026\*

