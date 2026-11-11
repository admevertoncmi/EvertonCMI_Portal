-- ============================================================================
-- CONVERSA DO PORTAL: mensagens por conteúdo (texto, fotos e áudio)
-- Rodar no Supabase: SQL Editor > New query > colar tudo > Run.
-- Pode rodar ANTES de publicar o código (só cria coisas novas).
--
-- O cliente não tem login: ele lê e escreve só pelas server actions de
-- src/actions/portal.ts, que validam o token mágico e usam a service role.
-- A equipe (logada) também passa por server actions (src/actions/conversa.ts).
-- Por isso o navegador não precisa de acesso direto: a RLS só libera a equipe.
-- ============================================================================

-- 1. Tabela de mensagens
CREATE TABLE IF NOT EXISTS public.mensagens_material (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id        uuid NOT NULL REFERENCES public.materiais(id) ON DELETE CASCADE,
  cliente_id         uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  autor              text NOT NULL CHECK (autor IN ('cliente', 'equipe')),
  autor_id           uuid NULL,              -- membro da equipe que escreveu (null = cliente)
  autor_nome         text NULL,
  feito_pela_agencia boolean NOT NULL DEFAULT false, -- admin agindo no portal do cliente
  texto              text NULL,
  fotos              text[] NOT NULL DEFAULT '{}',   -- caminhos no bucket portal-anexos
  audio_path         text NULL,
  audio_dur          integer NULL,           -- segundos
  ajuste             boolean NOT NULL DEFAULT false, -- mensagem é um pedido de ajuste
  alvo               text NULL CHECK (alvo IS NULL OR alvo IN ('video', 'capa', 'ambos')),
  evento             text NULL,              -- ex.: 'aprovado' (registro automático na conversa)
  lida_pelo_cliente  boolean NOT NULL DEFAULT false,
  lida_pela_equipe   boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mensagens_material_material_idx ON public.mensagens_material (material_id, created_at);
CREATE INDEX IF NOT EXISTS mensagens_material_cliente_nao_lidas_idx ON public.mensagens_material (cliente_id) WHERE autor = 'equipe' AND lida_pelo_cliente = false;
CREATE INDEX IF NOT EXISTS mensagens_material_equipe_nao_lidas_idx ON public.mensagens_material (material_id) WHERE autor = 'cliente' AND lida_pela_equipe = false;

ALTER TABLE public.mensagens_material ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Equipe: tudo" ON public.mensagens_material;
CREATE POLICY "Equipe: tudo" ON public.mensagens_material FOR ALL TO authenticated
  USING (public.is_equipe()) WITH CHECK (public.is_equipe());

-- 2. Bucket privado para as fotos e áudios da conversa
--    (privado: os arquivos só abrem por link assinado e temporário gerado no servidor)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'portal-anexos', 'portal-anexos', false, 26214400, -- 25 MB por arquivo
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif',
        'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/wav', 'audio/x-m4a']
)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Equipe logada pode ler/enviar direto (o app usa links assinados gerados no servidor,
-- mas isso deixa o painel do Supabase e futuras telas funcionarem).
DROP POLICY IF EXISTS "Portal anexos: equipe le"     ON storage.objects;
DROP POLICY IF EXISTS "Portal anexos: equipe envia"  ON storage.objects;
DROP POLICY IF EXISTS "Portal anexos: equipe remove" ON storage.objects;
CREATE POLICY "Portal anexos: equipe le"     ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'portal-anexos' AND public.is_equipe());
CREATE POLICY "Portal anexos: equipe envia"  ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'portal-anexos' AND public.is_equipe());
CREATE POLICY "Portal anexos: equipe remove" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'portal-anexos' AND public.is_equipe());
-- O cliente envia por "signed upload URL" criada no servidor depois de validar o token;
-- esse tipo de envio não depende de policy para anon.
