import { createClient, SupabaseClient } from '@supabase/supabase-js';

function resolveSupabaseConfig(): { url: string; anonKey: string } {
  let url = (
    import.meta.env.VITE_SUPABASE_URL ||
    (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
    ''
  ).trim();

  let anonKey = (
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    (typeof process !== 'undefined' && (process.env?.VITE_SUPABASE_ANON_KEY || process.env?.VITE_SUPABASE_PUBLISHABLE_KEY)) ||
    ''
  ).trim();

  // Si pas dans l'environnement, vérifier localStorage (secours)
  if ((!url || !anonKey) && typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('efa_supabase_config_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.url && parsed.anonKey) {
          url = parsed.url.trim();
          anonKey = parsed.anonKey.trim();
        }
      }
    } catch {}
  }

  return { url, anonKey };
}

const { url: supabaseUrl, anonKey: supabaseKey } = resolveSupabaseConfig();

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseKey &&
  !supabaseUrl.includes('placeholder.supabase.co') &&
  !supabaseKey.includes('placeholder-anon-key')
);

if (!isSupabaseConfigured) {
  console.warn(
    '[EFA GARDE SUPABASE] Variables VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquantes dans l\'environnement. Configuration de secours active.'
  );
}

export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);

export function getSupabase(): SupabaseClient {
  return supabase;
}

