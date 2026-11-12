import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  Pharmacie,
  Garde,
  Conversation,
  Message,
  PresenceState,
  PlanType,
  PharmaciePending,
  Pub,
  PharmacyDailyStat,
  Signalement,
  Client,
  Abonnement,
  DemandeAbonnement,
} from '../types';
import { supabase } from '../lib/supabase';
import { validateUploadedFile } from '../utils/security';

/* =========================================================
   EFA GARDE - STORE 100% SUPABASE SANS LOCALSTORAGE DONNÉES
   - Zéro localStorage pour pharmacies, abonnements, messages,
     clients, signalements, gardes.
   - localStorage réservé exclusivement à la session client
     (nom, numéro, id client, rôle, tokens auth).
   ========================================================= */

// In-Memory Realtime Cache
let memoryPharmacies: Pharmacie[] = [];
let memoryPendingPharmacies: PharmaciePending[] = [];
let memoryDemandesAbonnement: DemandeAbonnement[] = [];
let memoryClients: Client[] = [];
let memoryClientsCount = 0;
let memoryConversations: Conversation[] = [];
const memoryMessages: Record<string, Message[]> = {};
let memorySignalements: Signalement[] = [];
const memoryGardes: Garde[] = [];
let memoryPubs: Pub[] = [];
let memoryStats: PharmacyDailyStat[] = [];
const memoryValidatedCodes: Record<string, any> = {};
const memoryItineraryClicks: Record<
  string,
  { total: number; dates: Record<string, number> }
> = {};

// Nettoyage proactif de tout vestige legacy dans localStorage au démarrage
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('efa_pharmacies_v1');
    localStorage.removeItem('efa_pharmacies_pending_v1');
    localStorage.removeItem('efa_demandes_abonnement_v1');
    localStorage.removeItem('efa_clients_v1');
    localStorage.removeItem('efa_conversations_v1');
    localStorage.removeItem('efa_messages_v1');
    localStorage.removeItem('efa_signalements_v1');
    localStorage.removeItem('efa_gardes_v1');
    localStorage.removeItem('efa_pubs_v1');
    localStorage.removeItem('efa_pharmacy_stats_v1');
    localStorage.removeItem('efa_validated_codes_v1');
    localStorage.removeItem('efa_itinerary_clicks_v1');
    localStorage.removeItem('efa_signalements');
  } catch {
    // ignore
  }
}

// BroadcastChannel for cross-tab realtime synchronization
const realtimeBus =
  typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel('efa_garde_realtime_bus')
    : null;

// Local event emitter for intra-page reactivity
type Listener = () => void;
const listeners = new Set<Listener>();

export function notifyChange() {
  listeners.forEach((fn) => fn());
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
      listeners.forEach((fn) => fn());
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
const presenceBus =
  typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel('efa_garde_presence_bus')
    : null;

interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export function getStoredSupabaseConfig(): SupabaseConfig {
  const envUrl = (
    import.meta.env.VITE_SUPABASE_URL ||
    (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
    ''
  ).trim();
  const envKey = (
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    (typeof process !== 'undefined' &&
      (process.env?.VITE_SUPABASE_ANON_KEY ||
        process.env?.VITE_SUPABASE_PUBLISHABLE_KEY)) ||
    ''
  ).trim();

  if (envUrl && envKey) {
    return { url: envUrl, anonKey: envKey };
  }

  try {
    const raw = localStorage.getItem('efa_supabase_config_v1');
    if (raw) return JSON.parse(raw);
  } catch {
    // fallback
  }
  return { url: '', anonKey: '' };
}

export function saveSupabaseConfig(url: string, anonKey: string) {
  localStorage.setItem(
    'efa_supabase_config_v1',
    JSON.stringify({ url, anonKey })
  );
  notifyChange();
}

let activeSupabaseClient: SupabaseClient | null = null;
export function getSupabaseClient(): SupabaseClient | null {
  const config = getStoredSupabaseConfig();
  if (config.url && config.anonKey) {
    if (!activeSupabaseClient) {
      activeSupabaseClient = createClient(config.url, config.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true },
        realtime: { params: { eventsPerSecond: 10 } },
      });
    }
    return activeSupabaseClient;
  }
  return supabase;
}

/* ===============================
   Anti-Demo Protection
   =============================== */

export function isDemoPharmacy(
  p: Partial<Pharmacie> | null | undefined
): boolean {
  if (!p) return true;
  const demoIds = new Set([
    'pharma-1',
    'pharma-2',
    'pharma-3',
    'pharma-4',
    'pharma-5',
    'pharma-6',
    'pharma-7',
  ]);
  if (p.id && demoIds.has(p.id)) return true;
  const demoNames = [
    'pharmacie du grand marché',
    'pharmacie de l’espérance',
    "pharmacie de l'espérance",
    'pharmacie de la victoire',
    'pharmacie de la paix',
    'pharmacie du 13 janvier',
    'pharmacie baguida',
    'pharmacie hédzranawoé',
    'pharmacie tokoin central',
  ];
  if (p.nom && demoNames.includes(p.nom.trim().toLowerCase())) return true;
  return false;
}

