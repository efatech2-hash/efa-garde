import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Pharmacie, Garde, Conversation, Message, PresenceState, PlanType, PharmaciePending, Pub, PharmacyDailyStat } from '../types';
import { INITIAL_PHARMACIES, INITIAL_PUBS } from './seedData';
import { supabase } from '../lib/supabase';
import { validateUploadedFile } from '../utils/security';

const LOCAL_STORAGE_PHARMACIES = 'efa_pharmacies_v1';
const LOCAL_STORAGE_GARDES = 'efa_gardes_v1';
const LOCAL_STORAGE_CONVERSATIONS = 'efa_conversations_v1';
const LOCAL_STORAGE_MESSAGES = 'efa_messages_v1';
const LOCAL_STORAGE_SUPABASE_CONFIG = 'efa_supabase_config_v1';
const LOCAL_STORAGE_STATS = 'efa_pharmacy_stats_v1';

// BroadcastChannel for cross-tab realtime synchronization
const realtimeBus = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('efa_garde_realtime_bus')
  : null;

// Local event emitter for intra-page reactivity
type Listener = () => void;
const listeners = new Set<Listener>();
function notifyChange() {
  listeners.forEach(fn => fn());
  if (realtimeBus) {
    try {
      realtimeBus.postMessage({ type: 'SYNC' });
    } catch {
      // ignore
    }
  }
}

if (realtimeBus) {
  realtimeBus.onmessage = (event) => {
    if (event.data?.type === 'SYNC') {
      listeners.forEach(fn => fn());
    }
  };
}

export function subscribeToStore(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

// Presence tracking bus
const presenceBus = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('efa_garde_presence_bus')
  : null;

interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export function getStoredSupabaseConfig(): SupabaseConfig {
  const envUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim();
  
  if (envUrl && envKey) {
    return { url: envUrl, anonKey: envKey };
  }

  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SUPABASE_CONFIG);
    if (raw) return JSON.parse(raw);
  } catch {
    // fallback
  }
  return { url: '', anonKey: '' };
}

export function saveSupabaseConfig(url: string, anonKey: string) {
  localStorage.setItem(LOCAL_STORAGE_SUPABASE_CONFIG, JSON.stringify({ url, anonKey }));
  notifyChange();
}

let activeSupabaseClient: SupabaseClient | null = null;
export function getSupabaseClient(): SupabaseClient | null {
  const config = getStoredSupabaseConfig();
  if (config.url && config.anonKey) {
    if (!activeSupabaseClient) {
      activeSupabaseClient = createClient(config.url, config.anonKey);
    }
    return activeSupabaseClient;
  }
  return supabase;
}

/* ===============================
   Local fallback / Hybrid helpers
   =============================== */

export function loadPharmacies(): Pharmacie[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_PHARMACIES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const uniqueMap = new Map<string, Pharmacie>();
        for (const p of parsed) {
          if (!p || !p.id) continue;
          if (uniqueMap.has(p.id)) continue; // ignore duplicate keys

          const seed = INITIAL_PHARMACIES.find((ip) => ip.id === p.id || ip.nom === p.nom);
          let lat = seed ? seed.lat : p.lat;
          let lng = seed ? seed.lng : p.lng;

          if (!lat || !lng || isNaN(lat) || isNaN(lng) || lat < 6.12) {
            console.warn(`[Geo] Coordonnées dans l'océan ou invalides pour ${p.nom}, repositionnement à Lomé`);
            lat = seed?.lat || 6.1319;
            lng = seed?.lng || 1.2228;
          }

          uniqueMap.set(p.id, {
            ...p,
            nom: seed?.nom || p.nom,
            adresse: seed?.adresse || p.adresse,
            lat,
            lng,
          });
        }
        const result = Array.from(uniqueMap.values());
        const sorted = sortPharmaciesPriority(result);
        // Clean localStorage if duplicates were present
        if (sorted.length !== parsed.length) {
          localStorage.setItem(LOCAL_STORAGE_PHARMACIES, JSON.stringify(sorted));
        }
        return sorted;
      }
    }
  } catch {
    // ignore
  }
  // Initialize with seed data
  const initialSorted = sortPharmaciesPriority(INITIAL_PHARMACIES);
  localStorage.setItem(LOCAL_STORAGE_PHARMACIES, JSON.stringify(initialSorted));
  return initialSorted;
}

export function sortPharmaciesPriority(list: Pharmacie[]): Pharmacie[] {
  return [...list].sort((a, b) => {
    const isPopA = Boolean(
      a.is_premium ||
        a.etoile_doree ||
        a.plan === 'populaire_mensuel' ||
        a.plan === 'populaire_annuel'
    );
    const isPopB = Boolean(
      b.is_premium ||
        b.etoile_doree ||
        b.plan === 'populaire_mensuel' ||
        b.plan === 'populaire_annuel'
    );

    // 1. is_premium / POPULAIRE first
    if (isPopA && !isPopB) return -1;
    if (!isPopA && isPopB) return 1;

    // 2. position (asc, 0 is at top)
    const posA = a.position !== undefined ? a.position : 999;
    const posB = b.position !== undefined ? b.position : 999;
    if (posA !== posB) return posA - posB;

    // 3. etoile_doree (desc)
    if (a.etoile_doree && !b.etoile_doree) return -1;
    if (!a.etoile_doree && b.etoile_doree) return 1;

    // 4. alphabetical
    return a.nom.localeCompare(b.nom);
  });
}

