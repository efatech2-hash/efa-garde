export type PlanType =
  | 'free'
  | 'register'
  | 'top'
  | 'annual'
  | '60k'
  | 'populaire_mensuel'
  | 'populaire_annuel';

export type SubscriptionPlan = 'basic' | 'premium';
export type SubscriptionStatus = 'active' | 'inactive';

export interface Pharmacie {
  id: string;
  nom: string;
  tel: string;
  lat: number;
  lng: number;
  adresse: string;
  plan: PlanType;
  is_online: boolean;
  is_active?: boolean;
  is_registered?: boolean;
  subscription_plan?: SubscriptionPlan;
  subscription_status?: SubscriptionStatus;
  subscription_start_at?: string;
  subscription_end_at?: string;
  subscription_days_left?: number;
  subscription_end?: string;
  is_premium?: boolean;
  etoile_doree?: boolean;
  position?: number;
  is_always_visible?: boolean;
  badge?: string;
  prix?: number;
  distanceKm?: number;
  is_pending?: boolean;
  quartier?: string;
  titulaire?: string;
  numero_ordre?: string;
  photo_url?: string;
  piece_url?: string;
  email_pro?: string;
  mot_de_passe?: string;
  statut?: 'pending' | 'approved' | 'rejected';
  itinerary_clicks?: number;
  horaires?: string;
}

export interface Pub {
  id: string;
  image: string;
  titre: string;
  lien: string;
  prix?: string;
  date_fin?: string;
  description?: string;
  sponsor?: string;
}

export interface PharmaciePending {
  id: string;
  nom: string;
  quartier: string;
  adresse: string;
  phone: string;
  titulaire: string;
  numero_ordre?: string;
  piece_url?: string;
  email_pro?: string;
  mot_de_passe?: string;
  lat: number;
  lng: number;
  photo_url?: string;
  statut: 'pending' | 'en_attente' | 'approved' | 'rejected';
  created_at: string;
}

export interface Garde {
  id: string;
  pharmacie_id: string;
  date_debut: string; // ISO string
  date_fin: string;   // ISO string
}

export interface Conversation {
  id: string;
  client_id: string;
  pharmacy_id: string;
  pharmacy_user_id?: string;
  last_message?: string;
  last_message_at?: string;
  unread_count_pharmacy?: number;
  unread_count_client?: number;
  is_blocked?: boolean;
  blocked_by?: string;
  blocked_by_type?: 'pharmacy' | 'client';
  blocked_at?: string;
  is_reported?: boolean;
  updated_at?: string;
  created_at?: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id?: string;
  receiver_id?: string;
  sender_type?: 'client' | 'pharma' | 'system';
  sender: 'client' | 'pharma';
  content?: string;
  text: string;
  is_read?: boolean;
  created_at: string;
  expires_at?: string; // created_at + 24h (suppression automatique 24h)
  type?: 'text' | 'image' | 'audio';
  media_url?: string;
  audio_duration?: number;
}

export interface Signalement {
  id: string;
  conversation_id: string;
  reporter_id: string;
  reported_id: string;
  reason: 'Spam' | 'Harcèlement' | 'Injures' | 'Autre' | string;
  description?: string;
  status: 'pending' | 'resolved' | 'ignored' | 'banned';
  created_at: string;
  pharmacy_nom?: string;
  client_nom?: string;
}

export interface PresenceState {
  userId: string;
  role: 'client' | 'pharma';
  pharmacieId?: string;
  onlineAt: string;
}

export interface PharmacyDailyStat {
  pharmacie_id: string;
  date: string; // YYYY-MM-DD
  client_count: number;
}

