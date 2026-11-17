-- ==============================================================================
-- EFA GARDE - FIX CHAT RECIPROCITE (conversations + messages)
-- - Garantit les colonnes conversation_id, sender_id, pharmacy_id, client_id
-- - Politiques RLS permissives INSERT / SELECT / UPDATE / DELETE pour anon & authenticated
-- - Realtime activé avec REPLICA IDENTITY FULL sur conversations et messages
-- ==============================================================================

-- 1. TABLE CONVERSATIONS
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS client_id TEXT,
  ADD COLUMN IF NOT EXISTS pharmacy_id TEXT,
  ADD COLUMN IF NOT EXISTS pharmacie_id TEXT,
  ADD COLUMN IF NOT EXISTS pharmacy_user_id TEXT,
  ADD COLUMN IF NOT EXISTS admin_id TEXT,
  ADD COLUMN IF NOT EXISTS last_message TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS unread_count_pharmacy INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unread_count_client INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS blocked_by TEXT,
  ADD COLUMN IF NOT EXISTS blocked_by_type TEXT,
  ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_reported BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_pharmacy_id_fkey;
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_pharmacie_id_fkey;
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_client_id_fkey;

CREATE INDEX IF NOT EXISTS idx_conversations_pharmacy_id ON public.conversations(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_conversations_client_id ON public.conversations(client_id);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Conversations access policy" ON public.conversations;
DROP POLICY IF EXISTS "Conversations all policy" ON public.conversations;
DROP POLICY IF EXISTS "conversations_select_public" ON public.conversations;
DROP POLICY IF EXISTS "conversations_insert_public" ON public.conversations;
DROP POLICY IF EXISTS "conversations_update_public" ON public.conversations;
CREATE POLICY "Conversations all policy" ON public.conversations
  FOR ALL
  TO public, anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 2. TABLE MESSAGES
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS conversation_id TEXT,
  ADD COLUMN IF NOT EXISTS pharmacy_id TEXT,
  ADD COLUMN IF NOT EXISTS client_id TEXT,
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
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours');

ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_receiver_id_fkey;
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_pharmacy_id_fkey;
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_client_id_fkey;

DO $$
BEGIN
  ALTER TABLE public.messages ALTER COLUMN sender DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_pharmacy_id ON public.messages(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_messages_client_id ON public.messages(client_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);

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

-- 3. DROITS EXPLICITES
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.conversations,
  public.messages
TO anon, authenticated;

-- 4. REALTIME ACTIVATION
ALTER TABLE public.conversations REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.messages; EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END $$;