/**
 * Charge les pharmacies depuis Supabase selon les privilèges officiels :
 * order('is_premium', {ascending:false})
 * order('position', {ascending:true})
 * order('etoile_doree', {ascending:false})
 */
export async function fetchPharmacies(): Promise<Pharmacie[]> {
  try {
    const client = getSupabaseClient();
    if (client) {
      const { data, error } = await client
        .from('pharmacies')
        .select('*')
        .order('is_premium', { ascending: false })
        .order('position', { ascending: true })
        .order('etoile_doree', { ascending: false });

      if (!error && data && Array.isArray(data) && data.length > 0) {
        const sorted = sortPharmaciesPriority(data as Pharmacie[]);
        savePharmacies(sorted);
        return sorted;
      }
    }
  } catch (err) {
    console.warn('[EFA GARDE] fetchPharmacies fallback:', err);
  }
  return loadPharmacies();
}

export function savePharmacies(list: Pharmacie[]) {
  const uniqueMap = new Map<string, Pharmacie>();
  for (const item of list) {
    if (item && item.id && !uniqueMap.has(item.id)) {
      uniqueMap.set(item.id, item);
    }
  }
  const cleanList = sortPharmaciesPriority(Array.from(uniqueMap.values()));
  localStorage.setItem(LOCAL_STORAGE_PHARMACIES, JSON.stringify(cleanList));
  notifyChange();
}

export function updatePharmacyStatus(pharmacieId: string, isOnline: boolean): Pharmacie | null {
  const list = loadPharmacies();
  const idx = list.findIndex(p => p.id === pharmacieId);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], is_online: isOnline };
  savePharmacies(list);
  return list[idx];
}

export function updatePharmacyPlan(pharmacieId: string, plan: PlanType): Pharmacie | null {
  const list = loadPharmacies();
  const idx = list.findIndex(p => p.id === pharmacieId);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], plan };
  savePharmacies(list);
  return list[idx];
}

export function updatePharmacySuperAdmin(
  pharmacieId: string,
  updates: Partial<Pharmacie>
): Pharmacie | null {
  const list = loadPharmacies();
  const idx = list.findIndex(p => p.id === pharmacieId);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...updates };
  savePharmacies(list);
  return list[idx];
}

export interface SubscriptionActivationOptions {
  planType: 'basic_90k' | 'premium_140k' | 'premium_15k';
  durationDays?: number;
}

/**
 * Active l'abonnement en Base de Données Supabase (Source unique de vérité)
 * Puis synchronise le cache local et notifie tous les écouteurs en temps réel.
 */
export async function activateSubscriptionInDB(
  pharmacyId: string,
  options: SubscriptionActivationOptions
): Promise<Pharmacie | null> {
  const { planType } = options;
  const now = new Date();
  const isPremium = planType === 'premium_140k' || planType === 'premium_15k';
  const durationDays = options.durationDays || (planType === 'premium_15k' ? 30 : 365);
  const end = new Date(now.getTime() + durationDays * 86400000);

  const updates: Partial<Pharmacie> = {
    subscription_plan: isPremium ? 'premium' : 'basic',
    subscription_status: 'active',
    subscription_start_at: now.toISOString(),
    subscription_end_at: end.toISOString(),
    subscription_end: end.toISOString(),
    subscription_days_left: durationDays,
    is_active: true,
    is_premium: isPremium,
    etoile_doree: isPremium,
    position: isPremium ? 0 : 1,
    is_always_visible: isPremium,
    badge: isPremium ? 'POPULAIRE' : undefined,
    plan: planType === 'premium_140k' ? 'populaire_annuel' : planType === 'premium_15k' ? 'populaire_mensuel' : 'annual',
    prix: planType === 'premium_140k' ? 140000 : planType === 'premium_15k' ? 15000 : 90000,
    statut: 'approved',
  };

  try {
    const client = getSupabaseClient();
    if (client) {
      const { error } = await client
        .from('pharmacies')
        .update(updates)
        .eq('id', pharmacyId);
      if (error) {
        console.warn('[EFA GARDE] Error updating pharmacy subscription in DB:', error);
      }
    }
  } catch (err) {
    console.warn('[EFA GARDE] Failed to update DB:', err);
  }

  const updated = updatePharmacySuperAdmin(pharmacyId, updates);
  notifyChange();
  return updated;
}

export async function fetchPharmacyById(id: string): Promise<Pharmacie | null> {
  try {
    const client = getSupabaseClient();
    if (client) {
      const { data, error } = await client
        .from('pharmacies')
        .select('*')
        .eq('id', id)
        .single();
      if (!error && data) {
        updatePharmacySuperAdmin(id, data as Pharmacie);
        return data as Pharmacie;
      }
    }
  } catch (err) {
    console.warn('[EFA GARDE] fetchPharmacyById fallback:', err);
  }
  const list = loadPharmacies();
  return list.find((p) => p.id === id) || null;
}

