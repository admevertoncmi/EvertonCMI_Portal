-- ============================================================================
-- CONFIGURAÇÕES DO SISTEMA: cores do tema salvas no banco (valem para todos)
-- Rodar no Supabase: SQL Editor > New query > colar tudo > Run.
-- Pode rodar ANTES de publicar o código (só cria coisas novas).
--
-- Quem lê: o servidor do app (service role), para pintar todas as páginas,
-- inclusive o login, já com as cores certas. Quem altera: só admin, pela tela
-- Configurações › Cores do tema (server action que confere se é admin).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.configuracoes (
  chave           text PRIMARY KEY,
  valor           jsonb NOT NULL,
  atualizado_em   timestamptz NOT NULL DEFAULT now(),
  atualizado_por  uuid NULL
);

ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Config: equipe le"     ON public.configuracoes;
DROP POLICY IF EXISTS "Config: admin altera"  ON public.configuracoes;
CREATE POLICY "Config: equipe le"    ON public.configuracoes FOR SELECT TO authenticated USING (public.is_equipe());
CREATE POLICY "Config: admin altera" ON public.configuracoes FOR ALL    TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Tema padrão da Everton (pêssego, cobre e oliva)
INSERT INTO public.configuracoes (chave, valor)
VALUES ('tema', '{"soft": "#F9E2D2", "brand": "#A25431", "ink": "#212013"}')
ON CONFLICT (chave) DO NOTHING;
