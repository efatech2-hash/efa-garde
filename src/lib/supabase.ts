import { createClient } from '@supabase/supabase-js';

const supabaseUrl: string =
  (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseKey: string =
  (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim();

if (!supabaseUrl || !supabaseKey) {
  console.warn('[EFA GARDE SÉCURITÉ] Configuration Supabase manquante dans les variables d\'environnement. Mode autonome actif.');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder-anon-key'
);