export function loadGardes(pharmacieId?: string): Garde[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_GARDES);
    let all: Garde[] = raw ? JSON.parse(raw) : [];
    if (!raw) {
      // Seed initial gardes for testing
      const now = new Date();
      const nextWeek = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
      all = [
        {
          id: 'garde-1',
          pharmacie_id: 'pharma-1',
          date_debut: now.toISOString(),
          date_fin: nextWeek.toISOString(),
        },
        {
          id: 'garde-2',
          pharmacie_id: 'pharma-2',
          date_debut: now.toISOString(),
          date_fin: nextWeek.toISOString(),
        },
        {
          id: 'garde-3',
          pharmacie_id: 'pharma-5',
          date_debut: now.toISOString(),
          date_fin: nextWeek.toISOString(),
        }
      ];
      localStorage.setItem(LOCAL_STORAGE_GARDES, JSON.stringify(all));
    }
    if (pharmacieId) {
      return all.filter(g => g.pharmacie_id === pharmacieId);
    }
    return all;
  } catch {
    return [];
  }
}

export function addGarde(garde: Omit<Garde, 'id'>): Garde {
  const all = loadGardes();
  const newGarde: Garde = {
    ...garde,
    id: 'garde-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6)
  };
  all.push(newGarde);
  localStorage.setItem(LOCAL_STORAGE_GARDES, JSON.stringify(all));
  notifyChange();
  return newGarde;
}

export function deleteGarde(id: string) {
  const all = loadGardes();
  const filtered = all.filter(g => g.id !== id);
  localStorage.setItem(LOCAL_STORAGE_GARDES, JSON.stringify(filtered));
  notifyChange();
}

export function isPharmacyCurrentlyOnDuty(pharmacieId: string): boolean {
  const gardes = loadGardes(pharmacieId);
  const now = new Date().getTime();
  return gardes.some(g => {
    const start = new Date(g.date_debut).getTime();
    const end = new Date(g.date_fin).getTime();
    return now >= start && now <= end;
  });
}

export function loadConversations(pharmacieId?: string, clientId?: string): Conversation[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_CONVERSATIONS);
    let all: Conversation[] = raw ? JSON.parse(raw) : [];
    if (!raw) {
      // Seed a starter conversation
      all = [
        {
          id: 'conv-pharma-1-client-demo',
          client_id: 'client-guest-1',
          pharmacie_id: 'pharma-1',
          last_message: 'Bonjour, avez-vous du Paracétamol 1000mg en stock ?',
          updated_at: new Date(Date.now() - 15 * 60 * 1000).toISOString()
        }
      ];
      localStorage.setItem(LOCAL_STORAGE_CONVERSATIONS, JSON.stringify(all));
    }
    if (pharmacieId) {
      return all.filter(c => c.pharmacie_id === pharmacieId);
    }
    if (clientId) {
      return all.filter(c => c.client_id === clientId);
    }
    return all;
  } catch {
    return [];
  }
}

export function getOrCreateConversation(clientId: string, pharmacieId: string): Conversation {
  const all = loadConversations();
  const existing = all.find(c => c.client_id === clientId && c.pharmacie_id === pharmacieId);
  if (existing) return existing;

  const newConv: Conversation = {
    id: `conv-${pharmacieId}-${clientId}`,
    client_id: clientId,
    pharmacie_id: pharmacieId,
    last_message: '',
    updated_at: new Date().toISOString()
  };
  all.unshift(newConv);
  localStorage.setItem(LOCAL_STORAGE_CONVERSATIONS, JSON.stringify(all));
  notifyChange();
  return newConv;
}

export const MS_24_HOURS = 24 * 60 * 60 * 1000;

export function isMessageExpired(m: Message): boolean {
  const now = Date.now();
  if (m.expires_at) {
    return new Date(m.expires_at).getTime() <= now;
  }
  const created = new Date(m.created_at).getTime();
  return now - created >= MS_24_HOURS;
}

export function loadMessages(conversationId: string): Message[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_MESSAGES);
    let all: Record<string, Message[]> = raw ? JSON.parse(raw) : {};
    if (!raw) {
      all = {
        'conv-pharma-1-client-demo': [
          {
            id: 'm-1',
            conversation_id: 'conv-pharma-1-client-demo',
            sender: 'client',
            text: 'Bonjour, avez-vous du Paracétamol 1000mg en stock ?',
            created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
            expires_at: new Date(Date.now() - 15 * 60 * 1000 + MS_24_HOURS).toISOString(),
            type: 'text'
          },
          {
            id: 'm-2',
            conversation_id: 'conv-pharma-1-client-demo',
            sender: 'pharma',
            text: 'Bonjour ! Oui, nous en avons disponible en boîte de 8 et 16 comprimés. Vous pouvez passer.',
            created_at: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
            expires_at: new Date(Date.now() - 12 * 60 * 1000 + MS_24_HOURS).toISOString(),
            type: 'text'
          }
        ]
      };
      localStorage.setItem(LOCAL_STORAGE_MESSAGES, JSON.stringify(all));
    }
    const list = all[conversationId] || [];
    // Filtre automatique 24h : les messages de plus de 24h ne s'affichent plus
    return list.filter((m) => !isMessageExpired(m));
  } catch {
    return [];
  }
}

