import { Pharmacie, Pub } from '../types';

export const INITIAL_PHARMACIES: Pharmacie[] = [
  {
    id: 'pharma-1',
    nom: 'Pharmacie du Grand Marché',
    tel: '+228 90 22 11 00',
    lat: 6.1255,
    lng: 1.2215,
    adresse: 'Rue du Commerce, Grand Marché d’Adawlato, Lomé',
    plan: 'top',
    is_online: true,
    titulaire: 'Dr. Edoh Koffi',
    numero_ordre: 'ONPT-TOGO-0056',
    email_pro: 'grandmarche@ordredespharmaciens.tg',
    itinerary_clicks: 42,
  },
  {
    id: 'pharma-2',
    nom: 'Pharmacie Dékon',
    tel: '+228 91 34 56 78',
    lat: 6.1332,
    lng: 1.2224,
    adresse: 'Boulevard du 13 Janvier, Carrefour Dékon, Lomé',
    plan: '60k',
    is_online: true,
    titulaire: 'Dr. Kodjo Mensah',
    numero_ordre: 'ONPT-TOGO-0142',
    email_pro: 'dekon@ordredespharmaciens.tg',
    itinerary_clicks: 78,
  },
  {
    id: 'pharma-3',
    nom: 'Pharmacie Nouvelle',
    tel: '+228 92 88 44 22',
    lat: 6.155,
    lng: 1.214,
    adresse: 'Boulevard de la Paix, Face CHU Tokoin, Lomé',
    plan: 'top',
    is_online: true,
    titulaire: 'Dr. Ayoko Lawson',
    numero_ordre: 'ONPT-TOGO-0089',
    email_pro: 'nouvelle@ordredespharmaciens.tg',
    itinerary_clicks: 56,
  },
  {
    id: 'pharma-4',
    nom: 'Pharmacie de l’Espérance',
    tel: '+228 93 11 22 33',
    lat: 6.142,
    lng: 1.255,
    adresse: 'Avenue de la Libération, Bè-Kpota, Lomé',
    plan: '60k',
    is_online: false,
    titulaire: 'Dr. Séna Amouzou',
    numero_ordre: 'ONPT-TOGO-0178',
    email_pro: 'esperance@ordredespharmaciens.tg',
    itinerary_clicks: 19,
  },
  {
    id: 'pharma-5',
    nom: 'Pharmacie Agoè Assiyéyé',
    tel: '+228 90 77 66 55',
    lat: 6.2085,
    lng: 1.1963,
    adresse: 'Nationale N1, Face Marché Assiyéyé, Agoè-Nyivé',
    plan: 'top',
    is_online: true,
    titulaire: 'Dr. Yao Agbodjan',
    numero_ordre: 'ONPT-TOGO-0104',
    email_pro: 'agoe@ordredespharmaciens.tg',
    itinerary_clicks: 34,
  },
  {
    id: 'pharma-6',
    nom: 'Pharmacie de la Victoire',
    tel: '+228 22 21 04 50',
    lat: 6.145,
    lng: 1.238,
    adresse: 'Rue de l’OCAM, Tokoin Wuiti, Lomé',
    plan: 'free',
    is_online: false,
    titulaire: 'Dr. Mawuli Ayité',
    numero_ordre: 'ONPT-TOGO-0215',
    email_pro: 'victoire@ordredespharmaciens.tg',
    itinerary_clicks: 12,
  },
  {
    id: 'pharma-7',
    nom: 'Pharmacie Baguida Plage',
    tel: '+228 99 44 33 22',
    lat: 6.1558,
    lng: 1.3284,
    adresse: 'Route d’Aného, Rond-Point Baguida, Lomé',
    plan: 'free',
    is_online: true,
  },
  {
    id: 'pharma-8',
    nom: 'Pharmacie Hédzranawoé',
    tel: '+228 90 15 90 40',
    lat: 6.1645,
    lng: 1.2341,
    adresse: 'Avenue Pya, Marché Hédzranawoé, Lomé',
    plan: '60k',
    is_online: true,
  },
  {
    id: 'pharma-9',
    nom: 'Pharmacie Kodjoviakopé',
    tel: '+228 91 00 23 45',
    lat: 6.1265,
    lng: 1.2055,
    adresse: 'Rue des Hydrocarbures, Frontière Aflao, Kodjoviakopé',
    plan: 'free',
    is_online: false,
  }
];

