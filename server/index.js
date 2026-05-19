require('dotenv').config();
const express    = require('express');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const cors       = require('cors');
const path       = require('path');
const { createClient } = require('@supabase/supabase-js');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Supabase client ──
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ── Middleware ──
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ── Auth middleware ──
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido' });
  }
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    req.userId   = payload.userId;
    req.userName = payload.userName;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

// ════════════════════════════════════════════
// AUTH ROUTES
// ════════════════════════════════════════════

// POST /api/register
app.post('/api/register', async (req, res) => {
  const { nombre, password } = req.body;
  if (!nombre || !password) {
    return res.status(400).json({ error: 'Nombre y contraseña requeridos' });
  }
  if (nombre.trim().length < 2 || nombre.trim().length > 30) {
    return res.status(400).json({ error: 'El nombre debe tener entre 2 y 30 caracteres' });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres' });
  }

  // Check if name already taken
  const { data: existing } = await supabase
    .from('usuarios')
    .select('id')
    .ilike('nombre', nombre.trim())
    .single();

  if (existing) {
    return res.status(409).json({ error: 'Ese nombre ya está en uso' });
  }

  const hash = await bcrypt.hash(password, 10);
  const { data, error } = await supabase
    .from('usuarios')
    .insert({ nombre: nombre.trim(), password_hash: hash, estado: {} })
    .select('id, nombre')
    .single();

  if (error) {
    console.error('Register error:', error);
    return res.status(500).json({ error: 'Error al crear usuario' });
  }

  const token = jwt.sign(
    { userId: data.id, userName: data.nombre },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );

  res.json({ token, nombre: data.nombre, userId: data.id });
});

// POST /api/login
app.post('/api/login', async (req, res) => {
  const { nombre, password } = req.body;
  if (!nombre || !password) {
    return res.status(400).json({ error: 'Nombre y contraseña requeridos' });
  }

  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nombre, password_hash, estado')
    .ilike('nombre', nombre.trim())
    .single();

  if (error || !data) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }

  const ok = await bcrypt.compare(password, data.password_hash);
  if (!ok) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }

  const token = jwt.sign(
    { userId: data.id, userName: data.nombre },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );

  res.json({ token, nombre: data.nombre, userId: data.id, estado: data.estado });
});

// ════════════════════════════════════════════
// ALBUM ROUTES
// ════════════════════════════════════════════

// GET /api/album — load current user's album
app.get('/api/album', authMiddleware, async (req, res) => {
  const { data, error } = await supabase
    .from('usuarios')
    .select('estado, nombre')
    .eq('id', req.userId)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  res.json({ estado: data.estado || {}, nombre: data.nombre });
});

// PUT /api/album — save full album state
app.put('/api/album', authMiddleware, async (req, res) => {
  const { estado } = req.body;
  if (typeof estado !== 'object') {
    return res.status(400).json({ error: 'Estado inválido' });
  }

  const { error } = await supabase
    .from('usuarios')
    .update({ estado, updated_at: new Date().toISOString() })
    .eq('id', req.userId);

  if (error) {
    console.error('Save error:', error);
    return res.status(500).json({ error: 'Error al guardar' });
  }

  res.json({ ok: true });
});

// PATCH /api/album/sticker — update a single sticker (more efficient)
app.patch('/api/album/sticker', authMiddleware, async (req, res) => {
  const { key, value } = req.body;
  if (!key || !['vacia','tengo','repetida'].includes(value)) {
    return res.status(400).json({ error: 'Datos inválidos' });
  }

  // Fetch current state, update key, save back
  const { data, error: fetchErr } = await supabase
    .from('usuarios')
    .select('estado')
    .eq('id', req.userId)
    .single();

  if (fetchErr || !data) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  const estado = data.estado || {};
  if (value === 'vacia') {
    delete estado[key];
  } else {
    estado[key] = value;
  }

  const { error: saveErr } = await supabase
    .from('usuarios')
    .update({ estado, updated_at: new Date().toISOString() })
    .eq('id', req.userId);

  if (saveErr) {
    return res.status(500).json({ error: 'Error al guardar' });
  }

  res.json({ ok: true, key, value });
});

// GET /api/usuarios — ranking/list (public, no auth needed)
app.get('/api/usuarios', async (req, res) => {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nombre, estado, updated_at')
    .order('updated_at', { ascending: false });

  if (error) return res.status(500).json({ error: 'Error al obtener usuarios' });

  // Calculate progress for each user without exposing passwords
  const usuarios = (data || []).map(u => {
    const estado = u.estado || {};
    const tengo = Object.values(estado).filter(v => v === 'tengo').length;
    const repetidas = Object.values(estado).filter(v => v === 'repetida').length;
    return {
      id: u.id,
      nombre: u.nombre,
      tengo,
      repetidas,
      total: 1008,
      pct: Math.round(tengo / 1008 * 100),
      updated_at: u.updated_at
    };
  });

  res.json(usuarios);
});

// GET /api/change-password
app.post('/api/change-password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Faltan datos' });
  }
  if (newPassword.length < 4) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 4 caracteres' });
  }

  const { data } = await supabase
    .from('usuarios')
    .select('password_hash')
    .eq('id', req.userId)
    .single();

  if (!data) return res.status(404).json({ error: 'Usuario no encontrado' });

  const ok = await bcrypt.compare(currentPassword, data.password_hash);
  if (!ok) return res.status(401).json({ error: 'Contraseña actual incorrecta' });

  const hash = await bcrypt.hash(newPassword, 10);
  await supabase.from('usuarios').update({ password_hash: hash }).eq('id', req.userId);

  res.json({ ok: true });
});

// GET /api/health — check server + supabase connection
app.get('/api/health', async (req, res) => {
  const checks = {
    server: 'ok',
    supabase_url: !!process.env.SUPABASE_URL,
    supabase_key: !!process.env.SUPABASE_SERVICE_KEY,
    jwt_secret: !!process.env.JWT_SECRET,
    supabase_connection: false,
    error: null
  };
  try {
    const { error } = await supabase.from('usuarios').select('id').limit(1);
    if (error) { checks.error = error.message; }
    else { checks.supabase_connection = true; }
  } catch(e) { checks.error = e.message; }
  const allOk = checks.supabase_url && checks.supabase_key && checks.jwt_secret && checks.supabase_connection;
  res.status(allOk ? 200 : 500).json(checks);
});

// Catch-all: serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`🌍 Mundial 2026 Album server running on port ${PORT}`);
});