export function addMessage(
  conversationId: string,
  sender: 'client' | 'pharma',
  text: string,
  mediaOptions?: {
    type?: 'text' | 'image' | 'audio';
    media_url?: string;
    audio_duration?: number;
  }
): Message {
  const raw = localStorage.getItem(LOCAL_STORAGE_MESSAGES);
  const all: Record<string, Message[]> = raw ? JSON.parse(raw) : {};
  const list = (all[conversationId] || []).filter((m) => !isMessageExpired(m));

  const createdAt = new Date().toISOString();
  // Table messages : colonne expires_at = created_at + 24h (Suppression automatique 24h)
  const expiresAt = new Date(Date.now() + MS_24_HOURS).toISOString();

  const newMsg: Message = {
    id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    conversation_id: conversationId,
    sender,
    text,
    type: mediaOptions?.type || 'text',
    media_url: mediaOptions?.media_url,
    audio_duration: mediaOptions?.audio_duration,
    created_at: createdAt,
    expires_at: expiresAt,
  };

  list.push(newMsg);
  all[conversationId] = list;
  localStorage.setItem(LOCAL_STORAGE_MESSAGES, JSON.stringify(all));

  // Update conversation last_message
  const convs = loadConversations();
  const cIdx = convs.findIndex((c) => c.id === conversationId);
  if (cIdx !== -1) {
    convs[cIdx].last_message =
      mediaOptions?.type === 'audio'
        ? '🎤 Message vocal'
        : mediaOptions?.type === 'image'
        ? '📷 Photo'
        : text;
    convs[cIdx].updated_at = newMsg.created_at;
    localStorage.setItem(LOCAL_STORAGE_CONVERSATIONS, JSON.stringify(convs));

    // Compte chaque fois qu'un client envoie un message via la messagerie
    if (sender === 'client' && convs[cIdx].pharmacie_id) {
      try {
        recordClientContact(convs[cIdx].pharmacie_id);
      } catch {
        // ignore
      }
    }
  }

  // Synchronisation Supabase si la table messages est configurée
  try {
    const sb = getSupabaseClient();
    if (sb) {
      Promise.resolve(
        sb.from('messages').insert({
          id: newMsg.id,
          conversation_id: newMsg.conversation_id,
          sender: newMsg.sender,
          text: newMsg.text,
          type: newMsg.type,
          media_url: newMsg.media_url,
          created_at: newMsg.created_at,
          expires_at: newMsg.expires_at,
        })
      )
        .then(() => {})
        .catch((err: unknown) => {
          // Table non créée ou hors-ligne, continu en mode autonome
          console.log('EFA GARDE sync info:', err instanceof Error ? err.message : 'mode autonome');
        });
    }
  } catch {
    // silently continue
  }

  notifyChange();
  return newMsg;
}

/**
 * AUTO CLEAN 24H (MESSAGES & PHOTOS) :
 * - Supprime tous les messages dont expires_at < now() ou créés il y a plus de 24h
 * - Exécute la suppression locale dans localStorage
 * - Exécute le DELETE SQL sur Supabase:
 *   DELETE FROM messages WHERE created_at < NOW() - INTERVAL '24 hours';
 *   DELETE FROM messages WHERE expires_at < NOW();
 * - Invoque l'Edge Function cleanup-garde pour purger garde.messages et storage.objects
 */
export async function cleanExpiredMessages(): Promise<number> {
  const now = Date.now();
  const nowIso = new Date().toISOString();
  const threshold24hIso = new Date(now - MS_24_HOURS).toISOString();
  let cleanedCount = 0;

  // 1. Nettoyage LocalStorage
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_MESSAGES);
    if (raw) {
      const all: Record<string, Message[]> = JSON.parse(raw);
      let modified = false;
      for (const convId of Object.keys(all)) {
        const initialLen = all[convId].length;
        all[convId] = all[convId].filter((m) => !isMessageExpired(m));
        if (all[convId].length !== initialLen) {
          cleanedCount += (initialLen - all[convId].length);
          modified = true;
        }
      }
      if (modified) {
        localStorage.setItem(LOCAL_STORAGE_MESSAGES, JSON.stringify(all));
        notifyChange();
      }
    }
  } catch (err) {
    console.warn('Erreur cleanExpiredMessages local:', err);
  }

  // 2. Nettoyage cloud Supabase : DELETE FROM messages WHERE created_at < NOW() - INTERVAL '24 hours'
  try {
    const sb = getSupabaseClient();
    if (sb) {
      await sb.from('messages').delete().lt('expires_at', nowIso);
      await sb.from('messages').delete().lt('created_at', threshold24hIso);

      // Invoque l'Edge Function cleanup-garde pour suppression auto 24h côté serveur
      sb.functions
        .invoke('cleanup-garde')
        .then(() => {})
        .catch(() => {});
    }
  } catch (err) {
    console.log('Auto clean sync:', err);
  }

  return cleanedCount;
}

/**
 * Upload Audio ou Image vers Supabase Storage :
 * - Bucket 'garde-photo' (avec fallback 'garde-ordonnances' et 'chat-media')
 * - Max 500 Ko par fichier compressé
 * - Refus strict si > 1 Mo
 */