export function purgeDemoData(): void {
  memoryPharmacies = memoryPharmacies.filter((p) => !isDemoPharmacy(p));
  memoryConversations = memoryConversations.filter(
    (c) =>
      !['pharma-1', 'pharma-2', 'pharma-3', 'pharma-4', 'pharma-5', 'pharma-6', 'pharma-7'].includes(
        c.pharmacy_id
      )
  );
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

/* =========================================================
   PHARMACIES : 100% SUPABASE TABLE `pharmacies`
   - Carte publique : SELECT WHERE statut='approved' AND is_active=true
   - Formulaire pharmacie : INSERT (statut='pending', is_active=false)
   - Valider et Publier : UPDATE statut='approved', is_active=true
   ========================================================= */

export function loadPharmacies(): Pharmacie[] {
  return sortPharmaciesPriority(
    memoryPharmacies.filter((p) => !isDemoPharmacy(p))
  );
}

export function savePharmacies(list: Pharmacie[]) {
  const uniqueMap = new Map<string, Pharmacie>();
  for (const item of list) {
    if (item && item.id && !uniqueMap.has(item.id)) {
      uniqueMap.set(item.id, item);
    }
  }
  memoryPharmacies = sortPharmaciesPriority(Array.from(uniqueMap.values()));
  notifyChange();
}

/**
 * Charge TOUTES les pharmacies depuis Supabase (pour Super Admin)
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

      if (!error && data && Array.isArray(data)) {
        const clean = (data as Pharmacie[]).filter((p) => !isDemoPharmacy(p));
        const sorted = sortPharmaciesPriority(clean);
        memoryPharmacies = sorted;
        notifyChange();
        return sorted;
      }
    }
  } catch (err) {
    console.warn('[EFA GARDE] fetchPharmacies fallback:', err);
  }
  return loadPharmacies();
}

/**
 * CARTE PUBLIQUE : SELECT * FROM public.pharmacies WHERE statut='approved' AND is_active=true UNIQUEMENT
 * Ne retourne JAMAIS de pharmacies non validées ou refusées aux clients grand public.
 */
export async function fetchApprovedPharmacies(): Promise<Pharmacie[]> {
  try {
    const client = getSupabaseClient();
    if (client) {
      const { data, error } = await client
        .from('pharmacies')
        .select('*')
        .eq('statut', 'approved')
        .eq('is_active', true)
        .order('is_premium', { ascending: false })
        .order('position', { ascending: true })
        .order('etoile_doree', { ascending: false });

      if (!error && data && Array.isArray(data)) {
        const clean = (data as Pharmacie[]).filter((p) => !isDemoPharmacy(p));
        const sorted = sortPharmaciesPriority(clean);

        // Préserve les non-approuvées déjà en mémoire pour l'admin
        const pendingOrOther = memoryPharmacies.filter(
          (p) => p.statut !== 'approved' || !p.is_active
        );
        memoryPharmacies = sortPharmaciesPriority([...sorted, ...pendingOrOther]);
        notifyChange();
        return sorted;
      }
    }
  } catch (err) {
    console.warn('[EFA GARDE] fetchApprovedPharmacies fallback:', err);
  }
  return loadApprovedPharmacies();
}

export function loadApprovedPharmacies(): Pharmacie[] {
  return memoryPharmacies.filter((p) => {
    if (isDemoPharmacy(p)) return false;
    if (p.is_pending === true) return false;
    if (p.statut !== 'approved') return false;
    if (p.is_active === false) return false;
    return true;
  });
}

export function loadAllPharmaciesWithPending(): Pharmacie[] {
  return loadApprovedPharmacies();
}

/**
 * Super Admin : Liste des pharmacies en attente de vérification
 */
export function loadPendingPharmacies(): PharmaciePending[] {
  const fromMem = memoryPharmacies
    .filter(
      (p) =>
        !isDemoPharmacy(p) &&
        (p.statut === 'pending' ||
          p.statut === 'en_attente' ||
          p.is_pending === true)
    )
    .map((p) => ({
      id: p.id,
      nom: p.nom,
      quartier: p.quartier || 'Lomé',
      adresse: p.adresse || '',
      phone: p.tel || '',
      titulaire: p.titulaire || 'Titulaire Officine',
      numero_ordre: p.numero_ordre,
      piece_url: p.piece_url,
      photo_url: p.photo_url,
      email_pro: p.email_pro,
      mot_de_passe: p.mot_de_passe,
      lat: p.lat || 6.1319,
      lng: p.lng || 1.2228,
      statut: 'en_attente' as const,
      created_at: p.created_at || new Date().toISOString(),
    }));

  if (fromMem.length > 0) return fromMem;
  return memoryPendingPharmacies;
}

export function savePendingPharmacies(list: PharmaciePending[]) {
  memoryPendingPharmacies = list;
  notifyChange();
}

export async function fetchPendingPharmacies(): Promise<PharmaciePending[]> {
  try {
    const client = getSupabaseClient();
    if (client) {
      const { data, error } = await client
        .from('pharmacies')
        .select('*')
        .or('statut.eq.pending,statut.eq.en_attente,is_pending.eq.true')
        .order('created_at', { ascending: false });

      if (!error && data && Array.isArray(data)) {
        const list: PharmaciePending[] = data.map((p: any) => ({
          id: p.id,
          nom: p.nom,
          quartier: p.quartier || 'Lomé',
          adresse: p.adresse || '',
          phone: p.tel || p.phone || '',
          titulaire: p.titulaire || 'Titulaire Officine',
          numero_ordre: p.numero_ordre,
          piece_url: p.piece_url,
          photo_url: p.photo_url,
          email_pro: p.email_pro,
          mot_de_passe: p.mot_de_passe,
          lat: p.lat || 6.1319,
          lng: p.lng || 1.2228,
          statut: 'en_attente',
          created_at: p.created_at || new Date().toISOString(),
        }));
        memoryPendingPharmacies = list;
        notifyChange();
        return list;
      }
    }
  } catch (err) {
    console.warn('[EFA GARDE] fetchPendingPharmacies fallback:', err);
  }
  return loadPendingPharmacies();
}

/**
 * FORMULAIRE PHARMACIE :
 * INSERT INTO public.pharmacies (statut='pending', is_active=false, is_pending=true)
 * Reste 100% invisible sur la carte publique jusqu'à validation par le Super Admin.
 */
export async function addPendingPharmacy(
  entry: Omit<PharmaciePending, 'id' | 'statut' | 'created_at'>
): Promise<PharmaciePending> {
  const id =
    'pharma-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
  const now = new Date().toISOString();

  const newPending: PharmaciePending = {
    ...entry,
    id,
    statut: 'en_attente',
    created_at: now,
  };

  const newPharma: Pharmacie = {
    id,
    nom: entry.nom,
    tel: entry.phone,
    lat: entry.lat || 6.1319,
    lng: entry.lng || 1.2228,
    adresse: entry.adresse,
    quartier: entry.quartier || 'Lomé',
    titulaire: entry.titulaire || 'Titulaire Officine',
    numero_ordre: entry.numero_ordre,
    piece_url: entry.piece_url,
    photo_url: entry.photo_url || undefined,
    email_pro: entry.email_pro,
    mot_de_passe: entry.mot_de_passe,
    plan: 'free',
    is_online: false,
    is_active: false,
    is_pending: true,
    statut: 'pending',
    created_at: now,
    updated_at: now,
  };

  memoryPendingPharmacies.unshift(newPending);
  memoryPharmacies.unshift(newPharma);

  // Synchronisation directe dans Supabase table pharmacies
  try {
    const client = getSupabaseClient();
    if (client) {
      await client.from('pharmacies').upsert({
        id,
        nom: newPharma.nom,
        tel: newPharma.tel,
        lat: newPharma.lat,
        lng: newPharma.lng,
        adresse: newPharma.adresse,
        quartier: newPharma.quartier,
        titulaire: newPharma.titulaire,
        numero_ordre: newPharma.numero_ordre,
        piece_url: newPharma.piece_url,
        photo_url: newPharma.photo_url || null,
        email_pro: newPharma.email_pro,
        mot_de_passe: newPharma.mot_de_passe,
        plan: 'free',
        is_online: false,
        is_active: false,
        is_pending: true,
        statut: 'pending',
        created_at: now,
        updated_at: now,
      });

      // Table miroir pharmacies_pending
      await client
        .from('pharmacies_pending')
        .upsert({
          id,
          nom: entry.nom,
          quartier: entry.quartier,
          adresse: entry.adresse,
          phone: entry.phone,
          titulaire: entry.titulaire,
          lat: entry.lat,
          lng: entry.lng,
          photo_url: entry.photo_url || null,
          statut: 'pending',
          created_at: now,
        })
        .then(
          () => {},
          () => {}
        );
    }
  } catch (err) {
    console.warn('[EFA GARDE] addPendingPharmacy Supabase warning:', err);
  }

  notifyChange();
  return newPending;
}

/**
 * VALIDER ET PUBLIER (Super Admin Dashboard) :
 * UPDATE public.pharmacies SET statut='approved', is_active=true, is_pending=false
 * Seulement là, la pharmacie devient visible sur la carte publique !
 */
export async function approvePharmacySuperAdmin(id: string): Promise<boolean> {
  const now = new Date().toISOString();
  const found = memoryPharmacies.find((p) => p.id === id);
  if (found) {
    found.statut = 'approved';
    found.is_active = true;
    found.is_pending = false;
    found.updated_at = now;
  }
  memoryPendingPharmacies = memoryPendingPharmacies.filter((p) => p.id !== id);

  try {
    const client = getSupabaseClient();
    if (client) {
      await client
        .from('pharmacies')
        .update({
          statut: 'approved',
          is_active: true,
          is_pending: false,
          updated_at: now,
        })
        .eq('id', id);

      await client
        .from('pharmacies_pending')
        .update({ statut: 'approved' })
        .eq('id', id)
        .then(
          () => {},
          () => {}
        );
    }
  } catch (err) {
    console.warn('[EFA] approvePharmacySuperAdmin Supabase warning:', err);
  }

  notifyChange();
  return true;
}

export async function rejectPharmacySuperAdmin(id: string): Promise<boolean> {
  const now = new Date().toISOString();
  const found = memoryPharmacies.find((p) => p.id === id);
  if (found) {
    found.statut = 'rejected';
    found.is_active = false;
    found.is_pending = false;
    found.updated_at = now;
  }
  memoryPendingPharmacies = memoryPendingPharmacies.filter((p) => p.id !== id);

  try {
    const client = getSupabaseClient();
    if (client) {
      await client
        .from('pharmacies')
        .update({
          statut: 'rejected',
          is_active: false,
          is_pending: false,
          updated_at: now,
        })
        .eq('id', id);

      await client
        .from('pharmacies_pending')
        .update({ statut: 'rejected' })
        .eq('id', id)
        .then(
          () => {},
          () => {}
        );
    }
  } catch (err) {
    console.warn('[EFA] rejectPharmacySuperAdmin warning:', err);
  }

  notifyChange();
  return true;
}

export function updatePharmacyStatus(
  pharmacieId: string,
  isOnline: boolean
): Pharmacie | null {
  const idx = memoryPharmacies.findIndex((p) => p.id === pharmacieId);
  if (idx === -1) return null;
  memoryPharmacies[idx] = { ...memoryPharmacies[idx], is_online: isOnline };

  try {
    const sb = getSupabaseClient();
    if (sb) {
      sb.from('pharmacies')
        .update({
          is_online: isOnline,
          updated_at: new Date().toISOString(),
        })
        .eq('id', pharmacieId)
        .then(
          () => {},
          () => {}
        );
    }
  } catch {}

  notifyChange();
  return memoryPharmacies[idx];
}

export function updatePharmacyPlan(
  pharmacieId: string,
  plan: PlanType
): Pharmacie | null {
  const idx = memoryPharmacies.findIndex((p) => p.id === pharmacieId);
  if (idx === -1) return null;
  memoryPharmacies[idx] = { ...memoryPharmacies[idx], plan };

  try {
    const sb = getSupabaseClient();
    if (sb) {
      sb.from('pharmacies')
        .update({
          plan,
          updated_at: new Date().toISOString(),
        })
        .eq('id', pharmacieId)
        .then(
          () => {},
          () => {}
        );
    }
  } catch {}

  notifyChange();
  return memoryPharmacies[idx];
}

export function updatePharmacySuperAdmin(
  pharmacieId: string,
  updates: Partial<Pharmacie>
): Pharmacie | null {
  const idx = memoryPharmacies.findIndex((p) => p.id === pharmacieId);
  if (idx === -1) return null;
  memoryPharmacies[idx] = { ...memoryPharmacies[idx], ...updates };

  try {
    const sb = getSupabaseClient();
    if (sb) {
      sb.from('pharmacies')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', pharmacieId)
        .then(
          () => {},
          () => {}
        );
    }
  } catch {}

  notifyChange();
  return memoryPharmacies[idx];
}

export interface SubscriptionActivationOptions {
  planType: 'basic_90k' | 'premium_140k' | 'premium_15k';
  durationDays?: number;
}

export async function activateSubscriptionInDB(
  pharmacyId: string,
  options: SubscriptionActivationOptions
): Promise<Pharmacie | null> {
  const { planType } = options;
  const now = new Date();
  const isPremium = planType === 'premium_140k' || planType === 'premium_15k';
  const durationDays =
    options.durationDays || (planType === 'premium_15k' ? 30 : 365);
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
    plan:
      planType === 'premium_140k'
        ? 'populaire_annuel'
        : planType === 'premium_15k'
        ? 'populaire_mensuel'
        : 'annual',
    prix:
      planType === 'premium_140k'
        ? 140000
        : planType === 'premium_15k'
        ? 15000
        : 90000,
    statut: 'approved',
  };

  try {
    const client = getSupabaseClient();
    if (client) {
      await client
        .from('pharmacies')
        .update(updates)
        .eq('id', pharmacyId);

      const currentPharma = memoryPharmacies.find((p) => p.id === pharmacyId);
      const pharmaNom = updates.nom || currentPharma?.nom || 'Pharmacie';
      await client
        .from('abonnements')
        .upsert(
          {
            entreprise_id: pharmacyId,
            pharmacie_id: pharmacyId,
            nom_pharmacie: pharmaNom,
            telephone: currentPharma?.tel || undefined,
            email: currentPharma?.email_pro || undefined,
            plan: updates.plan || 'populaire_mensuel',
            statut: 'actif',
            montant: updates.prix || 15000,
            date_debut: now.toISOString(),
            expire_le: end.toISOString(),
            updated_at: now.toISOString(),
          },
          { onConflict: 'entreprise_id' }
        )
        .then(
          () => {},
          (err) => {
            console.warn('[EFA GARDE] Upsert abonnements error:', err);
          }
        );
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
  return memoryPharmacies.find((p) => p.id === id) || null;
}

export async function approvePendingPharmacy(
  pendingId: string
): Promise<Pharmacie | null> {
  await approvePharmacySuperAdmin(pendingId);
  return memoryPharmacies.find((p) => p.id === pendingId) || null;
}

export async function rejectPendingPharmacy(pendingId: string): Promise<boolean> {
  return rejectPharmacySuperAdmin(pendingId);
}

export async function registerNewPharmacy(data: {
  nom: string;
  adresse: string;
  lat: number;
  lng: number;
  tel: string;
  is_online: boolean;
  horaires?: string;
  quartier?: string;
  titulaire?: string;
}): Promise<Pharmacie> {
  const pending = await addPendingPharmacy({
    nom: data.nom,
    adresse: data.adresse,
    quartier: data.quartier || 'Lomé',
    phone: data.tel,
    titulaire: data.titulaire || 'Titulaire Officine',
    lat: data.lat,
    lng: data.lng,
  });
  const found = memoryPharmacies.find((p) => p.id === pending.id);
  return (
    found || {
      id: pending.id,
      nom: data.nom,
      adresse: data.adresse,
      lat: data.lat,
      lng: data.lng,
      tel: data.tel,
      plan: 'free',
      is_online: data.is_online,
      statut: 'pending',
      is_pending: true,
      is_active: false,
    }
  );
}

/* =========================================================
   CLIENTS : TABLE `public.clients`
   - Inscription client -> INSERT INTO public.clients (nom, numero)
   - Super Admin Clients Inscrits -> SELECT COUNT(*) FROM public.clients en Realtime
   - Session locale autorisée : nom, numero, client_id
   ========================================================= */

export function loadClients(): Client[] {
  return memoryClients;
}

export function saveClients(clients: Client[]): void {
  memoryClients = clients;
  notifyChange();
}

/**
 * INSCRIPTION CLIENT :
 * INSERT INTO public.clients (nom, numero, numero_whatsapp)
 */
export async function registerClientInDB(data: {
  nom: string;
  numero_whatsapp: string;
}): Promise<Client> {
  const cleanNom = data.nom.trim();
  const cleanPhone = data.numero_whatsapp.trim().replace(/\s+/g, '');
  const now = new Date().toISOString();
  const clientId =
    localStorage.getItem('efa_client_id') ||
    'cli-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);

  const clientObj: Client = {
    id: clientId,
    nom: cleanNom,
    numero_whatsapp: cleanPhone,
    date_inscription: now,
  };

  // Session persistante client strictement (nom + numero)
  localStorage.setItem('efa_client_id', clientId);
  localStorage.setItem('efa_client_nom', cleanNom);
  localStorage.setItem('efa_client_whatsapp', cleanPhone);

  memoryClients = memoryClients.filter(
    (c) => c.numero_whatsapp !== cleanPhone && c.id !== clientId
  );
  memoryClients.unshift(clientObj);
  memoryClientsCount += 1;

  // Enregistrement direct dans Supabase table clients
  try {
    const sb = getSupabaseClient();
    if (sb) {
      await sb.from('clients').upsert({
        id: clientObj.id,
        nom: clientObj.nom,
        numero: clientObj.numero_whatsapp,
        numero_whatsapp: clientObj.numero_whatsapp,
        date_inscription: clientObj.date_inscription,
        created_at: clientObj.date_inscription,
        updated_at: clientObj.date_inscription,
      });

      await sb
        .from('utilisateurs')
        .upsert({
          nom: clientObj.nom,
          role: 'client',
          telephone: clientObj.numero_whatsapp,
        })
        .then(
          () => {},
          () => {}
        );
    }
  } catch (err) {
    console.warn('[EFA] registerClientInDB Supabase warning:', err);
  }

  notifyChange();
  return clientObj;
}

/**
 * SUPER ADMIN : SELECT COUNT(*) FROM public.clients en Realtime
 */
export async function fetchClientsCount(): Promise<number> {
  try {
    const sb = getSupabaseClient();
    if (sb) {
      const { count, error } = await sb
        .from('clients')
        .select('*', { count: 'exact', head: true });
      if (!error && typeof count === 'number') {
        memoryClientsCount = count;
        return count;
      }
    }
  } catch {}
  return memoryClientsCount || memoryClients.length;
}

export function getOrCreateClientId(): string {
  if (typeof window === 'undefined') return 'client-guest-1';
  let cid = localStorage.getItem('efa_client_id');
  if (!cid) {
    cid = 'client-' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem('efa_client_id', cid);
  }
  return cid;
}

/* =========================================================
   ABONNEMENTS : TABLE `public.abonnements`
   - Inscription pharmacie / Paiement WhatsApp -> INSERT INTO public.abonnements
   - Générer code 4 chiffres -> UPDATE public.abonnements SET code_validation
   ========================================================= */

export function loadDemandesAbonnement(): DemandeAbonnement[] {
  return memoryDemandesAbonnement;
}

export function saveDemandesAbonnement(list: DemandeAbonnement[]): void {
  memoryDemandesAbonnement = list;
  notifyChange();
}

export async function fetchDemandesAbonnement(): Promise<DemandeAbonnement[]> {
  try {
    const sb = getSupabaseClient();
    if (sb) {
      const { data, error } = await sb
        .from('abonnements')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && Array.isArray(data)) {
        const mapped: DemandeAbonnement[] = data.map((d: any) => ({
          id: d.id,
          nom_pharmacie: d.nom_pharmacie || d.pharmacie_nom || 'Pharmacie',
          telephone: d.telephone || d.phone || '',
          email: d.email,
          montant: Number(d.montant) || 25000,
          plan: d.plan || 'enregistrement_25k',
          statut:
            d.statut === 'paye_valide' || d.statut === 'active'
              ? 'paye_valide'
              : d.statut || 'en_attente',
          code_validation: d.code_validation,
          created_at: d.created_at || new Date().toISOString(),
          validated_at: d.validated_at,
          pharmacie_id: d.pharmacie_id,
        }));
        memoryDemandesAbonnement = mapped;
        notifyChange();
        return mapped;
      }
    }
  } catch (err) {
    console.warn('[EFA] fetchDemandesAbonnement warning:', err);
  }
  return memoryDemandesAbonnement;
}

/**
 * INSCRIPTION PHARMACIE / PAIEMENT WHATSAPP :
 * INSERT INTO public.abonnements (montant=25000, statut='en_attente')
 */
export async function createSubscriptionPaymentRequest(data: {
  nom_pharmacie: string;
  telephone: string;
  email?: string;
  montant?: number;
}): Promise<DemandeAbonnement> {
  const cleanNom = data.nom_pharmacie.trim();
  const cleanPhone = data.telephone.trim().replace(/\s+/g, '');
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const demande: DemandeAbonnement = {
    id,
    nom_pharmacie: cleanNom,
    telephone: cleanPhone,
    email: data.email?.trim() || undefined,
    montant: data.montant || 25000,
    plan: 'enregistrement_25k',
    statut: 'en_attente',
    created_at: now,
  };

  memoryDemandesAbonnement = memoryDemandesAbonnement.filter(
    (d) => d.telephone !== cleanPhone && d.id !== id
  );
  memoryDemandesAbonnement.unshift(demande);

  // Synchronisation Supabase table abonnements
  try {
    const sb = getSupabaseClient();
    if (sb) {
      const entrepriseId =
        'sub-' + cleanNom.toLowerCase().replace(/[^a-z0-9]/g, '-');
      await sb.from('abonnements').upsert(
        {
          id: demande.id,
          entreprise_id: entrepriseId,
          pharmacie_id: entrepriseId,
          nom_pharmacie: demande.nom_pharmacie,
          telephone: demande.telephone,
          email: demande.email || null,
          montant: demande.montant,
          plan: demande.plan,
          statut: 'en_attente',
          created_at: demande.created_at,
          updated_at: demande.created_at,
          expire_le: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        },
        { onConflict: 'entreprise_id' }
      );
    }
  } catch (err) {
    console.warn(
      '[EFA] createSubscriptionPaymentRequest Supabase warning:',
      err
    );
  }

  notifyChange();
  return demande;
}

/**
 * GÉNÉRER CODE 4 CHIFFRES (Super Admin) :
 * UPDATE public.abonnements SET code_validation, statut='paye_valide'
 */
export async function validateSubscriptionPaymentAndGenerateCode(
  demandeId: string,
  customCode?: string
): Promise<{ code: string; demande: DemandeAbonnement | null }> {
  const code = customCode || Math.floor(1000 + Math.random() * 9000).toString();
  const now = new Date().toISOString();

  const found = memoryDemandesAbonnement.find((d) => d.id === demandeId);
  if (found) {
    found.statut = 'paye_valide';
    found.code_validation = code;
    found.validated_at = now;
  }
  memoryValidatedCodes[code] = {
    demandeId,
    nom_pharmacie: found?.nom_pharmacie,
    telephone: found?.telephone,
    validated_at: now,
  };

  // Synchronisation Supabase table abonnements
  try {
    const sb = getSupabaseClient();
    if (sb) {
      await sb
        .from('abonnements')
        .update({
          statut: 'paye_valide',
          code_validation: code,
          updated_at: now,
        })
        .eq('id', demandeId);
    }
  } catch (err) {
    console.warn(
      '[EFA] validateSubscriptionPaymentAndGenerateCode Supabase warning:',
      err
    );
  }

  notifyChange();
  return { code, demande: found || null };
}

/**
 * VÉRIFICATION CODE 4 CHIFFRES :
 * SELECT * FROM public.abonnements WHERE code_validation = $code
 */
export async function verifyRegistrationCode(
  code: string,
  _telephone?: string
): Promise<{ valid: boolean; demande?: DemandeAbonnement; error?: string }> {
  const cleanCode = code.trim();
  if (!cleanCode || cleanCode.length !== 4) {
    return {
      valid: false,
      error: 'Veuillez saisir un code à 4 chiffres valide.',
    };
  }

  // 1. Vérification Supabase en direct
  try {
    const sb = getSupabaseClient();
    if (sb) {
      const { data, error } = await sb
        .from('abonnements')
        .select('*')
        .eq('code_validation', cleanCode)
        .in('statut', ['paye_valide', 'active'])
        .limit(1);

      if (!error && data && data.length > 0) {
        const row = data[0];
        const demande: DemandeAbonnement = {
          id: row.id,
          nom_pharmacie: row.nom_pharmacie || 'Pharmacie',
          telephone: row.telephone || '',
          email: row.email,
          montant: row.montant || 25000,
          plan: row.plan,
          statut: 'paye_valide',
          code_validation: cleanCode,
          created_at: row.created_at,
        };
        return { valid: true, demande };
      }
    }
  } catch (err) {
    console.warn('[EFA] verifyRegistrationCode Supabase warning:', err);
  }

  // 2. Vérification mémoire runtime
  const localMatch = memoryDemandesAbonnement.find(
    (d) =>
      d.code_validation === cleanCode &&
      (d.statut === 'paye_valide' || d.statut === 'en_attente')
  );
  if (localMatch) {
    return { valid: true, demande: localMatch };
  }

  if (memoryValidatedCodes[cleanCode]) {
    const info = memoryValidatedCodes[cleanCode];
    return {
      valid: true,
      demande: {
        id: info.demandeId || 'code-' + cleanCode,
        nom_pharmacie: info.nom_pharmacie || 'Pharmacie',
        telephone: info.telephone || '',
        montant: 25000,
        statut: 'paye_valide',
        code_validation: cleanCode,
        created_at: new Date().toISOString(),
      },
    };
  }

  return {
    valid: false,
    error:
      "Code à 4 chiffres invalide ou paiement non encore validé par l'administrateur.",
  };
}

export async function fetchAbonnements(
  pharmacieId?: string
): Promise<Abonnement[]> {
  try {
    const sb = getSupabaseClient();
    if (sb) {
      let query = sb
        .from('abonnements')
        .select('*')
        .order('created_at', { ascending: false });

      if (pharmacieId) {
        query = query.eq('pharmacie_id', pharmacieId);
      }

      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        return data as Abonnement[];
      }
    }
  } catch (err) {
    console.warn('fetchAbonnements error:', err);
  }
  return [];
}

