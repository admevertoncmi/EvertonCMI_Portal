-- Create logs_acesso table for portal access tracking
CREATE TABLE IF NOT EXISTS logs_acesso (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  material_id UUID REFERENCES materiais(id) ON DELETE CASCADE,
  evento TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS if needed
ALTER TABLE logs_acesso ENABLE ROW LEVEL SECURITY;

-- Policy for insert (anyone with material access)
CREATE POLICY "Allow insert logs_acesso" ON logs_acesso
  FOR INSERT TO authenticated, anon
  WITH CHECK (true);
