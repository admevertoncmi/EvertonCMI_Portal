-- ============================================================================
-- SEGURANÇA: fecha o acesso público ao banco
-- Rodar no Supabase: SQL Editor > New query > colar tudo > Run.
--
-- Antes: a chave anon (pública, vai no navegador de qualquer visitante) lia
-- clientes (com token_magico), materiais, equipe e logs, e alterava materiais.
-- Depois: só membros da equipe logados (linha em perfis_equipe) acessam o banco
-- pelo navegador. O portal do cliente passa a usar server actions que validam
-- o token mágico (src/actions/portal.ts) e não precisa mais da chave anon.
--
-- RODAR SÓ DEPOIS de publicar a versão do código com src/actions/portal.ts,
-- senão o portal do cliente para de carregar.
-- ============================================================================

-- 1. Funções auxiliares (SECURITY DEFINER para não cair em recursão de RLS)
CREATE OR REPLACE FUNCTION public.is_equipe()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.perfis_equipe WHERE id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.perfis_equipe WHERE id = auth.uid() AND role = 'admin')
$$;

REVOKE ALL ON FUNCTION public.is_equipe() FROM anon;
REVOKE ALL ON FUNCTION public.is_admin() FROM anon;

-- 2. Remove TODAS as policies atuais das tabelas do app
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('clientes', 'materiais', 'logs_acesso', 'logs_material', 'perfis_equipe', 'tags')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;

ALTER TABLE public.clientes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materiais     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs_acesso   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs_material ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfis_equipe ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags          ENABLE ROW LEVEL SECURITY;

-- 3. Equipe tem acesso total às tabelas de trabalho; anon não tem nada
CREATE POLICY "Equipe: tudo" ON public.clientes      FOR ALL TO authenticated USING (public.is_equipe()) WITH CHECK (public.is_equipe());
CREATE POLICY "Equipe: tudo" ON public.materiais     FOR ALL TO authenticated USING (public.is_equipe()) WITH CHECK (public.is_equipe());
CREATE POLICY "Equipe: tudo" ON public.logs_acesso   FOR ALL TO authenticated USING (public.is_equipe()) WITH CHECK (public.is_equipe());
CREATE POLICY "Equipe: tudo" ON public.logs_material FOR ALL TO authenticated USING (public.is_equipe()) WITH CHECK (public.is_equipe());
CREATE POLICY "Equipe: tudo" ON public.tags          FOR ALL TO authenticated USING (public.is_equipe()) WITH CHECK (public.is_equipe());

-- perfis_equipe: equipe lê (e cada um lê o próprio perfil); só admin altera
CREATE POLICY "Perfis: leitura equipe" ON public.perfis_equipe FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_equipe());
CREATE POLICY "Perfis: admin altera"   ON public.perfis_equipe FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Perfis: admin remove"   ON public.perfis_equipe FOR DELETE TO authenticated USING (public.is_admin());
-- INSERT em perfis_equipe só pelo trigger abaixo / service role

-- 4. Trigger de novo usuário: o role vem de app_metadata (só a service role
--    escreve ali). Antes vinha de user_metadata, que QUALQUER pessoa define no
--    cadastro: bastava se registrar com {"role":"admin"} para virar admin.
--    Usuário sem role em app_metadata (cadastro público) NÃO ganha perfil.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.raw_app_meta_data->>'role' IN ('admin', 'editor', 'planner', 'designer') THEN
    INSERT INTO public.perfis_equipe (id, email, nome, role)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
      NEW.raw_app_meta_data->>'role'
    );
  END IF;
  RETURN NEW;
END;
$$;

-- 5. Storage: leitura continua pública (logos aparecem no portal); escrita só equipe
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (coalesce(qual, '') || coalesce(with_check, '')) ~ '(logos|roteiros-midia)'
      AND cmd <> 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "App buckets: equipe envia"   ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id IN ('logos', 'roteiros-midia') AND public.is_equipe());
CREATE POLICY "App buckets: equipe altera"  ON storage.objects FOR UPDATE TO authenticated USING (bucket_id IN ('logos', 'roteiros-midia') AND public.is_equipe());
CREATE POLICY "App buckets: equipe remove"  ON storage.objects FOR DELETE TO authenticated USING (bucket_id IN ('logos', 'roteiros-midia') AND public.is_equipe());

-- ============================================================================
-- 6. CONFERÊNCIA (rodar separado e olhar o resultado)
-- ============================================================================
-- Quem tem login no sistema e quem é da equipe. Procure contas do ex-dev,
-- e-mails desconhecidos e contas criadas recentemente.
--
-- SELECT u.email, u.created_at, u.last_sign_in_at, p.role
-- FROM auth.users u LEFT JOIN public.perfis_equipe p ON p.id = u.id
-- ORDER BY u.last_sign_in_at DESC NULLS LAST;
--
-- Para remover alguém: Authentication > Users > (usuário) > Delete user.