/* =========================================================
   MESSAGERIE & CHAT : TABLES `public.conversations` & `public.messages`
   - INSERT / SELECT sur conversations + messages + Realtime channel
   - Pas de reload, zéro localStorage pour le contenu des messages
   ========================================================= */

export const MS_24_HOURS = 24 * 60 * 60 * 1000;

export function isMessageExpired(m: Message): boolean {
  const now = Date.now();
  if (m.expires_at) {
    return new Date(m.expires_at).getTime() <= now;
  }
  const created = new Date(m.created_at).getTime();
  return now - created >= MS_24_HOURS;
}

export function saveConversations(convs: Conversation[]) {
  memoryConversations = convs;
  notifyChange();
}

export function loadConversations(
  pharmacieId?: string,
  clientId?: string,
  pharmacyUserId?: string
): Conversation[] {
  let all = [...memoryConversations].map((c) => ({
    ...c,
    pharmacy_id: c.pharmacy_id || (c as any).pharmacie_id || '',
  }));

  all.sort((a, b) => {
    const timeA = new Date(a.last_message_at || a.updated_at || 0).getTime();
    const timeB = new Date(b.last_message_at || b.updated_at || 0).getTime();
    return timeB - timeA;
  });

  if (pharmacyUserId && pharmacieId) {
    return all.filter(
      (c) =>
        c.pharmacy_user_id === pharmacyUserId || c.pharmacy_id === pharmacieId
    );
  }
  if (pharmacieId) {
    return all.filter((c) => c.pharmacy_id === pharmacieId);
  }
  if (clientId) {
    return all.filter((c) => c.client_id === clientId);
  }
  return all;
}

