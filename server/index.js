require('dotenv').config();
const express    = require('express');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const cors       = require('cors');
const path       = require('path');
const { createClient } = require('@supabase/supabase-js');

const app  = express();
const PORT = process.env.PORT || 3000;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ── Auth middleware ──
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer '))
    return res.status(401).json({ error: 'Token requerido' });
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    req.userId   = payload.userId;
    req.userName = payload.userName;
    req.userRol  = payload.userRol || 'coleccionista';
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

// ── Admin middleware ──
function adminMiddleware(req, res, next) {
  if (req.userRol !== 'admin')
    return res.status(403).json({ error: 'Acceso denegado. Se requiere rol admin.' });
  next();
}

// ════════════════════════════════════════════
// AUTH
// ════════════════════════════════════════════

app.post('/api/register', async (req, res) => {
  const { nombre, password } = req.body;
  if (!nombre || !password)
    return res.status(400).json({ error: 'Nombre y contraseña requeridos' });
  if (nombre.trim().length < 2 || nombre.trim().length > 30)
    return res.status(400).json({ error: 'El nombre debe tener entre 2 y 30 caracteres' });
  if (password.length < 4)
    return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres' });

  const { data: existing } = await supabase
    .from('usuarios').select('id').ilike('nombre', nombre.trim()).single();
  if (existing)
    return res.status(409).json({ error: 'Ese nombre ya está en uso' });

  const hash = await bcrypt.hash(password, 10);
  const { data, error } = await supabase
    .from('usuarios')
    .insert({ nombre: nombre.trim(), password_hash: hash, estado: {}, rol: 'coleccionista' })
    .select('id, nombre, rol')
    .single();

  if (error) {
    console.error('Register error:', error);
    return res.status(500).json({ error: 'Error al crear usuario' });
  }

  const token = jwt.sign(
    { userId: data.id, userName: data.nombre, userRol: data.rol || 'coleccionista' },
    process.env.JWT_SECRET, { expiresIn: '30d' }
  );

  try {
    await supabase.from('logs').insert({
      usuario_id: data.id, usuario_nombre: data.nombre,
      accion: 'registro', detalle: 'Cuenta creada'
    });
  } catch(_) {}

  res.json({ token, nombre: data.nombre, userId: data.id, rol: data.rol || 'coleccionista' });
});

app.post('/api/login', async (req, res) => {
  const { nombre, password } = req.body;
  if (!nombre || !password)
    return res.status(400).json({ error: 'Nombre y contraseña requeridos' });

  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nombre, password_hash, estado, rol')
    .ilike('nombre', nombre.trim())
    .single();

  if (error || !data)
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });

  const ok = await bcrypt.compare(password, data.password_hash);
  if (!ok)
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });

  const rol = data.rol || 'coleccionista';
  const token = jwt.sign(
    { userId: data.id, userName: data.nombre, userRol: rol },
    process.env.JWT_SECRET, { expiresIn: '30d' }
  );

  try {
    await supabase.from('logs').insert({
      usuario_id: data.id, usuario_nombre: data.nombre,
      accion: 'login', detalle: 'Ingreso exitoso'
    });
  } catch(_) {}

  res.json({ token, nombre: data.nombre, userId: data.id, rol, estado: data.estado });
});

// ════════════════════════════════════════════
// ALBUM (usuario propio)
// ════════════════════════════════════════════

app.get('/api/album', authMiddleware, async (req, res) => {
  const { data, error } = await supabase
    .from('usuarios').select('estado, nombre, rol').eq('id', req.userId).single();
  if (error || !data)
    return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json({ estado: data.estado || {}, nombre: data.nombre, rol: data.rol || 'coleccionista' });
});

app.put('/api/album', authMiddleware, async (req, res) => {
  const { estado } = req.body;
  if (typeof estado !== 'object')
    return res.status(400).json({ error: 'Estado inválido' });
  const { error } = await supabase
    .from('usuarios')
    .update({ estado, updated_at: new Date().toISOString() })
    .eq('id', req.userId);
  if (error) return res.status(500).json({ error: 'Error al guardar' });
  res.json({ ok: true });
});

