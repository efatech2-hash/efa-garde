import React, { useState, useMemo } from 'react';
import { Pharmacie } from '../types';
import { PharmacyMap } from '../components/PharmacyMap';
import { PharmacyCard } from '../components/PharmacyCard';
import { trackItineraryClick } from '../services/store';
import {
  get3ClosestPharmacies,
  getDistance,
  formatDistanceUser,
  getGoogleMapsNavigationUrl,
} from '../utils/geo';
import {
  Search,
  Star,
  Phone,
  Navigation,
  MessageSquare,
  Filter,
  MapPin,
  RefreshCw,
  Share2,
  Check,
  Target,
  Sparkles,
} from 'lucide-react';

interface MapProps {
  pharmacies: Pharmacie[];
  onOpenChat: (pharmacieId: string) => void;
  onRefresh: () => void;
}

export const Map: React.FC<MapProps> = ({
  pharmacies,
  onOpenChat,
  onRefresh,
}) => {
  const [selectedPharmacy, setSelectedPharmacy] = useState<Pharmacie | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyOnline, setOnlyOnline] = useState(false);
  const [shareFeedback, setShareFeedback] = useState(false);

  // Share handler
  const handleShare = async () => {
    const shareData = {
      title: 'EFA GARDE',
      text: '💙 Trouve les pharmacies de garde ouvertes à Lomé en direct sur EFA GARDE :',
      url: window.location.origin,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // User cancelled or share failed
      }
    } else {
      try {
        await navigator.clipboard.writeText(window.location.origin);
        setShareFeedback(true);
        setTimeout(() => setShareFeedback(false), 2500);
      } catch {
        // fallback
      }
    }
  };

  // 1. GPS "Me localiser" / "Où suis-je"
  const handleLocateUser = () => {
    setLocationLoading(true);
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationError("La géolocalisation n'est pas supportée par votre navigateur.");
      setLocationLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setLocationLoading(false);
        setLocationError(null);
      },
      (err) => {
        console.warn('Geolocation error:', err);
        setLocationLoading(false);
        // Si permission refusée : Affiche "Activez votre localisation pour voir la distance"
        setLocationError('Activez votre localisation pour voir la distance');
        setTimeout(() => setLocationError(null), 6000);
      },
      { timeout: 10000, enableHighAccuracy: true, maximumAge: 10000 }
    );
  };

  // 2 & 3. CALCUL DE DISTANCE & TRI AUTOMATIQUE PAR DISTANCE CROISSANTE
  const displayedPharmacies = useMemo(() => {
    // Déduplication stricte par ID pour éviter toute clé React en double
    const seenIds = new Set<string>();
    const cleanList = pharmacies.filter((p) => {
      if (!p || !p.id || seenIds.has(p.id)) return false;
      seenIds.add(p.id);
      return true;
    });

    return cleanList
      .filter((p) => {
        const matchSearch =
          p.nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.adresse.toLowerCase().includes(searchQuery.toLowerCase());
        const matchOnline = onlyOnline ? p.is_online : true;
        return matchSearch && matchOnline;
      })
      .map((p) => {
        const dist = userLocation
          ? getDistance(userLocation.lat, userLocation.lng, p.lat, p.lng)
          : undefined;
        return { ...p, distanceKm: dist };
      })
      .sort((a, b) => {
        // Quand localisation active : trier par distance croissante absolue
        if (userLocation && a.distanceKm !== undefined && b.distanceKm !== undefined) {
          return a.distanceKm - b.distanceKm;
        }

        // Sinon tri standard : plan top en premier, puis en ligne, puis nom
        if (a.plan === 'top' && b.plan !== 'top') return -1;
        if (b.plan === 'top' && a.plan !== 'top') return 1;

        if (a.is_online && !b.is_online) return -1;
        if (!a.is_online && b.is_online) return 1;

        return a.nom.localeCompare(b.nom);
      });
  }, [pharmacies, searchQuery, onlyOnline, userLocation]);

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-3 space-y-3 pb-28">
      {/* 1. BANNIÈRE ACCÈS LIBRE (AUCUN LOGIN OBLIGATOIRE) */}
      <div className="w-full bg-sky-100 text-sky-950 border border-sky-300 rounded-2xl p-4 sm:p-4 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xl shrink-0">📍</span>
            <h1 className="text-base sm:text-lg font-black text-[#0b5cb5]">
              Trouvez la pharmacie la plus proche - Accès libre
            </h1>
          </div>
          <p className="text-xs sm:text-sm font-semibold text-slate-700 leading-snug">
            💙 Service public de garde 24h/24 à Lomé sans inscription. Partagez l'application avec vos amis pour les aider à trouver les pharmacies de garde et sauver des vies.
          </p>
        </div>

        <button
          onClick={handleShare}
          className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 px-5 py-3 min-h-[48px] rounded-xl bg-[#0b5cb5] hover:bg-[#094b96] text-white font-bold text-base shadow-md transition-all active:scale-95 cursor-pointer"
        >
          {shareFeedback ? <Check className="w-5 h-5 text-white" /> : <Share2 className="w-5 h-5 text-white" />}
          <span>{shareFeedback ? 'Lien copié !' : 'Partager'}</span>
        </button>
      </div>

      {/* 2. STICKY TOP SEARCH BAR + GPS BOUTON (MOBILE FIRST) */}
      <div className="sticky top-16 z-30 bg-slate-900/95 backdrop-blur-md p-3 rounded-2xl border border-slate-800 shadow-xl space-y-2">
        <div className="flex flex-col sm:flex-row items-stretch gap-2">
          {/* Input: h-14, text-base, rounded-xl */}
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-slate-400 absolute left-4 top-4.5" />
            <input
              type="text"
              placeholder="Rechercher pharmacie ou quartier à Lomé..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-14 bg-slate-800 text-base text-white pl-12 pr-10 rounded-xl border border-slate-700 focus:outline-none focus:border-[#0b5cb5] placeholder:text-slate-500 shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-4.5 text-sm text-slate-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>

          {/* Bouton GPS "Me localiser" (min-height 48px, gros au pouce) */}
          <button
            onClick={handleLocateUser}
            disabled={locationLoading}
            className={`h-14 min-h-[48px] px-6 rounded-xl font-extrabold text-base shadow-lg flex items-center justify-center gap-2.5 transition-all active:scale-95 cursor-pointer disabled:opacity-60 ${
              userLocation
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-500/25 ring-2 ring-emerald-400/30'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/25'
            }`}
          >
            <span className="text-xl">🎯</span>
            <span>
              {locationLoading
                ? 'Localisation GPS...'
                : userLocation
                ? 'Position active'
                : 'Me localiser (GPS)'}
            </span>
          </button>
        </div>

        {/* Message d'erreur de permission si refusée */}
        {locationError && (
          <div className="p-3 bg-amber-950/70 border border-amber-500/60 rounded-xl text-amber-200 text-xs sm:text-sm font-semibold flex items-center gap-2 animate-in fade-in">
            <span className="text-base">⚠️</span>
            <span>{locationError}</span>
          </div>
        )}

        {/* Filter bar */}
        <div className="flex items-center justify-between text-xs sm:text-sm px-1">
          <button
            onClick={() => setOnlyOnline(!onlyOnline)}
            className={`flex items-center gap-2 px-3.5 py-2 min-h-[40px] rounded-xl border transition-all ${
              onlyOnline
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-bold'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span>Ouvertes de garde uniquement</span>
          </button>

          <span className="text-slate-400 text-xs">
            {displayedPharmacies.length} pharmacie{displayedPharmacies.length > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* 3. CARTE + LISTE EN GRID (Mobile first: h-[60vh] mobile, h-[85vh] desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Map Container: h-[60vh] mobile, h-[85vh] desktop */}
        <div className="lg:col-span-7 xl:col-span-8 relative h-[60vh] md:h-[85vh] w-full rounded-2xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-900">
          <PharmacyMap
            pharmacies={displayedPharmacies}
            selectedPharmacy={selectedPharmacy}
            onSelectPharmacy={(pharma) => setSelectedPharmacy(pharma)}
            userPosition={userLocation}
            onLocateUser={handleLocateUser}
            isLocating={locationLoading}
            locationError={locationError}
          />

          {/* Active Pharmacy Detail Card overlay on mobile/desktop */}
          {selectedPharmacy && (
            <div className="absolute bottom-4 left-3 right-3 z-[500] flex justify-center pointer-events-auto">
              <PharmacyCard
                pharmacy={selectedPharmacy}
                onClose={() => setSelectedPharmacy(null)}
                onOpenChat={onOpenChat}
                distanceKm={selectedPharmacy.distanceKm}
                userLocation={userLocation}
              />
            </div>
          )}
        </div>

        {/* 4. LISTE PHARMACIES: Cards liste 1 col mobile, 2-3 cols desktop */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col space-y-3">
          {/* Header 5: "📍 X pharmacies autour de vous" quand localisé */}
          <div className="flex items-center justify-between px-1">
            <h2 className="text-base font-black text-white flex items-center gap-1.5">
              <span>
                {userLocation
                  ? `📍 ${displayedPharmacies.length} pharmacies autour de vous`
                  : `📍 ${displayedPharmacies.length} officines de Lomé`}
              </span>
            </h2>

            <button
              onClick={onRefresh}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
              title="Rafraîchir"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3 max-h-[60vh] lg:max-h-[80vh] overflow-y-auto pr-1">
            {displayedPharmacies.map((p, index) => {
              const isSelected = selectedPharmacy?.id === p.id;
              const isTop = p.plan === 'top';
              const isClosest = userLocation && index === 0;

              // Format textuel : "Pharmacie Dékon - À 800m de vous"
              const distanceText =
                p.distanceKm !== undefined ? ` - ${formatDistanceUser(p.distanceKm)}` : '';

              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedPharmacy(p)}
                  className={`w-full p-4 rounded-2xl border transition-all cursor-pointer space-y-3 shadow-lg relative ${
                    isClosest
                      ? 'bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border-emerald-500/80 ring-2 ring-emerald-500/30'
                      : isSelected
                      ? 'bg-slate-800 border-blue-500 ring-2 ring-blue-500/40'
                      : isTop
                      ? 'bg-gradient-to-r from-amber-950/25 to-slate-900 border-amber-500/40 hover:border-amber-400'
                      : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Badge vert "LA PLUS PROCHE ⭐" sur la première quand géolocalisé */}
                  {isClosest && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-500 text-slate-950 shadow-md">
                      <Sparkles className="w-3.5 h-3.5 fill-slate-950" />
                      <span>LA PLUS PROCHE ⭐</span>
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-2">
                    <div className="font-extrabold text-white text-base leading-snug">
                      <div className="flex items-center gap-1.5">
                        {isTop && (
                          <Star className="w-4 h-4 fill-amber-400 text-amber-400 shrink-0" />
                        )}
                        <span>{p.nom}</span>
                      </div>
                      {/* Affichage distance sous le nom */}
                      {distanceText && (
                        <div className="text-xs font-bold text-emerald-400 mt-0.5">
                          {distanceText.replace(' - ', '')}
                        </div>
                      )}
                    </div>

                    {p.is_pending ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                        EN COURS DE VÉRIFICATION
                      </span>
                    ) : (
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${
                          p.is_online
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            p.is_online ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                          }`}
                        />
                        {p.is_online ? 'EN LIGNE' : 'FERMÉE'}
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-slate-300 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{p.adresse}</span>
                  </div>

                  {/* Actions faciles au pouce : Appeler, Itinéraire, Chatter */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800">
                    <a
                      href={`tel:${p.tel}`}
                      onClick={(e) => e.stopPropagation()}
                      className="min-h-[46px] flex items-center justify-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold text-xs border border-slate-700 transition-colors"
                      title="Appeler l'officine"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Appeler</span>
                    </a>

                    {/* 5. Bouton "Ma position" ouvre Google Maps Navigation */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        trackItineraryClick(p.id);
                        window.open(`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`);
                      }}
                      className="min-h-[46px] flex items-center justify-center gap-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 font-bold text-xs border border-blue-500/40 transition-colors cursor-pointer"
                      title="Ouvrir l'itinéraire Google Maps"
                    >
                      <Navigation className="w-3.5 h-3.5 text-blue-400" />
                      <span>Ma position</span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (p.is_online) onOpenChat(p.id);
                      }}
                      disabled={!p.is_online || p.is_pending}
                      className={`min-h-[46px] flex items-center justify-center gap-1.5 rounded-xl font-bold text-xs transition-all ${
                        p.is_online && !p.is_pending
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30'
                          : 'bg-slate-800/60 text-slate-500 border border-slate-800 cursor-not-allowed opacity-60'
                      }`}
                      title={p.is_pending ? 'En attente de vérification' : p.is_online ? 'Discuter en direct' : 'Pharmacie hors ligne'}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>{p.is_pending ? 'Vérif...' : p.is_online ? 'Chatter' : 'Inactif'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
};

export default Map;
