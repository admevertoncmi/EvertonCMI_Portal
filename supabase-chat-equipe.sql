-- ============================================================================
-- CHAT DA EQUIPE: conversa interna entre os colaboradores (sala Geral + conversas
-- entre duas pessoas), com mensagem solta ou ligada a uma demanda (conteúdo).
-- Rodar no Supabase: SQL Editor > New query > colar tudo > Run.
-- Pode rodar ANTES de publicar o código (só cria coisas novas) e mais de uma vez.
--
-- Tudo passa por server actions (src/actions/chat-equipe.ts), que checam quem
-- está logado e se a pessoa participa da conversa. Por isso a RLS fica ligada
-- SEM política: o navegador não lê nada direto (as conversas 1 a 1 ficam privadas).
-- Fotos e áudios usam o bucket privado "portal-anexos" já existente (pasta equipe/).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.mensagens_equipe (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canal       text NOT NULL,                 -- 'geral' ou 'dm:<id menor>:<id maior>'
  autor_id    uuid NOT NULL REFERENCES public.perfis_equipe(id) ON DELETE CASCADE,
  autor_nome  text NULL,
  material_id uuid NULL REFERENCES public.materiais(id) ON DELETE SET NULL, -- demanda (opcional)
  texto       text NULL,
  fotos       text[] NOT NULL DEFAULT '{}',
  audio_path  text NULL,
  audio_dur   integer NULL,
  audio_transcricao text NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mensagens_equipe_canal_idx ON public.mensagens_equipe (canal, created_at);
CREATE INDEX IF NOT EXISTS mensagens_equipe_material_idx ON public.mensagens_equipe (material_id) WHERE material_id IS NOT NULL;

-- Até onde cada pessoa já leu cada conversa (para o contador de não lidas)
CREATE TABLE IF NOT EXISTS public.leituras_chat_equipe (
  membro_id uuid NOT NULL REFERENCES public.perfis_equipe(id) ON DELETE CASCADE,
  canal     text NOT NULL,
  lida_ate  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (membro_id, canal)
);

ALTER TABLE public.mensagens_equipe ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leituras_chat_equipe ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