export async function uploadMediaToSupabase(
  fileOrBlob: Blob | File,
  folder: 'audio' | 'images',
  filename?: string
): Promise<string> {
  // 3. Stockage : Validation de taille et de type MIME stricte
  const validation = validateUploadedFile(fileOrBlob, 1024 * 1024);
  if (!validation.isValid) {
    throw new Error(validation.error || 'Fichier non autorisé (max 1 Mo, extensions exécutables interdites).');
  }

  const sb = getSupabaseClient();
  const isImage = folder === 'images' || fileOrBlob.type.startsWith('image/');
  const ext = isImage ? 'webp' : 'webm';
  const name =
    filename ||
    `${folder}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${ext}`;
  const filePath = `${folder}/${name}`;
  const mimeType = isImage
    ? 'image/webp'
    : fileOrBlob.type || 'audio/webm';

  // Buckets cibles autorisés : priorité 'garde-photo', puis 'garde-ordonnances', puis 'chat-media'
  const targetBuckets = ['garde-photo', 'garde-ordonnances', 'chat-media'];

  try {
    if (sb) {
      for (const bucket of targetBuckets) {
        try {
          const { data, error } = await sb.storage
            .from(bucket)
            .upload(filePath, fileOrBlob, {
              cacheControl: '3600',
              upsert: true,
              contentType: mimeType,
            });

          if (!error && data) {
            const { data: publicUrlData } = sb.storage
              .from(bucket)
              .getPublicUrl(filePath);
            if (publicUrlData?.publicUrl) {
              return publicUrlData.publicUrl;
            }
          }
        } catch {
          // essayer le bucket suivant
        }
      }
    }
  } catch (err) {
    console.warn('Storage direct upload non dispo, bascule en Data URL:', err);
  }

  // Fallback garanti en Data URL (stockage sécurisé immédiat et lecture instantanée)
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(fileOrBlob);
  });
}

/* ===============================
   Realtime Presence Simulation
   =============================== */
const activePresenceMap = new Map<string, PresenceState>();

export function trackPresence(state: PresenceState, onPresenceUpdate: (all: PresenceState[]) => void): () => void {
  activePresenceMap.set(state.userId, state);
  
  const broadcast = () => {
    if (presenceBus) {
      try {
        presenceBus.postMessage({
          type: 'PRESENCE_PING',
          state
        });
      } catch {
        // ignore
      }
    }
  };

  broadcast();
  const interval = setInterval(broadcast, 5000);

  const handleMessage = (event: MessageEvent) => {
    if (event.data?.type === 'PRESENCE_PING' && event.data.state) {
      activePresenceMap.set(event.data.state.userId, event.data.state);
      onPresenceUpdate(Array.from(activePresenceMap.values()));
    }
  };

  if (presenceBus) {
    presenceBus.addEventListener('message', handleMessage);
  }

  onPresenceUpdate(Array.from(activePresenceMap.values()));

  return () => {
    clearInterval(interval);
    activePresenceMap.delete(state.userId);
    if (presenceBus) {
      presenceBus.removeEventListener('message', handleMessage);
      try {
        presenceBus.postMessage({
          type: 'PRESENCE_LEAVE',
          userId: state.userId
        });
      } catch {
        // ignore
      }
    }
  };
}

/* ===============================
   Pharmacies Pending (En attente de vérification)
   =============================== */
const LOCAL_STORAGE_PHARMACIES_PENDING = 'efa_pharmacies_pending_v1';

export function loadPendingPharmacies(): PharmaciePending[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_PHARMACIES_PENDING);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const uniqueMap = new Map<string, PharmaciePending>();
        for (const item of parsed) {
          if (item && item.id && !uniqueMap.has(item.id)) {
            uniqueMap.set(item.id, item);
          }
        }
        const result = Array.from(uniqueMap.values());
        if (result.length !== parsed.length) {
          localStorage.setItem(LOCAL_STORAGE_PHARMACIES_PENDING, JSON.stringify(result));
        }
        return result;
      }
    }
  } catch {
    // fallback
  }
  return [];
}

export function savePendingPharmacies(list: PharmaciePending[]) {
  const uniqueMap = new Map<string, PharmaciePending>();
  for (const item of list) {
    if (item && item.id && !uniqueMap.has(item.id)) {
      uniqueMap.set(item.id, item);
    }
  }
  const cleanList = Array.from(uniqueMap.values());
  localStorage.setItem(LOCAL_STORAGE_PHARMACIES_PENDING, JSON.stringify(cleanList));
  notifyChange();
}

export async function addPendingPharmacy(
  entry: Omit<PharmaciePending, 'id' | 'statut' | 'created_at'>
): Promise<PharmaciePending> {
  const newPending: PharmaciePending = {
    ...entry,
    id: 'pending-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
    statut: 'en_attente',
    created_at: new Date().toISOString(),
  };

  const list = loadPendingPharmacies();
  list.unshift(newPending);
  savePendingPharmacies(list);

  // Sync avec la table Supabase pharmacies_pending
  try {
    const client = getSupabaseClient();
    if (client) {
      const { error } = await client.from('pharmacies_pending').insert([
        {
          nom: entry.nom,
          quartier: entry.quartier,
          adresse: entry.adresse,
          phone: entry.phone,
          titulaire: entry.titulaire,
          lat: entry.lat,
          lng: entry.lng,
          photo_url: entry.photo_url || null,
          statut: 'pending',
        },
      ]);
      if (error) {
        console.warn('[EFA GARDE] pharmacies_pending insert warning:', error.message);
      } else {
        console.log('[EFA GARDE] ✅ Pharmacie ajoutée dans la table pharmacies_pending !');
      }
    }
  } catch (err) {
    console.warn('[EFA GARDE] pharmacies_pending offline fallback:', err);
  }

  notifyChange();
  return newPending;
}

