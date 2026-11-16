-- ==============================================================================
-- EFA GARDE - FIX 4 BUGS : RLS UPDATES, VUE CARTE, ABONNEMENTS & MESSAGERIE
-- - Ne modifie pas `is_garde` comme filtre bloquant
-- - Autorise SELECT, INSERT, UPDATE sur `abonnements`, `pharmacies`,
--   `conversations`, `messages` pour `anon` et `authenticated`
-- - Corrige `view_pharmacies_garde` (is_active = true)
-- ==============================================================================

-- 1. PHARMACIES : colonnes attendues + RLS complète (SELECT, INSERT, UPDATE, DELETE)
ALTER TABLE public.pharmacies
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_garde BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_registered BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS etoile_doree BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_always_visible BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 999,
  ADD COLUMN IF NOT EXISTS badge TEXT,
  ADD COLUMN IF NOT EXISTS prix INTEGER DEFAULT 25000,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'basic',
  ADD COLUMN IF NOT EXISTS subscription_start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_end_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_end TEXT,
  ADD COLUMN IF NOT EXISTS subscription_days_left INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.pharmacies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Pharmacies all policy" ON public.pharmacies;
DROP POLICY IF EXISTS "pharmacies_select_public" ON public.pharmacies;
DROP POLICY IF EXISTS "pharmacies_update_all" ON public.pharmacies;
CREATE POLICY "Pharmacies all policy" ON public.pharmacies
  FOR ALL
  TO public, anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 2. VUE CARTE PUBLIQUE : `view_pharmacies_garde` (is_active = true, sans bloquer sur is_verified/is_garde/lat)
CREATE OR REPLACE VIEW public.view_pharmacies_garde AS
SELECT *
FROM public.pharmacies
WHERE is_active = true;

GRANT SELECT ON public.view_pharmacies_garde TO anon, authenticated;

-- 3. ABONNEMENTS : harmonisation pharmacie_id + pharmacy_id + RLS UPDATE complète
ALTER TABLE public.abonnements
  ADD COLUMN IF NOT EXISTS pharmacie_id TEXT,
  ADD COLUMN IF NOT EXISTS pharmacy_id TEXT,
  ADD COLUMN IF NOT EXISTS entreprise_id TEXT,
  ADD COLUMN IF NOT EXISTS nom_pharmacie TEXT,
  ADD COLUMN IF NOT EXISTS telephone TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'enregistrement_25k',
  ADD COLUMN IF NOT EXISTS montant NUMERIC DEFAULT 25000,
  ADD COLUMN IF NOT EXISTS statut TEXT DEFAULT 'en_attente',
  ADD COLUMN IF NOT EXISTS code_validation TEXT,
  ADD COLUMN IF NOT EXISTS date_debut TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS expire_le TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.abonnements DROP CONSTRAINT IF EXISTS abonnements_pharmacie_id_fkey;
ALTER TABLE public.abonnements DROP CONSTRAINT IF EXISTS abonnements_pharmacy_id_fkey;

ALTER TABLE public.abonnements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Abonnements all policy" ON public.abonnements;
DROP POLICY IF EXISTS "abonnements_update_all" ON public.abonnements;
CREATE POLICY "Abonnements all policy" ON public.abonnements
  FOR ALL
  TO public, anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 4. CONVERSATIONS & MESSAGES (Messagerie réciproque Super Admin <-> Pharmacie & Client <-> Pharmacie)
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS pharmacie_id TEXT,
  ADD COLUMN IF NOT EXISTS pharmacy_id TEXT,
  ADD COLUMN IF NOT EXISTS pharmacy_user_id TEXT,
  ADD COLUMN IF NOT EXISTS admin_id TEXT,
  ADD COLUMN IF NOT EXISTS last_message TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS unread_count_pharmacy INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unread_count_client INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_reported BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_pharmacy_id_fkey;
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_pharmacie_id_fkey;
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_client_id_fkey;

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Conversations all policy" ON public.conversations;
CREATE POLICY "Conversations all policy" ON public.conversations
  FOR ALL
  TO public, anon, authenticated
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS sender_id TEXT,
  ADD COLUMN IF NOT EXISTS receiver_id TEXT,
  ADD COLUMN IF NOT EXISTS sender_type TEXT,
  ADD COLUMN IF NOT EXISTS sender TEXT,
  ADD COLUMN IF NOT EXISTS content TEXT,
  ADD COLUMN IF NOT EXISTS text TEXT,
  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS media_url TEXT,
  ADD COLUMN IF NOT EXISTS audio_duration INTEGER,
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours');

ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_receiver_id_fkey;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Messages all policy" ON public.messages;
CREATE POLICY "Messages all policy" ON public.messages
  FOR ALL
  TO public, anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 5. DROITS EXPLICITES
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.pharmacies,
  public.abonnements,
  public.conversations,
  public.messages
TO anon, authenticated;

-- 6. REALTIME PUBLICATION
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.pharmacies; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.abonnements; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.messages; EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END $$;
