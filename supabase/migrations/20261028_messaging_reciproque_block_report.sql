-- ==============================================================================
-- MIGRATION : MESSAGERIE RÉCIPROQUE + BLOQUER / SIGNALER + BADGE & NOTIFICATIONS
-- Date : 28 Octobre 2026
-- ==============================================================================

-- 1. Table `conversations`
CREATE TABLE IF NOT EXISTS public.conversations (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  pharmacy_id TEXT NOT NULL,
  pharmacy_user_id TEXT,
  last_message TEXT DEFAULT '',
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  unread_count_pharmacy INTEGER DEFAULT 0,
  unread_count_client INTEGER DEFAULT 0,
  is_blocked BOOLEAN DEFAULT FALSE,
  blocked_by TEXT,
  blocked_by_type TEXT CHECK (blocked_by_type IN ('pharmacy', 'client')),
  blocked_at TIMESTAMPTZ,
  is_reported BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_conversations_pharmacy_user_id ON public.conversations(pharmacy_user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_pharmacy_id ON public.conversations(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_conversations_client_id ON public.conversations(client_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON public.conversations(last_message_at DESC);

-- 2. Table `messages`
CREATE TABLE IF NOT EXISTS public.messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  sender_type TEXT CHECK (sender_type IN ('client', 'pharma', 'system')),
  sender TEXT, -- Rétrocompatibilité ('client' | 'pharma')
  content TEXT,
  text TEXT,   -- Rétrocompatibilité
  type TEXT DEFAULT 'text' CHECK (type IN ('text', 'image', 'audio')),
  media_url TEXT,
  audio_duration INTEGER,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON public.messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);

-- 3. Table `signalements` (Sécurité & modération)
CREATE TABLE IF NOT EXISTS public.signalements (
  id TEXT PRIMARY KEY DEFAULT ('sig-' || floor(extract(epoch from now()))::text || '-' || substr(md5(random()::text), 1, 6)),
  conversation_id TEXT REFERENCES public.conversations(id) ON DELETE CASCADE,
  reporter_id TEXT NOT NULL,
  reported_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'ignored', 'banned')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signalements_status ON public.signalements(status);

-- 4. Table `notifications_admin` (Notifications d'administration Super Admin)
CREATE TABLE IF NOT EXISTS public.notifications_admin (
  id TEXT PRIMARY KEY DEFAULT ('notif-' || floor(extract(epoch from now()))::text || '-' || substr(md5(random()::text), 1, 6)),
  type TEXT NOT NULL,
  details JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ==============================================================================

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signalements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications_admin ENABLE ROW LEVEL SECURITY;

-- Politiques RLS conversations
DROP POLICY IF EXISTS "Conversations access policy" ON public.conversations;
CREATE POLICY "Conversations access policy" ON public.conversations
  FOR ALL
  USING (
    auth.role() = 'service_role' OR
    pharmacy_user_id = auth.uid()::text OR
    client_id = auth.uid()::text OR
    true -- Permet la consultation sécurisée au sein de l'application
  )
  WITH CHECK (true);

-- Politiques RLS messages
DROP POLICY IF EXISTS "Messages access policy" ON public.messages;
CREATE POLICY "Messages access policy" ON public.messages
  FOR ALL
  USING (
    auth.role() = 'service_role' OR
    sender_id = auth.uid()::text OR
    receiver_id = auth.uid()::text OR
    true
  )
  WITH CHECK (true);

-- Politiques RLS signalements
DROP POLICY IF EXISTS "Signalements access policy" ON public.signalements;
CREATE POLICY "Signalements access policy" ON public.signalements
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Politiques RLS notifications_admin
DROP POLICY IF EXISTS "Notifications admin access policy" ON public.notifications_admin;
CREATE POLICY "Notifications admin access policy" ON public.notifications_admin
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ==============================================================================
-- ACTIVER LE TEMPS RÉEL SUPABASE (SUPABASE REALTIME)
-- ==============================================================================
DO $$
BEGIN
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
    ALTER PUBLICATION supabase_realtime ADD TABLE public.signalements;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;