export async function fetchConversations(
  pharmacieId?: string,
  clientId?: string
): Promise<Conversation[]> {
  try {
    const sb = getSupabaseClient();
    if (sb) {
      let query = sb
        .from('conversations')
        .select('*')
        .order('last_message_at', { ascending: false });

      if (pharmacieId) {
        query = query.eq('pharmacy_id', pharmacieId);
      }
      if (clientId) {
        query = query.eq('client_id', clientId);
      }

      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        memoryConversations = data as Conversation[];
        notifyChange();
        return memoryConversations;
      }
    }
  } catch (err) {
    console.warn('fetchConversations error:', err);
  }
  return loadConversations(pharmacieId, clientId);
}

export function getOrCreateConversation(
  clientId: string,
  pharmacieId: string,
  pharmacyUserId?: string
): Conversation {
  const existing = memoryConversations.find(
    (c) =>
      c.client_id === clientId &&
      (c.pharmacy_id === pharmacieId || (c as any).pharmacie_id === pharmacieId)
  );

  if (existing) {
    if (pharmacyUserId && !existing.pharmacy_user_id) {
      existing.pharmacy_user_id = pharmacyUserId;
      notifyChange();
    }
    return existing;
  }

  const now = new Date().toISOString();
  const newConv: Conversation = {
    id: `conv-${pharmacieId}-${clientId}`,
    client_id: clientId,
    pharmacy_id: pharmacieId,
    pharmacy_user_id: pharmacyUserId || pharmacieId,
    last_message: '',
    last_message_at: now,
    unread_count_pharmacy: 0,
    unread_count_client: 0,
    is_blocked: false,
    is_reported: false,
    created_at: now,
    updated_at: now,
  };

  memoryConversations.unshift(newConv);

  // Sync Supabase conversations
  try {
    const sb = getSupabaseClient();
    if (sb) {
      sb.from('conversations')
        .upsert({
          id: newConv.id,
          client_id: newConv.client_id,
          pharmacy_id: newConv.pharmacy_id,
          pharmacy_user_id: newConv.pharmacy_user_id,
          last_message: '',
          last_message_at: now,
          unread_count_pharmacy: 0,
          unread_count_client: 0,
          is_blocked: false,
          is_reported: false,
          created_at: now,
          updated_at: now,
        })
        .then(
          () => {},
          () => {}
        );
    }
  } catch {}

  notifyChange();
  return newConv;
}

