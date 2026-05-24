Álbum de Figuritas Mundial 2026 — Estado del proyecto (v2.0, Mayo 2026)

Roadmap — dónde estamos
✅ Fase 1 — MVP (completa): El álbum completo está funcionando — 12 grupos, 48 equipos, 1008 figuritas con estados vacía/tengo/repetida, guardado automático, exportar CSV/JSON, login con roles, panel admin, logs, ranking, 3 ambientes (dev/preprod/prod).
🔄 Fase 2 — Intercambios (en desarrollo): La infraestructura base ya está, incluyendo el flujo propuesta → reserva → aceptar/rechazar, el badge de notificaciones con polling cada 180s, y el bloqueo/liberación automático de figuritas reservadas. Lo que falta terminar:

Contraoferta (la UI del receptor permite elegir cuáles acepta, pero la contraoferta como flujo propio no está 100% cerrada)
Expiración automática de propuestas pendientes (hoy pueden quedarse bloqueando figuritas indefinidamente)
Actualización automática del álbum al aceptar un intercambio (hoy dice "actualizá manualmente")

💡 Fase 3 — Chat/Feed (planificado, sin empezar): Feed híbrido con mensajes + eventos del sistema, historial de intercambios visible para todos, polling cada 30s.

Bugs y riesgos técnicos conocidos

Estado anidado vs flat en base de datos: el backend maneja dos formatos de estado (anidado {equipo: {cod: val}} y flat {equipo||cod: val}). La función flattenEstado lo unifica, pero es un punto frágil y puede dar sorpresas.
No hay expiración de propuestas: una propuesta pendiente puede dejar figuritas reservadas bloqueadas para siempre si el receptor no responde.
Álbum no se actualiza automáticamente al aceptar: el usuario tiene que acordarse de marcar manualmente las figuritas que recibió. Es la parte más incompleta del flujo de intercambios.
Polling de notificaciones cada 180s: muy lento para algo que debería sentirse en tiempo real. No hay WebSockets.
Render hiberna tras 15 min de inactividad: el primer request tarda ~30s. Está mitigado con UptimeRobot pero requiere configuración externa manual.
Timeout de sesión a los 10 min de inactividad: puede resultar molesto para alguien que deja el álbum abierto mientras busca las figuritas físicas.


Pendientes estéticos / UX

La sección de Intercambios todavía está marcada con 🚧 en el texto de ayuda, aunque la funcionalidad base ya funciona.
La animación de figuritas reservadas (pulso rojo + 🔒) está implementada pero es bastante agresiva visualmente; podría refinarse.
El estado vacío en las figuritas "foil" no tiene tratamiento visual diferenciado (hay animación para tengo y repetida, pero el vacío usa el estilo genérico).
El grid de figuritas usa 10 columnas fijas, lo que en mobile muy pequeño puede quedar apretado.