app.patch('/api/album/sticker', authMiddleware, async (req, res) => {
  const { key, value } = req.body;
  if (!key || !['vacia','tengo','repetida'].includes(value))
    return res.status(400).json({ error: 'Datos inválidos' });
  const { data, error: fetchErr } = await supabase
    .from('usuarios').select('estado').eq('id', req.userId).single();
  if (fetchErr || !data)
    return res.status(404).json({ error: 'Usuario no encontrado' });
  const estado = data.estado || {};
  if (value === 'vacia') delete estado[key]; else estado[key] = value;
  const { error: saveErr } = await supabase
    .from('usuarios')
    .update({ estado, updated_at: new Date().toISOString() })
    .eq('id', req.userId);
  if (saveErr) return res.status(500).json({ error: 'Error al guardar' });
  res.json({ ok: true, key, value });
});

// ════════════════════════════════════════════
// RANKING (público)
// ════════════════════════════════════════════

app.get('/api/usuarios', async (req, res) => {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nombre, estado, rol, updated_at')
    .order('updated_at', { ascending: false });
  if (error) return res.status(500).json({ error: 'Error al obtener usuarios' });
  const usuarios = (data || []).map(u => {
    const estado = u.estado || {};
    const tengo = Object.values(estado).filter(v => v === 'tengo').length;
    const repetidas = Object.values(estado).filter(v => v === 'repetida').length;
    return { id: u.id, nombre: u.nombre, rol: u.rol || 'coleccionista',
      tengo, repetidas, total: 1008,
      pct: Math.round(tengo / 1008 * 100), updated_at: u.updated_at };
  });
  res.json(usuarios);
});

app.post('/api/change-password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword)
    return res.status(400).json({ error: 'Faltan datos' });
  if (newPassword.length < 4)
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 4 caracteres' });
  const { data } = await supabase
    .from('usuarios').select('password_hash').eq('id', req.userId).single();
  if (!data) return res.status(404).json({ error: 'Usuario no encontrado' });
  const ok = await bcrypt.compare(currentPassword, data.password_hash);
  if (!ok) return res.status(401).json({ error: 'Contraseña actual incorrecta' });
  const hash = await bcrypt.hash(newPassword, 10);
  await supabase.from('usuarios').update({ password_hash: hash }).eq('id', req.userId);
  res.json({ ok: true });
});

// ════════════════════════════════════════════
// ADMIN ROUTES
// ════════════════════════════════════════════

app.get('/api/admin/usuarios', authMiddleware, adminMiddleware, async (req, res) => {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nombre, rol, estado, created_at, updated_at')
    .order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: 'Error al obtener usuarios' });
  const result = (data || []).map(u => {
    const estado = u.estado || {};
    const tengo = Object.values(estado).filter(v => v === 'tengo').length;
    const repetidas = Object.values(estado).filter(v => v === 'repetida').length;
    return { id: u.id, nombre: u.nombre, rol: u.rol || 'coleccionista',
      tengo, repetidas, total: 1008,
      pct: Math.round(tengo / 1008 * 100),
      created_at: u.created_at, updated_at: u.updated_at };
  });
  res.json(result);
});

app.get('/api/admin/album/:id', authMiddleware, adminMiddleware, async (req, res) => {
  const { data, error } = await supabase
    .from('usuarios').select('id, nombre, rol, estado, updated_at')
    .eq('id', req.params.id).single();
  if (error || !data) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json({ id: data.id, nombre: data.nombre, rol: data.rol, estado: data.estado || {}, updated_at: data.updated_at });
});

app.post('/api/admin/reset/:id', authMiddleware, adminMiddleware, async (req, res) => {
  const { error } = await supabase
    .from('usuarios')
    .update({ estado: {}, updated_at: new Date().toISOString() })
    .eq('id', req.params.id);
  if (error) return res.status(500).json({ error: 'Error al resetear' });
  res.json({ ok: true });
});

