-- ============================================================================
-- Responsáveis livres nas tarefas + foto de perfil da equipe
-- Rodar no SQL Editor do Supabase (pode rodar mais de uma vez sem problema).
-- ============================================================================

-- Pessoas responsáveis pela tarefa além dos postos de função
-- (planner_id / editor_id / designer_id continuam valendo para o fluxo de cada painel)
ALTER TABLE public.materiais
  ADD COLUMN IF NOT EXISTS responsaveis uuid[] NOT NULL DEFAULT '{}';

-- Foto de perfil dos membros da equipe (URL pública no Storage, arquivos avatar-* do bucket roteiros-midia)
ALTER TABLE public.perfis_equipe
  ADD COLUMN IF NOT EXISTS foto_url text;

-- Faz a API do Supabase enxergar as colunas novas na hora
NOTIFY pgrst, 'reload schema';
