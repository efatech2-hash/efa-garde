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
let memoryGardes: Garde[] = [];
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
    return supabase;
  }

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

/**
 * Enregistre un utilisateur dans `public.utilisateurs` et `public.users`
 * Modèle identique à `user_consents` : INSERT direct via supabase.from(...).insert([...])
 */
export async function registerUserInDB(data: {
  auth_user_id?: string | null;
  email?: string | null;
  nom: string;
  role: 'client' | 'pharma' | 'admin' | 'super_admin';
  telephone?: string | null;
  pharmacie_id?: string | null;
}): Promise<void> {
  const now = new Date().toISOString();
  const row = {
    auth_user_id: data.auth_user_id || null,
    email: data.email || null,
    nom: data.nom,
    role: data.role,
    telephone: data.telephone || null,
    pharmacie_id: data.pharmacie_id || null,
    created_at: now,
    updated_at: now,
  };

  try {
    const sb = getSupabaseClient();
    if (sb) {
      const { error: utilisateursError } = await sb
        .from('utilisateurs')
        .insert([row]);
      if (utilisateursError) {
        console.warn('[EFA GARDE] INSERT utilisateurs:', utilisateursError.message);
      }

      const { error: usersError } = await sb.from('users').insert([row]);
      if (usersError) {
        console.warn('[EFA GARDE] INSERT users:', usersError.message);
      }
    }
  } catch (err) {
    console.warn('[EFA GARDE] registerUserInDB warning:', err);
  }
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

export function getPharmacyListTier(p: Partial<Pharmacie> | null | undefined): 0 | 1 | 2 {
  if (!p) return 2;
  const planStr = String(p.plan || '').toLowerCase();
  const subPlanStr = String(p.subscription_plan || '').toLowerCase();

  // 0 = JAUNE (PLAN STAR mensuel 15.000F + PLAN STAR annuel 140.000F)
  const isStarYellow = Boolean(
    p.etoile_doree ||
      p.is_premium ||
      subPlanStr === 'premium' ||
      planStr === 'populaire_mensuel' ||
      planStr === 'populaire_annuel' ||
      planStr.includes('star') ||
      planStr === 'top'
  );
  if (isStarYellow) return 0;

  // 1 = VERT (90.000F/an / Enregistrement 25.000F / abonnement actif standard)
  const isPaidGreen = Boolean(
    p.subscription_status === 'active' ||
      p.is_registered ||
      subPlanStr === 'basic' ||
      planStr === 'register' ||
      planStr === 'annual' ||
      planStr === '60k' ||
      planStr === '90k' ||
      planStr.includes('enregistrement') ||
      planStr.includes('annuel') ||
      planStr.includes('annual')
  );
  if (isPaidGreen) return 1;

  // 2 = GRIS (Gratuit / sans abonnement)
  return 2;
}

/**
 * Règle Chat Client :
 * - Gratuit / enregistrement seul / expiré = PAS de bouton Chat
 * - Seulement Standard 90.000F (annual / annuel / 90k / 60k actif)
 *   + PLAN STAR 15.000F/140.000F (star_mensuel / star_annuel / populaire_* / etoile_doree actif)
 *   quand is_garde = true ET is_active !== false
 */
export function canPharmacyUseChat(
  p: Partial<Pharmacie> | null | undefined
): boolean {
  if (!p) return false;
  if (p.is_active === false) return false;
  const isGarde = Boolean(p.is_garde ?? p.is_online);
  if (!isGarde) return false;

  const subStatus = String(p.subscription_status || '').toLowerCase();
  if (
    subStatus === 'expired' ||
    subStatus === 'rejete' ||
    subStatus === 'canceled'
  ) {
    return false;
  }

  const rawEnd = p.subscription_end_at || p.subscription_end;
  if (rawEnd) {
    const endMs = new Date(rawEnd).getTime();
    if (Number.isFinite(endMs) && endMs <= Date.now()) {
      return false;
    }
  }
  if (
    typeof p.subscription_days_left === 'number' &&
    p.subscription_days_left <= 0 &&
    rawEnd
  ) {
    return false;
  }

  const planStr = String(p.plan || '').toLowerCase();
  const subPlanStr = String(p.subscription_plan || '').toLowerCase();

  if (planStr === 'free' || planStr === 'gratuit') {
    return false;
  }

  // PLAN STAR 15.000F / 140.000F
  const isStar = Boolean(
    p.etoile_doree ||
      p.is_premium ||
      subPlanStr === 'premium' ||
      planStr === 'populaire_mensuel' ||
      planStr === 'populaire_annuel' ||
      planStr.includes('star') ||
      planStr === 'top'
  );
  if (isStar) {
    return true;
  }

  // Standard 90.000F (annual / annuel_officine / 90k / 60k)
  const isStandard90k =
    planStr === 'annual' ||
    planStr === '90k' ||
    planStr === '60k' ||
    planStr.includes('annuel') ||
    planStr.includes('annual') ||
    planStr.includes('standard') ||
    Number(p.prix) >= 60000;

  if (isStandard90k && (subStatus === 'active' || !rawEnd)) {
    return true;
  }

  return false;
}

export function sortPharmaciesPriority(list: Pharmacie[]): Pharmacie[] {
  return [...list].sort((a, b) => {
    const tierA = getPharmacyListTier(a);
    const tierB = getPharmacyListTier(b);

    // 1. Hiérarchie stricte : Jaunes (0) > Verts (1) > Gris (2)
    if (tierA !== tierB) return tierA - tierB;

    // 2. Pour PLAN STAR : position (asc) puis etoile_doree
    if (tierA === 0) {
      const posA = a.position !== undefined ? a.position : 999;
      const posB = b.position !== undefined ? b.position : 999;
      if (posA !== posB) return posA - posB;
      if (a.etoile_doree && !b.etoile_doree) return -1;
      if (!a.etoile_doree && b.etoile_doree) return 1;
    }

    // 3. Ordre alphabétique
    return (a.nom || '').localeCompare(b.nom || '');
  });
}

/* =========================================================
   PHARMACIES : 100% SUPABASE TABLE `pharmacies` & VUE `view_pharmacies_garde`
   - Carte publique : SELECT * FROM view_pharmacies_garde (is_active=true)
   - Garde gérée par is_garde uniquement
   - pharmacies_pending unifiée sur `status` + `id` UUID
   ========================================================= */

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(val: unknown): val is string {
  return typeof val === 'string' && UUID_REGEX.test(val.trim());
}

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Génère un UUID déterministe (RFC-4122) à partir de deux chaînes (ex: pharmacyId + clientId)
 * afin que client & pharmacie produisent le même conversation_id valide (compatible UUID et TEXT).
 */
function deterministicUuidFromSeed(seed: string): string {
  let h1 = 0xdeadbeef ^ seed.length;
  let h2 = 0x41c6ce57 ^ seed.length;
  let h3 = 0x9e3779b9;
  let h4 = 0x85ebca6b;
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
    h3 = Math.imul(h3 ^ (ch + i), 2246822519);
    h4 = Math.imul(h4 ^ (ch * 31), 3266489917);
  }
  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  const raw = (hex(h1) + hex(h2) + hex(h3) + hex(h4)).slice(0, 32);
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-4${raw.slice(13, 16)}-8${raw.slice(17, 20)}-${raw.slice(20, 32)}`;
}

function parseCoord(val: unknown, fallback: number): number {
  if (val === null || val === undefined || val === '') return fallback;
  const cleaned = typeof val === 'string' ? val.replace(',', '.').trim() : val;
  const n = Number(cleaned);
  return Number.isFinite(n) && n !== 0 ? n : fallback;
}

function isStarPlanName(plan?: string | null): boolean {
  if (!plan) return false;
  const p = plan.toLowerCase();
  return (
    p.includes('star') ||
    p.includes('populaire') ||
    p === 'top' ||
    p === 'premium'
  );
}

function isPaidGreenPlanName(plan?: string | null): boolean {
  if (!plan) return false;
  const p = plan.toLowerCase();
  return (
    p.includes('enregistrement') ||
    p.includes('25k') ||
    p.includes('annuel') ||
    p.includes('annual') ||
    p.includes('90k') ||
    p.includes('60k') ||
    p === 'register' ||
    p === 'basic'
  );
}

function normalizePharmacyRow(p: any): Pharmacie {
  const isGarde = Boolean(p.is_garde ?? p.is_online);
  const isActive = p.is_active !== false;
  const phone = String(p.phone || p.tel || '');
  const lat = parseCoord(p.lat ?? p.latitude, 6.1319);
  const lng = parseCoord(p.lng ?? p.longitude, 1.2228);
  return {
    ...p,
    nom: p.nom || 'Pharmacie',
    tel: phone,
    phone,
    adresse: p.adresse || '',
    quartier: p.quartier || 'Lomé',
    lat,
    lng,
    latitude: p.latitude ?? lat,
    longitude: p.longitude ?? lng,
    plan: p.plan || 'free',
    is_garde: isGarde,
    is_online: isGarde,
    is_verified: Boolean(p.is_verified),
    is_active: isActive,
    is_pending: isActive ? false : Boolean(p.is_pending),
  };
}

function applyAbonnementsToPharmacies(
  list: Pharmacie[],
  abns: DemandeAbonnement[]
): Pharmacie[] {
  if (!Array.isArray(abns) || abns.length === 0) return list;

  const nowMs = Date.now();
  const isPaidStatut = (st?: string) => {
    const s = (st || '').toLowerCase();
    return s === 'paye_valide' || s === 'active' || s === 'actif';
  };
  const isExpiredRow = (a: DemandeAbonnement) => {
    if (!a.expire_le) return false;
    const expMs = new Date(a.expire_le).getTime();
    return Number.isFinite(expMs) && expMs <= nowMs;
  };

  const validAbns = abns.filter((a) => isPaidStatut(a.statut) && !isExpiredRow(a));
  const expiredAbns = abns.filter((a) => isPaidStatut(a.statut) && isExpiredRow(a));

  return list.map((p) => {
    const cleanName = (p.nom || '').trim().toLowerCase();
    const matchesTarget = (a: DemandeAbonnement) => {
      const abnPharmaId = a.pharmacy_id || a.pharmacie_id;
      if (abnPharmaId && p.id && abnPharmaId === p.id) return true;
      const abnNom = (a.nom_pharmacie || '').trim().toLowerCase();
      if (abnNom && cleanName && abnNom === cleanName) return true;
      return false;
    };

    const matches = validAbns.filter(matchesTarget);

    if (matches.length === 0) {
      // Si l'officine avait uniquement des abonnements expirés et pas d'autre actif,
      // on marque l'abonnement comme expiré pour masquer le bouton Chat
      const hasOnlyExpiredAbn = expiredAbns.some(matchesTarget);
      const rawEnd = p.subscription_end_at || p.subscription_end;
      const hasExpiredPharmaDate =
        Boolean(rawEnd) &&
        Number.isFinite(new Date(rawEnd as string).getTime()) &&
        new Date(rawEnd as string).getTime() <= nowMs;
      if (hasOnlyExpiredAbn || hasExpiredPharmaDate) {
        return {
          ...p,
          subscription_status: 'expired',
          etoile_doree: false,
          is_premium: false,
        };
      }
      return p;
    }

    const starMatch = matches.find((a) => isStarPlanName(a.plan));
    if (starMatch) {
      return {
        ...p,
        plan: starMatch.plan?.toLowerCase().includes('annuel')
          ? 'populaire_annuel'
          : 'populaire_mensuel',
        etoile_doree: true,
        is_premium: true,
        subscription_plan: 'premium',
        subscription_status: 'active',
        subscription_end_at: starMatch.expire_le || p.subscription_end_at,
      };
    }

    // Prioriser Standard 90.000F / annuel avant enregistrement_25k
    const annualMatch = matches.find((a) => {
      const lower = (a.plan || '').toLowerCase();
      return (
        lower.includes('annuel') ||
        lower.includes('annual') ||
        lower.includes('90') ||
        lower.includes('60') ||
        lower.includes('standard') ||
        Number(a.montant) >= 60000
      );
    });
    if (annualMatch) {
      return {
        ...p,
        plan: 'annual',
        is_registered: true,
        subscription_plan: 'basic',
        subscription_status: 'active',
        subscription_end_at: annualMatch.expire_le || p.subscription_end_at,
        prix: Number(annualMatch.montant) || 90000,
      };
    }

    const greenMatch = matches.find(
      (a) => isPaidGreenPlanName(a.plan) || !a.plan
    );
    if (greenMatch) {
      const lowerPlan = (greenMatch.plan || '').toLowerCase();
      return {
        ...p,
        plan:
          lowerPlan.includes('annuel') ||
          lowerPlan.includes('annual') ||
          lowerPlan.includes('90') ||
          lowerPlan.includes('60')
            ? 'annual'
            : p.plan && p.plan !== 'free'
            ? p.plan
            : 'register',
        is_registered: true,
        subscription_plan: p.subscription_plan || 'basic',
        subscription_status: 'active',
        subscription_end_at: greenMatch.expire_le || p.subscription_end_at,
      };
    }

    return p;
  });
}

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
 * Lit `public.garde_planning` depuis Supabase :
 * - activeIds : pharmacy_id dont `now() BETWEEN date_debut AND date_fin`
 * - plannedIds : toutes les pharmacy_id ayant au moins une garde planifiée
 */
export async function fetchGardePlanningStatus(): Promise<{
  activeIds: Set<string>;
  plannedIds: Set<string>;
  ok: boolean;
}> {
  const activeIds = new Set<string>();
  const plannedIds = new Set<string>();
  try {
    const client = getSupabaseClient();
    if (!client) return { activeIds, plannedIds, ok: false };

    const nowIso = new Date().toISOString();
    const [activeRes, allRes] = await Promise.all([
      client
        .from('garde_planning')
        .select('pharmacy_id')
        .lte('date_debut', nowIso)
        .gte('date_fin', nowIso),
      client.from('garde_planning').select('pharmacy_id'),
    ]);

    if (activeRes.error) {
      console.warn('[EFA GARDE] SELECT garde_planning actif:', activeRes.error.message);
      return { activeIds, plannedIds, ok: false };
    }

    if (Array.isArray(activeRes.data)) {
      for (const row of activeRes.data as any[]) {
        const pid = String(row.pharmacy_id || '');
        if (pid) activeIds.add(pid);
      }
    }

    if (!allRes.error && Array.isArray(allRes.data)) {
      for (const row of allRes.data as any[]) {
        const pid = String(row.pharmacy_id || '');
        if (pid) plannedIds.add(pid);
      }
    }

    return { activeIds, plannedIds, ok: true };
  } catch (err) {
    console.warn('[EFA GARDE] fetchGardePlanningStatus error:', err);
    return { activeIds, plannedIds, ok: false };
  }
}

function applyGardePlanningToPharmacies(
  list: Pharmacie[],
  planning: { activeIds: Set<string>; plannedIds: Set<string>; ok: boolean }
): Pharmacie[] {
  if (!planning.ok) return list;
  return list.map((p) => {
    const hasActiveGarde = planning.activeIds.has(p.id);
    const hasAnyPlanning = planning.plannedIds.has(p.id);
    const isGarde = hasActiveGarde
      ? true
      : hasAnyPlanning
      ? false
      : Boolean(p.is_garde);
    return {
      ...p,
      is_garde: isGarde,
      is_online: isGarde,
    };
  });
}

/**
 * Charge TOUTES les pharmacies depuis Supabase (pour Super Admin)
 */
export async function fetchPharmacies(): Promise<Pharmacie[]> {
  try {
    const client = getSupabaseClient();
    if (client) {
      const [{ data, error }, planning] = await Promise.all([
        client.from('pharmacies').select('*'),
        fetchGardePlanningStatus(),
      ]);

      if (!error && data && Array.isArray(data)) {
        const clean = data
          .map(normalizePharmacyRow)
          .filter((p) => !isDemoPharmacy(p));
        const withPlanning = applyGardePlanningToPharmacies(clean, planning);
        const enriched = applyAbonnementsToPharmacies(
          withPlanning,
          memoryDemandesAbonnement
        );
        const sorted = sortPharmaciesPriority(enriched);
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
 * CARTE PUBLIQUE : Lecture view_pharmacies_garde WHERE is_active=true
 * Fallback obligatoire : SELECT * FROM public.pharmacies WHERE is_active=true
 * Statut DE GARDE calculé depuis Supabase `garde_planning` (now() BETWEEN date_debut AND date_fin).
 */
export async function fetchApprovedPharmacies(): Promise<Pharmacie[]> {
  try {
    const client = getSupabaseClient();
    if (client) {
      let { data, error } = await client
        .from('view_pharmacies_garde')
        .select('*')
        .eq('is_active', true);

      if (error || !Array.isArray(data) || data.length === 0) {
        if (error) {
          console.warn(
            '[EFA GARDE] view_pharmacies_garde fallback vers pharmacies:',
            error.message
          );
        }
        const fallbackRes = await client
          .from('pharmacies')
          .select('*')
          .eq('is_active', true);
        data = fallbackRes.data;
        error = fallbackRes.error;
      }

      if (error) {
        console.error('[EFA GARDE] Erreur SELECT pharmacies:', error.message);
      }

      if (!error && data && Array.isArray(data)) {
        const planning = await fetchGardePlanningStatus();

        if (memoryDemandesAbonnement.length === 0) {
          const { data: abnData } = await client
            .from('abonnements')
            .select('*')
            .order('created_at', { ascending: false });
          if (Array.isArray(abnData)) {
            memoryDemandesAbonnement = abnData.map((d: any) => ({
              id: d.id,
              nom_pharmacie: d.nom_pharmacie || d.pharmacie_nom || 'Pharmacie',
              telephone: d.telephone || d.phone || '',
              email: d.email,
              montant: Number(d.montant) || 25000,
              plan: d.plan || 'enregistrement_25k',
              statut:
                d.statut === 'paye_valide' ||
                d.statut === 'active' ||
                d.statut === 'actif'
                  ? 'paye_valide'
                  : d.statut || 'en_attente',
              code_validation: d.code_validation,
              created_at: d.created_at || new Date().toISOString(),
              validated_at: d.validated_at,
              pharmacy_id: d.pharmacy_id || d.pharmacie_id,
              pharmacie_id: d.pharmacy_id || d.pharmacie_id,
              expire_le: d.expire_le,
            }));
          }
        }

        const clean = data
          .map(normalizePharmacyRow)
          .filter((p) => !isDemoPharmacy(p) && p.is_active !== false);
        const withPlanning = applyGardePlanningToPharmacies(clean, planning);
        const enriched = applyAbonnementsToPharmacies(
          withPlanning,
          memoryDemandesAbonnement
        );
        const sorted = sortPharmaciesPriority(enriched);

        console.log(sorted);

        // Préserve les inactives déjà en mémoire pour l'admin
        const inactiveOrOther = memoryPharmacies.filter((p) => p.is_active === false);
        memoryPharmacies = sortPharmaciesPriority([...sorted, ...inactiveOrOther]);
        notifyChange();
        return sorted;
      }
    }
  } catch (err) {
    console.warn('[EFA GARDE] fetchApprovedPharmacies fallback:', err);
  }
  const fallbackList = loadApprovedPharmacies();
  console.log(fallbackList);
  return fallbackList;
}

export function loadApprovedPharmacies(): Pharmacie[] {
  return memoryPharmacies.filter((p) => {
    if (isDemoPharmacy(p)) return false;
    if (p.is_active === false) return false;
    return true;
  });
}

export function loadAllPharmaciesWithPending(): Pharmacie[] {
  return loadApprovedPharmacies();
}

/**
 * Super Admin : Liste des pharmacies en attente de vérification (`status = 'pending'`)
 */
export function loadPendingPharmacies(): PharmaciePending[] {
  return memoryPendingPharmacies.filter((p) => p.status === 'pending');
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
        .from('pharmacies_pending')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (!error && data && Array.isArray(data)) {
        const list: PharmaciePending[] = data.map((p: any) => ({
          id: p.id,
          nom: p.nom,
          quartier: p.quartier || 'Lomé',
          adresse: p.adresse || '',
          phone: p.phone || p.tel || '',
          titulaire: p.titulaire || 'Titulaire Officine',
          numero_ordre: p.numero_ordre,
          piece_url: p.piece_url,
          photo_url: p.photo_url,
          email_pro: p.email_pro,
          mot_de_passe: p.mot_de_passe,
          lat: p.lat || 6.1319,
          lng: p.lng || 1.2228,
          status: 'pending',
          created_at: p.created_at || new Date().toISOString(),
        }));
        memoryPendingPharmacies = list;
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
 * INSERT INTO public.pharmacies_pending (id uuid, status='pending') sans doublon dans pharmacies.
 * Le transfert vers public.pharmacies se fait automatiquement lors de la validation Super Admin.
 */
export async function addPendingPharmacy(
  entry: Omit<PharmaciePending, 'id' | 'status' | 'created_at'>
): Promise<PharmaciePending> {
  const id = generateUuid();
  const now = new Date().toISOString();

  const newPending: PharmaciePending = {
    ...entry,
    id,
    status: 'pending',
    created_at: now,
  };

  memoryPendingPharmacies.unshift(newPending);

  try {
    const client = getSupabaseClient();
    if (client) {
      // 1. INSERT dans public.pharmacies_pending (id UUID, status='pending')
      const { error: pendingErr } = await client
        .from('pharmacies_pending')
        .insert([
          {
            id,
            nom: entry.nom,
            quartier: entry.quartier || 'Lomé',
            adresse: entry.adresse || '',
            phone: entry.phone,
            titulaire: entry.titulaire || 'Titulaire Officine',
            numero_ordre: entry.numero_ordre || 'EN-ATTENTE',
            piece_url: entry.piece_url || null,
            photo_url: entry.photo_url || null,
            email_pro: entry.email_pro || null,
            mot_de_passe: entry.mot_de_passe || null,
            lat: entry.lat || 6.1319,
            lng: entry.lng || 1.2228,
            status: 'pending',
            created_at: now,
            submitted_at: now,
          },
        ]);
      if (pendingErr) {
        console.warn(
          '[EFA GARDE] INSERT pharmacies_pending:',
          pendingErr.message
        );
      }

      // 2. INSERT dans public.pre_inscriptions
      const { error: preErr } = await client.from('pre_inscriptions').insert([
        {
          id: generateUuid(),
          nom_pharmacie: entry.nom,
          telephone: entry.phone,
          email: entry.email_pro || null,
          quartier: entry.quartier || 'Lomé',
          adresse: entry.adresse || '',
          titulaire: entry.titulaire || 'Titulaire Officine',
          numero_ordre: entry.numero_ordre || null,
          montant: 25000,
          statut: 'formulaire_soumis',
          created_at: now,
          updated_at: now,
        },
      ]);
      if (preErr) {
        console.warn('[EFA GARDE] INSERT pre_inscriptions:', preErr.message);
      }

      // 3. INSERT dans public.utilisateurs & public.users
      await registerUserInDB({
        email: entry.email_pro || null,
        nom: entry.titulaire || entry.nom,
        role: 'pharma',
        telephone: entry.phone,
        pharmacie_id: id,
      });
    }
  } catch (err) {
    console.warn('[EFA GARDE] addPendingPharmacy Supabase warning:', err);
  }

  notifyChange();
  return newPending;
}

/**
 * VALIDER ET PUBLIER (Super Admin Dashboard) :
 * 1) Transfère la ligne de public.pharmacies_pending vers public.pharmacies avec UUID (is_active=true, is_verified=true, is_garde=false)
 *    Si phone existe déjà dans pharmacies -> UPDATE sans doublon.
 * 2) Marque la ligne pending comme transférée (`status='transferred'`, `reviewed_at=NOW()`)
 */
export async function approvePharmacySuperAdmin(id: string): Promise<boolean> {
  const now = new Date().toISOString();
  const memPending = memoryPendingPharmacies.find((p) => p.id === id);
  const found = memoryPharmacies.find((p) => p.id === id);

  try {
    const client = getSupabaseClient();
    if (client) {
      const { data: pendingRow } = await client
        .from('pharmacies_pending')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      const source: any = pendingRow || memPending || found;
      const rowPhone = String(source?.phone || source?.tel || '').trim();
      const targetUuid = isValidUuid(id) ? id : generateUuid();

      // 1) Vérifie si phone existe déjà dans pharmacies (UPDATE sans doublon)
      let existingPharmaId: string | null = null;
      if (rowPhone) {
        const { data: existingByPhone } = await client
          .from('pharmacies')
          .select('id')
          .eq('phone', rowPhone)
          .limit(1)
          .maybeSingle();
        if (existingByPhone?.id) {
          existingPharmaId = String(existingByPhone.id);
        }
      }
      if (!existingPharmaId && isValidUuid(id)) {
        const { data: existingById } = await client
          .from('pharmacies')
          .select('id')
          .eq('id', id)
          .limit(1)
          .maybeSingle();
        if (existingById?.id) {
          existingPharmaId = String(existingById.id);
        }
      }

      const updateFields = {
        nom: source?.nom || 'Pharmacie',
        phone: rowPhone,
        adresse: source?.adresse || '',
        quartier: source?.quartier || 'Lomé',
        lat: source?.lat ?? 6.1319,
        lng: source?.lng ?? 1.2228,
        email_pro: source?.email_pro || null,
        is_active: true,
        is_verified: true,
        updated_at: now,
      };

      if (existingPharmaId) {
        const { error: updateErr } = await client
          .from('pharmacies')
          .update(updateFields)
          .eq('id', existingPharmaId);
        if (updateErr) {
          console.warn(
            '[EFA] approvePharmacySuperAdmin pharmacies update:',
            updateErr.message
          );
        }
      } else {
        const insertPayload = {
          id: targetUuid,
          ...updateFields,
          is_garde: false,
          created_at: source?.created_at || now,
        };
        const { error: insertErr } = await client
          .from('pharmacies')
          .insert([insertPayload]);

        if (insertErr) {
          if (
            insertErr.code === '23505' ||
            insertErr.message?.toLowerCase().includes('duplicate')
          ) {
            await client
              .from('pharmacies')
              .update(updateFields)
              .eq('id', targetUuid);
          } else {
            console.warn(
              '[EFA] approvePharmacySuperAdmin pharmacies insert:',
              insertErr.message
            );
          }
        }
      }

      // 2) Marque la ligne pending comme transférée (colonne unique `status`)
      const { error: pendErr } = await client
        .from('pharmacies_pending')
        .update({
          status: 'transferred',
          reviewed_at: now,
        })
        .eq('id', id);
      if (pendErr) {
        console.warn('[EFA] approvePharmacySuperAdmin pending:', pendErr.message);
      }

      memoryPendingPharmacies = memoryPendingPharmacies.filter((p) => p.id !== id);
      const finalId = existingPharmaId || targetUuid;
      const existingMemIdx = memoryPharmacies.findIndex(
        (p) => p.id === finalId || (rowPhone && p.tel === rowPhone)
      );
      if (existingMemIdx >= 0) {
        memoryPharmacies[existingMemIdx] = {
          ...memoryPharmacies[existingMemIdx],
          ...updateFields,
          tel: rowPhone,
          is_pending: false,
        };
      } else if (source) {
        memoryPharmacies.unshift({
          id: finalId,
          nom: source.nom || 'Pharmacie',
          tel: rowPhone,
          phone: rowPhone,
          adresse: source.adresse || '',
          quartier: source.quartier || 'Lomé',
          lat: source.lat ?? 6.1319,
          lng: source.lng ?? 1.2228,
          titulaire: source.titulaire || 'Titulaire Officine',
          numero_ordre: source.numero_ordre,
          piece_url: source.piece_url,
          photo_url: source.photo_url,
          email_pro: source.email_pro,
          mot_de_passe: source.mot_de_passe,
          plan: 'free',
          is_online: false,
          is_garde: false,
          is_active: true,
          is_verified: true,
          is_pending: false,
          created_at: source.created_at || now,
          updated_at: now,
        });
      }

      notifyChange();
      return true;
    }
  } catch (err) {
    console.warn('[EFA] approvePharmacySuperAdmin Supabase warning:', err);
  }

  memoryPendingPharmacies = memoryPendingPharmacies.filter((p) => p.id !== id);
  if (found) {
    found.is_active = true;
    found.is_verified = true;
    found.is_pending = false;
    found.updated_at = now;
  } else if (memPending) {
    memoryPharmacies.unshift({
      id: isValidUuid(id) ? id : generateUuid(),
      nom: memPending.nom,
      tel: memPending.phone,
      phone: memPending.phone,
      adresse: memPending.adresse,
      quartier: memPending.quartier,
      lat: memPending.lat,
      lng: memPending.lng,
      titulaire: memPending.titulaire,
      numero_ordre: memPending.numero_ordre,
      piece_url: memPending.piece_url,
      photo_url: memPending.photo_url,
      email_pro: memPending.email_pro,
      mot_de_passe: memPending.mot_de_passe,
      plan: 'free',
      is_online: false,
      is_garde: false,
      is_active: true,
      is_verified: true,
      is_pending: false,
      created_at: memPending.created_at || now,
      updated_at: now,
    });
  }

  notifyChange();
  return true;
}

export async function rejectPharmacySuperAdmin(id: string): Promise<boolean> {
  const now = new Date().toISOString();
  memoryPendingPharmacies = memoryPendingPharmacies.filter((p) => p.id !== id);

  try {
    const client = getSupabaseClient();
    if (client) {
      const { error: pendErr } = await client
        .from('pharmacies_pending')
        .update({ status: 'rejected', reviewed_at: now })
        .eq('id', id);
      if (pendErr) {
        console.warn('[EFA] rejectPharmacySuperAdmin pending:', pendErr.message);
      }
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
  memoryPharmacies[idx] = {
    ...memoryPharmacies[idx],
    is_garde: isOnline,
    is_online: isOnline,
  };

  try {
    const sb = getSupabaseClient();
    if (sb && isValidUuid(pharmacieId)) {
      sb.from('pharmacies')
        .update({
          is_garde: isOnline,
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

  const abnPlanName =
    planType === 'premium_140k'
      ? 'star_annuel'
      : planType === 'premium_15k'
      ? 'star_mensuel'
      : 'annuel_officine';

  const updates: Partial<Pharmacie> = {
    subscription_plan: isPremium ? 'premium' : 'basic',
    subscription_status: 'active',
    subscription_start_at: now.toISOString(),
    subscription_end_at: end.toISOString(),
    subscription_end: end.toISOString(),
    subscription_days_left: durationDays,
    is_active: true,
    is_verified: true,
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
  };

  try {
    const client = getSupabaseClient();
    if (client && isValidUuid(pharmacyId)) {
      const { error: phErr } = await client
        .from('pharmacies')
        .update(updates)
        .eq('id', pharmacyId);

      if (phErr) {
        console.warn(
          '[EFA GARDE] UPDATE pharmacies complet échoué, fallback is_active=true:',
          phErr.message
        );
        const { error: minPhErr } = await client
          .from('pharmacies')
          .update({
            is_active: true,
            ...(isPremium ? { etoile_doree: true, is_premium: true } : {}),
          })
          .eq('id', pharmacyId);
        if (minPhErr) {
          console.error(
            '[EFA GARDE] Erreur UPDATE pharmacies (is_active=true):',
            minPhErr
          );
        }
      }

      const currentPharma = memoryPharmacies.find((p) => p.id === pharmacyId);
      const pharmaNom = updates.nom || currentPharma?.nom || 'Pharmacie';

      let existingAbn: any = null;
      const byPharmacie = await client
        .from('abonnements')
        .select('id')
        .eq('pharmacie_id', pharmacyId)
        .limit(1)
        .maybeSingle();

      if (!byPharmacie.error && byPharmacie.data?.id) {
        existingAbn = byPharmacie.data;
      } else {
        const byPharmacy = await client
          .from('abonnements')
          .select('id')
          .eq('pharmacy_id', pharmacyId)
          .limit(1)
          .maybeSingle();
        if (!byPharmacy.error && byPharmacy.data?.id) {
          existingAbn = byPharmacy.data;
        }
      }

      if (existingAbn?.id) {
        const { error: abnUpdErr } = await client
          .from('abonnements')
          .update({
            pharmacie_id: pharmacyId,
            nom_pharmacie: pharmaNom,
            plan: abnPlanName,
            statut: 'paye_valide',
            montant: updates.prix || 90000,
            date_debut: now.toISOString(),
            expire_le: end.toISOString(),
            updated_at: now.toISOString(),
          })
          .eq('id', existingAbn.id);
        if (abnUpdErr) {
          console.warn(
            '[EFA GARDE] UPDATE abonnements complet échoué, tentative minimale:',
            abnUpdErr.message
          );
          const { error: minAbnErr } = await client
            .from('abonnements')
            .update({
              statut: 'paye_valide',
              plan: abnPlanName,
              montant: updates.prix || 90000,
              expire_le: end.toISOString(),
            })
            .eq('id', existingAbn.id);
          if (minAbnErr) {
            console.error('[EFA GARDE] Erreur UPDATE abonnements:', minAbnErr);
          }
        }
      } else {
        const abnId = generateUuid();
        const abnPayload = {
          id: abnId,
          pharmacie_id: pharmacyId,
          entreprise_id: pharmacyId,
          nom_pharmacie: pharmaNom,
          plan: abnPlanName,
          statut: 'paye_valide',
          montant: updates.prix || 90000,
          date_debut: now.toISOString(),
          expire_le: end.toISOString(),
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        };
        const { error: abnInsertErr } = await client
          .from('abonnements')
          .insert([abnPayload]);
        if (abnInsertErr) {
          console.warn(
            '[EFA GARDE] INSERT abonnements complet échoué, tentative minimale:',
            abnInsertErr.message
          );
          const { error: minErr } = await client.from('abonnements').insert([
            {
              id: abnId,
              pharmacie_id: pharmacyId,
              nom_pharmacie: pharmaNom,
              plan: abnPlanName,
              statut: 'paye_valide',
              montant: updates.prix || 90000,
              date_debut: now.toISOString(),
              expire_le: end.toISOString(),
            },
          ]);
          if (minErr) {
            console.error('[EFA GARDE] Erreur INSERT abonnements:', minErr);
          }
        }
      }
    }
  } catch (err) {
    console.error('[EFA GARDE] Failed to update DB:', err);
  }

  const updated = updatePharmacySuperAdmin(pharmacyId, updates);
  await fetchDemandesAbonnement().catch(() => {});
  notifyChange();
  return updated;
}

export async function fetchPharmacyById(id: string): Promise<Pharmacie | null> {
  try {
    const client = getSupabaseClient();
    if (client && isValidUuid(id)) {
      const { data, error } = await client
        .from('pharmacies')
        .select('*')
        .eq('id', id)
        .single();
      if (!error && data) {
        const normalized = normalizePharmacyRow(data);
        updatePharmacySuperAdmin(id, normalized);
        return normalized;
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
      phone: data.tel,
      plan: 'free',
      is_online: data.is_online,
      is_garde: data.is_online,
      is_pending: true,
      is_active: false,
      is_verified: false,
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

export async function fetchClients(): Promise<Client[]> {
  try {
    const sb = getSupabaseClient();
    if (sb) {
      const { data, error } = await sb
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        const mapped: Client[] = data.map((row: any) => ({
          id: String(row.id),
          nom: (row.nom || '').trim(),
          telephone: (row.telephone || row.numero_whatsapp || row.numero || '').trim(),
          numero: (row.numero || row.telephone || row.numero_whatsapp || '').trim(),
          numero_whatsapp: (row.numero_whatsapp || row.telephone || row.numero || '').trim(),
          email: row.email ? String(row.email).trim() : undefined,
          date_inscription: row.date_inscription || row.created_at || new Date().toISOString(),
          created_at: row.created_at || row.date_inscription,
        }));
        memoryClients = mapped;
        memoryClientsCount = mapped.length;
        notifyChange();
        return mapped;
      }
      if (error) {
        console.warn('[EFA GARDE] fetchClients error:', error.message);
      }
    }
  } catch (err) {
    console.warn('[EFA GARDE] fetchClients warning:', err);
  }
  return memoryClients;
}

export function getClientDisplayName(clientId: string): string {
  if (!clientId) return '';
  const normalizedTarget = clientId.replace(/^client-/, '').trim();
  const matched = memoryClients.find(
    (c) =>
      c.id === clientId ||
      c.id === normalizedTarget ||
      `client-${c.id}` === clientId ||
      c.telephone === normalizedTarget ||
      c.numero_whatsapp === normalizedTarget ||
      c.numero === normalizedTarget
  );

  if (matched) {
    if (matched.nom && matched.nom.trim()) {
      return matched.nom.trim();
    }
    const tel =
      matched.telephone?.trim() ||
      matched.numero_whatsapp?.trim() ||
      matched.numero?.trim();
    if (tel) return tel;
  }

  if (typeof window !== 'undefined') {
    const localId =
      localStorage.getItem('client_id') || localStorage.getItem('efa_client_id');
    if (localId && (localId === clientId || localId === normalizedTarget)) {
      const localNom = localStorage.getItem('efa_client_nom')?.trim();
      if (localNom) return localNom;
      const localTel = localStorage.getItem('efa_client_whatsapp')?.trim();
      if (localTel) return localTel;
    }
  }

  return clientId;
}

/**
 * INSCRIPTION / RECONNEXION CLIENT :
 * 1) Récupère/crée auth.users.id si session/email Supabase Auth disponible
 * 2) Cherche dans public.clients WHERE telephone = numero (ou id = auth.users.id / email)
 * 3) Si existe -> SELECT nom depuis clients & reconnecte sans doublon
 * 4) Sinon -> INSERT INTO public.clients (id, nom, telephone, email, created_at)
 * 5) Sauvegarde client_id + nom + telephone dans localStorage
 */
export async function registerClientInDB(data: {
  nom: string;
  numero_whatsapp: string;
  email?: string;
  password?: string;
}): Promise<Client> {
  const cleanNom = data.nom.trim();
  const cleanPhone = data.numero_whatsapp.trim().replace(/\s+/g, '');
  const cleanEmail = data.email?.trim().toLowerCase() || '';
  const now = new Date().toISOString();
  const fallbackId = generateUuid();

  let clientId = fallbackId;
  let finalNom = cleanNom;
  let finalPhone = cleanPhone;
  let finalEmail: string | undefined = cleanEmail || undefined;
  let finalDate = now;
  let isNewClient = false;

  try {
    const sb = getSupabaseClient();
    if (sb) {
      // 0. Vérifie / obtient auth.users.id via Supabase Auth
      let authUserId: string | null = null;
      try {
        const { data: userRes } = await sb.auth.getUser();
        if (userRes?.user?.id) {
          authUserId = userRes.user.id;
        } else if (cleanEmail) {
          const authPassword =
            data.password && data.password.length >= 6
              ? data.password
              : `EfaClient#${cleanPhone.slice(-6)}!2026`;
          const { data: signUpRes, error: signUpErr } = await sb.auth.signUp({
            email: cleanEmail,
            password: authPassword,
            options: {
              data: { nom: cleanNom, telephone: cleanPhone, role: 'client' },
            },
          });
          if (!signUpErr && signUpRes?.user?.id) {
            authUserId = signUpRes.user.id;
          } else {
            const { data: signInRes } = await sb.auth.signInWithPassword({
              email: cleanEmail,
              password: authPassword,
            });
            if (signInRes?.user?.id) {
              authUserId = signInRes.user.id;
            }
          }
        } else if (typeof (sb.auth as any).signInAnonymously === 'function') {
          const { data: anonRes } = await (sb.auth as any).signInAnonymously({
            options: {
              data: { nom: cleanNom, telephone: cleanPhone, role: 'client' },
            },
          });
          if (anonRes?.user?.id) {
            authUserId = anonRes.user.id;
          }
        }
      } catch {
        // Supabase Auth optionnel si désactivé : on continue avec UUID / row DB
      }

      let existingClient: any = null;

      // 1. Cherche d'abord dans clients WHERE telephone = numero
      const { data: byTel, error: byTelErr } = await sb
        .from('clients')
        .select('id, nom, telephone, numero, numero_whatsapp, email, date_inscription, created_at')
        .eq('telephone', cleanPhone)
        .limit(1)
        .maybeSingle();

      if (!byTelErr && byTel) {
        existingClient = byTel;
      } else {
        // Fallback compatibilité si anciennes lignes enregistrées sous numero / numero_whatsapp / email / id
        const orFilters = [`numero.eq.${cleanPhone}`, `numero_whatsapp.eq.${cleanPhone}`];
        if (cleanEmail) orFilters.push(`email.eq.${cleanEmail}`);
        if (authUserId) orFilters.push(`id.eq.${authUserId}`);

        const { data: byAlt } = await sb
          .from('clients')
          .select('id, nom, telephone, numero, numero_whatsapp, email, date_inscription, created_at')
          .or(orFilters.join(','))
          .limit(1)
          .maybeSingle();
        if (byAlt) {
          existingClient = byAlt;
        }
      }

      if (existingClient) {
        // 2. Client déjà existant -> SELECT nom depuis clients & Reconnexion sans doublon
        clientId = String(existingClient.id);
        finalNom =
          (existingClient.nom && String(existingClient.nom).trim()) || cleanNom;
        finalPhone =
          existingClient.telephone ||
          existingClient.numero_whatsapp ||
          existingClient.numero ||
          cleanPhone;
        finalEmail = existingClient.email || cleanEmail || undefined;
        finalDate =
          existingClient.created_at || existingClient.date_inscription || now;

        // Si le nom saisi diffère d'une ancienne ligne sans nom ou si email ajouté, on met à jour
        const patchFields: Record<string, any> = {};
        if (!existingClient.nom && cleanNom) patchFields.nom = cleanNom;
        if (!existingClient.telephone && cleanPhone) patchFields.telephone = cleanPhone;
        if (!existingClient.email && cleanEmail) patchFields.email = cleanEmail;
        if (Object.keys(patchFields).length > 0) {
          await sb.from('clients').update(patchFields).eq('id', clientId);
        }
      } else {
        // 3. Nouveau client -> INSERT INTO clients (id = auth.users.id ?? uuid, nom, telephone, email, created_at)
        const targetId = authUserId || fallbackId;
        const insertPayload: Record<string, any> = {
          id: targetId,
          nom: cleanNom,
          telephone: cleanPhone,
          email: cleanEmail || null,
          created_at: now,
        };

        const { data: insertedRow, error: insertErr } = await sb
          .from('clients')
          .insert([insertPayload])
          .select('id, nom, telephone, numero, numero_whatsapp, email, date_inscription, created_at')
          .maybeSingle();

        if (!insertErr && insertedRow) {
          clientId = String(insertedRow.id);
          finalNom = (insertedRow.nom && String(insertedRow.nom).trim()) || cleanNom;
          finalPhone =
            insertedRow.telephone ||
            insertedRow.numero_whatsapp ||
            insertedRow.numero ||
            cleanPhone;
          finalEmail = insertedRow.email || cleanEmail || undefined;
          finalDate =
            insertedRow.created_at || insertedRow.date_inscription || now;
          isNewClient = true;
        } else if (
          insertErr &&
          (insertErr.code === '23505' ||
            insertErr.message?.toLowerCase().includes('duplicate'))
        ) {
          // Concurrence / unicité -> récupère la ligne existante sans doublon
          const { data: existingAfterRace } = await sb
            .from('clients')
            .select('id, nom, telephone, numero, numero_whatsapp, email, date_inscription, created_at')
            .eq('telephone', cleanPhone)
            .limit(1)
            .maybeSingle();
          if (existingAfterRace) {
            clientId = String(existingAfterRace.id);
            finalNom =
              (existingAfterRace.nom && String(existingAfterRace.nom).trim()) ||
              cleanNom;
            finalPhone =
              existingAfterRace.telephone ||
              existingAfterRace.numero_whatsapp ||
              existingAfterRace.numero ||
              cleanPhone;
            finalEmail = existingAfterRace.email || cleanEmail || undefined;
            finalDate =
              existingAfterRace.created_at ||
              existingAfterRace.date_inscription ||
              now;
          }
        } else if (insertErr) {
          // Fallback schéma legacy (si colonne numero_whatsapp NOT NULL ou email absent)
          const legacyPayload: Record<string, any> = {
            id: targetId,
            nom: cleanNom,
            numero: cleanPhone,
            numero_whatsapp: cleanPhone,
            date_inscription: now,
            created_at: now,
            updated_at: now,
          };
          if (!insertErr.message?.toLowerCase().includes('telephone')) {
            legacyPayload.telephone = cleanPhone;
          }
          if (!insertErr.message?.toLowerCase().includes('email') && cleanEmail) {
            legacyPayload.email = cleanEmail;
          }
          const { data: legacyInserted, error: legacyErr } = await sb
            .from('clients')
            .insert([legacyPayload])
            .select()
            .maybeSingle();

          if (!legacyErr && legacyInserted) {
            clientId = String(legacyInserted.id);
            finalNom = (legacyInserted.nom && String(legacyInserted.nom).trim()) || cleanNom;
            isNewClient = true;
          } else if (legacyErr) {
            console.warn('[EFA GARDE] INSERT clients:', legacyErr.message);
          }
        }

        if (isNewClient) {
          await registerUserInDB({
            auth_user_id: authUserId,
            email: finalEmail || null,
            nom: finalNom,
            role: 'client',
            telephone: finalPhone,
          });
        }
      }
    }
  } catch (err) {
    console.warn('[EFA] registerClientInDB Supabase warning:', err);
  }

  const clientObj: Client = {
    id: clientId,
    nom: finalNom,
    telephone: finalPhone,
    numero: finalPhone,
    numero_whatsapp: finalPhone,
    email: finalEmail,
    date_inscription: finalDate,
    created_at: finalDate,
  };

  // 4. Sauvegarde client_id + nom + telephone dans localStorage
  localStorage.setItem('client_id', clientId);
  localStorage.setItem('efa_client_id', clientId);
  localStorage.setItem('efa_client_nom', finalNom);
  localStorage.setItem('efa_client_whatsapp', finalPhone);
  if (finalEmail) {
    localStorage.setItem('efa_client_email', finalEmail);
  }

  memoryClients = memoryClients.filter(
    (c) =>
      c.id !== clientId &&
      c.telephone !== finalPhone &&
      c.numero_whatsapp !== finalPhone
  );
  memoryClients.unshift(clientObj);
  if (isNewClient) {
    memoryClientsCount += 1;
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
  if (typeof window === 'undefined') return '00000000-0000-4000-8000-000000000001';
  let cid =
    localStorage.getItem('client_id') || localStorage.getItem('efa_client_id');
  if (!cid) {
    cid = generateUuid();
  }
  localStorage.setItem('client_id', cid);
  localStorage.setItem('efa_client_id', cid);
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
            d.statut === 'paye_valide' ||
            d.statut === 'active' ||
            d.statut === 'actif'
              ? 'paye_valide'
              : d.statut || 'en_attente',
          code_validation: d.code_validation,
          created_at: d.created_at || new Date().toISOString(),
          validated_at: d.validated_at,
          pharmacy_id: d.pharmacy_id || d.pharmacie_id,
          pharmacie_id: d.pharmacy_id || d.pharmacie_id,
          expire_le: d.expire_le,
        }));
        memoryDemandesAbonnement = mapped;
        if (memoryPharmacies.length > 0) {
          memoryPharmacies = sortPharmaciesPriority(
            applyAbonnementsToPharmacies(memoryPharmacies, mapped)
          );
        }
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

  // Synchronisation Supabase directe (modèle exact user_consents)
  try {
    const sb = getSupabaseClient();
    if (sb) {
      // 1. INSERT dans public.pre_inscriptions
      const { error: preErr } = await sb.from('pre_inscriptions').insert([
        {
          id: demande.id,
          nom_pharmacie: demande.nom_pharmacie,
          telephone: demande.telephone,
          email: demande.email || null,
          montant: demande.montant,
          statut: 'en_attente',
          created_at: demande.created_at,
          updated_at: demande.created_at,
        },
      ]);
      if (preErr) {
        console.warn('[EFA GARDE] INSERT pre_inscriptions:', preErr.message);
      }

      // 2. INSERT dans public.abonnements (pharmacie_id: null tant que la pharmacie n'est pas encore créée)
      const entrepriseId =
        'sub-' + cleanNom.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + cleanPhone;
      const expireLe = new Date(
        Date.now() + 30 * 24 * 3600 * 1000
      ).toISOString();

      const { error: abnErr } = await sb.from('abonnements').insert([
        {
          id: demande.id,
          entreprise_id: entrepriseId,
          pharmacy_id: null,
          pharmacie_id: null,
          nom_pharmacie: demande.nom_pharmacie,
          telephone: demande.telephone,
          email: demande.email || null,
          montant: demande.montant,
          plan: demande.plan,
          statut: 'en_attente',
          created_at: demande.created_at,
          updated_at: demande.created_at,
          expire_le: expireLe,
        },
      ]);

      if (abnErr) {
        if (
          abnErr.code === '23505' ||
          abnErr.message?.includes('duplicate')
        ) {
          await sb
            .from('abonnements')
            .update({
              nom_pharmacie: demande.nom_pharmacie,
              telephone: demande.telephone,
              email: demande.email || null,
              montant: demande.montant,
              plan: demande.plan,
              statut: 'en_attente',
              updated_at: demande.created_at,
              expire_le: expireLe,
            })
            .eq('entreprise_id', entrepriseId);
        } else {
          console.warn('[EFA GARDE] INSERT abonnements:', abnErr.message);
        }
      }
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
 * VALIDER ABONNEMENT & GÉNÉRER CODE 4 CHIFFRES (Super Admin) :
 * - UPDATE abonnements SET statut='paye_valide', expire_le=now()+interval WHERE id=[id]
 * - UPDATE pharmacies SET is_active=true WHERE id=pharmacie_id (si null, match nom_pharmacie=pharmacies.nom)
 * - Ne modifie jamais is_garde.
 */
export async function validateSubscriptionPaymentAndGenerateCode(
  demandeId: string,
  customCode?: string,
  demandeObj?: DemandeAbonnement
): Promise<{
  code: string;
  demande: DemandeAbonnement | null;
  ok: boolean;
  error?: string;
}> {
  const code = customCode || Math.floor(1000 + Math.random() * 9000).toString();
  const nowDate = new Date();
  const now = nowDate.toISOString();

  const found =
    memoryDemandesAbonnement.find((d) => d.id === demandeId) || demandeObj;

  const planStr = (found?.plan || '').toLowerCase();
  const isMonthly =
    planStr.includes('mensuel') ||
    planStr.includes('star_mensuel') ||
    Number(found?.montant) === 15000;
  const intervalDays = isMonthly ? 30 : 365;
  const expireLe = new Date(
    nowDate.getTime() + intervalDays * 24 * 3600 * 1000
  ).toISOString();

  if (found) {
    found.statut = 'paye_valide';
    found.code_validation = code;
    found.validated_at = now;
    found.expire_le = expireLe;
  }
  memoryValidatedCodes[code] = {
    demandeId,
    nom_pharmacie: found?.nom_pharmacie,
    telephone: found?.telephone,
    validated_at: now,
  };

  let dbOk = true;
  let dbErrorMsg: string | undefined;

  // Synchronisation Supabase table abonnements + pharmacies
  try {
    const sb = getSupabaseClient();
    if (sb) {
      // 1) Récupère la ligne d'abonnement exacte en DB si possible
      const { data: abnRow, error: fetchAbnErr } = await sb
        .from('abonnements')
        .select('*')
        .eq('id', demandeId)
        .maybeSingle();

      if (fetchAbnErr) {
        console.error(
          '[EFA] SELECT abonnements validation:',
          fetchAbnErr.message
        );
      }

      let targetPharmaId: string | null = null;
      const rawPid =
        abnRow?.pharmacie_id ||
        abnRow?.pharmacy_id ||
        found?.pharmacie_id ||
        found?.pharmacy_id;
      if (isValidUuid(rawPid)) {
        targetPharmaId = rawPid;
      }

      const targetNom = (
        abnRow?.nom_pharmacie ||
        found?.nom_pharmacie ||
        ''
      ).trim();

      // Si pharmacie_id null, match nom_pharmacie = pharmacies.nom
      if (!targetPharmaId && targetNom) {
        const { data: matchedByExact, error: matchErr } = await sb
          .from('pharmacies')
          .select('id, nom')
          .ilike('nom', targetNom)
          .limit(1)
          .maybeSingle();
        if (matchErr) {
          console.error('[EFA] Match pharmacie par nom:', matchErr.message);
        }
        if (matchedByExact?.id && isValidUuid(matchedByExact.id)) {
          targetPharmaId = matchedByExact.id;
        }
      }

      const effectivePlan = abnRow?.plan || found?.plan || 'enregistrement_25k';
      const effectiveMontant =
        Number(abnRow?.montant ?? found?.montant) || 25000;
      const effectiveMonthly =
        effectivePlan.toLowerCase().includes('mensuel') ||
        effectiveMontant === 15000;
      const effectiveExpireLe = new Date(
        nowDate.getTime() + (effectiveMonthly ? 30 : 365) * 24 * 3600 * 1000
      ).toISOString();

      if (found) {
        found.expire_le = effectiveExpireLe;
        found.plan = effectivePlan;
        found.montant = effectiveMontant;
        if (targetPharmaId) {
          found.pharmacie_id = targetPharmaId;
          found.pharmacy_id = targetPharmaId;
        }
      }

      // 2) UPDATE abonnements SET statut='paye_valide', plan=..., montant=..., expire_le=now()+interval WHERE id=[id]
      const abnUpdatePayload: Record<string, any> = {
        statut: 'paye_valide',
        plan: effectivePlan,
        montant: effectiveMontant,
        code_validation: code,
        expire_le: effectiveExpireLe,
        updated_at: now,
      };
      if (targetPharmaId) {
        abnUpdatePayload.pharmacie_id = targetPharmaId;
      }

      let { data: updatedAbnRows, error: abnErr } = await sb
        .from('abonnements')
        .update(abnUpdatePayload)
        .eq('id', demandeId)
        .select('id');

      if (abnErr) {
        console.warn(
          '[EFA] UPDATE abonnements complet échoué, tentative minimale:',
          abnErr.message
        );
        const minRes = await sb
          .from('abonnements')
          .update({
            statut: 'paye_valide',
            plan: effectivePlan,
            montant: effectiveMontant,
            expire_le: effectiveExpireLe,
          })
          .eq('id', demandeId)
          .select('id');
        updatedAbnRows = minRes.data;
        abnErr = minRes.error;
      }

      // Si aucune ligne touchée par id (ou si appel par pharmacie_id), essai par pharmacie_id
      if (!abnErr && (!updatedAbnRows || updatedAbnRows.length === 0) && targetPharmaId) {
        const byPidRes = await sb
          .from('abonnements')
          .update({
            statut: 'paye_valide',
            plan: effectivePlan,
            montant: effectiveMontant,
            expire_le: effectiveExpireLe,
          })
          .eq('pharmacie_id', targetPharmaId)
          .select('id');
        abnErr = byPidRes.error;
      }

      if (abnErr) {
        dbOk = false;
        dbErrorMsg = abnErr.message;
        console.error('[EFA GARDE] Erreur UPDATE abonnements:', abnErr);
      }

      // 3) UPDATE pharmacies SET is_active=true (+ plan & subscription_status) WHERE id=pharmacie_id (sans toucher is_garde)
      if (targetPharmaId) {
        const isStar = isStarPlanName(effectivePlan);
        const lowerEffPlan = effectivePlan.toLowerCase();
        const isAnnual90k =
          lowerEffPlan.includes('annuel') ||
          lowerEffPlan.includes('annual') ||
          lowerEffPlan.includes('90') ||
          effectiveMontant >= 60000;
        const pharmaPlanValue: PlanType = isStar
          ? lowerEffPlan.includes('annuel')
            ? 'populaire_annuel'
            : 'populaire_mensuel'
          : isAnnual90k
          ? 'annual'
          : 'register';

        const pharmaUpdate: Record<string, any> = {
          is_active: true,
          plan: pharmaPlanValue,
          subscription_plan: isStar ? 'premium' : 'basic',
          subscription_status: 'active',
          subscription_end_at: effectiveExpireLe,
          updated_at: now,
        };
        if (isStar) {
          pharmaUpdate.etoile_doree = true;
          pharmaUpdate.is_premium = true;
        }
        let { error: pharmaErr } = await sb
          .from('pharmacies')
          .update(pharmaUpdate)
          .eq('id', targetPharmaId);

        if (pharmaErr) {
          console.warn(
            '[EFA] UPDATE pharmacies complet échoué, fallback is_active=true:',
            pharmaErr.message
          );
          const minPh = await sb
            .from('pharmacies')
            .update({ is_active: true })
            .eq('id', targetPharmaId);
          pharmaErr = minPh.error;
        }

        if (pharmaErr) {
          dbOk = false;
          dbErrorMsg = dbErrorMsg
            ? `${dbErrorMsg} | ${pharmaErr.message}`
            : pharmaErr.message;
          console.error('[EFA GARDE] Erreur UPDATE pharmacies:', pharmaErr);
        }
      }
    }
  } catch (err: any) {
    dbOk = false;
    dbErrorMsg = err?.message || String(err);
    console.error(
      '[EFA] validateSubscriptionPaymentAndGenerateCode Supabase error:',
      err
    );
  }

  if (memoryPharmacies.length > 0) {
    memoryPharmacies = sortPharmaciesPriority(
      applyAbonnementsToPharmacies(memoryPharmacies, memoryDemandesAbonnement)
    );
  }

  notifyChange();
  return { code, demande: found || null, ok: dbOk, error: dbErrorMsg };
}

/**
 * REFUSER ABONNEMENT (Super Admin) :
 * UPDATE public.abonnements SET statut='rejete' WHERE id=[id]
 */
export async function rejectSubscriptionPayment(
  demandeId: string
): Promise<boolean> {
  const now = new Date().toISOString();
  const found = memoryDemandesAbonnement.find((d) => d.id === demandeId);
  if (found) {
    found.statut = 'rejete';
  }

  try {
    const sb = getSupabaseClient();
    if (sb) {
      const { error } = await sb
        .from('abonnements')
        .update({
          statut: 'rejete',
          updated_at: now,
        })
        .eq('id', demandeId);
      if (error) {
        await sb
          .from('abonnements')
          .update({ statut: 'rejete' })
          .eq('id', demandeId);
      }
    }
  } catch (err) {
    console.warn('[EFA] rejectSubscriptionPayment warning:', err);
  }

  if (memoryPharmacies.length > 0) {
    memoryPharmacies = sortPharmaciesPriority(
      applyAbonnementsToPharmacies(memoryPharmacies, memoryDemandesAbonnement)
    );
  }

  notifyChange();
  return true;
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
  pharmacyId?: string
): Promise<Abonnement[]> {
  try {
    const sb = getSupabaseClient();
    if (sb) {
      const { data, error } = await sb
        .from('abonnements')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        const mapped = data.map((a: any) => ({
          ...a,
          pharmacy_id: a.pharmacy_id || a.pharmacie_id || undefined,
          pharmacie_id: a.pharmacie_id || a.pharmacy_id || undefined,
        })) as Abonnement[];

        if (pharmacyId) {
          return mapped.filter(
            (a) =>
              a.pharmacy_id === pharmacyId ||
              a.pharmacie_id === pharmacyId ||
              a.entreprise_id === pharmacyId
          );
        }
        return mapped;
      }
      if (error) {
        console.error('[EFA GARDE] fetchAbonnements error:', error.message);
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
  const created = new Date(m.created_at).getTime();
  if (Number.isFinite(created) && now - created >= MS_24_HOURS) {
    return true;
  }
  if (m.expires_at) {
    const exp = new Date(m.expires_at).getTime();
    if (Number.isFinite(exp) && exp <= now) return true;
  }
  return false;
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
  const all = [...memoryConversations].map((c) => {
    const pid = c.pharmacy_id || c.pharmacie_id || '';
    return {
      ...c,
      pharmacy_id: pid,
      pharmacie_id: c.pharmacie_id || pid,
    };
  });

  all.sort((a, b) => {
    const timeA = new Date(a.last_message_at || a.updated_at || a.created_at || 0).getTime();
    const timeB = new Date(b.last_message_at || b.updated_at || b.created_at || 0).getTime();
    return timeB - timeA;
  });

  if (pharmacyUserId && pharmacieId) {
    return all.filter(
      (c) =>
        c.pharmacy_user_id === pharmacyUserId ||
        c.pharmacy_user_id === pharmacieId ||
        c.pharmacy_id === pharmacieId ||
        c.pharmacie_id === pharmacieId
    );
  }
  if (pharmacieId) {
    return all.filter(
      (c) =>
        c.pharmacy_id === pharmacieId ||
        c.pharmacie_id === pharmacieId ||
        c.pharmacy_user_id === pharmacieId
    );
  }
  if (clientId) {
    return all.filter(
      (c) => c.client_id === clientId || c.admin_id === clientId
    );
  }
  return all;
}

type ChatErrorListener = (errorMessage: string) => void;
const chatErrorListeners = new Set<ChatErrorListener>();

export function subscribeChatError(fn: ChatErrorListener): () => void {
  chatErrorListeners.add(fn);
  return () => {
    chatErrorListeners.delete(fn);
  };
}

function notifyChatError(errorMessage: string) {
  chatErrorListeners.forEach((fn) => {
    try {
      fn(errorMessage);
    } catch {}
  });
}

export async function fetchConversations(
  pharmacieId?: string,
  clientId?: string,
  pharmacyUserId?: string
): Promise<Conversation[]> {
  try {
    const sb = getSupabaseClient();
    if (sb) {
      let { data, error } = await sb
        .from('conversations')
        .select('*')
        .order('last_message_at', { ascending: false });

      if (error) {
        const fallbackRes = await sb
          .from('conversations')
          .select('*')
          .order('created_at', { ascending: false });
        data = fallbackRes.data;
        error = fallbackRes.error;
      }

      if (error) {
        const noOrderRes = await sb.from('conversations').select('*');
        data = noOrderRes.data;
        error = noOrderRes.error;
      }

      if (error) {
        console.error('[EFA CHAT] SELECT conversations échoué:', error.message, error);
      }

      const normalized: Conversation[] = Array.isArray(data)
        ? data.map((row: any) => {
            const pid = row.pharmacy_id || row.pharmacie_id || '';
            return {
              ...row,
              pharmacy_id: pid,
              pharmacie_id: row.pharmacie_id || pid,
              client_id: row.client_id || row.admin_id || 'client',
              admin_id: row.admin_id || undefined,
            };
          })
        : [];

      // Merge avec les conversations en mémoire si pas encore persistées
      const seen = new Set(normalized.map((c) => c.id));
      const merged = [...normalized];
      for (const memC of memoryConversations) {
        if (memC && memC.id && !seen.has(memC.id)) {
          merged.push(memC);
          seen.add(memC.id);
        }
      }

      // Filet de sécurité : récupérer aussi les messages récents (24h) pour garantir la réciprocité
      // même si un UPDATE sur `conversations` a échoué ou si la conversation n'existait pas côté local.
      try {
        const cutoff24h = new Date(Date.now() - MS_24_HOURS).toISOString();
        let { data: recentMsgs, error: msgFetchErr } = await sb
          .from('messages')
          .select('*')
          .gte('created_at', cutoff24h)
          .order('created_at', { ascending: true });

        if (msgFetchErr) {
          const fallbackMsgs = await sb.from('messages').select('*');
          recentMsgs = fallbackMsgs.data;
        }

        if (Array.isArray(recentMsgs)) {
          for (const rawM of recentMsgs as any[]) {
            const cId = rawM.conversation_id;
            if (!cId) continue;

            const existingConv = merged.find((c) => c.id === cId);
            const deducedSender: 'client' | 'pharma' | 'admin' =
              rawM.sender ||
              rawM.sender_type ||
              (rawM.sender_id &&
              (rawM.sender_id === rawM.pharmacy_id ||
                rawM.sender_id === existingConv?.pharmacy_id ||
                rawM.sender_id === existingConv?.pharmacy_user_id)
                ? 'pharma'
                : rawM.sender_id === 'super-admin'
                ? 'admin'
                : 'client');

            const mObj: Message = {
              id: String(rawM.id || generateUuid()),
              conversation_id: cId,
              pharmacy_id: rawM.pharmacy_id || existingConv?.pharmacy_id,
              client_id: rawM.client_id || existingConv?.client_id,
              sender_id: rawM.sender_id,
              receiver_id: rawM.receiver_id,
              sender_type: rawM.sender_type || deducedSender,
              sender: deducedSender,
              content: rawM.content || rawM.text || '',
              text: rawM.text || rawM.content || '',
              type: rawM.type || 'text',
              media_url: rawM.media_url,
              audio_duration: rawM.audio_duration,
              is_read: Boolean(rawM.is_read),
              created_at: rawM.created_at || new Date().toISOString(),
              expires_at: rawM.expires_at,
            };

            if (isMessageExpired(mObj)) continue;

            const curList = memoryMessages[cId] || [];
            if (!curList.some((x) => x.id === mObj.id)) {
              curList.push(mObj);
              curList.sort(
                (a, b) =>
                  new Date(a.created_at).getTime() -
                  new Date(b.created_at).getTime()
              );
              memoryMessages[cId] = curList;
            }

            const preview =
              mObj.type === 'audio'
                ? '🎤 Message vocal'
                : mObj.type === 'image'
                ? '📷 Photo'
                : mObj.text || '';

            if (!existingConv) {
              const pId =
                rawM.pharmacy_id ||
                (deducedSender === 'pharma' ? rawM.sender_id : rawM.receiver_id) ||
                '';
              const clId =
                rawM.client_id ||
                (deducedSender === 'client' ? rawM.sender_id : rawM.receiver_id) ||
                'client';
              if (pId || clId) {
                const synthConv: Conversation = {
                  id: cId,
                  client_id: clId,
                  pharmacy_id: pId,
                  pharmacie_id: pId,
                  pharmacy_user_id: pId,
                  last_message: preview,
                  last_message_at: mObj.created_at,
                  created_at: mObj.created_at,
                  updated_at: mObj.created_at,
                  unread_count_pharmacy: deducedSender === 'client' ? 1 : 0,
                  unread_count_client: deducedSender === 'pharma' ? 1 : 0,
                };
                merged.unshift(synthConv);
                seen.add(cId);
              }
            } else {
              const existingTime = new Date(
                existingConv.last_message_at || existingConv.updated_at || 0
              ).getTime();
              const msgTime = new Date(mObj.created_at).getTime();
              if (msgTime >= existingTime) {
                existingConv.last_message = preview || existingConv.last_message;
                existingConv.last_message_at = mObj.created_at;
                existingConv.updated_at = mObj.created_at;
              }
            }
          }
        }
      } catch (msgRecoveryErr) {
        console.warn('[EFA CHAT] Recovery messages récents:', msgRecoveryErr);
      }

      memoryConversations = merged;
      notifyChange();
      return loadConversations(pharmacieId, clientId, pharmacyUserId);
    }
  } catch (err) {
    console.warn('fetchConversations error:', err);
  }
  return loadConversations(pharmacieId, clientId, pharmacyUserId);
}

const inFlightConversationInserts = new Map<string, Promise<string>>();
const persistedConversationIds = new Set<string>();

function remapConversationIdInMemory(oldId: string, newId: string, dbConv?: Partial<Conversation>) {
  if (!oldId || !newId || oldId === newId) return;
  const idx = memoryConversations.findIndex((c) => c.id === oldId);
  if (idx >= 0) {
    memoryConversations[idx] = {
      ...memoryConversations[idx],
      ...(dbConv || {}),
      id: newId,
    };
  }
  if (memoryMessages[oldId]) {
    const existingNew = memoryMessages[newId] || [];
    const seen = new Set(existingNew.map((m) => m.id));
    for (const m of memoryMessages[oldId]) {
      const migrated = { ...m, conversation_id: newId };
      if (!seen.has(migrated.id)) {
        existingNew.push(migrated);
      }
    }
    memoryMessages[newId] = existingNew;
    delete memoryMessages[oldId];
  }
}

async function ensureConversationInDB(conv: Conversation): Promise<string> {
  if (persistedConversationIds.has(conv.id)) return conv.id;
  const existingPromise = inFlightConversationInserts.get(conv.id);
  if (existingPromise) {
    return existingPromise;
  }

  const p = (async (): Promise<string> => {
    try {
      const sb = getSupabaseClient();
      if (!sb) return conv.id;

      // 1) Vérifie si cet ID existe déjà en DB
      const { data: byIdRow } = await sb
        .from('conversations')
        .select('id')
        .eq('id', conv.id)
        .limit(1)
        .maybeSingle();

      if (byIdRow?.id) {
        persistedConversationIds.add(byIdRow.id);
        return byIdRow.id;
      }

      // 2) Vérifie si une conversation existe déjà pour (client_id, pharmacy_id)
      if (conv.client_id && conv.pharmacy_id) {
        const { data: byPairRows } = await sb
          .from('conversations')
          .select('*')
          .eq('client_id', conv.client_id)
          .or(
            `pharmacy_id.eq.${conv.pharmacy_id},pharmacie_id.eq.${conv.pharmacy_id}`
          )
          .limit(1);

        if (Array.isArray(byPairRows) && byPairRows.length > 0 && byPairRows[0]?.id) {
          const existingDbConv = byPairRows[0];
          persistedConversationIds.add(existingDbConv.id);
          if (existingDbConv.id !== conv.id) {
            remapConversationIdInMemory(conv.id, existingDbConv.id, existingDbConv);
          }
          return existingDbConv.id;
        }
      }

      const fullRow: Record<string, any> = {
        id: conv.id,
        client_id: conv.client_id,
        pharmacy_id: conv.pharmacy_id,
        pharmacie_id: conv.pharmacie_id || conv.pharmacy_id,
        pharmacy_user_id: conv.pharmacy_user_id || conv.pharmacy_id,
        last_message: conv.last_message || '',
        last_message_at: conv.last_message_at || conv.created_at,
        unread_count_pharmacy: conv.unread_count_pharmacy || 0,
        unread_count_client: conv.unread_count_client || 0,
        is_blocked: Boolean(conv.is_blocked),
        is_reported: Boolean(conv.is_reported),
        created_at: conv.created_at,
        updated_at: conv.updated_at,
      };
      if (conv.admin_id) {
        fullRow.admin_id = conv.admin_id;
      }

      let { error } = await sb
        .from('conversations')
        .upsert([fullRow], { onConflict: 'id' });

      if (
        error &&
        error.code !== '23505' &&
        !error.message?.includes('duplicate')
      ) {
        console.warn(
          '[EFA CHAT] UPSERT conversations complet échoué, tentative core:',
          error.message
        );
        const coreRes = await sb.from('conversations').upsert(
          [
            {
              id: conv.id,
              client_id: conv.client_id,
              pharmacy_id: conv.pharmacy_id,
              pharmacy_user_id: conv.pharmacy_user_id || conv.pharmacy_id,
              last_message: conv.last_message || '',
              last_message_at: conv.last_message_at || conv.created_at,
              created_at: conv.created_at,
              updated_at: conv.updated_at,
            },
          ],
          { onConflict: 'id' }
        );
        error = coreRes.error;
      }

      if (
        error &&
        error.code !== '23505' &&
        !error.message?.includes('duplicate')
      ) {
        const minRes = await sb.from('conversations').insert([
          {
            id: conv.id,
            client_id: conv.client_id,
            pharmacy_id: conv.pharmacy_id,
            last_message: conv.last_message || '',
            created_at: conv.created_at,
          },
        ]);
        error = minRes.error;
      }

      if (
        error &&
        error.code !== '23505' &&
        !error.message?.includes('duplicate')
      ) {
        // Fallback si DB génère elle-même un UUID par défaut
        const noIdRes = await sb
          .from('conversations')
          .insert([
            {
              client_id: conv.client_id,
              pharmacy_id: conv.pharmacy_id,
              last_message: conv.last_message || '',
            },
          ])
          .select('id')
          .single();
        if (!noIdRes.error && noIdRes.data?.id) {
          persistedConversationIds.add(noIdRes.data.id);
          remapConversationIdInMemory(conv.id, noIdRes.data.id);
          return noIdRes.data.id;
        }
        error = noIdRes.error || error;
      }

      if (
        !error ||
        error.code === '23505' ||
        error.message?.includes('duplicate')
      ) {
        persistedConversationIds.add(conv.id);
      } else {
        console.error('[EFA CHAT] INSERT conversations échoué:', error.message, error);
      }
      return conv.id;
    } catch (err) {
      console.warn('[EFA CHAT] ensureConversationInDB warning:', err);
      return conv.id;
    } finally {
      inFlightConversationInserts.delete(conv.id);
    }
  })();

  inFlightConversationInserts.set(conv.id, p);
  return p;
}

export function getOrCreateConversation(
  clientId: string,
  pharmacieId: string,
  pharmacyUserId?: string
): Conversation {
  const existing = memoryConversations.find(
    (c) =>
      c.client_id === clientId &&
      (c.pharmacy_id === pharmacieId || c.pharmacie_id === pharmacieId)
  );

  if (existing) {
    if (pharmacyUserId && !existing.pharmacy_user_id) {
      existing.pharmacy_user_id = pharmacyUserId;
      notifyChange();
    }
    void ensureConversationInDB(existing);
    return existing;
  }

  const now = new Date().toISOString();
  const sharedConvId = deterministicUuidFromSeed(`${pharmacieId}::${clientId}`);
  const newConv: Conversation = {
    id: sharedConvId,
    client_id: clientId,
    pharmacy_id: pharmacieId,
    pharmacie_id: pharmacieId,
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

  // INSERT direct dans public.conversations
  void ensureConversationInDB(newConv);

  notifyChange();
  return newConv;
}

/**
 * Résout ou crée de façon réciproque la conversation unique (client_id, pharmacy_id) dans Supabase :
 * garantit que client et pharmacie utilisent exactement le même `conversation_id`.
 */
export async function resolveOrCreateConversation(
  clientId: string,
  pharmacieId: string,
  pharmacyUserId?: string
): Promise<Conversation> {
  try {
    const sb = getSupabaseClient();
    if (sb) {
      let { data, error } = await sb
        .from('conversations')
        .select('*')
        .eq('client_id', clientId)
        .or(`pharmacy_id.eq.${pharmacieId},pharmacie_id.eq.${pharmacieId}`)
        .order('last_message_at', { ascending: false })
        .limit(1);

      if (error) {
        const fb = await sb
          .from('conversations')
          .select('*')
          .eq('client_id', clientId)
          .eq('pharmacy_id', pharmacieId)
          .limit(1);
        data = fb.data;
        error = fb.error;
      }

      if (!error && Array.isArray(data) && data.length > 0) {
        const row: any = data[0];
        const pid = row.pharmacy_id || row.pharmacie_id || pharmacieId;
        const dbConv: Conversation = {
          ...row,
          pharmacy_id: pid,
          pharmacie_id: row.pharmacie_id || pid,
          pharmacy_user_id: row.pharmacy_user_id || pharmacyUserId || pid,
        };
        persistedConversationIds.add(dbConv.id);
        const idx = memoryConversations.findIndex((c) => c.id === dbConv.id);
        if (idx >= 0) {
          memoryConversations[idx] = dbConv;
        } else {
          memoryConversations.unshift(dbConv);
        }
        notifyChange();
        return dbConv;
      }
    }
  } catch (err) {
    console.warn('[EFA CHAT] resolveOrCreateConversation lookup warning:', err);
  }

  const conv = getOrCreateConversation(clientId, pharmacieId, pharmacyUserId);
  const confirmedId = await ensureConversationInDB(conv);
  if (confirmedId && confirmedId !== conv.id) {
    const updated = memoryConversations.find((c) => c.id === confirmedId);
    if (updated) return updated;
  }
  return conv;
}

export function getOrCreateSuperAdminConversation(
  pharmacieId: string,
  adminId = 'super-admin'
): Conversation {
  const existing = memoryConversations.find(
    (c) =>
      (c.pharmacy_id === pharmacieId || c.pharmacie_id === pharmacieId) &&
      (c.client_id === 'super-admin' || c.admin_id === adminId || Boolean(c.admin_id))
  );

  if (existing) {
    void ensureConversationInDB(existing);
    return existing;
  }

  const now = new Date().toISOString();
  const newConv: Conversation = {
    id: deterministicUuidFromSeed(`${pharmacieId}::super-admin`),
    client_id: 'super-admin',
    admin_id: adminId,
    pharmacy_id: pharmacieId,
    pharmacie_id: pharmacieId,
    pharmacy_user_id: pharmacieId,
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
  void ensureConversationInDB(newConv);
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
      const cutoff24h = new Date(Date.now() - MS_24_HOURS).toISOString();
      let { data, error } = await sb
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .gte('created_at', cutoff24h)
        .order('created_at', { ascending: true });

      if (error) {
        const fallback = await sb
          .from('messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true });
        data = fallback.data;
        error = fallback.error;
      }

      if (error) {
        const minFb = await sb
          .from('messages')
          .select('*')
          .eq('conversation_id', conversationId);
        data = minFb.data;
        error = minFb.error;
      }

      if (error) {
        console.error('[EFA CHAT] fetchMessages error:', error.message, error);
      }

      if (!error && Array.isArray(data)) {
        const conv = memoryConversations.find((c) => c.id === conversationId);
        const msgs = (data as any[])
          .map((m) => {
            const deducedSender: 'client' | 'pharma' | 'admin' =
              m.sender ||
              m.sender_type ||
              (m.sender_id &&
              (m.sender_id === m.pharmacy_id ||
                m.sender_id === conv?.pharmacy_id ||
                m.sender_id === conv?.pharmacy_user_id)
                ? 'pharma'
                : m.sender_id === 'super-admin'
                ? 'admin'
                : 'client');
            return {
              ...m,
              pharmacy_id: m.pharmacy_id || conv?.pharmacy_id,
              client_id: m.client_id || conv?.client_id,
              sender: deducedSender,
              text: m.text || m.content || '',
              content: m.content || m.text || '',
            };
          })
          .filter((m) => !isMessageExpired(m))
          .sort(
            (a, b) =>
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          ) as Message[];
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
  sender: 'client' | 'pharma' | 'admin',
  text: string,
  mediaOptions?: {
    type?: 'text' | 'image' | 'audio';
    media_url?: string;
    audio_duration?: number;
    senderId?: string;
    receiverId?: string;
    pharmacyId?: string;
    clientId?: string;
    senderType?: 'client' | 'pharma' | 'admin' | 'system';
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
    (sender === 'admin'
      ? conv?.admin_id || 'super-admin'
      : sender === 'client'
      ? mediaOptions?.clientId || conv?.client_id || getOrCreateClientId()
      : mediaOptions?.pharmacyId ||
        conv?.pharmacy_id ||
        conv?.pharmacie_id ||
        conv?.pharmacy_user_id ||
        'pharma-1');

  const receiverId =
    mediaOptions?.receiverId ||
    (sender === 'pharma'
      ? mediaOptions?.clientId || conv?.admin_id || conv?.client_id || getOrCreateClientId()
      : mediaOptions?.pharmacyId ||
        conv?.pharmacy_id ||
        conv?.pharmacie_id ||
        conv?.pharmacy_user_id ||
        'pharma-1');

  const resolvedPharmacyId =
    mediaOptions?.pharmacyId ||
    conv?.pharmacy_id ||
    conv?.pharmacie_id ||
    (sender === 'pharma' ? senderId : receiverId);

  const resolvedClientId =
    mediaOptions?.clientId ||
    conv?.client_id ||
    (sender === 'client' ? senderId : receiverId);

  const newMsg: Message = {
    id: generateUuid(),
    conversation_id: conversationId,
    pharmacy_id: resolvedPharmacyId,
    client_id: resolvedClientId,
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
  const summary =
    mediaOptions?.type === 'audio'
      ? '🎤 Message vocal'
      : mediaOptions?.type === 'image'
      ? '📷 Photo'
      : text;

  if (cIdx !== -1) {
    memoryConversations[cIdx].last_message = summary;
    memoryConversations[cIdx].last_message_at = createdAt;
    memoryConversations[cIdx].updated_at = createdAt;

    if (sender === 'client' || sender === 'admin') {
      memoryConversations[cIdx].unread_count_pharmacy =
        (memoryConversations[cIdx].unread_count_pharmacy || 0) + 1;
      if (sender === 'client' && memoryConversations[cIdx].pharmacy_id) {
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

  // 4. Synchronisation Supabase : garantir `conversations` puis INSERT `messages`
  //    avec conversation_id + sender_id + pharmacy_id + client_id
  void (async () => {
    try {
      const sb = getSupabaseClient();
      if (!sb) {
        console.error('[EFA CHAT] Client Supabase indisponible pour INSERT messages.');
        return;
      }

      const convToEnsure: Conversation = conv || {
        id: conversationId,
        client_id: resolvedClientId,
        pharmacy_id: resolvedPharmacyId,
        pharmacie_id: resolvedPharmacyId,
        pharmacy_user_id: resolvedPharmacyId,
        last_message: summary,
        last_message_at: createdAt,
        unread_count_pharmacy: sender === 'client' ? 1 : 0,
        unread_count_client: sender === 'pharma' ? 1 : 0,
        created_at: createdAt,
        updated_at: createdAt,
      };

      const targetConvId = await ensureConversationInDB(convToEnsure);

      const fullMsgRow = {
        id: newMsg.id,
        conversation_id: targetConvId,
        sender_id: newMsg.sender_id,
        pharmacy_id: resolvedPharmacyId,
        client_id: resolvedClientId,
        receiver_id: newMsg.receiver_id,
        sender_type: newMsg.sender_type,
        sender: newMsg.sender,
        content: newMsg.content,
        text: newMsg.text,
        type: newMsg.type,
        media_url: newMsg.media_url || null,
        audio_duration: newMsg.audio_duration || null,
        is_read: false,
        created_at: newMsg.created_at,
        expires_at: newMsg.expires_at,
      };

      let { error: msgErr } = await sb.from('messages').insert([fullMsgRow]);

      if (msgErr) {
        console.warn(
          '[EFA CHAT] INSERT messages complet échoué, tentative core (conversation_id + sender_id + pharmacy_id + client_id):',
          msgErr.message
        );
        const coreMsgRes = await sb.from('messages').insert([
          {
            id: newMsg.id,
            conversation_id: targetConvId,
            sender_id: newMsg.sender_id,
            pharmacy_id: resolvedPharmacyId,
            client_id: resolvedClientId,
            receiver_id: newMsg.receiver_id,
            sender: newMsg.sender,
            content: newMsg.content,
            text: newMsg.text,
            type: newMsg.type,
            created_at: newMsg.created_at,
          },
        ]);
        msgErr = coreMsgRes.error;
      }

      if (msgErr) {
        console.warn('[EFA CHAT] Tentative 3 INSERT messages (sans id/type):', msgErr.message);
        const res3 = await sb.from('messages').insert([
          {
            conversation_id: targetConvId,
            sender_id: newMsg.sender_id,
            pharmacy_id: resolvedPharmacyId,
            client_id: resolvedClientId,
            sender: newMsg.sender,
            content: newMsg.content,
            text: newMsg.text,
            created_at: newMsg.created_at,
          },
        ]);
        msgErr = res3.error;
      }

      if (msgErr) {
        console.warn('[EFA CHAT] Tentative 4 INSERT messages minimal:', msgErr.message);
        const res4 = await sb.from('messages').insert([
          {
            conversation_id: targetConvId,
            sender_id: newMsg.sender_id,
            pharmacy_id: resolvedPharmacyId,
            client_id: resolvedClientId,
            content: newMsg.content,
          },
        ]);
        msgErr = res4.error;
      }

      if (msgErr) {
        console.error('[EFA CHAT] ECHEC DEFINITIF INSERT messages Supabase:', {
          code: msgErr.code,
          message: msgErr.message,
          details: msgErr.details,
          hint: msgErr.hint,
          conversation_id: targetConvId,
          sender_id: newMsg.sender_id,
          pharmacy_id: resolvedPharmacyId,
          client_id: resolvedClientId,
        });
        notifyChatError(`Erreur envoi message (${msgErr.message})`);
      }

      const updateFields: Record<string, any> = {
        last_message: conv?.last_message || summary,
        last_message_at: conv?.last_message_at || createdAt,
        unread_count_pharmacy: conv?.unread_count_pharmacy ?? (sender === 'client' ? 1 : 0),
        unread_count_client: conv?.unread_count_client ?? (sender === 'pharma' ? 1 : 0),
        updated_at: conv?.updated_at || createdAt,
      };
      let { error: convUpdateErr } = await sb
        .from('conversations')
        .update(updateFields)
        .eq('id', targetConvId);
      if (convUpdateErr) {
        const minUpd = await sb
          .from('conversations')
          .update({
            last_message: conv?.last_message || summary,
            updated_at: conv?.updated_at || createdAt,
          })
          .eq('id', targetConvId);
        convUpdateErr = minUpd.error;
      }
      if (convUpdateErr) {
        console.warn('[EFA CHAT] UPDATE conversations:', convUpdateErr.message);
      }

      await fetchMessages(targetConvId);
      await fetchConversations();
    } catch (err: any) {
      console.error('[EFA CHAT] addMessage Supabase exception:', err);
      notifyChatError(`Erreur réseau chat : ${err?.message || 'échec envoi'}`);
    }
  })();

  notifyChange();
  return newMsg;
}

export function markConversationAsRead(
  conversationId: string,
  readerType: 'pharma' | 'client' | 'admin',
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
        (m.sender === 'client' || m.sender === 'admin' || m.receiver_id === readerId)
      ) {
        m.is_read = true;
      } else if (
        (readerType === 'client' || readerType === 'admin') &&
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
   GARDES PERSISTANTES (`public.garde_planning` SUPABASE - ZERO LOCALSTORAGE)
   =============================== */

function normalizeGardeRow(g: any): Garde {
  const pid = String(g.pharmacy_id || g.pharmacie_id || '');
  return {
    id: String(g.id),
    pharmacy_id: pid,
    pharmacie_id: pid,
    date_debut: g.date_debut,
    date_fin: g.date_fin,
    type_garde: g.type_garde || '24h',
    created_at: g.created_at,
  };
}

export function loadGardes(pharmacieId?: string): Garde[] {
  if (pharmacieId) {
    return memoryGardes.filter(
      (g) => g.pharmacy_id === pharmacieId || g.pharmacie_id === pharmacieId
    );
  }
  return memoryGardes;
}

export async function fetchGardes(pharmacyId?: string): Promise<Garde[]> {
  try {
    const client = getSupabaseClient();
    if (!client) return loadGardes(pharmacyId);

    let query = client
      .from('garde_planning')
      .select('*')
      .order('date_debut', { ascending: true });

    if (pharmacyId && isValidUuid(pharmacyId)) {
      query = query.eq('pharmacy_id', pharmacyId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[EFA GARDE] SELECT garde_planning error:', error.message);
      return loadGardes(pharmacyId);
    }

    if (Array.isArray(data)) {
      const normalized = data.map(normalizeGardeRow);
      if (pharmacyId) {
        const others = memoryGardes.filter(
          (g) => g.pharmacy_id !== pharmacyId && g.pharmacie_id !== pharmacyId
        );
        memoryGardes = [...others, ...normalized];
      } else {
        memoryGardes = normalized;
      }
      notifyChange();
      return normalized;
    }
  } catch (err) {
    console.warn('[EFA GARDE] fetchGardes error:', err);
  }
  return loadGardes(pharmacyId);
}

export async function addGarde(garde: {
  pharmacy_id?: string;
  pharmacie_id?: string;
  date_debut: string;
  date_fin: string;
  type_garde?: string;
}): Promise<{ garde: Garde | null; error?: string }> {
  const pid = String(garde.pharmacy_id || garde.pharmacie_id || '');
  const id = generateUuid();
  const row = {
    id,
    pharmacy_id: pid,
    date_debut: garde.date_debut,
    date_fin: garde.date_fin,
    type_garde: garde.type_garde || '24h',
  };

  try {
    const client = getSupabaseClient();
    if (!client) {
      return { garde: null, error: 'Client Supabase non initialisé.' };
    }

    const { data, error } = await client
      .from('garde_planning')
      .insert([row])
      .select('*')
      .single();

    if (error) {
      console.error('[EFA GARDE] INSERT garde_planning error:', error.message);
      return { garde: null, error: error.message };
    }

    const saved = normalizeGardeRow(data || row);
    memoryGardes = [...memoryGardes.filter((g) => g.id !== saved.id), saved];

    // Met à jour is_garde en base si la plage englobe maintenant
    const nowMs = Date.now();
    const sMs = new Date(saved.date_debut).getTime();
    const eMs = new Date(saved.date_fin).getTime();
    if (nowMs >= sMs && nowMs <= eMs && isValidUuid(pid)) {
      updatePharmacyStatus(pid, true);
    }

    notifyChange();
    return { garde: saved };
  } catch (err: any) {
    console.error('[EFA GARDE] addGarde exception:', err);
    return { garde: null, error: err?.message || 'Erreur insertion garde' };
  }
}

export async function deleteGarde(id: string): Promise<boolean> {
  const existing = memoryGardes.find((g) => g.id === id);
  try {
    const client = getSupabaseClient();
    if (client) {
      const { error } = await client
        .from('garde_planning')
        .delete()
        .eq('id', id);
      if (error) {
        console.error('[EFA GARDE] DELETE garde_planning error:', error.message);
        return false;
      }
    }
    memoryGardes = memoryGardes.filter((g) => g.id !== id);
    if (existing) {
      const pid = existing.pharmacy_id || existing.pharmacie_id || '';
      if (pid && isValidUuid(pid)) {
        const stillOnDuty = isPharmacyCurrentlyOnDuty(pid);
        updatePharmacyStatus(pid, stillOnDuty);
      }
    }
    notifyChange();
    return true;
  } catch (err) {
    console.error('[EFA GARDE] deleteGarde exception:', err);
    return false;
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
    fetchGardes().catch(() => {});
    fetchClients().catch(() => {});
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
              const resolvedSender: 'client' | 'pharma' | 'admin' =
                newMsg.sender ||
                (newMsg.sender_type === 'pharma'
                  ? 'pharma'
                  : newMsg.sender_type === 'admin'
                  ? 'admin'
                  : 'client');
              const msgObj: Message = {
                id: newMsg.id,
                conversation_id: convId,
                pharmacy_id: newMsg.pharmacy_id,
                client_id: newMsg.client_id,
                sender: resolvedSender,
                sender_type: newMsg.sender_type || resolvedSender,
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
              };

              if (!isMessageExpired(msgObj)) {
                const list = memoryMessages[convId] || [];
                if (!list.some((m) => m.id === msgObj.id)) {
                  list.push(msgObj);
                  memoryMessages[convId] = list;
                }
              }

              // Mettre à jour ou créer la conversation en mémoire immédiatement pour réciprocité instantanée
              const convIdx = memoryConversations.findIndex((c) => c.id === convId);
              const msgPreview =
                msgObj.type === 'audio'
                  ? '🎤 Message vocal'
                  : msgObj.type === 'image'
                  ? '📷 Photo'
                  : msgObj.text || '';
              if (convIdx >= 0) {
                memoryConversations[convIdx] = {
                  ...memoryConversations[convIdx],
                  last_message: msgPreview,
                  last_message_at: msgObj.created_at,
                  updated_at: msgObj.created_at,
                  unread_count_pharmacy:
                    resolvedSender === 'client' || resolvedSender === 'admin'
                      ? (memoryConversations[convIdx].unread_count_pharmacy || 0) + 1
                      : memoryConversations[convIdx].unread_count_pharmacy,
                  unread_count_client:
                    resolvedSender === 'pharma'
                      ? (memoryConversations[convIdx].unread_count_client || 0) + 1
                      : memoryConversations[convIdx].unread_count_client,
                };
              } else {
                const guessedClientId =
                  newMsg.client_id ||
                  (resolvedSender === 'client' ? newMsg.sender_id : newMsg.receiver_id);
                const guessedPharmaId =
                  newMsg.pharmacy_id ||
                  (resolvedSender === 'pharma' ? newMsg.sender_id : newMsg.receiver_id);
                if (guessedClientId && guessedPharmaId) {
                  memoryConversations.unshift({
                    id: convId,
                    client_id: guessedClientId,
                    pharmacy_id: guessedPharmaId,
                    pharmacie_id: guessedPharmaId,
                    pharmacy_user_id: guessedPharmaId,
                    last_message: msgPreview,
                    last_message_at: msgObj.created_at,
                    unread_count_pharmacy: resolvedSender === 'client' ? 1 : 0,
                    unread_count_client: resolvedSender === 'pharma' ? 1 : 0,
                    created_at: msgObj.created_at,
                    updated_at: msgObj.created_at,
                  });
                }
                fetchConversations().catch(() => {});
                fetchClients().catch(() => {});
              }
            }
          } else if (payload.eventType === 'DELETE' && payload.old?.id) {
            const oldId = payload.old.id;
            for (const cId of Object.keys(memoryMessages)) {
              memoryMessages[cId] = memoryMessages[cId].filter((m) => m.id !== oldId);
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
          fetchClients().catch(() => {});
          fetchClientsCount().catch(() => {});
          notifyChange();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pharmacies_pending' },
        () => {
          fetchPendingPharmacies()
            .then(() => notifyChange())
            .catch(() => {});
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pre_inscriptions' },
        () => {
          notifyChange();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'utilisateurs' },
        () => {
          notifyChange();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'users' },
        () => {
          notifyChange();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'garde_planning' },
        () => {
          fetchGardes().catch(() => {});
          fetchApprovedPharmacies().catch(() => {});
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
 * 3. Timeout strict de 10 secondes : si dépassé, affiche quand même l'app avec bouton Réessayer.
 * 4. Ensuite seulement, en arrière-plan, subscribe au websocket.
 * 5. Pas de boucle si timeout ou websocket échoue, polling 30s en secours.
 */
export type BootstrapStatus = 'idle' | 'loading' | 'success' | 'timeout';

let bootstrapAttempted = false;
let bootstrapStatus: BootstrapStatus = 'idle';

export function getBootstrapStatus(): BootstrapStatus {
  return bootstrapStatus;
}

export async function bootstrapStoreFromSupabase(
  force = false
): Promise<void> {
  if (bootstrapAttempted && !force) return;
  bootstrapAttempted = true;
  bootstrapStatus = 'loading';
  if (force) {
    notifyChange();
  }

  const selectQueries = Promise.allSettled([
    fetchApprovedPharmacies(),
    fetchGardes(),
    fetchPendingPharmacies(),
    fetchDemandesAbonnement(),
    fetchClients(),
    fetchClientsCount(),
    fetchConversations(),
  ]);

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<'timeout'>((resolve) => {
    timeoutId = setTimeout(() => resolve('timeout'), 10000);
  });

  try {
    const outcome = await Promise.race([selectQueries, timeoutPromise]);
    if (timeoutId) clearTimeout(timeoutId);
    if (outcome === 'timeout') {
      bootstrapStatus = 'timeout';
      console.warn(
        '[EFA GARDE] Timeout 10s atteint sur bootstrap, ouverture immédiate avec bouton Réessayer.'
      );
    } else {
      bootstrapStatus = 'success';
    }
  } catch (err) {
    if (timeoutId) clearTimeout(timeoutId);
    bootstrapStatus = 'timeout';
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

export async function retryBootstrapStoreFromSupabase(): Promise<void> {
  return bootstrapStoreFromSupabase(true);
}

/**
 * Bouton Rafraîchir global (Liste pharmacies + Chat client + Chat pharmacien) :
 * Refetch gardes + pharmacies + abonnements + conversations + messages en parallèle.
 */
export async function refreshChatAndGardes(options?: {
  pharmacyId?: string;
  clientId?: string;
  pharmacyUserId?: string;
  conversationId?: string;
}): Promise<{
  pharmacies: Pharmacie[];
  gardes: Garde[];
  conversations: Conversation[];
  messages: Message[];
}> {
  const [
    gardesRes,
    abnRes,
    pharmaciesRes,
    _clientsRes,
    conversationsRes,
    messagesRes,
  ] = await Promise.allSettled([
    fetchGardes(options?.pharmacyId),
    fetchDemandesAbonnement(),
    fetchApprovedPharmacies(),
    fetchClients(),
    fetchConversations(
      options?.pharmacyId,
      options?.clientId,
      options?.pharmacyUserId
    ),
    options?.conversationId
      ? fetchMessages(options.conversationId)
      : Promise.resolve([] as Message[]),
  ]);

  void abnRes;

  return {
    gardes:
      gardesRes.status === 'fulfilled'
        ? gardesRes.value
        : loadGardes(options?.pharmacyId),
    pharmacies:
      pharmaciesRes.status === 'fulfilled'
        ? pharmaciesRes.value
        : loadApprovedPharmacies(),
    conversations:
      conversationsRes.status === 'fulfilled'
        ? conversationsRes.value
        : loadConversations(
            options?.pharmacyId,
            options?.clientId,
            options?.pharmacyUserId
          ),
    messages:
      messagesRes.status === 'fulfilled'
        ? messagesRes.value
        : options?.conversationId
        ? loadMessages(options.conversationId)
        : [],
  };
}

if (typeof window !== 'undefined') {
  bootstrapStoreFromSupabase().catch(() => {});
}
