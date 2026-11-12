-- ============================================================================
-- TRANSCRIÇÃO DE ÁUDIO NA CONVERSA DO PORTAL
-- Rodar no Supabase: SQL Editor > New query > colar tudo > Run.
-- Pode rodar ANTES de publicar o código (só cria uma coluna nova).
--
-- O texto só é gerado quando alguém clica em "Transcrever" no áudio
-- (API da Groq, chamada no servidor). Fica salvo aqui para não pagar de novo.
-- ============================================================================

ALTER TABLE public.mensagens_material
  ADD COLUMN IF NOT EXISTS audio_transcricao text NULL;
