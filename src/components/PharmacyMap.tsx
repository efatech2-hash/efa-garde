import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Pharmacie } from '../types';
import { LOME_CENTER, getDistance, formatDistanceShort } from '../utils/geo';
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

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Pharmacy Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove old markers not in current list
    markersRef.current.forEach((marker, id) => {
      if (!pharmacies.find((p) => p.id === id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    pharmacies.forEach((p) => {
      // Coordonnées sécurisées sur terre à Lomé
      let lat = p.lat;
      let lng = p.lng;
      if (!lat || !lng || isNaN(lat) || isNaN(lng) || lat < 6.12) {
        lat = LOME_CENTER.lat;
        lng = LOME_CENTER.lng;
      }

      // Calcul distance si utilisateur géolocalisé
      let distanceText = '';
      if (userPosition) {
        const d = getDistance(userPosition.lat, userPosition.lng, lat, lng);
        distanceText = ` • ${formatDistanceShort(d)}`;
      }

      // Règles visuelles
      const isPending = p.is_pending || p.statut === 'pending';
      const isPaidAndOnline = !isPending && (p.plan === '60k' || p.plan === 'top') && p.is_online;
      const isTop = !isPending && p.plan === 'top';

      let bgClass = 'bg-slate-500 border-slate-400 text-slate-200';
      let ringHtml = '';

      if (isPending) {
        // PIN GRIS + badge "En cours de vérification"
        bgClass = 'bg-slate-700 border-slate-400 text-slate-200 shadow-md';
        ringHtml = `
          <span class="absolute -top-1.5 -right-1.5 w-4 h-4 bg-amber-500 text-slate-950 font-black rounded-full flex items-center justify-center text-[9px] shadow border border-white">
            ⏳
          </span>
        `;
      } else if (isPaidAndOnline) {
        if (isTop) {
          bgClass = 'bg-emerald-600 border-amber-400 text-white shadow-lg shadow-emerald-500/50';
          ringHtml = `
            <span class="absolute -top-1 -right-1 w-5 h-5 bg-amber-400 text-slate-900 font-black rounded-full flex items-center justify-center text-[10px] shadow border border-white">
              ★
            </span>
            <span class="absolute -inset-1 rounded-full bg-emerald-400/40 marker-pulse -z-10"></span>
          `;
        } else {
          bgClass = 'bg-emerald-500 border-emerald-300 text-white shadow-md shadow-emerald-500/40';
          ringHtml = `<span class="absolute -inset-1 rounded-full bg-emerald-400/30 marker-pulse -z-10"></span>`;
        }
      } else {
        bgClass = 'bg-slate-600 border-slate-500 text-slate-300 opacity-90';
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
  }, [pharmacies, onSelectPharmacy, userPosition]);

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
      const validPharmacies = pharmacies.filter(
        (p) => p.lat && p.lng && !isNaN(p.lat) && !isNaN(p.lng)
      );

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
  }, [userPosition, pharmacies]);

  // Pan to selected pharmacy if changed
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedPharmacy) return;
    map.flyTo([selectedPharmacy.lat, selectedPharmacy.lng], 15, {
      duration: 1.2,
    });
  }, [selectedPharmacy]);

  return (
    <div className="relative w-full h-full min-h-[380px] rounded-2xl overflow-hidden shadow-2xl border border-slate-800">
      <div ref={mapContainerRef} className="w-full h-full" />

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
            const target = selectedPharmacy || pharmacies[0];
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
