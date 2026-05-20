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

  // Log de registro
  await supabase.from('logs').insert({
    usuario_id: data.id, usuario_nombre: data.nombre,
    accion: 'registro', detalle: 'Cuenta creada'
  }).catch(() => {});

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

  // Log de acceso
  await supabase.from('logs').insert({
    usuario_id: data.id, usuario_nombre: data.nombre,
    accion: 'login', detalle: 'Ingreso exitoso'
  }).catch(() => {});

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

// GET /api/admin/usuarios — lista completa con detalle
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

// GET /api/admin/album/:id — ver álbum de cualquier usuario
app.get('/api/admin/album/:id', authMiddleware, adminMiddleware, async (req, res) => {
  const { data, error } = await supabase
    .from('usuarios').select('id, nombre, rol, estado, updated_at')
    .eq('id', req.params.id).single();
  if (error || !data) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json({ id: data.id, nombre: data.nombre, rol: data.rol, estado: data.estado || {}, updated_at: data.updated_at });
});

// POST /api/admin/reset/:id — resetear álbum de un usuario
app.post('/api/admin/reset/:id', authMiddleware, adminMiddleware, async (req, res) => {
  const { error } = await supabase
    .from('usuarios')
    .update({ estado: {}, updated_at: new Date().toISOString() })
    .eq('id', req.params.id);
  if (error) return res.status(500).json({ error: 'Error al resetear' });
  res.json({ ok: true });
});

// DELETE /api/admin/usuario/:id — eliminar usuario
app.delete('/api/admin/usuario/:id', authMiddleware, adminMiddleware, async (req, res) => {
  if (req.params.id === req.userId)
    return res.status(400).json({ error: 'No podés eliminarte a vos mismo' });
  const { error } = await supabase.from('usuarios').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: 'Error al eliminar usuario' });
  res.json({ ok: true });
});

// POST /api/admin/change-password/:id — cambiar contraseña de cualquier usuario
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

// GET /api/admin/stats — estadísticas globales
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


// GET /api/admin/logs — últimos accesos
app.get('/api/admin/logs', authMiddleware, adminMiddleware, async (req, res) => {
  const { data, error } = await supabase
    .from('logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return res.status(500).json({ error: 'Error al obtener logs' });
  res.json(data || []);
});

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