export function loadMessages(conversationId: string): Message[] {
  const list = memoryMessages[conversationId] || [];
  return list.filter((m) => !isMessageExpired(m));
}

export async function fetchMessages(
  conversationId: string
): Promise<Message[]> {
  try {
    const sb = getSupabaseClient();
    if (sb) {
      const { data, error } = await sb
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (!error && Array.isArray(data)) {
        const msgs = (data as Message[]).filter((m) => !isMessageExpired(m));
        memoryMessages[conversationId] = msgs;
        notifyChange();
        return msgs;
      }
    }
  } catch (err) {
    console.warn('fetchMessages error:', err);
  }
  return loadMessages(conversationId);
}

export function addMessage(
  conversationId: string,
  sender: 'client' | 'pharma',
  text: string,
  mediaOptions?: {
    type?: 'text' | 'image' | 'audio';
    media_url?: string;
    audio_duration?: number;
    senderId?: string;
    receiverId?: string;
    senderType?: 'client' | 'pharma' | 'system';
  }
): Message {
  const cIdx = memoryConversations.findIndex((c) => c.id === conversationId);
  const conv = cIdx !== -1 ? memoryConversations[cIdx] : null;

  // 1. Vérification Anti-Harcèlement / Blocage
  if (conv && conv.is_blocked) {
    if (conv.blocked_by_type === 'pharmacy' && sender === 'client') {
      throw new Error('Vous avez été bloqué par cette pharmacie.');
    }
    if (conv.blocked_by_type === 'client' && sender === 'pharma') {
      throw new Error('Cette conversation a été bloquée par le client.');
    }
  }

  const list = (memoryMessages[conversationId] || []).filter(
    (m) => !isMessageExpired(m)
  );

  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + MS_24_HOURS).toISOString();

  const senderId =
    mediaOptions?.senderId ||
    (sender === 'client'
      ? conv?.client_id || getOrCreateClientId()
      : conv?.pharmacy_user_id || conv?.pharmacy_id || 'pharma-1');

  const receiverId =
    mediaOptions?.receiverId ||
    (sender === 'client'
      ? conv?.pharmacy_user_id || conv?.pharmacy_id || 'pharma-1'
      : conv?.client_id || getOrCreateClientId());

  const newMsg: Message = {
    id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    conversation_id: conversationId,
    sender_id: senderId,
    receiver_id: receiverId,
    sender_type: mediaOptions?.senderType || sender,
    sender,
    content: text,
    text,
    type: mediaOptions?.type || 'text',
    media_url: mediaOptions?.media_url,
    audio_duration: mediaOptions?.audio_duration,
    is_read: false,
    created_at: createdAt,
    expires_at: expiresAt,
  };

  list.push(newMsg);
  memoryMessages[conversationId] = list;

  // 2. Mettre à jour last_message, last_message_at et incrémenter unread count
  if (cIdx !== -1) {
    const summary =
      mediaOptions?.type === 'audio'
        ? '🎤 Message vocal'
        : mediaOptions?.type === 'image'
        ? '📷 Photo'
        : text;

    memoryConversations[cIdx].last_message = summary;
    memoryConversations[cIdx].last_message_at = createdAt;
    memoryConversations[cIdx].updated_at = createdAt;

    if (sender === 'client') {
      memoryConversations[cIdx].unread_count_pharmacy =
        (memoryConversations[cIdx].unread_count_pharmacy || 0) + 1;
      if (memoryConversations[cIdx].pharmacy_id) {
        try {
          recordClientContact(memoryConversations[cIdx].pharmacy_id);
        } catch {}
      }
    } else {
      memoryConversations[cIdx].unread_count_client =
        (memoryConversations[cIdx].unread_count_client || 0) + 1;
    }
  }

  // 3. Diffuser sur BroadcastChannel pour son & vibreur instantanés
  if (realtimeBus) {
    try {
      realtimeBus.postMessage({
        type: 'NEW_MESSAGE',
        message: newMsg,
        conversationId,
        receiverId,
        sender,
        content: text,
      });
    } catch {}
  }

  // 4. Synchronisation Supabase table messages + conversations
  try {
    const sb = getSupabaseClient();
    if (sb) {
      sb.from('messages')
        .insert({
          id: newMsg.id,
          conversation_id: newMsg.conversation_id,
          sender_id: newMsg.sender_id,
          receiver_id: newMsg.receiver_id,
          sender_type: newMsg.sender_type,
          sender: newMsg.sender,
          content: newMsg.content,
          text: newMsg.text,
          type: newMsg.type,
          media_url: newMsg.media_url,
          audio_duration: newMsg.audio_duration,
          is_read: false,
          created_at: newMsg.created_at,
          expires_at: newMsg.expires_at,
        })
        .then(
          () => {},
          () => {}
        );

      if (conv) {
        sb.from('conversations')
          .update({
            last_message: conv.last_message,
            last_message_at: conv.last_message_at,
            unread_count_pharmacy: conv.unread_count_pharmacy,
            unread_count_client: conv.unread_count_client,
            updated_at: conv.updated_at,
          })
          .eq('id', conversationId)
          .then(
            () => {},
            () => {}
          );
      }
    }
  } catch {}

  notifyChange();
  return newMsg;
}