app.delete('/api/admin/usuario/:id', authMiddleware, adminMiddleware, async (req, res) => {
  if (req.params.id === req.userId)
    return res.status(400).json({ error: 'No podés eliminarte a vos mismo' });
  const { error } = await supabase.from('usuarios').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: 'Error al eliminar usuario' });
  res.json({ ok: true });
});

app.post('/api/admin/change-password/:id', authMiddleware, adminMiddleware, async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 4)
    return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres' });
  const hash = await bcrypt.hash(newPassword, 10);
  const { error } = await supabase
    .from('usuarios').update({ password_hash: hash }).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: 'Error al cambiar contraseña' });
  res.json({ ok: true });
});

app.get('/api/admin/stats', authMiddleware, adminMiddleware, async (req, res) => {
  const { data, error } = await supabase
    .from('usuarios').select('nombre, rol, estado, created_at, updated_at');
  if (error) return res.status(500).json({ error: 'Error al obtener stats' });
  const total_usuarios = data.length;
  const admins = data.filter(u => u.rol === 'admin').length;
  let total_tengo = 0, total_repetidas = 0, mas_completo = null, maxPct = -1;
  data.forEach(u => {
    const estado = u.estado || {};
    const t = Object.values(estado).filter(v => v === 'tengo').length;
    const r = Object.values(estado).filter(v => v === 'repetida').length;
    total_tengo += t;
    total_repetidas += r;
    const pct = Math.round(t / 1008 * 100);
    if (pct > maxPct) { maxPct = pct; mas_completo = { nombre: u.nombre, pct, tengo: t }; }
  });
  const activos_7d = data.filter(u => {
    if (!u.updated_at) return false;
    return (Date.now() - new Date(u.updated_at).getTime()) < 7 * 24 * 3600 * 1000;
  }).length;
  res.json({ total_usuarios, admins, coleccionistas: total_usuarios - admins,
    total_tengo, total_repetidas, mas_completo, activos_7d,
    promedio_completado: total_usuarios > 0 ? Math.round(total_tengo / (total_usuarios * 1008) * 100) : 0 });
});

