-- ============================================================================
-- PALIATIVO TEMPORÁRIO: reabre para a chave anon só o que o portal antigo
-- (branch main, ClientPortal.tsx lendo direto do navegador) precisa.
-- Rodar no Supabase: SQL Editor > New query > colar a PARTE A > Run.
--
-- ATENÇÃO: isso reabre o buraco de segurança (qualquer um com a chave anon lê
-- todos os clientes, inclusive token_magico, e altera materiais).
-- Remover (PARTE B) assim que src/actions/portal.ts estiver em produção.
-- ============================================================================

-- PARTE A: aplicar
CREATE POLICY "PALIATIVO anon: le clientes"     ON public.clientes    FOR SELECT TO anon USING (true);
CREATE POLICY "PALIATIVO anon: le materiais"    ON public.materiais   FOR SELECT TO anon USING (true);
CREATE POLICY "PALIATIVO anon: altera materiais" ON public.materiais  FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "PALIATIVO anon: registra acesso" ON public.logs_acesso FOR INSERT TO anon WITH CHECK (true);

GRANT SELECT ON public.clientes    TO anon;
GRANT SELECT, UPDATE ON public.materiais TO anon;
GRANT INSERT ON public.logs_acesso TO anon;


-- ============================================================================
-- PARTE B: remover o paliativo (rodar depois do deploy do portal.ts)
-- ============================================================================
-- DROP POLICY IF EXISTS "PALIATIVO anon: le clientes"      ON public.clientes;
-- DROP POLICY IF EXISTS "PALIATIVO anon: le materiais"     ON public.materiais;
-- DROP POLICY IF EXISTS "PALIATIVO anon: altera materiais" ON public.materiais;
-- DROP POLICY IF EXISTS "PALIATIVO anon: registra acesso"  ON public.logs_acesso;