export function loadAllPharmaciesWithPending(): Pharmacie[] {
  const approved = loadPharmacies();
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();

  const cleanedApproved: Pharmacie[] = [];
  for (const p of approved) {
    if (!p || !p.id || seenIds.has(p.id)) continue;
    seenIds.add(p.id);
    if (p.nom) seenNames.add(p.nom.trim().toLowerCase());
    cleanedApproved.push(p);
  }

  const pending = loadPendingPharmacies().filter(
    (p) => p.statut === 'pending' || p.statut === 'en_attente'
  );

  const pendingAsPharmacies: Pharmacie[] = [];
  for (const p of pending) {
    if (!p || !p.id) continue;
    // Don't duplicate if already in approved list (by ID or exact name)
    if (seenIds.has(p.id) || (p.nom && seenNames.has(p.nom.trim().toLowerCase()))) {
      continue;
    }

    seenIds.add(p.id);
    if (p.nom) seenNames.add(p.nom.trim().toLowerCase());

    pendingAsPharmacies.push({
      id: p.id,
      nom: p.nom,
      tel: p.phone,
      lat: p.lat,
      lng: p.lng,
      adresse: `${p.adresse} (${p.quartier || 'Lomé'})`,
      plan: 'free',
      is_online: false,
      is_pending: true,
      statut: 'pending',
      quartier: p.quartier,
      titulaire: p.titulaire,
      photo_url: p.photo_url,
    });
  }

  return [...cleanedApproved, ...pendingAsPharmacies];
}

/* ===============================
   Compteur clics Itinéraire ("Combien de personnes ont cliqué Itinéraire")
   =============================== */
const LOCAL_STORAGE_ITINERARY_CLICKS = 'efa_itinerary_clicks_v1';

interface ItineraryRecord {
  [pharmaId: string]: {
    total: number;
    dates: { [dateStr: string]: number };
  };
}

export function trackItineraryClick(pharmaId: string): void {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_ITINERARY_CLICKS);
    const data: ItineraryRecord = raw ? JSON.parse(raw) : {};
    const today = new Date().toISOString().slice(0, 10);

    if (!data[pharmaId]) {
      data[pharmaId] = { total: 0, dates: {} };
    }
    data[pharmaId].total = (data[pharmaId].total || 0) + 1;
    data[pharmaId].dates[today] = (data[pharmaId].dates[today] || 0) + 1;

    localStorage.setItem(LOCAL_STORAGE_ITINERARY_CLICKS, JSON.stringify(data));
    notifyChange();
  } catch (err) {
    console.error('Failed to track itinerary click:', err);
  }
}

export function getItineraryClicks(pharmaId: string): { today: number; total: number } {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_ITINERARY_CLICKS);
    const today = new Date().toISOString().slice(0, 10);
    if (!raw) return { today: 4, total: 12 }; // Valeurs initiales réalistes de démonstration
    const data: ItineraryRecord = JSON.parse(raw);
    const entry = data[pharmaId];
    if (!entry) return { today: 4, total: 12 };
    return {
      today: entry.dates?.[today] || 0,
      total: entry.total || 0,
    };
  } catch {
    return { today: 0, total: 0 };
  }
}

/* ===============================
   ADMIN: Validation & Refus Pharmacies
   =============================== */
export async function approvePendingPharmacy(pendingId: string): Promise<Pharmacie | null> {
  const pendingList = loadPendingPharmacies();
  const targetIdx = pendingList.findIndex((p) => p.id === pendingId);
  if (targetIdx === -1) return null;

  const target = pendingList[targetIdx];
  target.statut = 'approved';
  savePendingPharmacies(pendingList);

  // Copie vers pharmacies officielles
  const approvedPharmacy: Pharmacie = {
    id: 'pharma-' + Date.now(),
    nom: target.nom,
    tel: target.phone,
    lat: target.lat,
    lng: target.lng,
    adresse: target.adresse,
    plan: '60k', // Activée officiellement avec plan complet
    is_online: true, // Passe sur la carte publique en vert
    quartier: target.quartier,
    titulaire: target.titulaire,
    numero_ordre: target.numero_ordre,
    photo_url: target.photo_url,
    piece_url: target.piece_url,
    email_pro: target.email_pro,
    mot_de_passe: target.mot_de_passe,
    statut: 'approved',
    itinerary_clicks: 0,
  };

  const currentPharmacies = loadPharmacies();
  currentPharmacies.unshift(approvedPharmacy);
  savePharmacies(currentPharmacies);

  // Sync EFA GARDE
  try {
    const client = getSupabaseClient();
    if (client) {
      await client
        .from('pharmacies_pending')
        .update({ statut: 'approved' })
        .eq('id', pendingId);

      await client.from('pharmacies').insert([
        {
          nom: approvedPharmacy.nom,
          tel: approvedPharmacy.tel,
          lat: approvedPharmacy.lat,
          lng: approvedPharmacy.lng,
          adresse: approvedPharmacy.adresse,
          plan: approvedPharmacy.plan,
          is_online: approvedPharmacy.is_online,
        },
      ]);
      console.log('✅ Pharmacie approuvée et enregistrée !');
    }
  } catch (err) {
    console.warn('Approve sync error:', err);
  }

  notifyChange();
  return approvedPharmacy;
}

