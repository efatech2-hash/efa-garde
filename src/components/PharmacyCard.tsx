import React from 'react';
import { Pharmacie } from '../types';
import { getGoogleMapsNavigationUrl, formatDistanceUser } from '../utils/geo';
import { trackItineraryClick, recordClientContact, getPharmacyListTier } from '../services/store';
import { Phone, Navigation, MessageSquare, Star, CheckCircle2, XCircle, MapPin } from 'lucide-react';

interface PharmacyCardProps {
  pharmacy: Pharmacie;
  onClose?: () => void;
  onOpenChat: (pharmacieId: string) => void;
  distanceKm?: number;
  userLocation?: { lat: number; lng: number } | null;
}

export const PharmacyCard: React.FC<PharmacyCardProps> = ({
  pharmacy,
  onClose,
  onOpenChat,
  distanceKm,
  userLocation,
}) => {
  const isOnline = Boolean(pharmacy.is_garde ?? pharmacy.is_online);
  const isActive = pharmacy.is_active !== false;
  const canChat = Boolean(isOnline && isActive);
  const tier = getPharmacyListTier(pharmacy);
  const isPopulaire = tier === 0;
  const isVertPaid = tier === 1;
  const isTop = false;
  const isPaid = isPopulaire || isVertPaid;
  const itineraireUrl = getGoogleMapsNavigationUrl(
    pharmacy.lat,
    pharmacy.lng,
    userLocation?.lat,
    userLocation?.lng
  );

  return (
    <div
      className={`relative bg-slate-900/95 backdrop-blur-xl rounded-2xl p-5 shadow-2xl text-slate-100 max-w-md w-full animate-in fade-in slide-in-from-bottom-4 duration-200 ${
        isPopulaire
          ? 'border-2 border-yellow-400 bg-gradient-to-br from-yellow-500/15 via-slate-900 to-slate-900 shadow-yellow-500/20'
          : isVertPaid
          ? 'border-2 border-emerald-500/70 bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900'
          : 'border border-slate-700/80'
      }`}
    >
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-100 p-1 rounded-full hover:bg-slate-800 transition-colors"
          title="Fermer"
        >
          <span className="sr-only">Fermer</span>
          ✕
        </button>
      )}

      {/* Header Badges */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {isPopulaire && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-gradient-to-r from-yellow-400 to-amber-400 text-slate-950 shadow-md">
            <Star className="w-3.5 h-3.5 fill-slate-950 text-slate-950" />
            PLAN STAR
          </span>
        )}

        {isTop && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-400/20 text-amber-300 border border-amber-400/40">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            TOP 1 RECOMMANDÉ
          </span>
        )}

        {isVertPaid && !isPopulaire && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            Officine vérifiée
          </span>
        )}

        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
            isOnline
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
              : isActive
              ? 'bg-blue-500/15 text-blue-300 border border-blue-500/40'
              : 'bg-slate-800 text-slate-400 border border-slate-700'
          }`}
        >
          {isOnline ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              DE GARDE
            </>
          ) : isActive ? (
            <>
              <span className="w-2 h-2 rounded-full bg-blue-400"></span>
              OUVERTE
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-slate-500"></span>
              FERMÉE
            </>
          )}
        </span>

        {distanceKm !== undefined && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 ml-auto">
            <Navigation className="w-3 h-3 rotate-45 text-blue-400" />
            {formatDistanceUser(distanceKm)}
          </span>
        )}
      </div>

      {isPopulaire && (
        <div className="mb-3 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-2">
          <span>⭐</span>
          <span>Officine mise en avant en première position à Lomé</span>
        </div>
      )}

      {/* Pharmacy Name & Address */}
      <h3 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
        <span>{pharmacy.nom}</span>
        {isPopulaire && (
          <span className="text-amber-400 text-xl shrink-0" title="Étoile dorée POPULAIRE">
            ⭐
          </span>
        )}
      </h3>

      <div className="flex items-start gap-2 text-sm text-slate-300 mt-2 mb-3">
        <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <span className="leading-snug">{pharmacy.adresse}</span>
      </div>

      {pharmacy.photo_url && (
        <div className="mb-3 h-28 w-full rounded-xl overflow-hidden border border-slate-700">
          <img src={pharmacy.photo_url} alt={pharmacy.nom} className="w-full h-full object-cover" />
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-slate-400 mb-5">
        <span className="font-mono bg-slate-800 px-2 py-0.5 rounded border border-slate-700 text-slate-300">
          GPS: {pharmacy.lat.toFixed(4)}, {pharmacy.lng.toFixed(4)}
        </span>
        <span>• Lomé, Togo</span>
      </div>

      {/* Action Buttons Grid */}
      <div
        className={`grid grid-cols-1 ${
          canChat ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
        } gap-2.5 pt-2 border-t border-slate-800`}
      >
        {/* Appeler */}
        <a
          href={`tel:${pharmacy.tel}`}
          onClick={() => recordClientContact(pharmacy.id)}
          className="min-h-[48px] flex items-center justify-center gap-2 px-3 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 hover:text-emerald-200 border border-slate-700 font-bold text-sm transition-all shadow active:scale-95"
        >
          <Phone className="w-4 h-4 text-emerald-400" />
          <span>Appeler</span>
        </a>

        {/* Bouton "Itinéraire" : ouvre Google Maps itinéraire Client -> Pharmacie */}
        <button
          type="button"
          onClick={() => {
            trackItineraryClick(pharmacy.id);
            if (navigator.geolocation) {
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  const latClient = pos.coords.latitude;
                  const lngClient = pos.coords.longitude;
                  window.open(
                    `https://www.google.com/maps/dir/?api=1&origin=${latClient},${lngClient}&destination=${pharmacy.lat},${pharmacy.lng}&travelmode=driving`,
                    '_blank'
                  );
                },
                () => {
                  window.open(
                    `https://www.google.com/maps/dir/?api=1&destination=${pharmacy.lat},${pharmacy.lng}&travelmode=driving`,
                    '_blank'
                  );
                },
                { enableHighAccuracy: true, timeout: 8000 }
              );
            } else {
              window.open(
                `https://www.google.com/maps/dir/?api=1&destination=${pharmacy.lat},${pharmacy.lng}&travelmode=driving`,
                '_blank'
              );
            }
          }}
          className="min-h-[48px] flex items-center justify-center gap-2 px-3 py-3 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 font-bold text-sm transition-all shadow active:scale-95 text-center cursor-pointer"
          title="Ouvrir l'itinéraire Google Maps vers cette officine"
        >
          <Navigation className="w-4 h-4 text-blue-400" />
          <span>Itinéraire</span>
        </button>

        {/* Chatter : visible UNIQUEMENT si is_garde=true ET is_active=true */}
        {canChat && (
          <button
            onClick={() => {
              recordClientContact(pharmacy.id);
              onOpenChat(pharmacy.id);
            }}
            className="min-h-[48px] flex items-center justify-center gap-2 px-3 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-all shadow-lg shadow-emerald-600/30 active:scale-95 cursor-pointer"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Chatter</span>
          </button>
        )}
      </div>
    </div>
  );
};