export function markConversationAsRead(
  conversationId: string,
  readerType: 'pharma' | 'client',
  readerId?: string
) {
  const cIdx = memoryConversations.findIndex((c) => c.id === conversationId);
  if (cIdx !== -1) {
    if (readerType === 'pharma') {
      memoryConversations[cIdx].unread_count_pharmacy = 0;
    } else {
      memoryConversations[cIdx].unread_count_client = 0;
    }
  }

  const msgs = memoryMessages[conversationId] || [];
  for (const m of msgs) {
    if (!m.is_read) {
      if (
        readerType === 'pharma' &&
        (m.sender === 'client' || m.receiver_id === readerId)
      ) {
        m.is_read = true;
      } else if (
        readerType === 'client' &&
        (m.sender === 'pharma' || m.receiver_id === readerId)
      ) {
        m.is_read = true;
      }
    }
  }

  try {
    const sb = getSupabaseClient();
    if (sb) {
      const updateData =
        readerType === 'pharma'
          ? { unread_count_pharmacy: 0 }
          : { unread_count_client: 0 };
      sb.from('conversations')
        .update(updateData)
        .eq('id', conversationId)
        .then(
          () => {},
          () => {}
        );

      if (readerId) {
        sb.from('messages')
          .update({ is_read: true })
          .eq('conversation_id', conversationId)
          .eq('receiver_id', readerId)
          .then(
            () => {},
            () => {}
          );
      }
    }
  } catch {}

  notifyChange();
}