export async function rejectPendingPharmacy(pendingId: string): Promise<boolean> {
  const pendingList = loadPendingPharmacies();
  const targetIdx = pendingList.findIndex((p) => p.id === pendingId);
  if (targetIdx === -1) return false;

  pendingList[targetIdx].statut = 'rejected';
  savePendingPharmacies(pendingList);

  try {
    const client = getSupabaseClient();
    if (client) {
      await client
        .from('pharmacies_pending')
        .update({ statut: 'rejected' })
        .eq('id', pendingId);
    }
  } catch (err) {
    console.warn('Reject sync error:', err);
  }

  notifyChange();
  return true;
}

/* ===============================
   Pubs (Espace Pub Sponsorisé)
   =============================== */
const LOCAL_STORAGE_PUBS = 'efa_pubs_v1';

export function loadPubs(): Pub[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_PUBS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // fallback
  }
  localStorage.setItem(LOCAL_STORAGE_PUBS, JSON.stringify(INITIAL_PUBS));
  return INITIAL_PUBS;
}

export function savePubs(list: Pub[]) {
  localStorage.setItem(LOCAL_STORAGE_PUBS, JSON.stringify(list));
  notifyChange();
}

/**
 * Enregistrement nouvelle pharmacie depuis formulaire /pharma/login
 * Insert table pharmacies (avec statut pending) + table pharmacies_pending
 */
export async function registerNewPharmacy(data: {
  nom: string;
  adresse: string;
  lat: number;
  lng: number;
  tel: string;
  is_online: boolean; // Garde (oui/non)
  horaires?: string;
  quartier?: string;
  titulaire?: string;
}): Promise<Pharmacie> {
  const newPharmaId =
    'pharma-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
  const newPharmacy: Pharmacie = {
    id: newPharmaId,
    nom: data.nom.trim(),
    adresse: data.adresse.trim(),
    lat: data.lat || 6.1319,
    lng: data.lng || 1.2228,
    tel: data.tel.trim(),
    plan: 'free',
    is_online: Boolean(data.is_online),
    horaires: data.horaires?.trim() || '24h/24',
    quartier: data.quartier?.trim() || 'Lomé',
    titulaire: data.titulaire?.trim() || 'Titulaire Officine',
    statut: 'pending',
    is_pending: true,
  };

  // 1. Sauvegarder dans pharmacies locales (sans doublons)
  const allPharmacies = loadPharmacies().filter(
    (p) => p.id !== newPharmaId && p.nom.trim().toLowerCase() !== newPharmacy.nom.toLowerCase()
  );
  allPharmacies.unshift(newPharmacy);
  savePharmacies(allPharmacies);

  // 2. Sauvegarder dans pending list avec identifiant distinct
  const pendingId =
    'pending-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
  const pendingEntry: PharmaciePending = {
    id: pendingId,
    nom: newPharmacy.nom,
    adresse: newPharmacy.adresse,
    phone: newPharmacy.tel,
    lat: newPharmacy.lat,
    lng: newPharmacy.lng,
    quartier: newPharmacy.quartier || 'Lomé',
    titulaire: newPharmacy.titulaire || 'Titulaire Officine',
    statut: 'pending',
    created_at: new Date().toISOString(),
  };
  const pendingList = loadPendingPharmacies().filter(
    (p) => p.nom.trim().toLowerCase() !== newPharmacy.nom.toLowerCase()
  );
  pendingList.unshift(pendingEntry);
  savePendingPharmacies(pendingList);

  // 3. Insert Supabase tables
  try {
    const client = getSupabaseClient();
    if (client) {
      // Insert in pharmacies table
      await client.from('pharmacies').insert([
        {
          nom: newPharmacy.nom,
          tel: newPharmacy.tel,
          lat: newPharmacy.lat,
          lng: newPharmacy.lng,
          adresse: newPharmacy.adresse,
          plan: 'free',
          is_online: newPharmacy.is_online,
        },
      ]);

      // Insert in pharmacies_pending table
      await client.from('pharmacies_pending').insert([
        {
          nom: newPharmacy.nom,
          adresse: newPharmacy.adresse,
          phone: newPharmacy.tel,
          lat: newPharmacy.lat,
          lng: newPharmacy.lng,
          quartier: newPharmacy.quartier,
          titulaire: newPharmacy.titulaire,
          statut: 'pending',
          horaires: newPharmacy.horaires,
        },
      ]);
    }
  } catch (err) {
    console.warn('Register fallback:', err);
  }

  notifyChange();
  return newPharmacy;
}

/* =========================================================
   PHARMACY STATS & CLIENT CONTACT TRACKING
   Table stats: pharmacie_id, date (YYYY-MM-DD), client_count
   ========================================================= */

