-- ==============================================================================
-- EFA GARDE - TABLE PERSISTANTE `garde_planning` (ZERO LOCALSTORAGE)
-- Stocke toutes les gardes planifiées dans Supabase pour résister au vidage de cache,
-- changement d'appareil et coupures.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.garde_planning (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id UUID NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  date_debut TIMESTAMPTZ NOT NULL,
  date_fin TIMESTAMPTZ NOT NULL,
  type_garde TEXT NOT NULL DEFAULT '24h',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_garde_planning_pharmacy_id
  ON public.garde_planning(pharmacy_id);

CREATE INDEX IF NOT EXISTS idx_garde_planning_window
  ON public.garde_planning(date_debut, date_fin);

-- RLS complète (SELECT, INSERT, UPDATE, DELETE) pour anon & authenticated
ALTER TABLE public.garde_planning ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "garde_planning_all_policy" ON public.garde_planning;
CREATE POLICY "garde_planning_all_policy" ON public.garde_planning
  FOR ALL
  TO public, anon, authenticated
  USING (true)
  WITH CHECK (true);

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.garde_planning TO anon, authenticated;

-- Activation Realtime pour synchronisation instantanée Pharmacie <-> Carte Client
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.garde_planning;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;
