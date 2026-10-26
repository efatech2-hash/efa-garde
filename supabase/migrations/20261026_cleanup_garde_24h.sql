-- =========================================================================
-- EFA GARDE - NETTOYAGE AUTOMATIQUE 24H & GESTION STORAGE BUCKETS
-- 1. Compression photo (max 500ko / format webp)
-- 2. Suppression auto 24h messages + photos (Cron toutes les 1h)
-- 3. Configuration des buckets garde-photo & garde-ordonnances (max 500ko, RLS delete)
-- =========================================================================

-- 1. Configuration des Buckets Supabase Storage
-- Bucket garde-photo : max 500 Ko (524288 octets)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'garde-photo',
  'garde-photo',
  true,
  524288, -- 500 Ko max
  ARRAY['image/webp', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 524288,
  allowed_mime_types = ARRAY['image/webp', 'image/jpeg', 'image/png'],
  public = true;

-- Bucket garde-ordonnances : max 500 Ko (524288 octets)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'garde-ordonnances',
  'garde-ordonnances',
  true,
  524288, -- 500 Ko max
  ARRAY['image/webp', 'image/jpeg', 'image/png', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 524288,
  allowed_mime_types = ARRAY['image/webp', 'image/jpeg', 'image/png', 'application/pdf'],
  public = true;

-- 2. Activation RLS et politiques DELETE sur storage.objects pour garde-ordonnances & garde-photo
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "garde_ordonnances_delete_policy" ON storage.objects;
CREATE POLICY "garde_ordonnances_delete_policy"
ON storage.objects FOR DELETE
TO public, anon, authenticated
USING (bucket_id IN ('garde-ordonnances', 'garde-photo', 'chat-media'));

DROP POLICY IF EXISTS "garde_ordonnances_select_policy" ON storage.objects;
CREATE POLICY "garde_ordonnances_select_policy"
ON storage.objects FOR SELECT
TO public, anon, authenticated
USING (bucket_id IN ('garde-ordonnances', 'garde-photo', 'chat-media'));

DROP POLICY IF EXISTS "garde_ordonnances_insert_policy" ON storage.objects;
CREATE POLICY "garde_ordonnances_insert_policy"
ON storage.objects FOR INSERT
TO public, anon, authenticated
WITH CHECK (bucket_id IN ('garde-ordonnances', 'garde-photo', 'chat-media'));

-- 3. Fonction SQL de nettoyage automatique 24h
CREATE OR REPLACE FUNCTION cleanup_garde_24h()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_messages int := 0;
  v_deleted_storage int := 0;
BEGIN
  -- A. Suppression des messages de plus de 24h dans le schema garde (si existant)
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'garde') THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'garde' AND table_name = 'messages') THEN
      EXECUTE 'DELETE FROM garde.messages WHERE created_at < NOW() - INTERVAL ''24 hours''';
      GET DIAGNOSTICS v_deleted_messages = ROW_COUNT;
    END IF;
  END IF;

  -- B. Suppression des messages de plus de 24h dans public.messages
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'messages') THEN
    DELETE FROM public.messages WHERE created_at < NOW() - INTERVAL '24 hours';
  END IF;

  -- C. Suppression des photos et ordonnances de plus de 24h dans storage.objects
  DELETE FROM storage.objects
  WHERE bucket_id IN ('garde-ordonnances', 'garde-photo', 'chat-media')
    AND created_at < NOW() - INTERVAL '24 hours';
  GET DIAGNOSTICS v_deleted_storage = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_messages', v_deleted_messages,
    'deleted_storage', v_deleted_storage,
    'executed_at', NOW()
  );
END;
$$;

-- 4. Planification du cron job Supabase (pg_cron) : tourne toutes les 1h ('0 * * * *')
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Déprogrammer si déjà existant
    PERFORM cron.unschedule('cleanup-garde-every-hour');
    -- Programmer toutes les heures
    PERFORM cron.schedule('cleanup-garde-every-hour', '0 * * * *', 'SELECT cleanup_garde_24h();');
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Continuer si pg_cron requiert une activation préalable dans le dashboard Supabase
    RAISE NOTICE 'pg_cron planification info: %', SQLERRM;
END;
$$;
