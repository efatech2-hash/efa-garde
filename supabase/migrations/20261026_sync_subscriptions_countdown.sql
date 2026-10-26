-- =========================================================================
-- EFA GARDE - SYNCHRONISATION COMPTE À REBOURS ABONNEMENT DB -> CLIENT
-- 1. Table pharmacies (schema public et garde si applicable) :
--    - subscription_plan (enum / text : 'basic', 'premium')
--    - subscription_status (text : 'active', 'inactive')
--    - subscription_start_at (timestamptz)
--    - subscription_end_at (timestamptz)
--    - subscription_days_left (integer)
-- 2. Mise à jour de la réplication Realtime pour la table pharmacies
-- 3. Fonction SQL / Cron sécurité daily pour expirer les abonnements échus
-- =========================================================================

-- 1. Colonnes sur public.pharmacies
ALTER TABLE IF EXISTS public.pharmacies
  ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'basic',
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS subscription_start_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS subscription_end_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_days_left INTEGER;

-- Rétrocompatibilité : synchroniser subscription_end_at avec subscription_end existant
UPDATE public.pharmacies
SET
  subscription_end_at = subscription_end::timestamptz,
  subscription_status = CASE
    WHEN subscription_end IS NOT NULL AND subscription_end::timestamptz > NOW() THEN 'active'
    ELSE 'inactive'
  END,
  subscription_plan = CASE
    WHEN is_premium = true OR etoile_doree = true OR plan IN ('populaire_mensuel', 'populaire_annuel', 'top') THEN 'premium'
    ELSE 'basic'
  END,
  subscription_days_left = CASE
    WHEN subscription_end IS NOT NULL AND subscription_end::timestamptz > NOW() THEN
      CEIL(EXTRACT(EPOCH FROM (subscription_end::timestamptz - NOW())) / 86400)::integer
    ELSE 0
  END
WHERE subscription_end_at IS NULL AND subscription_end IS NOT NULL;

-- 2. Activation de Realtime sur la table pharmacies
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'pharmacies'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.pharmacies;
    END IF;
  END IF;
END $$;

-- 3. Fonction SQL de nettoyage automatique des abonnements échus (Cron quotidien)
CREATE OR REPLACE FUNCTION expire_overdue_subscriptions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.pharmacies
  SET
    subscription_status = 'inactive',
    is_active = false,
    subscription_days_left = 0
  WHERE
    subscription_status = 'active'
    AND subscription_end_at IS NOT NULL
    AND subscription_end_at < NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
