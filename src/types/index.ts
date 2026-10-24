export type PlanType = 'free' | 'register' | 'top' | 'annual' | '60k';

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
  subscription_end?: string;
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
  pharmacie_id: string;
  last_message?: string;
  updated_at?: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender: 'client' | 'pharma';
  text: string;
  created_at: string;
  expires_at?: string; // created_at + 48h
  type?: 'text' | 'image' | 'audio';
  media_url?: string;
  audio_duration?: number;
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

