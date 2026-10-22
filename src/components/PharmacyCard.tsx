import React from 'react';
import { Pharmacie } from '../types';
import { getGoogleMapsNavigationUrl, formatDistanceUser } from '../utils/geo';
import { trackItineraryClick, recordClientContact } from '../services/store';
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
  const isOnline = pharmacy.is_online;
  const isTop = pharmacy.plan === 'top';
  const isPaid = pharmacy.plan === 'top' || pharmacy.plan === '60k';
  const itineraireUrl = getGoogleMapsNavigationUrl(
    pharmacy.lat,
    pharmacy.lng,
    userLocation?.lat,
    userLocation?.lng
  );

  return (
    <div className="relative bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-5 shadow-2xl text-slate-100 max-w-md w-full animate-in fade-in slide-in-from-bottom-4 duration-200">
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
        {isTop && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-400/20 text-amber-300 border border-amber-400/40">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            TOP 1 RECOMMANDÉ
          </span>
        )}

        {pharmacy.plan === '60k' && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            Plan Annuel 60k
          </span>
        )}

        {pharmacy.is_pending ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
            EN COURS DE VÉRIFICATION
          </span>
        ) : (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
              isOnline
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            {isOnline ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                DE GARDE • EN LIGNE
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                HORS GARDE • HORS LIGNE
              </>
            )}
          </span>
        )}

        {distanceKm !== undefined && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 ml-auto">
            <Navigation className="w-3 h-3 rotate-45 text-blue-400" />
            {formatDistanceUser(distanceKm)}
          </span>
        )}
      </div>

      {pharmacy.is_pending && (
        <div className="mb-3 p-2.5 bg-amber-950/40 border border-amber-500/40 rounded-xl text-xs text-amber-200">
          ⏳ Cette pharmacie a été ajoutée récemment et est en cours de vérification administrative.
        </div>
      )}

      {/* Pharmacy Name & Address */}
      <h3 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
        {pharmacy.nom}
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-800">
        {/* Appeler */}
        <a
          href={`tel:${pharmacy.tel}`}
          onClick={() => recordClientContact(pharmacy.id)}
          className="min-h-[48px] flex items-center justify-center gap-2 px-3 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 hover:text-emerald-200 border border-slate-700 font-bold text-sm transition-all shadow active:scale-95"
        >
          <Phone className="w-4 h-4 text-emerald-400" />
          <span>Appeler</span>
        </a>

        {/* Bouton "Ma position" : ouvre Google Maps itinéraire */}
        <button
          type="button"
          onClick={() => {
            trackItineraryClick(pharmacy.id);
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${pharmacy.lat},${pharmacy.lng}`);
          }}
          className="min-h-[48px] flex items-center justify-center gap-2 px-3 py-3 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 font-bold text-sm transition-all shadow active:scale-95 text-center cursor-pointer"
          title="Ouvrir l'itinéraire Google Maps vers cette officine"
        >
          <Navigation className="w-4 h-4 text-blue-400" />
          <span>Ma position</span>
        </button>

        {/* Chat Live (actif si is_online, disabled sinon) */}
        {isOnline ? (
          <button
            onClick={() => {
              recordClientContact(pharmacy.id);
              onOpenChat(pharmacy.id);
            }}
            className="min-h-[48px] flex items-center justify-center gap-2 px-3 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-all shadow-lg shadow-emerald-600/30 active:scale-95 cursor-pointer"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Chat Live</span>
          </button>
        ) : (
          <button
            disabled
            className="min-h-[48px] flex items-center justify-center gap-2 px-3 py-3 rounded-xl bg-slate-800/60 text-slate-500 border border-slate-800 font-medium text-xs cursor-not-allowed opacity-60"
            title="Pharmacie hors ligne"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Chat Inactif</span>
          </button>
        )}
      </div>

      {!isOnline && (
        <p className="text-[11px] text-slate-500 text-center mt-2">
          Le chat en direct est accessible dès que la pharmacie active son statut de garde.
        </p>
      )}
    </div>
  );
};