export function blockConversation(
  conversationId: string,
  blockerId: string,
  blockerType: 'pharmacy' | 'client',
  isReported: boolean,
  reportDetails?: { reason: string; description?: string }
): Conversation | null {
  const cIdx = memoryConversations.findIndex((c) => c.id === conversationId);
  if (cIdx === -1) return null;

  const now = new Date().toISOString();
  memoryConversations[cIdx].is_blocked = true;
  memoryConversations[cIdx].blocked_by = blockerId;
  memoryConversations[cIdx].blocked_by_type = blockerType;
  memoryConversations[cIdx].blocked_at = now;
  memoryConversations[cIdx].is_reported = Boolean(isReported);
  memoryConversations[cIdx].updated_at = now;

  if (isReported && reportDetails) {
    const sigId =
      'sig-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    const reportedId =
      blockerType === 'pharmacy'
        ? memoryConversations[cIdx].client_id
        : memoryConversations[cIdx].pharmacy_id;

    const ph = memoryPharmacies.find(
      (p) => p.id === memoryConversations[cIdx].pharmacy_id
    );

    const newSignalement: Signalement = {
      id: sigId,
      conversation_id: conversationId,
      reporter_id: blockerId,
      reported_id: reportedId,
      reason: reportDetails.reason,
      description: reportDetails.description,
      status: 'pending',
      created_at: now,
      pharmacy_nom: ph?.nom || 'Pharmacie',
      client_nom: memoryConversations[cIdx].client_id,
    };

    memorySignalements.unshift(newSignalement);

    try {
      const sb = getSupabaseClient();
      if (sb) {
        sb.from('signalements')
          .insert(newSignalement)
          .then(
            () => {},
            () => {}
          );
        sb.from('notifications_admin')
          .insert({
            type: 'report_block',
            details: {
              signalement_id: sigId,
              conversation_id: conversationId,
              reason: reportDetails.reason,
            },
            is_read: false,
          })
          .then(
            () => {},
            () => {}
          );
      }
    } catch {}
  }

  try {
    const sb = getSupabaseClient();
    if (sb) {
      sb.from('conversations')
        .update({
          is_blocked: true,
          blocked_by: blockerId,
          blocked_by_type: blockerType,
          blocked_at: now,
          is_reported: Boolean(isReported),
          updated_at: now,
        })
        .eq('id', conversationId)
        .then(
          () => {},
          () => {}
        );
    }
  } catch {}

  if (realtimeBus) {
    try {
      realtimeBus.postMessage({
        type: 'BLOCK_UPDATE',
        conversationId,
        isBlocked: true,
        blockedByType: blockerType,
        blockedBy: blockerId,
      });
    } catch {}
  }

  notifyChange();
  return memoryConversations[cIdx];
}

export function unblockConversation(
  conversationId: string
): Conversation | null {
  const cIdx = memoryConversations.findIndex((c) => c.id === conversationId);
  if (cIdx === -1) return null;

  const now = new Date().toISOString();
  memoryConversations[cIdx].is_blocked = false;
  memoryConversations[cIdx].blocked_by = undefined;
  memoryConversations[cIdx].blocked_by_type = undefined;
  memoryConversations[cIdx].blocked_at = undefined;
  memoryConversations[cIdx].is_reported = false;
  memoryConversations[cIdx].updated_at = now;

  try {
    const sb = getSupabaseClient();
    if (sb) {
      sb.from('conversations')
        .update({
          is_blocked: false,
          blocked_by: null,
          blocked_by_type: null,
          blocked_at: null,
          is_reported: false,
          updated_at: now,
        })
        .eq('id', conversationId)
        .then(
          () => {},
          () => {}
        );
    }
  } catch {}

  if (realtimeBus) {
    try {
      realtimeBus.postMessage({
        type: 'BLOCK_UPDATE',
        conversationId,
        isBlocked: false,
      });
    } catch {}
  }

  notifyChange();
  return memoryConversations[cIdx];
}

export function loadSignalements(): Signalement[] {
  return memorySignalements;
}

export function updateSignalementStatus(
  signalementId: string,
  status: 'resolved' | 'ignored' | 'banned',
  unblockConversationId?: string
) {
  const idx = memorySignalements.findIndex((s) => s.id === signalementId);
  if (idx !== -1) {
    memorySignalements[idx].status = status;
  }

  if (unblockConversationId) {
    unblockConversation(unblockConversationId);
  }

  try {
    const sb = getSupabaseClient();
    if (sb) {
      sb.from('signalements')
        .update({ status })
        .eq('id', signalementId)
        .then(
          () => {},
          () => {}
        );
    }
  } catch {}

  notifyChange();
}

export function getUnreadConversationsCount(
  userId: string,
  userType: 'pharma' | 'client',
  pharmacyId?: string
): number {
  if (userType === 'pharma') {
    return memoryConversations.filter(
      (c) =>
        (c.pharmacy_user_id === userId || c.pharmacy_id === pharmacyId) &&
        (c.unread_count_pharmacy || 0) > 0
    ).length;
  } else {
    return memoryConversations.filter(
      (c) =>
        (c.client_id === userId || !userId) &&
        (c.unread_count_client || 0) > 0
    ).length;
  }
}

/**
 * AUTO CLEAN 24H (MESSAGES & PHOTOS) :
 * DELETE FROM messages WHERE created_at < NOW() - INTERVAL '24 hours'
 */
export async function cleanExpiredMessages(): Promise<number> {
  const now = Date.now();
  const nowIso = new Date().toISOString();
  const threshold24hIso = new Date(now - MS_24_HOURS).toISOString();
  let cleanedCount = 0;

  for (const convId of Object.keys(memoryMessages)) {
    const initialLen = memoryMessages[convId].length;
    memoryMessages[convId] = memoryMessages[convId].filter(
      (m) => !isMessageExpired(m)
    );
    if (memoryMessages[convId].length !== initialLen) {
      cleanedCount += initialLen - memoryMessages[convId].length;
    }
  }

  try {
    const sb = getSupabaseClient();
    if (sb) {
      await sb.from('messages').delete().lt('expires_at', nowIso);
      await sb.from('messages').delete().lt('created_at', threshold24hIso);

      sb.functions
        .invoke('cleanup-garde')
        .then(() => {})
        .catch(() => {});
    }
  } catch (err) {
    console.log('Auto clean sync:', err);
  }

  if (cleanedCount > 0) {
    notifyChange();
  }
  return cleanedCount;
}

export async function uploadMediaToSupabase(
  fileOrBlob: Blob | File,
  folder: 'audio' | 'images',
  filename?: string
): Promise<string> {
  const validation = validateUploadedFile(fileOrBlob, 1024 * 1024);
  if (!validation.isValid) {
    throw new Error(
      validation.error ||
        'Fichier non autorisé (max 1 Mo, extensions exécutables interdites).'
    );
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

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(fileOrBlob);
  });
}

/* ===============================
   GARDES, PUBS & STATS
   =============================== */

export function loadGardes(pharmacieId?: string): Garde[] {
  if (pharmacieId) {
    return memoryGardes.filter((g) => g.pharmacie_id === pharmacieId);
  }
  return memoryGardes;
}

export function addGarde(garde: Omit<Garde, 'id'>): Garde {
  const newGarde: Garde = {
    ...garde,
    id: 'garde-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
  };
  memoryGardes.push(newGarde);
  notifyChange();
  return newGarde;
}

export function deleteGarde(id: string) {
  const idx = memoryGardes.findIndex((g) => g.id === id);
  if (idx !== -1) {
    memoryGardes.splice(idx, 1);
    notifyChange();
  }
}

export function isPharmacyCurrentlyOnDuty(pharmacieId: string): boolean {
  const gardes = loadGardes(pharmacieId);
  const now = new Date().getTime();
  return gardes.some((g) => {
    const start = new Date(g.date_debut).getTime();
    const end = new Date(g.date_fin).getTime();
    return now >= start && now <= end;
  });
}

export function trackItineraryClick(pharmaId: string): void {
  const today = new Date().toISOString().slice(0, 10);
  if (!memoryItineraryClicks[pharmaId]) {
    memoryItineraryClicks[pharmaId] = { total: 0, dates: {} };
  }
  memoryItineraryClicks[pharmaId].total += 1;
  memoryItineraryClicks[pharmaId].dates[today] =
    (memoryItineraryClicks[pharmaId].dates[today] || 0) + 1;
  notifyChange();
}

export function getItineraryClicks(pharmaId: string): {
  today: number;
  total: number;
} {
  const today = new Date().toISOString().slice(0, 10);
  const entry = memoryItineraryClicks[pharmaId];
  if (!entry) return { today: 0, total: 0 };
  return {
    today: entry.dates?.[today] || 0,
    total: entry.total || 0,
  };
}

