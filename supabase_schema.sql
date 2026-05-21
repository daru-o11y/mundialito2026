-- ═══════════════════════════════════════════════
-- MUNDIAL 2026 - Schema Supabase
-- Ejecutar en: Supabase > SQL Editor > New Query
-- ═══════════════════════════════════════════════

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS usuarios (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre       TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  estado       JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para búsqueda por nombre (case-insensitive)
CREATE INDEX IF NOT EXISTS idx_usuarios_nombre ON usuarios (LOWER(nombre));

-- Deshabilitar Row Level Security para acceso desde service key
ALTER TABLE usuarios DISABLE ROW LEVEL SECURITY;

