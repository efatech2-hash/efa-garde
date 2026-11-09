-- ==============================================================================
-- MIGRATION : TABLE CLIENTS + SYNCHRONISATION 6 TABLES SUPABASE
-- Date : 2026-11-09
-- ==============================================================================

-- 1. TABLE CLIENTS (Statistiques & Enregistrement direct)
CREATE TABLE IF NOT EXISTS public.clients (
  id TEXT PRIMARY KEY DEFAULT ('cli-' || floor(extract(epoch from now()))::text || '-' || substr(md5(random()::text), 1, 6)),
  nom TEXT NOT NULL,
  numero_whatsapp TEXT NOT NULL,
  date_inscription TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clients_numero_whatsapp ON public.clients(numero_whatsapp);
CREATE INDEX IF NOT EXISTS idx_clients_date_inscription ON public.clients(date_inscription DESC);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clients read policy" ON public.clients;
CREATE POLICY "Clients read policy" ON public.clients
  FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "Clients insert policy" ON public.clients;
CREATE POLICY "Clients insert policy" ON public.clients
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "Clients update policy" ON public.clients;
CREATE POLICY "Clients update policy" ON public.clients
  FOR UPDATE
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- 2. TABLE UTILISATEURS (Profils utilisateurs / Rôles)
CREATE TABLE IF NOT EXISTS public.utilisateurs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID,
  email TEXT,
  nom TEXT,
  role TEXT DEFAULT 'client' CHECK (role IN ('client', 'pharma', 'admin', 'super_admin')),
  telephone TEXT,
  pharmacie_id TEXT REFERENCES public.pharmacies(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_utilisateurs_email ON public.utilisateurs(email);
CREATE INDEX IF NOT EXISTS idx_utilisateurs_role ON public.utilisateurs(role);

ALTER TABLE public.utilisateurs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Utilisateurs access policy" ON public.utilisateurs;
CREATE POLICY "Utilisateurs access policy" ON public.utilisateurs
  FOR ALL
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- 3. Activation Realtime sur les 6 tables principales
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pharmacies;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.abonnements;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.clients;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.utilisateurs;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;
