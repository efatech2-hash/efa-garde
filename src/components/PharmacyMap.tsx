import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Pharmacie } from '../types';
import { LOME_CENTER, getDistance, formatDistanceShort } from '../utils/geo';
import { getSupabaseClient } from '../services/store';
import { Target, AlertCircle } from 'lucide-react';

interface PharmacyMapProps {
  pharmacies: Pharmacie[];
  selectedPharmacy: Pharmacie | null;
  onSelectPharmacy: (pharmacie: Pharmacie) => void;
  userPosition: { lat: number; lng: number } | null;
  onLocateUser?: () => void;
  isLocating?: boolean;
  locationError?: string | null;
}

export const PharmacyMap: React.FC<PharmacyMapProps> = ({
  pharmacies,
  selectedPharmacy,
  onSelectPharmacy,
  userPosition,
  onLocateUser,
  isLocating = false,
  locationError = null,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const userMarkerRef = useRef<L.Marker | null>(null);
  const dottedLinesRef = useRef<L.Polyline[]>([]);
  const [directPharmacies, setDirectPharmacies] = useState<Pharmacie[]>([]);

  // Lecture directe view_pharmacies_garde -> fallback obligatoire FROM pharmacies WHERE is_active=true
  useEffect(() => {
    let active = true;
    const loadDirectPharmacies = async () => {
      try {
        const client = getSupabaseClient();
        if (!client) return;
        let { data, error } = await client
          .from('view_pharmacies_garde')
          .select('*')
          .eq('is_active', true);

        if (error || !Array.isArray(data) || data.length === 0) {
          const fallbackRes = await client
            .from('pharmacies')
            .select('*')
            .eq('is_active', true);
          data = fallbackRes.data;
          error = fallbackRes.error;
        }

        if (error) {
          console.error('[PharmacyMap] Erreur SELECT pharmacies:', error.message);
          return;
        }
        if (active && Array.isArray(data)) {
          const normalized: Pharmacie[] = data.map((p: any) => {
            const rawLat = p.lat ?? p.latitude;
            const rawLng = p.lng ?? p.longitude;
            const parsedLat =
              rawLat !== null && rawLat !== undefined && rawLat !== ''
                ? Number(String(rawLat).replace(',', '.'))
                : NaN;
            const parsedLng =
              rawLng !== null && rawLng !== undefined && rawLng !== ''
                ? Number(String(rawLng).replace(',', '.'))
                : NaN;
            const lat = Number.isFinite(parsedLat) && parsedLat !== 0 ? parsedLat : 6.1319;
            const lng = Number.isFinite(parsedLng) && parsedLng !== 0 ? parsedLng : 1.2228;
            return {
              ...p,
              nom: p.nom || 'Pharmacie',
              tel: String(p.phone || p.tel || ''),
              phone: String(p.phone || p.tel || ''),
              adresse: p.adresse || '',
              quartier: p.quartier || 'Lomé',
              lat,
              lng,
              latitude: p.latitude ?? lat,
              longitude: p.longitude ?? lng,
              is_active: p.is_active !== false,
              is_garde: Boolean(p.is_garde ?? p.is_online),
              is_online: Boolean(p.is_garde ?? p.is_online),
            };
          });
          console.log(normalized);
          setDirectPharmacies(normalized);
        }
      } catch (err) {
        console.warn('[PharmacyMap] loadDirectPharmacies error:', err);
      }
    };
    loadDirectPharmacies();
    return () => {
      active = false;
    };
  }, []);

  const visiblePharmacies =
    pharmacies && pharmacies.length > 0 ? pharmacies : directPharmacies;

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [6.1319, 1.2228], // Lomé Togo
      zoom: 12, // Zoom 12 comme demandé
      zoomControl: false,
    });

    // OpenStreetMap 100% gratuit sans API key ni watermark
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // Zoom control at top-right
    L.control.zoom({ position: 'topright' }).addTo(map);

    mapInstanceRef.current = map;

    const resizeTimer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
      observer = new ResizeObserver(() => {
        map.invalidateSize();
      });
      observer.observe(mapContainerRef.current);
    }

    return () => {
      clearTimeout(resizeTimer);
      observer?.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Pharmacy Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    console.log(visiblePharmacies);

    // Remove old markers not in current list
    markersRef.current.forEach((marker, id) => {
      if (!visiblePharmacies.find((p) => p.id === id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    visiblePharmacies.forEach((p) => {
      // Position : lat ?? latitude , lng ?? longitude (si null/invalide -> 6.1319, 1.2228 par défaut)
      const rawLat: unknown = p.lat ?? p.latitude;
      const rawLng: unknown = p.lng ?? p.longitude;
      const parsedLat =
        rawLat !== null && rawLat !== undefined && rawLat !== ''
          ? Number(String(rawLat).replace(',', '.'))
          : NaN;
      const parsedLng =
        rawLng !== null && rawLng !== undefined && rawLng !== ''
          ? Number(String(rawLng).replace(',', '.'))
          : NaN;
      const lat = Number.isFinite(parsedLat) && parsedLat !== 0 ? parsedLat : 6.1319;
      const lng = Number.isFinite(parsedLng) && parsedLng !== 0 ? parsedLng : 1.2228;

      // Calcul distance si utilisateur géolocalisé
      let distanceText = '';
      if (userPosition) {
        const d = getDistance(userPosition.lat, userPosition.lng, lat, lng);
        distanceText = ` • ${formatDistanceShort(d)}`;
      }

      // Règles visuelles par abonnement (sans modifier is_garde)
      const isPending = Boolean(p.is_pending);
      const planStr = String(p.plan || '').toLowerCase();
      const isStarYellow =
        !isPending &&
        Boolean(
          p.etoile_doree ||
            p.is_premium ||
            planStr === 'populaire_mensuel' ||
            planStr === 'populaire_annuel' ||
            planStr.includes('star')
        );
      const isPaidGreen =
        !isPending &&
        !isStarYellow &&
        Boolean(
          p.subscription_status === 'active' ||
            p.is_registered ||
            planStr === 'register' ||
            planStr === 'annual' ||
            planStr === '60k' ||
            planStr === 'top' ||
            planStr.includes('enregistrement') ||
            planStr.includes('annuel')
        );

      let bgClass = 'bg-slate-600 border-slate-400 text-slate-200';
      let ringHtml = '';

      if (isPending) {
        // PIN GRIS + badge "En cours de vérification"
        bgClass = 'bg-slate-700 border-slate-400 text-slate-200 shadow-md';
        ringHtml = `
          <span class="absolute -top-1.5 -right-1.5 w-4 h-4 bg-amber-500 text-slate-950 font-black rounded-full flex items-center justify-center text-[9px] shadow border border-white">
            ⏳
          </span>
        `;
      } else if (isStarYellow) {
        // JAUNE BRILLANT + etoile_doree=true (star_mensuel + paye_valide)
        bgClass =
          'bg-gradient-to-tr from-yellow-400 via-amber-300 to-yellow-500 border-yellow-100 text-slate-950 shadow-xl shadow-yellow-400/70';
        ringHtml = `
          <span class="absolute -top-1.5 -right-1.5 w-5 h-5 bg-yellow-300 text-slate-950 font-black rounded-full flex items-center justify-center text-[11px] shadow border border-white">
            ⭐
          </span>
          <span class="absolute -inset-1.5 rounded-full bg-yellow-400/50 marker-pulse -z-10"></span>
        `;
      } else if (isPaidGreen) {
        // VERT (enregistrement_25k / annuel + paye_valide)
        bgClass =
          'bg-emerald-500 border-emerald-300 text-white shadow-lg shadow-emerald-500/50';
        ringHtml = `<span class="absolute -inset-1 rounded-full bg-emerald-400/35 marker-pulse -z-10"></span>`;
      } else {
        // GRIS (sans abonnement)
        bgClass = 'bg-slate-600 border-slate-400 text-slate-200 opacity-95';
      }

      const labelContent = isPending
        ? `${p.nom} • En cours de vérification`
        : `${p.nom}${distanceText}`;

      const iconHtml = `
        <div class="relative group cursor-pointer flex items-center justify-center transition-transform hover:scale-110">
          ${ringHtml}
          <div class="w-9 h-9 rounded-full ${bgClass} border-2 flex items-center justify-center shadow-lg transition-all">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div class="absolute -bottom-6 bg-slate-900/95 backdrop-blur-sm text-[10px] font-bold text-slate-100 px-2 py-0.5 rounded-md shadow-lg pointer-events-none whitespace-nowrap border border-slate-700/80 max-w-[150px] truncate flex items-center gap-1">
            <span>${labelContent}</span>
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-pharmacy-icon',
        html: iconHtml,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      let marker = markersRef.current.get(p.id);
      if (!marker) {
        marker = L.marker([lat, lng], { icon: customIcon });
        marker.on('click', () => {
          onSelectPharmacy(p);
        });
        marker.addTo(map);
        markersRef.current.set(p.id, marker);
      } else {
        marker.setLatLng([lat, lng]);
        marker.setIcon(customIcon);
      }
    });
    map.invalidateSize();
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);
    return () => clearTimeout(timer);
  }, [visiblePharmacies, onSelectPharmacy, userPosition]);

  // Update user position marker (Point BLEU "Vous êtes ici" comme Uber) + Lignes pointillées vers les 3 plus proches
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Nettoyer les anciennes lignes pointillées
    dottedLinesRef.current.forEach((l) => l.remove());
    dottedLinesRef.current = [];

    if (userPosition) {
      const userHtml = `
        <div class="relative flex items-center justify-center">
          <span class="absolute w-12 h-12 rounded-full bg-blue-500/35 marker-pulse"></span>
          <span class="absolute w-7 h-7 rounded-full bg-blue-400/50 animate-ping"></span>
          <div class="w-6 h-6 rounded-full bg-blue-600 border-2 border-white shadow-2xl flex items-center justify-center text-white">
            <div class="w-2.5 h-2.5 rounded-full bg-white"></div>
          </div>
          <div class="absolute -bottom-6 bg-blue-600 text-white font-extrabold text-[10px] px-2 py-0.5 rounded-full shadow-lg whitespace-nowrap border border-blue-300">
            Vous êtes ici
          </div>
        </div>
      `;
      const userIcon = L.divIcon({
        className: 'user-location-marker',
        html: userHtml,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      if (!userMarkerRef.current) {
        userMarkerRef.current = L.marker([userPosition.lat, userPosition.lng], {
          icon: userIcon,
          zIndexOffset: 1000,
        }).addTo(map);
      } else {
        userMarkerRef.current.setLatLng([userPosition.lat, userPosition.lng]);
      }

      // Tracer une petite ligne pointillée entre l'utilisateur et les 3 pharmacies les plus proches
      const validPharmacies = visiblePharmacies
        .map((p) => {
          const rLat: unknown = p.lat ?? p.latitude;
          const rLng: unknown = p.lng ?? p.longitude;
          const pLat = rLat !== null && rLat !== undefined && rLat !== '' ? Number(rLat) : NaN;
          const pLng = rLng !== null && rLng !== undefined && rLng !== '' ? Number(rLng) : NaN;
          return {
            ...p,
            lat: Number.isFinite(pLat) ? pLat : LOME_CENTER.lat,
            lng: Number.isFinite(pLng) ? pLng : LOME_CENTER.lng,
          };
        });

      const closest3 = validPharmacies
        .map((p) => ({
          ...p,
          d: getDistance(userPosition.lat, userPosition.lng, p.lat, p.lng),
        }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 3);

      closest3.forEach((cp, idx) => {
        const polyline = L.polyline(
          [
            [userPosition.lat, userPosition.lng],
            [cp.lat, cp.lng],
          ],
          {
            color: idx === 0 ? '#10b981' : '#3b82f6', // Vert pour la plus proche, bleu pour les 2 autres
            weight: idx === 0 ? 3 : 2,
            dashArray: '6, 8',
            opacity: idx === 0 ? 0.9 : 0.65,
          }
        ).addTo(map);

        dottedLinesRef.current.push(polyline);
      });
    } else if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }
  }, [userPosition, visiblePharmacies]);

  // Pan to selected pharmacy if changed
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedPharmacy) return;
    const rawSLat = selectedPharmacy.lat ?? selectedPharmacy.latitude;
    const rawSLng = selectedPharmacy.lng ?? selectedPharmacy.longitude;
    const pSLat = rawSLat != null ? Number(String(rawSLat).replace(',', '.')) : NaN;
    const pSLng = rawSLng != null ? Number(String(rawSLng).replace(',', '.')) : NaN;
    const sLat = Number.isFinite(pSLat) && pSLat !== 0 ? pSLat : 6.1319;
    const sLng = Number.isFinite(pSLng) && pSLng !== 0 ? pSLng : 1.2228;
    map.flyTo([sLat, sLng], 15, {
      duration: 1.2,
    });
  }, [selectedPharmacy]);

  return (
    <div className="relative w-full h-full min-h-[380px] rounded-2xl overflow-hidden shadow-2xl border border-slate-800">
      <div ref={mapContainerRef} className="w-full h-full min-h-[380px]" />

      {/* Petit bouton en bas à gauche de la carte : © OSM Gratuit */}
      <div className="absolute bottom-3 left-3 z-[400] pointer-events-auto">
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
          className="px-2.5 py-1.5 bg-white/95 hover:bg-white text-slate-800 hover:text-slate-950 text-[11px] font-bold rounded-xl border border-slate-300 shadow-md backdrop-blur-sm transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
          title="Données cartographiques OpenStreetMap 100% gratuites et libres de droits"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>© OSM Gratuit</span>
        </a>
      </div>

      {/* BOUTONS LOCALISATION sur la carte (en bas à droite) */}
      <div className="absolute bottom-3 right-3 z-[400] flex flex-col items-end gap-2 pointer-events-auto">
        {locationError && (
          <div className="bg-slate-900/95 text-amber-300 border border-amber-500/50 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-xl flex items-center gap-2 max-w-xs animate-in fade-in slide-in-from-bottom-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{locationError}</span>
          </div>
        )}

        {/* Bouton "Itinéraire" : ouvre Google Maps avec itinéraire Client -> Pharmacie */}
        <button
          onClick={() => {
            const target = selectedPharmacy || visiblePharmacies[0];
            const targetLat = target?.lat || 6.1319;
            const targetLng = target?.lng || 1.2228;
            if (navigator.geolocation) {
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  const latClient = pos.coords.latitude;
                  const lngClient = pos.coords.longitude;
                  window.open(
                    `https://www.google.com/maps/dir/?api=1&origin=${latClient},${lngClient}&destination=${targetLat},${targetLng}&travelmode=driving`,
                    '_blank'
                  );
                },
                () => {
                  window.open(
                    `https://www.google.com/maps/dir/?api=1&destination=${targetLat},${targetLng}&travelmode=driving`,
                    '_blank'
                  );
                },
                { enableHighAccuracy: true, timeout: 8000 }
              );
            } else {
              window.open(
                `https://www.google.com/maps/dir/?api=1&destination=${targetLat},${targetLng}&travelmode=driving`,
                '_blank'
              );
            }
          }}
          className="px-4 py-2.5 min-h-[46px] rounded-2xl shadow-2xl font-black text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer active:scale-95 bg-[#0A3D8F] hover:bg-[#082e6d] text-white border border-blue-400/40 shadow-blue-900/50"
          title="Ouvrir l'itinéraire Google Maps"
        >
          <span className="text-base">📍</span>
          <span>Itinéraire</span>
        </button>

        {/* Bouton "Me localiser" GPS Leaflet */}
        <button
          onClick={onLocateUser}
          disabled={isLocating}
          className={`px-4 py-2.5 min-h-[46px] rounded-2xl shadow-2xl font-extrabold text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer active:scale-95 border ${
            userPosition
              ? 'bg-blue-600 hover:bg-blue-500 text-white border-blue-400 shadow-blue-500/30'
              : 'bg-white hover:bg-slate-100 text-slate-900 border-slate-200'
          }`}
          title="Centrer sur ma position GPS"
        >
          <span className="text-base">🎯</span>
          <span>{isLocating ? 'Localisation...' : 'Me localiser'}</span>
          {userPosition && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          )}
        </button>
      </div>
    </div>
  );
};