app.get('/api/admin/logs', authMiddleware, adminMiddleware, async (req, res) => {
  const { data, error } = await supabase
    .from('logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return res.status(500).json({ error: 'Error al obtener logs' });
  res.json(data || []);
});

app.post('/api/admin/crear-usuario', authMiddleware, adminMiddleware, async (req, res) => {
  const { nombre, password, rol } = req.body;
  if (!nombre || !password)
    return res.status(400).json({ error: 'Nombre y contraseña requeridos' });
  if (nombre.trim().length < 2 || nombre.trim().length > 30)
    return res.status(400).json({ error: 'El nombre debe tener entre 2 y 30 caracteres' });
  if (password.length < 4)
    return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres' });
  if (!['admin','coleccionista'].includes(rol))
    return res.status(400).json({ error: 'Rol inválido' });

  const { data: existing } = await supabase
    .from('usuarios').select('id').ilike('nombre', nombre.trim()).single();
  if (existing)
    return res.status(409).json({ error: 'Ese nombre ya está en uso' });

  const hash = await bcrypt.hash(password, 10);
  const { data, error } = await supabase
    .from('usuarios')
    .insert({ nombre: nombre.trim(), password_hash: hash, estado: {}, rol })
    .select('id, nombre, rol')
    .single();

  if (error) {
    console.error('Create user error:', error);
    return res.status(500).json({ error: 'Error al crear usuario' });
  }

  try {
    await supabase.from('logs').insert({
      usuario_id: data.id, usuario_nombre: data.nombre,
      accion: 'registro', detalle: 'Creado por admin'
    });
  } catch(_) {}

  res.json({ ok: true, nombre: data.nombre, rol: data.rol });
});


// ════════════════════════════════════════════
// INTERCAMBIOS v2
// ════════════════════════════════════════════

function sanitizeFigKey(key) {
  if (typeof key !== 'string') return null;
  if (key.length > 150) return null;
  if (!/^[A-Za-z0-9_|]+$/.test(key)) return null;
  return key;
}
function sanitizeText(text, maxLen = 120) {
  if (typeof text !== 'string') return '';
  return text.replace(/<[^>]*>/g, '').trim().slice(0, maxLen);
}
function sanitizeKeys(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(k => sanitizeFigKey(k)).filter(Boolean).slice(0, 20);
}
function sanitizeDescs(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(d => sanitizeText(d)).filter(Boolean).slice(0, 20);
}

// Reservar figuritas de un usuario (repetida → reservada)
async function reservarFiguritas(userId, keys) {
  const { data } = await supabase.from('usuarios').select('estado').eq('id', userId).single();
  if (!data) return false;
  const estado = data.estado || {};
  let changed = false;
  keys.forEach(flatKey => {
    const parts = flatKey.split('||');
    if (parts.length === 2) {
      const [teamKey, codigo] = parts;
      if (estado[teamKey] && estado[teamKey][codigo] === 'repetida') {
        estado[teamKey][codigo] = 'reservada';
        changed = true;
      } else if (estado[flatKey] === 'repetida') {
        estado[flatKey] = 'reservada';
        changed = true;
      }
    } else if (estado[flatKey] === 'repetida') {
      estado[flatKey] = 'reservada';
      changed = true;
    }
  });
  if (!changed) return false;
  await supabase.from('usuarios').update({ estado, updated_at: new Date().toISOString() }).eq('id', userId);
  return true;
}

// Liberar figuritas reservadas de un usuario (reservada → repetida)
async function liberarFiguritas(userId, keys) {
  const { data } = await supabase.from('usuarios').select('estado').eq('id', userId).single();
  if (!data) return;
  const estado = data.estado || {};
  keys.forEach(flatKey => {
    const parts = flatKey.split('||');
    if (parts.length === 2) {
      const [teamKey, codigo] = parts;
      if (estado[teamKey] && estado[teamKey][codigo] === 'reservada') {
        estado[teamKey][codigo] = 'repetida';
      } else if (estado[flatKey] === 'reservada') {
        estado[flatKey] = 'repetida';
      }
    } else if (estado[flatKey] === 'reservada') {
      estado[flatKey] = 'repetida';
    }
  });
  await supabase.from('usuarios').update({ estado, updated_at: new Date().toISOString() }).eq('id', userId);
}

// Confirmar figuritas: reservada → tengo (intercambio aceptado)
async function confirmarFiguritas(userId, keys) {
  const { data } = await supabase.from('usuarios').select('estado').eq('id', userId).single();
  if (!data) return;
  const estado = data.estado || {};
  keys.forEach(flatKey => {
    const parts = flatKey.split('||');
    if (parts.length === 2) {
      const [teamKey, codigo] = parts;
      if (estado[teamKey] && estado[teamKey][codigo] === 'reservada') {
        estado[teamKey][codigo] = 'tengo';
      } else if (estado[flatKey] === 'reservada') {
        estado[flatKey] = 'tengo';
      }
    } else if (estado[flatKey] === 'reservada') {
      estado[flatKey] = 'tengo';
    }
  });
  await supabase.from('usuarios').update({ estado, updated_at: new Date().toISOString() }).eq('id', userId);
}

// Revertir figuritas aceptadas → repetida (si venció o se canceló post-aceptación)
async function liberarFiguritasAceptadas(userId, keys) {
  const { data } = await supabase.from('usuarios').select('estado').eq('id', userId).single();
  if (!data) return;
  const estado = data.estado || {};
  keys.forEach(flatKey => {
    const parts = flatKey.split('||');
    if (parts.length === 2) {
      const [teamKey, codigo] = parts;
      // Libera tanto si está reservada (no se confirmó) como tengo (ya se confirmó)
      if (estado[teamKey] && ['reservada','tengo'].includes(estado[teamKey][codigo])) {
        estado[teamKey][codigo] = 'repetida';
      } else if (['reservada','tengo'].includes(estado[flatKey])) {
        estado[flatKey] = 'repetida';
      }
    } else if (['reservada','tengo'].includes(estado[flatKey])) {
      estado[flatKey] = 'repetida';
    }
  });
  await supabase.from('usuarios').update({ estado, updated_at: new Date().toISOString() }).eq('id', userId);
}

// Flatten nested estado to flat keys
function flattenEstado(estado) {
  const flat = {};
  for (const [teamKey, val] of Object.entries(estado || {})) {
    if (val && typeof val === 'object') {
      for (const [codigo, v] of Object.entries(val)) {
        flat[teamKey + '||' + codigo] = v;
      }
    } else if (typeof val === 'string') {
      flat[teamKey] = val;
    }
  }
  return flat;
}

// GET /api/intercambios — mis propuestas
app.get('/api/intercambios', authMiddleware, async (req, res) => {
  const { data, error } = await supabase
    .from('intercambios').select('*')
    .or(`solicitante_id.eq.${req.userId},receptor_id.eq.${req.userId}`)
    .order('created_at', { ascending: false }).limit(100);
  if (error) return res.status(500).json({ error: 'Error al obtener intercambios' });
  res.json(data || []);
});

// GET /api/intercambios/pendientes-count — solo el count para el badge
app.get('/api/intercambios/pendientes-count', authMiddleware, async (req, res) => {
  const { data, error } = await supabase
    .from('intercambios').select('id')
    .eq('receptor_id', req.userId).eq('estado', 'pendiente');
  if (error) return res.status(500).json({ count: 0 });
  res.json({ count: (data || []).length });
});

// GET /api/intercambios/usuarios — usuarios con repetidas disponibles
app.get('/api/intercambios/usuarios', authMiddleware, async (req, res) => {
  const { data, error } = await supabase
    .from('usuarios').select('id, nombre, estado').neq('id', req.userId);
  if (error) return res.status(500).json({ error: 'Error' });
  const result = (data || []).map(u => {
    const estado = flattenEstado(u.estado);
    const repetidas  = Object.keys(estado).filter(k => estado[k] === 'repetida');
    const reservadas = Object.keys(estado).filter(k => estado[k] === 'reservada');
    const tengo      = Object.keys(estado).filter(k => estado[k] === 'tengo');
    return { id: u.id, nombre: u.nombre, repetidas, reservadas, tengo,
      totalRep: repetidas.length };
  }).filter(u => u.totalRep > 0);
  res.json(result);
});

// POST /api/intercambios — crear propuesta
app.post('/api/intercambios', authMiddleware, async (req, res) => {
  const { receptor_id, pide_key, pide_desc, ofrece_keys, ofrece_descs } = req.body;

  const cleanPideKey    = sanitizeFigKey(pide_key);
  const cleanOfreceKeys = sanitizeKeys(ofrece_keys);
  const cleanPideDesc   = sanitizeText(pide_desc);
  const cleanOfreceDescs= sanitizeDescs(ofrece_descs);

  if (!receptor_id || !cleanPideKey || cleanOfreceKeys.length === 0)
    return res.status(400).json({ error: 'Datos inválidos o incompletos' });
  if (receptor_id === req.userId)
    return res.status(400).json({ error: 'No podés intercambiar con vos mismo' });

  const { data: solData } = await supabase
    .from('usuarios').select('nombre, estado').eq('id', req.userId).single();
  if (!solData) return res.status(404).json({ error: 'Usuario no encontrado' });
  const flatSol = flattenEstado(solData.estado || {});
  const noDisponibles = cleanOfreceKeys.filter(k => flatSol[k] !== 'repetida');
  if (noDisponibles.length > 0)
    return res.status(400).json({ error: 'Algunas figuritas que ofrecés ya no están disponibles' });

  const { data: recData } = await supabase
    .from('usuarios').select('nombre, estado').eq('id', receptor_id).single();
  if (!recData) return res.status(404).json({ error: 'Receptor no encontrado' });
  const flatRec = flattenEstado(recData.estado || {});
  if (flatRec[cleanPideKey] !== 'repetida')
    return res.status(400).json({ error: 'Ese usuario ya no tiene esa figurita como repetida' });

  const { data: existing } = await supabase
    .from('intercambios').select('id')
    .eq('solicitante_id', req.userId).eq('receptor_id', receptor_id)
    .eq('pide_key', cleanPideKey).eq('estado', 'pendiente').single();
  if (existing)
    return res.status(409).json({ error: 'Ya tenés una propuesta pendiente para esa figurita' });

  await reservarFiguritas(req.userId, cleanOfreceKeys);

  const { data, error } = await supabase.from('intercambios').insert({
    solicitante_id: req.userId, solicitante_nom: solData.nombre,
    receptor_id,               receptor_nom: recData.nombre,
    pide_key: cleanPideKey,    pide_desc: cleanPideDesc,
    ofrece_keys: cleanOfreceKeys, ofrece_descs: cleanOfreceDescs,
    estado: 'pendiente'
  }).select().single();

  if (error) {
    console.error('Intercambios insert error:', JSON.stringify(error));
    await liberarFiguritas(req.userId, cleanOfreceKeys);
    return res.status(500).json({ error: 'Error al crear propuesta', detail: error.message });
  }
  res.json({ ok: true, intercambio: data });
});

// PATCH /api/intercambios/:id — aceptar, rechazar, cancelar, contraoferta, terminado
// ─────────────────────────────────────────────────────────────────────────────
// FIX: reestructurado por estado actual del intercambio.
//
//  Estado PENDIENTE → acciones válidas:
//    - aceptado    (receptor)
//    - rechazado   (receptor)
//    - contraoferta(receptor)
//    - cancelado   (solicitante)
//
//  Estado ACEPTADO → acciones válidas:
//    - terminado   (solicitante: confirma que el físico se hizo)
//    - cancelado   (cualquiera: deshace el trato y libera figuritas)
//
//  Cualquier otro estado → ya procesado, error 400.
// ─────────────────────────────────────────────────────────────────────────────
app.patch('/api/intercambios/:id', authMiddleware, async (req, res) => {
  const { accion, contraoferta_keys, contraoferta_descs } = req.body;

  // FIX BUG #1: 'terminado' agregado a validAcciones
  const validAcciones = ['aceptado', 'rechazado', 'cancelado', 'contraoferta', 'terminado'];
  if (!validAcciones.includes(accion))
    return res.status(400).json({ error: 'Acción inválida' });

  const { data: interc } = await supabase
    .from('intercambios').select('*').eq('id', req.params.id).single();
  if (!interc) return res.status(404).json({ error: 'Intercambio no encontrado' });

  // Validar que el usuario es participante
  const isParticipante = interc.solicitante_id === req.userId || interc.receptor_id === req.userId;
  if (!isParticipante)
    return res.status(403).json({ error: 'No sos parte de este intercambio' });

  // ── FIX BUG #2: rama ACEPTADO ahora es alcanzable ──
  // El early return anterior por estado !== 'pendiente' bloqueaba esta rama.
  // Ahora el flujo se bifurca limpiamente por estado actual.
  if (interc.estado === 'aceptado') {
    if (accion === 'terminado') {
      // Solo el solicitante confirma que el intercambio físico se realizó
      if (interc.solicitante_id !== req.userId)
        return res.status(403).json({ error: 'Solo el solicitante puede marcar como terminado' });
      const { error } = await supabase.from('intercambios')
        .update({ estado: 'terminado', updated_at: new Date().toISOString() })
        .eq('id', interc.id);
      if (error) return res.status(500).json({ error: 'Error al marcar como terminado' });
      return res.json({ ok: true, estado: 'terminado' });
    }

    if (accion === 'cancelado') {
      // Cualquiera puede cancelar un trato aceptado; libera figuritas de B
      await liberarFiguritasAceptadas(interc.solicitante_id, interc.ofrece_keys || []);
      const { error } = await supabase.from('intercambios')
        .update({ estado: 'cancelado', updated_at: new Date().toISOString() })
        .eq('id', interc.id);
      if (error) return res.status(500).json({ error: 'Error al cancelar' });
      return res.json({ ok: true, estado: 'cancelado' });
    }

    return res.status(400).json({ error: 'Un intercambio aceptado solo puede marcarse como terminado o cancelado' });
  }

  // ── Rama PENDIENTE ──
  if (interc.estado !== 'pendiente')
    return res.status(400).json({ error: 'Esta propuesta ya fue procesada' });

  if (accion === 'cancelado' && interc.solicitante_id !== req.userId)
    return res.status(403).json({ error: 'Solo el solicitante puede cancelar' });
  if (['aceptado','rechazado','contraoferta'].includes(accion) && interc.receptor_id !== req.userId)
    return res.status(403).json({ error: 'Solo el receptor puede responder' });

  if (accion === 'contraoferta') {
    const cleanKeys  = sanitizeKeys(contraoferta_keys);
    const cleanDescs = sanitizeDescs(contraoferta_descs);
    if (cleanKeys.length === 0)
      return res.status(400).json({ error: 'La contraoferta debe tener al menos una figurita' });
    const { data: recData } = await supabase
      .from('usuarios').select('estado').eq('id', req.userId).single();
    const recEstado = recData?.estado || {};
    const noDisp = cleanKeys.filter(k => recEstado[k] !== 'repetida');
    if (noDisp.length > 0)
      return res.status(400).json({ error: 'Algunas figuritas de la contraoferta no están disponibles' });
    const { error } = await supabase.from('intercambios')
      .update({ contraoferta_keys: cleanKeys, contraoferta_descs: cleanDescs,
        updated_at: new Date().toISOString() })
      .eq('id', req.params.id);
    if (error) return res.status(500).json({ error: 'Error al guardar contraoferta' });
    return res.json({ ok: true, estado: 'pendiente', contraoferta: true });
  }

  if (accion === 'rechazado' || accion === 'cancelado') {
    await liberarFiguritas(interc.solicitante_id, interc.ofrece_keys || []);
  }

  const updateData = { estado: accion, updated_at: new Date().toISOString() };
  if (accion === 'aceptado') {
    const expires = new Date();
    expires.setDate(expires.getDate() + 7);
    updateData.expires_at = expires.toISOString();
  }

  const { error } = await supabase.from('intercambios')
    .update(updateData)
    .eq('id', req.params.id);
  if (error) return res.status(500).json({ error: 'Error al actualizar' });
  res.json({ ok: true, estado: accion });
});

// ════════════════════════════════════════════
// EXPIRY JOB — revierte intercambios vencidos
// ════════════════════════════════════════════
async function checkExpiredIntercambios() {
  try {
    const { data, error } = await supabase
      .from('intercambios')
      .select('*')
      .eq('estado', 'aceptado')
      .lt('expires_at', new Date().toISOString());
    if (error || !data?.length) return;
    console.log(`Expiry check: ${data.length} intercambio(s) vencido(s)`);
    for (const interc of data) {
      await liberarFiguritasAceptadas(interc.solicitante_id, interc.ofrece_keys || []);
      await supabase.from('intercambios')
        .update({ estado: 'vencido', updated_at: new Date().toISOString() })
        .eq('id', interc.id);
      console.log(`Intercambio ${interc.id} marcado como vencido`);
    }
  } catch(e) { console.error('Expiry job error:', e.message); }
}

setInterval(checkExpiredIntercambios, 60 * 60 * 1000);
checkExpiredIntercambios();

// ════════════════════════════════════════════
// HEALTH
// ════════════════════════════════════════════

app.get('/api/health', async (req, res) => {
  const checks = { server: 'ok',
    supabase_url: !!process.env.SUPABASE_URL,
    supabase_key: !!process.env.SUPABASE_SERVICE_KEY,
    jwt_secret: !!process.env.JWT_SECRET,
    supabase_connection: false, error: null };
  try {
    const { error } = await supabase.from('usuarios').select('id').limit(1);
    if (error) checks.error = error.message;
    else checks.supabase_connection = true;
  } catch(e) { checks.error = e.message; }
  const allOk = checks.supabase_url && checks.supabase_key && checks.jwt_secret && checks.supabase_connection;
  res.status(allOk ? 200 : 500).json(checks);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`🌍 Mundial 2026 Album server running on port ${PORT}`);
});