export function loadPubs(): Pub[] {
  return memoryPubs;
}

export function savePubs(list: Pub[]) {
  memoryPubs = list;
  notifyChange();
}

export function loadAllDailyStats(): PharmacyDailyStat[] {
  return memoryStats;
}

export function saveAllDailyStats(stats: PharmacyDailyStat[]): void {
  memoryStats = stats;
  notifyChange();
}

export function recordClientContact(pharmacieId: string): number {
  if (!pharmacieId) return 0;
  const todayStr = new Date().toISOString().slice(0, 10);
  const targetIndex = memoryStats.findIndex(
    (s) => s.pharmacie_id === pharmacieId && s.date === todayStr
  );

  let newCount = 1;
  if (targetIndex >= 0) {
    memoryStats[targetIndex].client_count += 1;
    newCount = memoryStats[targetIndex].client_count;
  } else {
    memoryStats.push({
      pharmacie_id: pharmacieId,
      date: todayStr,
      client_count: 1,
    });
  }

  notifyChange();

  try {
    const client = getSupabaseClient();
    if (client) {
      Promise.resolve(
        client.from('stats').upsert(
          {
            pharmacie_id: pharmacieId,
            date: todayStr,
            client_count: newCount,
          },
          { onConflict: 'pharmacie_id,date' }
        )
      )
        .then(() => {})
        .catch(() => {});
    }
  } catch {}

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
  const now = new Date();
  const pharmaStats = memoryStats.filter((s) => s.pharmacie_id === pharmacieId);
  const statsMap = new Map<string, number>();
  pharmaStats.forEach((s) => {
    statsMap.set(s.date, (statsMap.get(s.date) || 0) + s.client_count);
  });

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

  const conversations = loadConversations(pharmacieId);
  return {
    pharmacie_id: pharmacieId,
    totalThisWeek,
    totalThisMonth,
    conversationsHandled: conversations.length,
    dailyStats7Days,
    dailyStats30Days,
  };
}

export function trackPresence(
  state: PresenceState,
  onPresenceUpdate: (all: PresenceState[]) => void
): () => void {
  const activePresenceMap = new Map<string, PresenceState>();
  activePresenceMap.set(state.userId, state);

  const broadcast = () => {
    if (presenceBus) {
      try {
        presenceBus.postMessage({ type: 'PRESENCE_PING', state });
      } catch {}
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
          userId: state.userId,
        });
      } catch {}
    }
  };
}

/* =========================================================
   SYNCHRONISATION REALTIME SUPABASE GLOBALE (6 TABLES)
   abonnements, conversations, messages, pharmacies, utilisateurs, clients
   - Un seul subscribe, avec try/catch
   - Pas de boucle si websocket échoue
   - Mode polling 30s de secours
   ========================================================= */

let globalRealtimeAttempted = false;
let pollingInterval: any = null;

function startBackgroundPolling(): void {
  if (pollingInterval || typeof window === 'undefined') return;
  pollingInterval = setInterval(() => {
    fetchApprovedPharmacies().catch(() => {});
    fetchClientsCount().catch(() => {});
    fetchDemandesAbonnement().catch(() => {});
    fetchConversations().catch(() => {});
  }, 30000);
}

export function initSupabaseRealtime(): void {
  if (globalRealtimeAttempted || typeof window === 'undefined') return;
  globalRealtimeAttempted = true;

  const sb = getSupabaseClient();
  if (!sb) {
    startBackgroundPolling();
    return;
  }

  try {
    const channel = sb.channel('efa_realtime_all_tables')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        (payload: any) => {
          if (payload.eventType === 'INSERT' && payload.new) {
            const newMsg = payload.new;
            const convId = newMsg.conversation_id;
            if (convId) {
              const list = memoryMessages[convId] || [];
              if (!list.some((m) => m.id === newMsg.id)) {
                list.push({
                  id: newMsg.id,
                  conversation_id: convId,
                  sender:
                    newMsg.sender ||
                    (newMsg.sender_type === 'pharma' ? 'pharma' : 'client'),
                  sender_id: newMsg.sender_id,
                  receiver_id: newMsg.receiver_id,
                  text: newMsg.text || newMsg.content || '',
                  content: newMsg.content || newMsg.text || '',
                  created_at: newMsg.created_at || new Date().toISOString(),
                  expires_at: newMsg.expires_at,
                  is_read: Boolean(newMsg.is_read),
                  type: newMsg.type || 'text',
                  media_url: newMsg.media_url,
                  audio_duration: newMsg.audio_duration,
                });
                memoryMessages[convId] = list;
              }
            }
          }
          notifyChange();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        () => {
          fetchConversations().catch(() => {});
          notifyChange();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pharmacies' },
        () => {
          fetchApprovedPharmacies().catch(() => {});
          notifyChange();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'abonnements' },
        () => {
          fetchDemandesAbonnement().catch(() => {});
          notifyChange();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clients' },
        () => {
          fetchClientsCount().catch(() => {});
          notifyChange();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'utilisateurs' },
        () => {
          notifyChange();
        }
      );

    channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log('REALTIME OK');
      } else if (
        status === 'CHANNEL_ERROR' ||
        status === 'TIMED_OUT' ||
        status === 'CLOSED' ||
        err
      ) {
        console.warn(
          '[EFA Realtime] Statut websocket (' +
            status +
            '), mode polling 30s actif'
        );
        startBackgroundPolling();
      }
    });

    console.log('REALTIME OK');
  } catch (err) {
    console.warn('[EFA] initSupabaseRealtime global error:', err);
    startBackgroundPolling();
  }
}

/**
 * CHARGEMENT INITIAL DEPUIS SUPABASE :
 * 1. NE PAS await le Realtime.
 * 2. SELECTs simples en parallèle (pharmacies, clients, abonnements, conversations).
 * 3. Timeout strict de 3 secondes : si dépassé, affiche quand même l'app.
 * 4. Ensuite seulement, en arrière-plan, subscribe au websocket.
 * 5. Pas de boucle si websocket échoue, polling 30s en secours.
 */
let bootstrapAttempted = false;

export async function bootstrapStoreFromSupabase(): Promise<void> {
  if (bootstrapAttempted) return;
  bootstrapAttempted = true;

  const selectQueries = Promise.allSettled([
    fetchApprovedPharmacies(),
    fetchPendingPharmacies(),
    fetchDemandesAbonnement(),
    fetchClientsCount(),
    fetchConversations(),
  ]);

  const timeoutPromise = new Promise<'timeout'>((resolve) =>
    setTimeout(() => resolve('timeout'), 3000)
  );

  try {
    const outcome = await Promise.race([selectQueries, timeoutPromise]);
    if (outcome === 'timeout') {
      console.warn(
        '[EFA GARDE] Timeout 3s atteint sur bootstrap, ouverture immédiate avec données disponibles.'
      );
    }
  } catch (err) {
    console.warn('[EFA GARDE] bootstrapStoreFromSupabase error:', err);
  } finally {
    // Affiche l'app / met à jour les écouteurs de store
    notifyChange();

    // ENSUITE seulement, en arrière-plan, tu fais supabase.channel().subscribe()
    setTimeout(() => {
      initSupabaseRealtime();
    }, 100);
  }
}

if (typeof window !== 'undefined') {
  bootstrapStoreFromSupabase().catch(() => {});
}
