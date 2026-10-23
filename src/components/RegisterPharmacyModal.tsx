import React, { useState } from 'react';
import { Pharmacie } from '../types';
import { registerNewPharmacy } from '../services/store';
import { LOME_CENTER } from '../utils/geo';
import {
  X,
  MapPin,
  Building,
  Phone,
  Clock,
  Navigation,
  CheckCircle2,
  AlertCircle,
  Moon,
  Sun,
  Loader2,
  PlusCircle,
} from 'lucide-react';

interface RegisterPharmacyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newPharma: Pharmacie) => void;
  userPosition?: { lat: number; lng: number } | null;
}

export const RegisterPharmacyModal: React.FC<RegisterPharmacyModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  userPosition,
}) => {
  const [nom, setNom] = useState('');
  const [quartier, setQuartier] = useState('');
  const [adresse, setAdresse] = useState('');
  const [lat, setLat] = useState(userPosition ? userPosition.lat : LOME_CENTER.lat);
  const [lng, setLng] = useState(userPosition ? userPosition.lng : LOME_CENTER.lng);
  const [tel, setTel] = useState('');
  const [garde, setGarde] = useState<boolean>(true); // Garde (oui/non)
  const [horaires, setHoraires] = useState('24h/24');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsFeedback, setGpsFeedback] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDetectGps = () => {
    if (!navigator.geolocation) {
      setGpsFeedback('Géolocalisation non prise en charge par votre navigateur.');
      return;
    }

    setGpsLoading(true);
    setGpsFeedback(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const detectedLat = Number(pos.coords.latitude.toFixed(6));
        const detectedLng = Number(pos.coords.longitude.toFixed(6));
        setLat(detectedLat);
        setLng(detectedLng);
        setGpsLoading(false);
        setGpsFeedback('Position récupérée');
      },
      (err) => {
        console.warn('GPS error in register form:', err);
        setGpsLoading(false);
        setGpsFeedback('Position GPS non accessible. Coordonnées de Lomé appliquées.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!nom.trim()) {
      setErrorMsg("Veuillez renseigner le nom de l'officine.");
      return;
    }
    if (!quartier.trim()) {
      setErrorMsg("Veuillez renseigner le quartier.");
      return;
    }
    if (!adresse.trim()) {
      setErrorMsg("Veuillez renseigner l'adresse de l'officine.");
      return;
    }
    if (!tel.trim()) {
      setErrorMsg('Veuillez renseigner le numéro de téléphone.');
      return;
    }

    setIsSubmitting(true);

    try {
      const createdPharma = await registerNewPharmacy({
        nom: nom.trim(),
        adresse: adresse.trim(),
        lat: Number(lat) || LOME_CENTER.lat,
        lng: Number(lng) || LOME_CENTER.lng,
        tel: tel.trim(),
        is_online: garde,
        horaires: horaires.trim() || '24h/24',
        quartier: quartier.trim() || 'Lomé',
        titulaire: 'Pharmacien Titulaire',
      });

      setIsSubmitting(false);
      onSuccess(createdPharma);
      onClose();
    } catch (err: unknown) {
      console.error('Erreur enregistrement pharmacie:', err);
      setIsSubmitting(false);
      setErrorMsg("Une erreur s'est produite lors de l'enregistrement de l'officine.");
    }
  };

  return (
    <div className="fixed inset-0 z-[1500] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-lg w-full p-5 sm:p-7 shadow-2xl relative my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          type="button"
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="mb-5 space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span>Nouvelle Officine</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            ➕ Enregistrer ma pharmacie
          </h2>
          <p className="text-xs text-slate-400">
            Renseignez les coordonnées de votre officine pour la référencer sur le réseau officiel EFA GARDE Lomé.
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-950/70 border border-red-500/50 rounded-xl text-red-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* 1. Nom Officine */}
          <div className="space-y-1.5">
            <label className="block text-slate-300 font-bold">
              Nom de l'officine <span className="text-emerald-400">*</span>
            </label>
            <div className="relative">
              <Building className="w-4 h-4 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
              <input
                type="text"
                required
                placeholder="Ex: Pharmacie du Golfe Lomé"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                className="w-full bg-slate-800 text-white pl-9 pr-3 py-3 rounded-xl border border-slate-700 text-xs focus:outline-none focus:border-emerald-500 shadow-inner"
              />
            </div>
          </div>

          {/* 2. Quartier & Adresse */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-slate-300 font-bold">
                Quartier <span className="text-emerald-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Tokoin, Bè, Adidogomé..."
                value={quartier}
                onChange={(e) => setQuartier(e.target.value)}
                className="w-full bg-slate-800 text-white px-3 py-3 rounded-xl border border-slate-700 text-xs focus:outline-none focus:border-emerald-500 shadow-inner"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-slate-300 font-bold">
                Adresse géographique <span className="text-emerald-400">*</span>
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
                <input
                  type="text"
                  required
                  placeholder="Ex: Boulevard du 13 Janvier, Lomé"
                  value={adresse}
                  onChange={(e) => setAdresse(e.target.value)}
                  className="w-full bg-slate-800 text-white pl-9 pr-3 py-3 rounded-xl border border-slate-700 text-xs focus:outline-none focus:border-emerald-500 shadow-inner"
                />
              </div>
            </div>
          </div>

          {/* 3. GPS (Bouton Ma position) */}
          <div className="space-y-2 bg-slate-800/60 border border-slate-700/60 rounded-2xl p-3.5">
            <div className="flex items-center justify-between">
              <label className="block text-slate-300 font-bold">
                Coordonnées GPS (Position sur la carte)
              </label>
              <button
                type="button"
                onClick={handleDetectGps}
                disabled={gpsLoading}
                className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 disabled:opacity-50 text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
              >
                {gpsLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Détection...</span>
                  </>
                ) : (
                  <>
                    <MapPin className="w-3.5 h-3.5 text-blue-400" />
                    <span>📍 Ma position</span>
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-slate-400 block mb-1">Latitude :</span>
                <input
                  type="number"
                  step="any"
                  value={lat}
                  onChange={(e) => setLat(parseFloat(e.target.value))}
                  className="w-full bg-slate-900 text-white px-2.5 py-2 rounded-lg border border-slate-700 text-xs font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block mb-1">Longitude :</span>
                <input
                  type="number"
                  step="any"
                  value={lng}
                  onChange={(e) => setLng(parseFloat(e.target.value))}
                  className="w-full bg-slate-900 text-white px-2.5 py-2 rounded-lg border border-slate-700 text-xs font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {gpsFeedback && (
              <div className="text-[11px] text-emerald-300 font-medium flex items-center gap-1 mt-1">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                <span>{gpsFeedback}</span>
              </div>
            )}
          </div>

          {/* 4. Téléphone direct de garde */}
          <div className="space-y-1.5">
            <label className="block text-slate-300 font-bold">
              Numéro de téléphone de garde <span className="text-emerald-400">*</span>
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
              <input
                type="tel"
                required
                placeholder="Ex: +228 90 12 34 56"
                value={tel}
                onChange={(e) => setTel(e.target.value)}
                className="w-full bg-slate-800 text-white pl-9 pr-3 py-3 rounded-xl border border-slate-700 text-xs focus:outline-none focus:border-emerald-500 shadow-inner"
              />
            </div>
          </div>

          {/* 5. Garde (oui/non) */}
          <div className="space-y-1.5">
            <label className="block text-slate-300 font-bold">
              Statut de garde actuel <span className="text-emerald-400">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setGarde(true)}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  garde
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-inner'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                <Moon className={`w-4 h-4 ${garde ? 'text-emerald-400' : 'text-slate-500'}`} />
                <span>Oui (De garde)</span>
              </button>

              <button
                type="button"
                onClick={() => setGarde(false)}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  !garde
                    ? 'bg-slate-700/60 border-slate-500 text-white shadow-inner'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                <Sun className={`w-4 h-4 ${!garde ? 'text-amber-400' : 'text-slate-500'}`} />
                <span>Non (Hors garde)</span>
              </button>
            </div>
          </div>

          {/* 6. Horaires */}
          <div className="space-y-1.5">
            <label className="block text-slate-300 font-bold">
              Horaires d'ouverture <span className="text-emerald-400">*</span>
            </label>
            <div className="relative">
              <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
              <input
                type="text"
                required
                placeholder="Ex: 24h/24 ou 08h00 - 22h00"
                value={horaires}
                onChange={(e) => setHoraires(e.target.value)}
                className="w-full bg-slate-800 text-white pl-9 pr-3 py-3 rounded-xl border border-slate-700 text-xs focus:outline-none focus:border-emerald-500 shadow-inner"
              />
            </div>
            <div className="flex gap-2 pt-1">
              {['24h/24', '07h30 - 21h30', '08h00 - 20h00'].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setHoraires(preset)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold text-sm shadow-lg shadow-emerald-600/30 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Enregistrement en cours...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Enregistrer mon officine</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
