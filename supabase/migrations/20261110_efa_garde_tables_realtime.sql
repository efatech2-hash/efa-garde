-- ==============================================================================
-- EFA GARDE - MIGRATION OFFICIELLE TEMPS RÉEL : 6 TABLES SYNCHRONISÉES
-- 1. public.clients (Statistiques réelles & inscriptions)
-- 2. public.abonnements (Paiements 25k, codes 4 chiffres, abonnements)
-- 3. public.pharmacies (Pharmacies validées, coordonnées GPS Lomé)
-- 4. public.conversations (Messagerie réciproque, anti-blocage)
-- 5. public.messages (Chat temps réel bidirectionnel, auto-clean 24h)
-- 6. public.utilisateurs (Comptes & rôles)
-- ==============================================================================

-- 1. TABLE CLIENTS
CREATE TABLE IF NOT EXISTS public.clients (
  id TEXT PRIMARY KEY DEFAULT ('cli-' || floor(extract(epoch from now()))::text || '-' || substr(md5(random()::text), 1, 6)),
  nom TEXT NOT NULL,
  numero TEXT,
  numero_whatsapp TEXT,
  date_inscription TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Si la colonne numero n'existe pas encore, on l'ajoute
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'numero'
  ) THEN
    ALTER TABLE public.clients ADD COLUMN numero TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_clients_numero ON public.clients(numero);
CREATE INDEX IF NOT EXISTS idx_clients_numero_whatsapp ON public.clients(numero_whatsapp);
CREATE INDEX IF NOT EXISTS idx_clients_created_at ON public.clients(created_at DESC);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Clients all policy" ON public.clients;
CREATE POLICY "Clients all policy" ON public.clients
  FOR ALL
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- 2. TABLE ABONNEMENTS (Demandes d'inscription 25.000 FCFA & Codes 4 chiffres)
CREATE TABLE IF NOT EXISTS public.abonnements (
  id TEXT PRIMARY KEY DEFAULT ('sub-' || floor(extract(epoch from now()))::text || '-' || substr(md5(random()::text), 1, 6)),
  pharmacie_id TEXT,
  nom_pharmacie TEXT,
  telephone TEXT,
  email TEXT,
  montant NUMERIC DEFAULT 25000,
  plan TEXT DEFAULT 'enregistrement_25k',
  statut TEXT DEFAULT 'en_attente', -- 'en_attente', 'paye_valide', 'active', 'rejete'
  code_validation TEXT,             -- Code 4 chiffres généré par le Super Admin
  date_debut TIMESTAMPTZ DEFAULT NOW(),
  expire_le TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'abonnements' AND column_name = 'code_validation'
  ) THEN
    ALTER TABLE public.abonnements ADD COLUMN code_validation TEXT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'abonnements' AND column_name = 'nom_pharmacie'
  ) THEN
    ALTER TABLE public.abonnements ADD COLUMN nom_pharmacie TEXT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'abonnements' AND column_name = 'telephone'
  ) THEN
    ALTER TABLE public.abonnements ADD COLUMN telephone TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_abonnements_code ON public.abonnements(code_validation);
CREATE INDEX IF NOT EXISTS idx_abonnements_statut ON public.abonnements(statut);

ALTER TABLE public.abonnements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Abonnements all policy" ON public.abonnements;
CREATE POLICY "Abonnements all policy" ON public.abonnements
  FOR ALL
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- 3. TABLE PHARMACIES
CREATE TABLE IF NOT EXISTS public.pharmacies (
  id TEXT PRIMARY KEY,
  nom TEXT NOT NULL,
  tel TEXT,
  adresse TEXT,
  quartier TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  plan TEXT DEFAULT 'free',
  is_online BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT false,
  is_pending BOOLEAN DEFAULT false,
  statut TEXT DEFAULT 'approved',
  subscription_status TEXT DEFAULT 'inactive',
  subscription_plan TEXT DEFAULT 'basic',
  subscription_start_at TIMESTAMPTZ,
  subscription_end_at TIMESTAMPTZ,
  subscription_days_left INTEGER DEFAULT 0,
  is_premium BOOLEAN DEFAULT false,
  etoile_doree BOOLEAN DEFAULT false,
  position INTEGER DEFAULT 999,
  photo_url TEXT,
  piece_url TEXT,
  titulaire TEXT,
  email_pro TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.pharmacies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Pharmacies all policy" ON public.pharmacies;
CREATE POLICY "Pharmacies all policy" ON public.pharmacies
  FOR ALL
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- 4. TABLE CONVERSATIONS
CREATE TABLE IF NOT EXISTS public.conversations (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  pharmacy_id TEXT NOT NULL,
  pharmacy_user_id TEXT,
  last_message TEXT,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  unread_count_pharmacy INTEGER DEFAULT 0,
  unread_count_client INTEGER DEFAULT 0,
  is_blocked BOOLEAN DEFAULT false,
  blocked_by TEXT,
  blocked_by_type TEXT,
  blocked_at TIMESTAMPTZ,
  is_reported BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Conversations all policy" ON public.conversations;
CREATE POLICY "Conversations all policy" ON public.conversations
  FOR ALL
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- 5. TABLE MESSAGES (Chat instantané avec suppression auto 24h)
CREATE TABLE IF NOT EXISTS public.messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id TEXT,
  receiver_id TEXT,
  sender_type TEXT,
  sender TEXT NOT NULL,
  content TEXT,
  text TEXT,
  type TEXT DEFAULT 'text',
  media_url TEXT,
  audio_duration INTEGER,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_messages_convo ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_expires_at ON public.messages(expires_at);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Messages all policy" ON public.messages;
CREATE POLICY "Messages all policy" ON public.messages
  FOR ALL
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- Nettoyage automatique 24h : Suppression des messages expirés
CREATE OR REPLACE FUNCTION public.cleanup_messages_24h()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.messages
  WHERE expires_at < NOW() OR created_at < (NOW() - INTERVAL '24 hours');
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- 6. TABLE UTILISATEURS
CREATE TABLE IF NOT EXISTS public.utilisateurs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID,
  email TEXT,
  nom TEXT,
  role TEXT DEFAULT 'client',
  telephone TEXT,
  pharmacie_id TEXT REFERENCES public.pharmacies(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.utilisateurs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Utilisateurs all policy" ON public.utilisateurs;
CREATE POLICY "Utilisateurs all policy" ON public.utilisateurs
  FOR ALL
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- 7. ACTIVATION TEMPS RÉEL (Supabase Realtime sur les 6 tables)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.clients; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.abonnements; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.pharmacies; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.messages; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.utilisateurs; EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END $$;