export function loadAllDailyStats(): PharmacyDailyStat[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_STATS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // fallback
  }
  return [];
}

export function saveAllDailyStats(stats: PharmacyDailyStat[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_STATS, JSON.stringify(stats));
  } catch (err) {
    console.warn('Erreur sauvegarde stats:', err);
  }
}

/**
 * Enregistre et incrémente le contact client pour la pharmacie :
 * Appelé quand un client clique sur "Contacter" / "Chat Live" ou envoie un message.
 * Stocke dans table stats: pharmacie_id, date, client_count
 */
export function recordClientContact(pharmacieId: string): number {
  if (!pharmacieId) return 0;

  const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const allStats = loadAllDailyStats();

  const targetIndex = allStats.findIndex(
    (s) => s.pharmacie_id === pharmacieId && s.date === todayStr
  );

  let newCount = 1;
  if (targetIndex >= 0) {
    allStats[targetIndex].client_count += 1;
    newCount = allStats[targetIndex].client_count;
  } else {
    allStats.push({
      pharmacie_id: pharmacieId,
      date: todayStr,
      client_count: 1,
    });
  }

  saveAllDailyStats(allStats);
  notifyChange();

  // Synchronisation Supabase table stats: pharmacie_id, date, client_count
  try {
    const client = getSupabaseClient();
    if (client) {
      Promise.resolve(
        client
          .from('stats')
          .upsert(
            {
              pharmacie_id: pharmacieId,
              date: todayStr,
              client_count: newCount,
            },
            { onConflict: 'pharmacie_id,date' }
          )
      )
        .then(() => {})
        .catch((err: unknown) => {
          console.log(
            'Stats sync info:',
            err instanceof Error ? err.message : 'mode autonome'
          );
        });
    }
  } catch {
    // continue
  }

  return newCount;
}

export interface PharmacyStatsSummary {
  pharmacie_id: string;
  totalThisWeek: number;
  totalThisMonth: number;
  conversationsHandled: number;
  dailyStats7Days: { date: string; label: string; count: number }[];
  dailyStats30Days: { date: string; label: string; count: number }[];
}

export function getPharmacyStats(pharmacieId: string): PharmacyStatsSummary {
  const allStats = loadAllDailyStats();
  const pharmaStats = allStats.filter((s) => s.pharmacie_id === pharmacieId);

  // If completely empty for this pharmacy, initialize a realistic baseline
  if (pharmaStats.length === 0) {
    const seeded = seedInitialStatsForPharmacy(pharmacieId);
    return getPharmacyStatsCalculated(pharmacieId, seeded);
  }

  return getPharmacyStatsCalculated(pharmacieId, pharmaStats);
}

function getPharmacyStatsCalculated(
  pharmacieId: string,
  pharmaStats: PharmacyDailyStat[]
): PharmacyStatsSummary {
  const now = new Date();
  const statsMap = new Map<string, number>();
  pharmaStats.forEach((s) => {
    statsMap.set(s.date, (statsMap.get(s.date) || 0) + s.client_count);
  });

  // 7 derniers jours
  const dailyStats7Days: { date: string; label: string; count: number }[] = [];
  const dayLabels = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  let totalThisWeek = 0;

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(now.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const label =
      i === 0 ? "Aujourd'hui" : dayLabels[d.getDay()] + ' ' + d.getDate();
    const count = statsMap.get(dateStr) || 0;
    dailyStats7Days.push({ date: dateStr, label, count });
    totalThisWeek += count;
  }

  // 30 derniers jours
  const dailyStats30Days: { date: string; label: string; count: number }[] = [];
  let totalThisMonth = 0;

  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(now.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayOfMonth = d.getDate();
    const monthIndex = d.getMonth() + 1;
    const label = `${dayOfMonth}/${monthIndex < 10 ? '0' : ''}${monthIndex}`;
    const count = statsMap.get(dateStr) || 0;
    dailyStats30Days.push({ date: dateStr, label, count });
    totalThisMonth += count;
  }

  // Nombre de conversations prises en charge
  const conversations = loadConversations(pharmacieId);
  const conversationsHandled = conversations.length;

  return {
    pharmacie_id: pharmacieId,
    totalThisWeek,
    totalThisMonth,
    conversationsHandled,
    dailyStats7Days,
    dailyStats30Days,
  };
}

function seedInitialStatsForPharmacy(pharmacieId: string): PharmacyDailyStat[] {
  const allStats = loadAllDailyStats();
  const existing = allStats.filter((s) => s.pharmacie_id === pharmacieId);
  if (existing.length > 0) return existing;

  const now = new Date();
  const newStats: PharmacyDailyStat[] = [];

  // Seed 30 days of realistic patient contacts
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(now.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);

    // Seed pattern: weekend / night guards have higher contacts
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    const base = isWeekend ? 8 : 4;
    const seedVal =
      (d.getDate() * 7 + pharmacieId.charCodeAt(pharmacieId.length - 1)) % 7;
    const count = base + seedVal;

    const entry: PharmacyDailyStat = {
      pharmacie_id: pharmacieId,
      date: dateStr,
      client_count: count,
    };
    newStats.push(entry);
    allStats.push(entry);
  }

  saveAllDailyStats(allStats);
  return newStats;
}
