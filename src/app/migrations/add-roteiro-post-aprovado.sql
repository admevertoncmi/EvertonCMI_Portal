-- Migration: Adicionar statuses 'roteiro_aprovado' e 'post_aprovado'
-- Diferencia aprovação de roteiro vs aprovação de post pelo cliente

-- Remove a constraint antiga
ALTER TABLE materiais DROP CONSTRAINT IF EXISTS status_check;
ALTER TABLE materiais DROP CONSTRAINT IF EXISTS materiais_status_check;

-- Adiciona constraint com TODOS os statuses válidos
ALTER TABLE materiais ADD CONSTRAINT status_check CHECK (
  status IN (
    'pendente', 'aprovado', 'ajustes', 'revisao', 'concluido', 
    'roteiro_pendente', 'planejamento', 'organizado', 'em_organizacao', 
    'faltando_material', 'verificar_material', 'analise_roteiro', 
    'em_edicao', 'roteiro_aprovado', 'post_aprovado'
  )
);
