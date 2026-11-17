import React, { useState, useMemo, useEffect } from 'react';
import { Pharmacie } from '../types';
import { PharmacyMap } from '../components/PharmacyMap';
import { PharmacyCard } from '../components/PharmacyCard';
import { trackItineraryClick, recordClientContact, fetchApprovedPharmacies, fetchDemandesAbonnement, getPharmacyListTier } from '../services/store';
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
  Smartphone,
  Download,
  ExternalLink,
  Share,
  X,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

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
  const [showInstallHelpModal, setShowInstallHelpModal] = useState(false);
  const [fetchedPharmacies, setFetchedPharmacies] = useState<Pharmacie[]>([]);
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  const handleInstallWebApp = async () => {
    if (isInstalled) {
      return;
    }
    if (isInstallable) {
      const outcome = await install();
      if (outcome === 'accepted') {
        return;
      }
    }
    setShowInstallHelpModal(true);
  };

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

  // Itinéraire Google Maps Client -> Pharmacie
  const handleOpenItinerary = (destLat: number, destLng: number) => {
    if (userLocation) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${destLat},${destLng}&travelmode=driving`,
        '_blank'
      );
      return;
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setUserLocation({ lat, lng });
          window.open(
            `https://www.google.com/maps/dir/?api=1&origin=${lat},${lng}&destination=${destLat},${destLng}&travelmode=driving`,
            '_blank'
          );
        },
        () => {
          window.open(
            `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&travelmode=driving`,
            '_blank'
          );
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&travelmode=driving`,
        '_blank'
      );
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

  // Sync pharmacies from view_pharmacies_garde (fallback pharmacies WHERE is_active=true) & abonnements
  useEffect(() => {
    fetchDemandesAbonnement().catch(() => {});
    fetchApprovedPharmacies()
      .then((list) => {
        if (Array.isArray(list)) {
          setFetchedPharmacies(list);
        }
      })
      .catch((err) =>
        console.warn('Map initial fetchApprovedPharmacies fallback:', err)
      );
  }, []);

  // 2 & 3. CARTE (toutes actives filtrées recherche) VS LISTE HIÉRARCHIQUE :
  // Jaunes (PLAN STAR: toujours visibles même si is_garde=false) > Verts (seulement si is_garde=true) > Gris (seulement si is_garde=true)
  const { mapPharmacies, listedPharmacies } = useMemo(() => {
    const sourceList = pharmacies.length > 0 ? pharmacies : fetchedPharmacies;
    const seenIds = new Set<string>();
    const cleanList = sourceList.filter((p) => {
      if (!p || !p.id || seenIds.has(p.id)) return false;
      seenIds.add(p.id);
      return true;
    });

    const q = searchQuery.toLowerCase();
    const withDistance = cleanList
      .filter((p) => {
        const nom = (p.nom || '').toLowerCase();
        const adresse = (p.adresse || '').toLowerCase();
        const quartier = (p.quartier || '').toLowerCase();
        return nom.includes(q) || adresse.includes(q) || quartier.includes(q);
      })
      .map((p) => {
        const dist = userLocation
          ? getDistance(userLocation.lat, userLocation.lng, p.lat, p.lng)
          : undefined;
        return { ...p, distanceKm: dist };
      });

    // Pour la carte Leaflet : conserver l'affichage existant sans modifier les couleurs de marqueurs
    const forMap = withDistance.filter((p) => {
      if (!onlyOnline) return true;
      return Boolean(p.is_garde ?? p.is_online) || getPharmacyListTier(p) === 0;
    });

    // Pour la liste :
    // - PLAN STAR (tier 0) : TOUJOURS VISIBLE même si is_garde=false, toujours en tête
    // - VERT (tier 1) : visible SEULEMENT si is_garde=true, au milieu
    // - GRIS (tier 2) : visible SEULEMENT si is_garde=true, en bas
    const forList = withDistance
      .filter((p) => {
        const tier = getPharmacyListTier(p);
        if (tier === 0) return true;
        return Boolean(p.is_garde ?? p.is_online);
      })
      .sort((a, b) => {
        const tierA = getPharmacyListTier(a);
        const tierB = getPharmacyListTier(b);

        // Hiérarchie stricte : Jaunes (0) > Verts (1) > Gris (2)
        if (tierA !== tierB) return tierA - tierB;

        if (tierA === 0) {
          const posA = a.position !== undefined ? a.position : 999;
          const posB = b.position !== undefined ? b.position : 999;
          if (posA !== posB) return posA - posB;
          if (a.etoile_doree && !b.etoile_doree) return -1;
          if (!a.etoile_doree && b.etoile_doree) return 1;
        }

        if (userLocation && a.distanceKm !== undefined && b.distanceKm !== undefined) {
          return a.distanceKm - b.distanceKm;
        }

        return (a.nom || '').localeCompare(b.nom || '');
      });

    return { mapPharmacies: forMap, listedPharmacies: forList };
  }, [pharmacies, fetchedPharmacies, searchQuery, onlyOnline, userLocation]);

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
            {mapPharmacies.length} pharmacie{mapPharmacies.length > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* 3. CARTE + LISTE EN GRID (Mobile first: h-[60vh] mobile, h-[85vh] desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Map Container: h-[60vh] mobile, h-[85vh] desktop */}
        <div className="lg:col-span-7 xl:col-span-8 relative h-[60vh] md:h-[85vh] w-full rounded-2xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-900">
          <PharmacyMap
            pharmacies={mapPharmacies}
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
                  ? `📍 ${listedPharmacies.length} pharmacies autour de vous`
                  : `📍 ${listedPharmacies.length} officines de Lomé`}
              </span>
            </h2>

            <button
              onClick={() => {
                fetchApprovedPharmacies()
                  .then((list) => {
                    if (Array.isArray(list)) setFetchedPharmacies(list);
                  })
                  .catch(() => {});
                onRefresh();
              }}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
              title="Rafraîchir"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3 max-h-[60vh] lg:max-h-[80vh] overflow-y-auto pr-1">
            {listedPharmacies.map((p, index) => {
              const isSelected = selectedPharmacy?.id === p.id;
              const tier = getPharmacyListTier(p);
              const isPlanStar = tier === 0;
              const isVertPaid = tier === 1;
              const isClosest = userLocation && index === 0;

              // Format textuel : "Pharmacie Dékon - À 800m de vous"
              const distanceText =
                p.distanceKm !== undefined ? ` - ${formatDistanceUser(p.distanceKm)}` : '';

              const cardStyleClass = isPlanStar
                ? isSelected
                  ? 'bg-gradient-to-r from-yellow-500/30 via-amber-500/20 to-slate-900 border-2 border-yellow-300 ring-2 ring-yellow-400/50 shadow-yellow-500/20'
                  : 'bg-gradient-to-r from-yellow-500/20 via-amber-500/15 to-slate-900 border-2 border-yellow-400/80 hover:border-yellow-300 shadow-yellow-500/10'
                : isVertPaid
                ? isSelected
                  ? 'bg-gradient-to-r from-emerald-950/70 via-emerald-900/30 to-slate-900 border-2 border-emerald-400 ring-2 ring-emerald-500/40'
                  : 'bg-gradient-to-r from-emerald-950/50 via-emerald-900/20 to-slate-900 border border-emerald-500/60 hover:border-emerald-400'
                : isSelected
                ? 'bg-slate-800 border-2 border-slate-400 ring-2 ring-slate-500/40'
                : 'bg-slate-900/90 border border-slate-700/80 hover:border-slate-600';

              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedPharmacy(p)}
                  className={`w-full p-4 rounded-2xl transition-all cursor-pointer space-y-3 shadow-lg relative ${cardStyleClass}`}
                >
                  {/* Badges hiérarchiques */}
                  {(isPlanStar || isClosest) && (
                    <div className="flex flex-wrap items-center gap-2">
                      {isPlanStar && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-gradient-to-r from-yellow-400 to-amber-400 text-slate-950 shadow-md">
                          <Star className="w-3.5 h-3.5 fill-slate-950 text-slate-950" />
                          <span>PLAN STAR</span>
                        </span>
                      )}
                      {isClosest && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-500 text-slate-950 shadow-md">
                          <Sparkles className="w-3.5 h-3.5 fill-slate-950" />
                          <span>LA PLUS PROCHE ⭐</span>
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-2">
                    <div className="font-extrabold text-white text-base leading-snug">
                      <div className="flex items-center gap-1.5">
                        {isPlanStar && (
                          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400 shrink-0" />
                        )}
                        <span className={isPlanStar ? 'text-yellow-100' : ''}>{p.nom}</span>
                      </div>
                      {/* Affichage distance sous le nom */}
                      {distanceText && (
                        <div className="text-xs font-bold text-emerald-400 mt-0.5">
                          {distanceText.replace(' - ', '')}
                        </div>
                      )}
                    </div>

                    {(() => {
                      const isGarde = Boolean(p.is_garde ?? p.is_online);
                      const isActive = p.is_active !== false;
                      return (
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${
                            isGarde
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : isActive
                              ? 'bg-blue-500/15 text-blue-300 border border-blue-500/40'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isGarde
                                ? 'bg-emerald-400 animate-pulse'
                                : isActive
                                ? 'bg-blue-400'
                                : 'bg-slate-500'
                            }`}
                          />
                          {isGarde ? 'DE GARDE' : isActive ? 'OUVERTE' : 'FERMÉE'}
                        </span>
                      );
                    })()}
                  </div>

                  <div className="text-xs text-slate-300 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{p.adresse}</span>
                  </div>

                  {/* Actions faciles au pouce : Appeler, Itinéraire, Chatter */}
                  {(() => {
                    const canChat = Boolean(
                      (p.is_garde ?? p.is_online) && p.is_active !== false
                    );
                    return (
                      <div
                        className={`grid ${
                          canChat ? 'grid-cols-3' : 'grid-cols-2'
                        } gap-2 pt-2 border-t border-slate-800`}
                      >
                        <a
                          href={`tel:${p.tel}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            recordClientContact(p.id);
                          }}
                          className="min-h-[46px] flex items-center justify-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold text-xs border border-slate-700 transition-colors"
                          title="Appeler l'officine"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>Appeler</span>
                        </a>

                        {/* 5. Bouton "Itinéraire" ouvre Google Maps Navigation */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            trackItineraryClick(p.id);
                            handleOpenItinerary(p.lat, p.lng);
                          }}
                          className="min-h-[46px] flex items-center justify-center gap-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 font-bold text-xs border border-blue-500/40 transition-colors cursor-pointer"
                          title="Ouvrir l'itinéraire Google Maps"
                        >
                          <Navigation className="w-3.5 h-3.5 text-blue-400" />
                          <span>Itinéraire</span>
                        </button>

                        {canChat && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              recordClientContact(p.id);
                              onOpenChat(p.id);
                            }}
                            className="min-h-[46px] flex items-center justify-center gap-1.5 rounded-xl font-bold text-xs transition-all bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30 cursor-pointer"
                            title="Discuter en direct"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Chatter</span>
                          </button>
                        )}
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>

        </div>
      </div>

      {/* 4. SECTION TÉLÉCHARGER L'APPLICATION EFA GARDE */}
      <section className="bg-slate-900/95 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-[#0b5cb5]/20 border border-[#0b5cb5]/40 flex items-center justify-center shrink-0">
                <Smartphone className="w-5 h-5 text-blue-400" />
              </div>
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                Télécharger l&apos;application EFA Garde
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Accédez plus rapidement aux pharmacies de garde à Lomé depuis votre téléphone ou ordinateur.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
            <a
              href="https://play.google.com/store/apps/details?id=com.efa.technologie.garde"
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[46px] px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <ExternalLink className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Télécharger sur Google Play</span>
            </a>

            <button
              type="button"
              onClick={handleInstallWebApp}
              disabled={isInstalled}
              className={`min-h-[46px] px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
                isInstalled
                  ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 cursor-default'
                  : 'bg-[#0b5cb5] hover:bg-[#094b96] text-white shadow-md shadow-blue-900/40 cursor-pointer active:scale-95'
              }`}
            >
              {isInstalled ? (
                <>
                  <Check className="w-4 h-4 shrink-0" />
                  <span>Application Web installée</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 shrink-0" />
                  <span>Installer l&apos;application Web</span>
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {showInstallHelpModal && (
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setShowInstallHelpModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-5 shadow-2xl text-slate-100 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-base font-extrabold text-white">
                Installer l&apos;application Web EFA Garde
              </h3>
              <button
                type="button"
                onClick={() => setShowInstallHelpModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <div className="space-y-2.5 text-sm text-slate-300 leading-relaxed">
                <p className="flex items-start gap-2">
                  <span className="font-bold text-blue-400 shrink-0">1.</span>
                  <span>
                    Appuyez sur{' '}
                    <span className="inline-flex items-center gap-1 font-semibold text-white">
                      Partager <Share className="w-3.5 h-3.5 text-blue-400" />
                    </span>{' '}
                    dans la barre Safari.
                  </span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="font-bold text-blue-400 shrink-0">2.</span>
                  <span>
                    Sélectionnez <strong className="text-white">Sur l&apos;écran d&apos;accueil</strong> puis confirmez.
                  </span>
                </p>
              </div>
            ) : (
              <div className="space-y-2 text-sm text-slate-300 leading-relaxed">
                <p>
                  Ouvrez le menu de votre navigateur (Chrome / Edge / Samsung Internet) et appuyez sur{' '}
                  <strong className="text-white">Installer l&apos;application</strong> ou{' '}
                  <strong className="text-white">Ajouter à l&apos;écran d&apos;accueil</strong>.
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowInstallHelpModal(false)}
              className="w-full py-2.5 rounded-xl bg-[#0b5cb5] hover:bg-[#094b96] text-white text-sm font-bold transition-colors cursor-pointer"
            >
              Compris
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Map;
