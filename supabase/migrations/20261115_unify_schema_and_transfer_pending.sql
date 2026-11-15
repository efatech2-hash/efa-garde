-- ==============================================================================
-- EFA GARDE - CORRECTION SCHÉMA RÉEL & TRANSFERT Kkk (100% IDEMPOTENT)
-- 1. Transférer Kkk de pharmacies_pending -> pharmacies (nouvel uuid, is_active=true, is_verified=true, is_garde=false)
-- 2. Mettre Efa dans pharmacies: is_verified=true, is_garde=false
-- 3. Corriger view_pharmacies_garde: afficher pharmacies WHERE is_active=true (sans exiger is_verified=true ni is_garde=true)
-- 4. Unifier pharmacies_pending: garder uniquement status (supprimer statut), id en UUID DEFAULT gen_random_uuid()
-- 5. Marquer les lignes pending déjà validées/transférées comme 'transferred' (pas de doublon)
-- 6. Vérifier abonnements: jointure par pharmacy_id UUID
-- 7. Ne pas créer de table gardes, ne pas modifier les autres tables
-- ==============================================================================

-- Assurer les colonnes attendues sur public.pharmacies sans toucher aux autres tables
ALTER TABLE public.pharmacies
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_garde BOOLEAN DEFAULT false;

-- 1. Transférer Kkk de pharmacies_pending vers pharmacies avec nouvel UUID (sans dupliquer Efa)
INSERT INTO public.pharmacies (
  id,
  nom,
  phone,
  adresse,
  quartier,
  lat,
  lng,
  email_pro,
  is_active,
  is_verified,
  is_garde,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  p.nom,
  p.phone,
  COALESCE(p.adresse, ''),
  COALESCE(p.quartier, 'Lomé'),
  COALESCE(p.lat, 6.1319),
  COALESCE(p.lng, 1.2228),
  p.email_pro,
  true,
  true,
  false,
  COALESCE(p.created_at, NOW()),
  NOW()
FROM public.pharmacies_pending p
WHERE (p.nom ILIKE 'Kkk%' OR p.phone = '93289162')
  AND NOT EXISTS (
    SELECT 1
    FROM public.pharmacies ph
    WHERE ph.phone = p.phone
  );

-- 2. Mettre Efa dans pharmacies: is_verified=true, is_garde=false
UPDATE public.pharmacies
SET
  is_verified = true,
  is_garde = false,
  is_active = true,
  updated_at = NOW()
WHERE phone = '96100972'
   OR id = 'e8be03d7-d881-428d-bdc5-bfec5b26d2f0'::uuid;

-- 3. Corriger view_pharmacies_garde : afficher pharmacies où is_active = true
-- (Ne pas exiger is_verified=true pour afficher sur la carte ; garder is_garde comme info)
DROP VIEW IF EXISTS public.view_pharmacies_garde;
CREATE VIEW public.view_pharmacies_garde AS
SELECT *
FROM public.pharmacies
WHERE is_active = true;

GRANT SELECT ON public.view_pharmacies_garde TO anon, authenticated, public;

-- 4 & 5. Unifier pharmacies_pending: status uniquement + id UUID + marquer transférées
ALTER TABLE public.pharmacies_pending
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pharmacies_pending'
      AND column_name = 'statut'
  ) THEN
    UPDATE public.pharmacies_pending
    SET status = COALESCE(NULLIF(status, ''), NULLIF(statut, ''), 'pending');

    ALTER TABLE public.pharmacies_pending DROP CONSTRAINT IF EXISTS pharmacies_pending_statut_check;
    ALTER TABLE public.pharmacies_pending DROP COLUMN IF EXISTS statut;
  END IF;
END $$;

-- Convertir pharmacies_pending.id en UUID avec DEFAULT gen_random_uuid()
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pharmacies_pending'
      AND column_name = 'id'
      AND data_type <> 'uuid'
  ) THEN
    ALTER TABLE public.pharmacies_pending ALTER COLUMN id DROP DEFAULT;

    UPDATE public.pharmacies_pending
    SET id = gen_random_uuid()::text
    WHERE id IS NULL
       OR id !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

    ALTER TABLE public.pharmacies_pending
      ALTER COLUMN id TYPE UUID USING id::uuid;
  END IF;

  ALTER TABLE public.pharmacies_pending
    ALTER COLUMN id SET DEFAULT gen_random_uuid();
END $$;

-- Marquer Kkk, Efa et les lignes déjà validées comme transférées (pas de doublon en file d'attente)
UPDATE public.pharmacies_pending
SET
  status = 'transferred',
  reviewed_at = COALESCE(reviewed_at, NOW())
WHERE phone IN ('93289162', '96100972')
   OR status IN ('valide', 'approved');

-- 6. Abonnements : jointure par pharmacy_id UUID (pas par phone ni par id text pending)
ALTER TABLE public.abonnements
  ADD COLUMN IF NOT EXISTS pharmacy_id UUID REFERENCES public.pharmacies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_abonnements_pharmacy_id ON public.abonnements(pharmacy_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'abonnements'
      AND column_name = 'pharmacie_id'
  ) THEN
    UPDATE public.abonnements a
    SET pharmacy_id = ph.id
    FROM public.pharmacies ph
    WHERE a.pharmacy_id IS NULL
      AND a.pharmacie_id IS NOT NULL
      AND a.pharmacie_id::text ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      AND ph.id = a.pharmacie_id::uuid;
  END IF;
END $$;

-- VÉRIFICATION FINALE
SELECT COUNT(*) AS total_pharmacies FROM public.pharmacies;
SELECT COUNT(*) AS total_view_pharmacies_garde FROM public.view_pharmacies_garde;
SELECT nom, is_verified, is_garde FROM public.pharmacies;