export const INITIAL_PUBS: Pub[] = [
  {
    id: 'pub-1',
    titre: 'Vitamines & Immunité Forte - Gamme BIOPHARMA Lomé',
    image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=800&q=80',
    sponsor: 'Laboratoires BIOPHARMA Togo',
    description: 'Renforcez votre système immunitaire pendant la saison des pluies. Disponible dans toutes les officines.',
    prix: 'Pack dès 6.500 FCFA',
    date_fin: '31 Déc. 2026',
    lien: 'https://wa.me/22890000000?text=Bonjour,%20je%20suis%20int%C3%A9ress%C3%A9%20par%20les%20produits%20BIOPHARMA%20vus%20sur%20EFA%20GARDE',
  },
  {
    id: 'pub-2',
    titre: 'Assurance Santé SantéPlus - Couverture 80% Pharmacie',
    image: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=800&q=80',
    sponsor: 'NSIA Assurances Togo',
    description: 'Tiers-payant instantané dans plus de 75 pharmacies partenaires de Lomé et agglomération.',
    prix: 'Dès 12.000 FCFA / mois',
    date_fin: '30 Nov. 2026',
    lien: 'https://wa.me/22890000000?text=Bonjour,%20je%20souhaite%20des%20informations%20sur%20l%20assurance%20Sant%C3%A9Plus%20Togo',
  },
  {
    id: 'pub-3',
    titre: 'Tensiomètre Électronique Homologué Omron M3',
    image: 'https://images.unsplash.com/photo-1631815589968-fdb09a223b1e?auto=format&fit=crop&w=800&q=80',
    sponsor: 'Matériel Médical Lomé',
    description: 'Mesure automatique de la tension artérielle et détection des arythmies. Garantie 3 ans avec SAV.',
    prix: 'Promo : 24.500 FCFA',
    date_fin: '15 Janv. 2027',
    lien: 'https://wa.me/22890000000?text=Bonjour,%20je%20souhaite%20commander%20un%20tensiom%C3%A8tre%20Omron%20M3',
  },
  {
    id: 'pub-4',
    titre: 'Livraison Express Ordonnances & Médicaments à Lomé 24/7',
    image: 'https://images.unsplash.com/photo-1616401784845-180882ba9ba8?auto=format&fit=crop&w=800&q=80',
    sponsor: 'Express Pharma Lomé',
    description: 'Faites-vous livrer vos ordonnances de garde à domicile en moins de 35 minutes chrono.',
    prix: 'Course dès 1.000 FCFA',
    date_fin: '31 Déc. 2026',
    lien: 'https://wa.me/22890000000?text=Bonjour,%20j%20ai%20besoin%20d%20une%20livraison%20urgente%20de%20m%C3%A9dicaments%20%C3%A0%20Lom%C3%A9',
  },
  {
    id: 'pub-5',
    titre: 'Dermocosmétique CeraVe & La Roche-Posay en Officine',
    image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=800&q=80',
    sponsor: 'Parapharmacie Centrale Lomé',
    description: 'Soins hydratants, nettoyants dermatologiques et protections solaires SPF50+ certifiées.',
    prix: 'Dès 8.900 FCFA',
    date_fin: '28 Févr. 2027',
    lien: 'https://wa.me/22890000000?text=Bonjour,%20disponibilit%C3%A9%20des%20soins%20CeraVe%20%C3%A0%20Lom%C3%A9',
  },
  {
    id: 'pub-6',
    titre: 'Laits Infantiles 1er et 2ème Âges - Nutrition Certifiée',
    image: 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=800&q=80',
    sponsor: 'Espace Maman & Bébé Lomé',
    description: 'Toutes les grandes marques de laits infantiles disponibles jour et nuit en pharmacie de garde.',
    prix: 'Boîte dès 4.800 FCFA',
    date_fin: '31 Mars 2027',
    lien: 'https://wa.me/22890000000?text=Bonjour,%20je%20cherche%20du%20lait%20infantile%20en%20garde%20%C3%A0%20Lom%C3%A9',
  },
];

export const SQL_SCHEMA_SCRIPT = `-- ==========================================
-- EFA GARDE - MIGRATION POSTGRESQL DATABASE
-- ==========================================

-- 1. Table pharmacies
create table if not exists pharmacies (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  tel text not null,
  lat double precision not null,
  lng double precision not null,
  adresse text not null,
  plan text check (plan in ('free', '60k', 'top')) default 'free',
  is_online boolean default false
);

-- 2. Table gardes
create table if not exists gardes (
  id uuid primary key default gen_random_uuid(),
  pharmacie_id uuid references pharmacies(id) on delete cascade,
  date_debut timestamp with time zone not null,
  date_fin timestamp with time zone not null
);

-- 3. Table conversations
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  client_id text not null,
  pharmacie_id uuid references pharmacies(id) on delete cascade
);

-- 4. Table messages (avec expiration automatique 48h et support médias)
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade,
  sender text check (sender in ('client', 'pharma')) not null,
  text text not null,
  type text default 'text', -- 'text' | 'image' | 'audio'
  media_url text,
  audio_duration integer,
  created_at timestamp with time zone default now(),
  expires_at timestamp with time zone default (now() + interval '48 hours')
);

-- Index pour auto-nettoyage rapide 48h
create index if not exists idx_messages_expires_at on messages (expires_at);

-- 5. Table pharmacies_pending (En attente de vérification)
create table if not exists pharmacies_pending (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  quartier text not null,
  adresse text not null,
  phone text not null,
  titulaire text not null,
  lat double precision not null,
  lng double precision not null,
  photo_url text,
  horaires text,
  statut text check (statut in ('pending', 'approved', 'rejected')) default 'pending',
  created_at timestamp with time zone default now()
);

-- 6. Table pubs (Espace Publicités Sponsorisées)
create table if not exists pubs (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  image text not null,
  lien text not null,
  prix text,
  date_fin text,
  sponsor text,
  description text,
  created_at timestamp with time zone default now()
);

-- Enable Realtime for tables
alter publication supabase_realtime add table pharmacies;
alter publication supabase_realtime add table pharmacies_pending;
alter publication supabase_realtime add table gardes;
alter publication supabase_realtime add table conversations;
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table pubs;
`;
