-- ==============================================================================
-- EFA GARDE - HARMONISATION SCHÉMAS + POLITIQUES RLS POUR INSERT DIRECT
-- Même modèle fonctionnel que `public.user_consents` pour les 9 tables :
--   1. public.pharmacies
--   2. public.pharmacies_pending
--   3. public.abonnements
--   4. public.clients
--   5. public.conversations
--   6. public.messages
--   7. public.pre_inscriptions
--   8. public.users
--   9. public.utilisateurs
-- NOTE : Aucune écriture/INSERT sur `view_pharmacies` (c'est une vue).
-- ==============================================================================

-- 0. USER_CONSENTS (référence qui fonctionne)
CREATE TABLE IF NOT EXISTS public.user_consents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT,
  device_id TEXT,
  date TEXT,
  heure TEXT,
  ip TEXT,
  ip_hash TEXT,
  version TEXT DEFAULT '1.0',
  consent BOOLEAN DEFAULT true,
  consent_given BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "consents_select" ON public.user_consents;
DROP POLICY IF EXISTS "consents_insert" ON public.user_consents;
DROP POLICY IF EXISTS "User consents all policy" ON public.user_consents;
CREATE POLICY "User consents all policy" ON public.user_consents
  FOR ALL
  TO public, anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 1. TABLE PUBLIC.PHARMACIES
CREATE TABLE IF NOT EXISTS public.pharmacies (
  id TEXT PRIMARY KEY,
  nom TEXT NOT NULL,
  tel TEXT,
  phone TEXT,
  adresse TEXT,
  quartier TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  plan TEXT DEFAULT 'free',
  prix INTEGER DEFAULT 25000,
  badge TEXT,
  horaires TEXT,
  is_online BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT false,
  is_pending BOOLEAN DEFAULT false,
  is_registered BOOLEAN DEFAULT false,
  is_always_visible BOOLEAN DEFAULT false,
  statut TEXT DEFAULT 'pending',
  subscription_status TEXT DEFAULT 'inactive',
  subscription_plan TEXT DEFAULT 'basic',
  subscription_start_at TIMESTAMPTZ,
  subscription_end_at TIMESTAMPTZ,
  subscription_end TEXT,
  subscription_days_left INTEGER DEFAULT 0,
  is_premium BOOLEAN DEFAULT false,
  etoile_doree BOOLEAN DEFAULT false,
  position INTEGER DEFAULT 999,
  photo_url TEXT,
  piece_url TEXT,
  titulaire TEXT,
  numero_ordre TEXT,
  email_pro TEXT,
  mot_de_passe TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.pharmacies
  ADD COLUMN IF NOT EXISTS tel TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS prix INTEGER DEFAULT 25000,
  ADD COLUMN IF NOT EXISTS badge TEXT,
  ADD COLUMN IF NOT EXISTS horaires TEXT,
  ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_pending BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_registered BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_always_visible BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS statut TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS subscription_end TEXT,
  ADD COLUMN IF NOT EXISTS numero_ordre TEXT,
  ADD COLUMN IF NOT EXISTS mot_de_passe TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.pharmacies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pharmacies_public_read" ON public.pharmacies;
DROP POLICY IF EXISTS "pharmacies_owner_update" ON public.pharmacies;
DROP POLICY IF EXISTS "pharmacies_admin_manage" ON public.pharmacies;
DROP POLICY IF EXISTS "pharmacies_admin_all" ON public.pharmacies;
DROP POLICY IF EXISTS "Pharmacies all policy" ON public.pharmacies;
CREATE POLICY "Pharmacies all policy" ON public.pharmacies
  FOR ALL
  TO public, anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 2. TABLE PUBLIC.PHARMACIES_PENDING
CREATE TABLE IF NOT EXISTS public.pharmacies_pending (
  id TEXT PRIMARY KEY,
  nom TEXT NOT NULL,
  quartier TEXT,
  adresse TEXT,
  phone TEXT,
  titulaire TEXT,
  numero_ordre TEXT,
  piece_url TEXT,
  photo_url TEXT,
  email_pro TEXT,
  mot_de_passe TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  statut TEXT DEFAULT 'pending',
  status TEXT DEFAULT 'pending',
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT
);

ALTER TABLE public.pharmacies_pending
  ADD COLUMN IF NOT EXISTS statut TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS email_pro TEXT,
  ADD COLUMN IF NOT EXISTS mot_de_passe TEXT,
  ADD COLUMN IF NOT EXISTS piece_url TEXT,
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

DO $$
BEGIN
  ALTER TABLE public.pharmacies_pending ALTER COLUMN quartier DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE public.pharmacies_pending ALTER COLUMN phone DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE public.pharmacies_pending ALTER COLUMN titulaire DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE public.pharmacies_pending ALTER COLUMN numero_ordre DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.pharmacies_pending ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pending_insert_public" ON public.pharmacies_pending;
DROP POLICY IF EXISTS "pending_admin_manage" ON public.pharmacies_pending;
DROP POLICY IF EXISTS "Pharmacies pending all policy" ON public.pharmacies_pending;
CREATE POLICY "Pharmacies pending all policy" ON public.pharmacies_pending
  FOR ALL
  TO public, anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 3. TABLE PUBLIC.PRE_INSCRIPTIONS
CREATE TABLE IF NOT EXISTS public.pre_inscriptions (
  id TEXT PRIMARY KEY DEFAULT ('pre-' || floor(extract(epoch from now()))::text || '-' || substr(md5(random()::text), 1, 6)),
  nom_pharmacie TEXT NOT NULL,
  telephone TEXT NOT NULL,
  email TEXT,
  quartier TEXT,
  adresse TEXT,
  titulaire TEXT,
  numero_ordre TEXT,
  montant NUMERIC DEFAULT 25000,
  statut TEXT DEFAULT 'en_attente',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.pre_inscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Pre inscriptions all policy" ON public.pre_inscriptions;
CREATE POLICY "Pre inscriptions all policy" ON public.pre_inscriptions
  FOR ALL
  TO public, anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 4. TABLE PUBLIC.ABONNEMENTS
CREATE TABLE IF NOT EXISTS public.abonnements (
  id TEXT PRIMARY KEY DEFAULT ('sub-' || floor(extract(epoch from now()))::text || '-' || substr(md5(random()::text), 1, 6)),
  entreprise_id TEXT,
  pharmacie_id TEXT,
  nom_pharmacie TEXT,
  telephone TEXT,
  email TEXT,
  montant NUMERIC DEFAULT 25000,
  plan TEXT DEFAULT 'enregistrement_25k',
  statut TEXT DEFAULT 'en_attente',
  code_validation TEXT,
  date_debut TIMESTAMPTZ DEFAULT NOW(),
  expire_le TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.abonnements
  ADD COLUMN IF NOT EXISTS entreprise_id TEXT,
  ADD COLUMN IF NOT EXISTS pharmacie_id TEXT,
  ADD COLUMN IF NOT EXISTS nom_pharmacie TEXT,
  ADD COLUMN IF NOT EXISTS telephone TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS code_validation TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Supprimer l'éventuelle FK bloquante sur pharmacie_id avant création de la pharmacie
ALTER TABLE public.abonnements DROP CONSTRAINT IF EXISTS abonnements_pharmacie_id_fkey;

ALTER TABLE public.abonnements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "abonnements_read_owner_admin" ON public.abonnements;
DROP POLICY IF EXISTS "abonnements_write_admin_only" ON public.abonnements;
DROP POLICY IF EXISTS "Abonnements all policy" ON public.abonnements;
CREATE POLICY "Abonnements all policy" ON public.abonnements
  FOR ALL
  TO public, anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 5. TABLE PUBLIC.CLIENTS
CREATE TABLE IF NOT EXISTS public.clients (
  id TEXT PRIMARY KEY DEFAULT ('cli-' || floor(extract(epoch from now()))::text || '-' || substr(md5(random()::text), 1, 6)),
  nom TEXT NOT NULL,
  numero TEXT,
  numero_whatsapp TEXT,
  date_inscription TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS numero TEXT,
  ADD COLUMN IF NOT EXISTS numero_whatsapp TEXT,
  ADD COLUMN IF NOT EXISTS date_inscription TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DO $$
BEGIN
  ALTER TABLE public.clients ALTER COLUMN numero_whatsapp DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Clients read policy" ON public.clients;
DROP POLICY IF EXISTS "Clients insert policy" ON public.clients;
DROP POLICY IF EXISTS "Clients update policy" ON public.clients;
DROP POLICY IF EXISTS "Clients all policy" ON public.clients;
CREATE POLICY "Clients all policy" ON public.clients
  FOR ALL
  TO public, anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 6. TABLE PUBLIC.CONVERSATIONS
CREATE TABLE IF NOT EXISTS public.conversations (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  pharmacy_id TEXT NOT NULL,
  pharmacy_user_id TEXT,
  last_message TEXT DEFAULT '',
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
DROP POLICY IF EXISTS "Conversations access policy" ON public.conversations;
DROP POLICY IF EXISTS "Conversations all policy" ON public.conversations;
CREATE POLICY "Conversations all policy" ON public.conversations
  FOR ALL
  TO public, anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 7. TABLE PUBLIC.MESSAGES
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

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS sender_id TEXT,
  ADD COLUMN IF NOT EXISTS receiver_id TEXT,
  ADD COLUMN IF NOT EXISTS sender_type TEXT,
  ADD COLUMN IF NOT EXISTS content TEXT,
  ADD COLUMN IF NOT EXISTS audio_duration INTEGER,
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "messages_select_public" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_public" ON public.messages;
DROP POLICY IF EXISTS "messages_delete_cleanup" ON public.messages;
DROP POLICY IF EXISTS "Messages access policy" ON public.messages;
DROP POLICY IF EXISTS "Messages all policy" ON public.messages;
CREATE POLICY "Messages all policy" ON public.messages
  FOR ALL
  TO public, anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 8. TABLE PUBLIC.UTILISATEURS
CREATE TABLE IF NOT EXISTS public.utilisateurs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID,
  email TEXT,
  nom TEXT,
  role TEXT DEFAULT 'client',
  telephone TEXT,
  pharmacie_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.utilisateurs DROP CONSTRAINT IF EXISTS utilisateurs_pharmacie_id_fkey;
ALTER TABLE public.utilisateurs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Utilisateurs access policy" ON public.utilisateurs;
DROP POLICY IF EXISTS "Utilisateurs all policy" ON public.utilisateurs;
CREATE POLICY "Utilisateurs all policy" ON public.utilisateurs
  FOR ALL
  TO public, anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 9. TABLE PUBLIC.USERS
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID,
  email TEXT,
  nom TEXT,
  role TEXT DEFAULT 'client',
  telephone TEXT,
  pharmacie_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users all policy" ON public.users;
CREATE POLICY "Users all policy" ON public.users
  FOR ALL
  TO public, anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 10. DROITS EXPLICITES POUR ANON & AUTHENTICATED (comme user_consents)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.user_consents,
  public.pharmacies,
  public.pharmacies_pending,
  public.pre_inscriptions,
  public.abonnements,
  public.clients,
  public.conversations,
  public.messages,
  public.utilisateurs,
  public.users
TO anon, authenticated;

-- 11. REALTIME SUR TOUTES LES TABLES
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.pharmacies; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.pharmacies_pending; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.pre_inscriptions; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.abonnements; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.clients; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.messages; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.utilisateurs; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.users; EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END $$;
