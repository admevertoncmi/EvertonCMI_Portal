-- ============================================================================
-- Notificações da equipe dentro da plataforma + WhatsApp de cada membro para avisos
-- Rodar no SQL Editor do Supabase (pode rodar mais de uma vez sem problema).
-- ============================================================================

-- WhatsApp do membro para receber avisos (número com DDD, ou ID de grupo da Z-API)
ALTER TABLE public.perfis_equipe
  ADD COLUMN IF NOT EXISTS whatsapp text;

-- Uma linha por pessoa avisada. Criada pelo servidor (service role) quando o cliente
-- manda mensagem/áudio/foto, pede ajuste ou aprova um conteúdo.
CREATE TABLE IF NOT EXISTS public.notificacoes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membro_id   uuid NOT NULL REFERENCES public.perfis_equipe(id) ON DELETE CASCADE,
  material_id uuid REFERENCES public.materiais(id) ON DELETE CASCADE,
  tipo        text NOT NULL DEFAULT 'mensagem',   -- mensagem | ajuste | aprovado
  titulo      text NOT NULL,
  texto       text,
  lida        boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notificacoes_membro_idx ON public.notificacoes (membro_id, lida, created_at DESC);

-- Cada membro só enxerga e marca como lidas as próprias notificações
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Notificações: membro lê as suas" ON public.notificacoes;
CREATE POLICY "Notificações: membro lê as suas" ON public.notificacoes
  FOR SELECT TO authenticated USING (membro_id = auth.uid());
DROP POLICY IF EXISTS "Notificações: membro marca as suas" ON public.notificacoes;
CREATE POLICY "Notificações: membro marca as suas" ON public.notificacoes
  FOR UPDATE TO authenticated USING (membro_id = auth.uid()) WITH CHECK (membro_id = auth.uid());

-- Faz a API do Supabase enxergar a tabela e a coluna novas na hora
NOTIFY pgrst, 'reload schema';
