-- Supabase SQL Script - Run in Supabase SQL Editor (dashboard.sql-editor)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE clientes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL,
  token_magico UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE materiais (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE NOT NULL,
  clickup_task_id TEXT NOT NULL,
  titulo TEXT NOT NULL,
  link_drive TEXT,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'ajustes')) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_materiais_cliente_status ON materiais(cliente_id, status);
CREATE INDEX idx_clientes_token ON clientes(token_magico);
CREATE INDEX idx_materiais_task ON materiais(clickup_task_id);

-- RLS (enable in Supabase dashboard)
-- ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE materiais ENABLE ROW LEVEL SECURITY;
-- Admin policy: SELECT/INSERT/UPDATE/DELETE all (use Supabase Auth)
-- Portal policy: SELECT materiais WHERE cliente_id = (SELECT id FROM clientes WHERE token_magico = current_setting('request.token_magico')::uuid)
