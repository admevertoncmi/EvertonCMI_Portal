-- Add feedback and concluido status
ALTER TABLE materiais ADD COLUMN feedback TEXT;
ALTER TABLE materiais ADD CONSTRAINT status_check CHECK (status IN ('pendente', 'aprovado', 'ajustes', 'concluido'));


