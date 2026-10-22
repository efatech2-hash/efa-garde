import { supabase } from '../lib/supabase';

export interface UserConsentRecord {
  user_id: string;
  date: string;
  heure: string;
  ip: string;
  version: string;
  consent: boolean;
}

const LOCAL_STORAGE_CONSENT_KEY = 'efa_legal_consent_v1';
const LOCAL_STORAGE_CONSENT_RECORD_KEY = 'efa_user_consent_record_v1';
const LOCAL_STORAGE_USER_ID_KEY = 'efa_user_id';

/**
 * Récupère ou génère un ID utilisateur anonyme persistant
 */
export function getOrCreateUserId(): string {
  try {
    let uid = localStorage.getItem(LOCAL_STORAGE_USER_ID_KEY);
    if (!uid) {
      uid = 'usr_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem(LOCAL_STORAGE_USER_ID_KEY, uid);
    }
    return uid;
  } catch {
    return 'usr_guest_' + Date.now();
  }
}

/**
 * Vérification synchrone rapide dans localStorage
 */
export function hasUserConsentSync(): boolean {
  try {
    return localStorage.getItem(LOCAL_STORAGE_CONSENT_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Récupère l'adresse IP de l'utilisateur via api.ipify.org avec timeout de secours
 */
export async function fetchUserIp(): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500);

  try {
    const res = await fetch('https://api.ipify.org?format=json', {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      if (data && data.ip) {
        return String(data.ip);
      }
    }
  } catch (err) {
    console.warn('EFA GARDE ipify fetch notice (fallback utilisé):', err);
  } finally {
    clearTimeout(timeoutId);
  }

  return '127.0.0.1';
}

/**
 * Vérification asynchrone (localStorage en priorité + vérification Supabase table user_consents)
 */
export async function checkUserConsent(): Promise<boolean> {
  // 1. Check rapide localStorage
  if (hasUserConsentSync()) {
    return true;
  }

  // 2. Check distant Supabase table user_consents
  const userId = getOrCreateUserId();
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('user_consents')
        .select('consent')
        .eq('user_id', userId)
        .eq('consent', true)
        .limit(1);

      if (!error && data && data.length > 0 && data[0].consent) {
        // Enregistre en local pour éviter tout appel réseau ultérieur
        localStorage.setItem(LOCAL_STORAGE_CONSENT_KEY, 'true');
        return true;
      }
    }
  } catch (err) {
    console.warn('Vérification consent Supabase:', err);
  }

  return false;
}

/**
 * Enregistre le consentement légal de l'utilisateur:
 * - Sauvegarde dans localStorage
 * - Enregistre dans la table user_consents: user_id, date, heure, IP, version = "1.0", consent = true
 */
export async function saveUserConsent(): Promise<UserConsentRecord> {
  const userId = getOrCreateUserId();
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const heureStr = now.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  // Récupère l'IP via ipify
  const ip = await fetchUserIp();

  const record: UserConsentRecord = {
    user_id: userId,
    date: dateStr,
    heure: heureStr,
    ip,
    version: '1.0',
    consent: true,
  };

  // 1. Sauvegarde locale permanente
  try {
    localStorage.setItem(LOCAL_STORAGE_CONSENT_KEY, 'true');
    localStorage.setItem(LOCAL_STORAGE_CONSENT_RECORD_KEY, JSON.stringify(record));
  } catch (err) {
    console.error('Erreur stockage local consent:', err);
  }

  // 2. Insertion dans table Supabase user_consents
  try {
    if (supabase) {
      await supabase.from('user_consents').insert([
        {
          user_id: record.user_id,
          date: record.date,
          heure: record.heure,
          ip: record.ip,
          version: record.version,
          consent: record.consent,
        },
      ]);
    }
  } catch (err) {
    console.warn('Insertion Supabase user_consents notice (mode autonome actif):', err);
  }

  return record;
}
