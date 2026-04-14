-- ============================================================================
-- ASSENT PORTAL - SETUP COMPLETO DO SUPABASE (Clone Perfeito)
-- Execute este script INTEIRO no SQL Editor do novo projeto Supabase.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================
-- TABELA: clientes
-- ============================
CREATE TABLE IF NOT EXISTS clientes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL,
  token_magico UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ciclos_contratados INTEGER DEFAULT 1,
  wpp_suporte TEXT,
  cor_marca TEXT DEFAULT '#1e3a5f',
  logo_url TEXT
);

-- ============================
-- TABELA: materiais
-- ============================
CREATE TABLE IF NOT EXISTS materiais (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE NOT NULL,
  titulo TEXT NOT NULL,
  link_drive TEXT,
  link_bruto TEXT,
  link_organizado TEXT,
  link_capa TEXT,
  roteiro TEXT,
  status TEXT DEFAULT 'pendente' NOT NULL
    CHECK (status IN (
      'pendente', 'aprovado', 'ajustes', 'revisao', 'concluido',
      'roteiro_pendente', 'planejamento', 'organizado', 'em_organizacao',
      'faltando_material', 'verificar_material', 'analise_roteiro',
      'em_edicao', 'roteiro_aprovado', 'post_aprovado'
    )),
  feedback TEXT,
  feedback_admin TEXT,
  ciclo INTEGER DEFAULT 1,
  data_limite DATE,
  editor_id UUID,
  designer_id UUID,
  planner_id UUID,
  video_entregue BOOLEAN DEFAULT FALSE,
  design_entregue BOOLEAN DEFAULT FALSE,
  clickup_task_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================
-- TABELA: logs_acesso
-- ============================
CREATE TABLE IF NOT EXISTS logs_acesso (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  material_id UUID REFERENCES materiais(id) ON DELETE CASCADE,
  evento TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================
-- TABELA: logs_material
-- ============================
CREATE TABLE IF NOT EXISTS logs_material (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  material_id UUID REFERENCES materiais(id) ON DELETE CASCADE,
  acao TEXT NOT NULL,
  detalhes TEXT,
  usuario_email TEXT DEFAULT 'Sistema',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================
-- TABELA: perfis_equipe
-- ============================
CREATE TABLE IF NOT EXISTS perfis_equipe (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  nome TEXT,
  role TEXT DEFAULT 'editor' CHECK (role IN ('admin', 'editor', 'planner', 'designer')),
  telegram_thread_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================
-- INDEXES
-- ============================
CREATE INDEX IF NOT EXISTS idx_materiais_cliente_status ON materiais(cliente_id, status);
CREATE INDEX IF NOT EXISTS idx_clientes_token ON clientes(token_magico);
CREATE INDEX IF NOT EXISTS idx_materiais_task ON materiais(clickup_task_id);
CREATE INDEX IF NOT EXISTS idx_materiais_editor ON materiais(editor_id);
CREATE INDEX IF NOT EXISTS idx_materiais_designer ON materiais(designer_id);
CREATE INDEX IF NOT EXISTS idx_materiais_planner ON materiais(planner_id);
CREATE INDEX IF NOT EXISTS idx_materiais_ciclo ON materiais(cliente_id, ciclo);
CREATE INDEX IF NOT EXISTS idx_logs_acesso_material ON logs_acesso(material_id);
CREATE INDEX IF NOT EXISTS idx_logs_material_material ON logs_material(material_id);
CREATE INDEX IF NOT EXISTS idx_perfis_equipe_role ON perfis_equipe(role);

-- ============================
-- ROW LEVEL SECURITY (RLS)
-- ============================
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE materiais ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs_acesso ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs_material ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfis_equipe ENABLE ROW LEVEL SECURITY;

-- clientes
CREATE POLICY "Clientes: Leitura publica" ON clientes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Clientes: Admin pode inserir" ON clientes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Clientes: Admin pode atualizar" ON clientes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Clientes: Admin pode deletar" ON clientes FOR DELETE TO authenticated USING (true);

-- materiais
CREATE POLICY "Materiais: Leitura publica" ON materiais FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Materiais: Insercao livre" ON materiais FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Materiais: Atualizacao livre" ON materiais FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Materiais: Delecao autenticada" ON materiais FOR DELETE TO authenticated USING (true);

-- logs_acesso
CREATE POLICY "Logs acesso: Leitura livre" ON logs_acesso FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Logs acesso: Insercao livre" ON logs_acesso FOR INSERT TO anon, authenticated WITH CHECK (true);

-- logs_material
CREATE POLICY "Logs material: Leitura livre" ON logs_material FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Logs material: Insercao livre" ON logs_material FOR INSERT TO anon, authenticated WITH CHECK (true);

-- perfis_equipe
CREATE POLICY "Perfis: Leitura livre" ON perfis_equipe FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Perfis: Atualizacao autenticada" ON perfis_equipe FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Perfis: Delecao autenticada" ON perfis_equipe FOR DELETE TO authenticated USING (true);
CREATE POLICY "Perfis: Insercao autenticada" ON perfis_equipe FOR INSERT TO authenticated WITH CHECK (true);

-- ============================
-- TRIGGER: Auto-criar perfil ao registrar user
-- ============================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.perfis_equipe (id, email, nome, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'editor')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================
-- REALTIME
-- ============================
ALTER PUBLICATION supabase_realtime ADD TABLE materiais;
ALTER PUBLICATION supabase_realtime ADD TABLE clientes;
ALTER PUBLICATION supabase_realtime ADD TABLE perfis_equipe;
ALTER PUBLICATION supabase_realtime ADD TABLE logs_acesso;

-- ============================
-- STORAGE: Bucket logos
-- ============================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('logos', 'logos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Logos: Leitura publica" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'logos');
CREATE POLICY "Logos: Upload autenticado" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'logos');
CREATE POLICY "Logos: Update autenticado" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'logos');

-- ============================================================================
-- PRONTO! Agora crie o primeiro Admin via Dashboard:
-- Authentication > Users > Add User
-- Email: admin@dominio.com | Password: SuaSenha
-- User Metadata: {"role": "admin", "nome": "Admin"}
-- ============================================================================
