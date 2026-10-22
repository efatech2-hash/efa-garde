import { Pharmacie } from '../types';

export const LOME_CENTER = {
  lat: 6.1319,
  lng: 1.2228,
};

/**
 * Calcul de distance (formule Haversine) en kilomètres
 */
export function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Rayon de la Terre en km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return Math.round(d * 10) / 10; // 1 décimale
}

// Alias de rétrocompatibilité
export const calculateDistanceKm = getDistance;

/**
 * Formate la distance pour affichage convivial (ex: "À 800m de vous" ou "À 1.2 km de vous")
 */
export function formatDistanceUser(km: number): string {
  if (km < 1) {
    const meters = Math.round(km * 1000);
    return `À ${meters}m de vous`;
  }
  return `À ${km.toFixed(1)} km de vous`;
}

/**
 * Formate la distance courte pour les badges/marqueurs (ex: "0.8km" ou "800m")
 */
export function formatDistanceShort(km: number): string {
  if (km < 1) {
    const meters = Math.round(km * 1000);
    return `${meters}m`;
  }
  return `${km.toFixed(1)}km`;
}

/**
 * Trie les pharmacies par distance croissante à partir de la position utilisateur
 */
export function sortPharmaciesByDistance(
  userLat: number,
  userLng: number,
  pharmacies: Pharmacie[]
): (Pharmacie & { distanceKm: number })[] {
  const withDistance = pharmacies.map((p) => {
    // Si lat/lng manquant ou dans l'océan, position par défaut dans Lomé
    let pLat = p.lat;
    let pLng = p.lng;
    if (!pLat || !pLng || isNaN(pLat) || isNaN(pLng) || pLat < 6.12) {
      console.warn(`[Geo] Coordonnées invalides ou océan pour ${p.nom}, position par défaut attribuée`);
      pLat = LOME_CENTER.lat;
      pLng = LOME_CENTER.lng;
    }
    return {
      ...p,
      lat: pLat,
      lng: pLng,
      distanceKm: getDistance(userLat, userLng, pLat, pLng),
    };
  });

  return withDistance.sort((a, b) => a.distanceKm - b.distanceKm);
}

/**
 * Calcule les 3 pharmacies les plus proches
 */
export function get3ClosestPharmacies(
  userLat: number,
  userLng: number,
  pharmacies: Pharmacie[]
): (Pharmacie & { distanceKm: number })[] {
  return sortPharmaciesByDistance(userLat, userLng, pharmacies).slice(0, 3);
}

/**
 * Génère le lien Google Maps Itinéraire exact demandé:
 * https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}
 */
export function getGoogleMapsNavigationUrl(
  destinationLat: number,
  destinationLng: number,
  _originLat?: number,
  _originLng?: number
): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${destinationLat},${destinationLng}`;
}
