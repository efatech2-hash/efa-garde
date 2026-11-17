-- ==============================================================================
-- MIGRATION : TABLE CLIENTS (id auth.users.id, nom, telephone, email, created_at)
-- ==============================================================================

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS telephone TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Assurer que numero_whatsapp n'échoue pas si INSERT minimal (nom, telephone, email)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'numero_whatsapp'
  ) THEN
    ALTER TABLE public.clients ALTER COLUMN numero_whatsapp DROP NOT NULL;
  END IF;
END $$;

-- Synchroniser les anciennes lignes ayant numero_whatsapp sans telephone
UPDATE public.clients
SET telephone = COALESCE(telephone, numero_whatsapp)
WHERE telephone IS NULL AND numero_whatsapp IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clients_telephone ON public.clients(telephone);
CREATE INDEX IF NOT EXISTS idx_clients_email ON public.clients(email);

-- RLS permissive pour inscription / connexion client et lecture nom dans Chat
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clients full access policy" ON public.clients;
CREATE POLICY "Clients full access policy" ON public.clients
  FOR ALL
  TO public, anon, authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.clients TO anon, authenticated;
