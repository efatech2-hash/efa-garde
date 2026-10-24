import React, { useState, useEffect } from 'react';
import { addPendingPharmacy } from '../services/store';
import { LOME_CENTER } from '../utils/geo';
import { Logo } from '../components/Logo';
import {
  getRegistrationPaymentToken,
  consumeRegistrationPaymentToken,
  RegistrationPaymentToken,
} from '../lib/paymentTokens';
import {
  ShieldCheck,
  Building,
  User,
  Phone,
  Mail,
  Lock,
  Upload,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  FileText,
  CreditCard,
  Hash,
  MessageCircle,
} from 'lucide-react';

interface PharmacienRegisterPageProps {
  onSuccess: () => void;
  onNavigateToLogin: () => void;
  onNavigateToPayment: () => void;
  onBackToMap: () => void;
}

export const PharmacienRegisterPage: React.FC<PharmacienRegisterPageProps> = ({
  onSuccess,
  onNavigateToLogin,
  onNavigateToPayment,
  onBackToMap,
}) => {
  // 1. VÉRIFICATION DU TOKEN DE PAIEMENT 25.000 FCFA
  const [paymentToken, setPaymentToken] = useState<RegistrationPaymentToken | null>(
    () => getRegistrationPaymentToken()
  );

  const [nom, setNom] = useState('');
  const [emailPro, setEmailPro] = useState('');

  const rawWhatsapp = (
    import.meta.env.VITE_WHATSAPP_NUMBER ||
    process.env.WHATSAPP_NUMBER ||
    '22896100972'
  ).replace(/[^0-9]/g, '');
  const [nomPharmacie, setNomPharmacie] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [ifu, setIfu] = useState('');

  const whatsappUrl = `https://wa.me/${rawWhatsapp}?text=${encodeURIComponent(
    `Bonjour EFA TECH, je souhaite payer les 25.000F pour enregistrer ma pharmacie ${(nomPharmacie || nom).trim() || ''}. Email: ${emailPro.trim() || ''}`
  )}`;
  const [numeroOrdre, setNumeroOrdre] = useState('');
  const [titulaire, setTitulaire] = useState('');
  const [phone, setPhone] = useState('');
  const [quartier, setQuartier] = useState('');
  const [adresse, setAdresse] = useState('');
  const [lat, setLat] = useState<number | string>(LOME_CENTER.lat);
  const [lng, setLng] = useState<number | string>(LOME_CENTER.lng);
  const [gpsToast, setGpsToast] = useState<string | null>(null);
  const [piecePreview, setPiecePreview] = useState<string | null>(null);
  const [devanturePreview, setDevanturePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Re-vérifier le token au montage
  useEffect(() => {
    const t = getRegistrationPaymentToken();
    setPaymentToken(t);
  }, []);

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setter(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // 10. Bouton "📍 Ma position" : récupère coords et remplit les 2 inputs + toast
  const handleUseGps = () => {
    if (!navigator.geolocation) {
      setGpsToast("Géolocalisation non supportée");
      setTimeout(() => setGpsToast(null), 3000);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const detectedLat = Number(pos.coords.latitude.toFixed(6));
        const detectedLng = Number(pos.coords.longitude.toFixed(6));
        setLat(detectedLat);
        setLng(detectedLng);
        setGpsToast('Position récupérée');
        setTimeout(() => setGpsToast(null), 3000);
      },
      (err) => {
        console.warn('GPS error in register form:', err);
        setGpsToast("Impossible de récupérer la position GPS");
        setTimeout(() => setGpsToast(null), 3000);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Sécurité stricte : vérifier la présence du token de paiement 25k
    const currentToken = getRegistrationPaymentToken();
    if (!currentToken) {
      setErrorMsg("Veuillez d'abord payer les 25.000 FCFA pour débloquer l'enregistrement.");
      return;
    }

    if (!numeroOrdre.trim()) {
      setErrorMsg("Le Numéro de l'Ordre National des Pharmaciens du Togo (ONPT) est obligatoire.");
      return;
    }

    if (!ifu.trim()) {
      setErrorMsg("Le Numéro IFU (Identifiant Fiscal Unique Togo) est requis pour l'enregistrement officiel.");
      return;
    }

    if (motDePasse.length < 6) {
      setErrorMsg('Le mot de passe doit comporter au moins 6 caractères.');
      return;
    }

    if (!quartier.trim()) {
      setErrorMsg('Le champ Quartier est obligatoire.');
      return;
    }

    if (lat === '' || lng === '' || isNaN(Number(lat)) || isNaN(Number(lng))) {
      setErrorMsg('Les coordonnées Latitude et Longitude sont obligatoires.');
      return;
    }

    setIsSubmitting(true);

    try {
      await addPendingPharmacy({
        nom: nomPharmacie.trim(),
        quartier,
        adresse: adresse.trim(),
        phone: phone.trim(),
        titulaire: titulaire.trim(),
        numero_ordre: numeroOrdre.trim().toUpperCase(),
        piece_url: piecePreview || undefined,
        photo_url: devanturePreview || undefined,
        email_pro: emailPro.trim().toLowerCase(),
        mot_de_passe: motDePasse,
        lat: Number(lat),
        lng: Number(lng),
      });

      // SÉCURITÉ : Supprimer le token de paiement après utilisation réussie
      consumeRegistrationPaymentToken();
      setPaymentToken(null);

      setSubmitted(true);
      onSuccess();
    } catch (err) {
      console.error(err);
      setErrorMsg("Une erreur s'est produite lors de l'enregistrement de votre demande.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 py-8 px-4 sm:px-6 flex flex-col justify-center items-center font-sans antialiased text-slate-100 relative">
      {/* Toast Notification : "Position récupérée" */}
      {gpsToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[2000] bg-emerald-600 text-white px-5 py-2.5 rounded-2xl shadow-2xl text-xs sm:text-sm font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-3 border border-emerald-400/40">
          <CheckCircle2 className="w-4 h-4 text-emerald-200" />
          <span>{gpsToast}</span>
        </div>
      )}

      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 animate-in fade-in duration-200">
        {/* Navigation retour */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <button
            onClick={onBackToMap}
            className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Retour à la carte</span>
          </button>

          <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
            Enregistrement Officiel
          </span>
        </div>

        {/* Brand header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-white p-1.5 mx-auto flex items-center justify-center shadow-md">
            <Logo className="w-full h-full" variant="blue" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Formulaire Enregistrement Pharmacie
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Agrément et référencement officiel des officines de Lomé (Togo)
          </p>
        </div>

        {/* SI PAS DE TOKEN DE PAIEMENT 25K : BLOQUER & TOAST */}
        {!paymentToken && !submitted ? (
          <div className="py-6 space-y-5 text-center animate-in zoom-in-95 duration-200">
            {/* Toast demandé : "Veuillez d'abord payer les 25.000 FCFA" */}
            <div className="p-4 rounded-2xl bg-amber-500/15 border-2 border-amber-500/40 text-amber-200 text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-amber-900/20">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
              <span>Veuillez d'abord payer les 25.000 FCFA</span>
            </div>

            <div className="p-5 rounded-2xl bg-slate-800/40 border border-slate-800 text-xs text-slate-300 space-y-2 text-left leading-relaxed">
              <p className="font-bold text-white text-sm">
                Vérification Obligatoire
              </p>
              <p>
                Pour garantir la sécurité des patients de Lomé et lutter contre les fausses officines, l'enregistrement nécessite le règlement préalable de <strong>25.000 FCFA</strong> via T-Money ou Moov Money.
              </p>
              <p className="text-slate-400 text-[11px]">
                Une fois le paiement effectué, le formulaire officiel sera instantanément débloqué.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              {/* GROS BOUTON FIXE "Payer 25.000F via WhatsApp" */}
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full min-h-[56px] py-4 px-6 rounded-2xl bg-[#25D366] hover:bg-[#20ba59] active:bg-[#1da850] text-slate-950 font-black text-sm sm:text-base shadow-2xl shadow-[#25D366]/40 transition-all flex items-center justify-center gap-2.5 cursor-pointer text-center active:scale-98 border-2 border-emerald-300"
              >
                <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6 fill-slate-950 text-slate-950 shrink-0" />
                <span>Payer 25.000F via WhatsApp</span>
              </a>

              <button
                onClick={onNavigateToPayment}
                className="w-full min-h-[50px] py-3.5 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm shadow-xl shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <CreditCard className="w-5 h-5" />
                <span>Payer les 25.000 FCFA par T-Money / Moov Money</span>
              </button>

              <button
                onClick={onNavigateToLogin}
                className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Déjà enregistré ? Se connecter à mon compte →
              </button>
            </div>
          </div>
        ) : submitted ? (
          <div className="text-center py-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/40">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <h2 className="text-2xl font-black text-white">Demande enregistrée !</h2>

            {/* Message officiel demandé */}
            <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-sm font-semibold flex items-start gap-3 text-left">
              <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-extrabold text-amber-300">
                  Statut : En attente de validation admin
                </p>
                <p className="text-xs text-amber-200/80 mt-1">
                  Paiement 25.000 FCFA vérifié et token consommé. Votre dossier avec le numéro d'Ordre ({numeroOrdre}) et IFU ({ifu}) est en cours d'examen par l'administration EFA GARDE. Votre officine sera activée sous 24h.
                </p>
              </div>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row gap-3">
              <button
                onClick={onBackToMap}
                className="flex-1 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm transition-all cursor-pointer"
              >
                Retour à la carte publique
              </button>
              <button
                onClick={onNavigateToLogin}
                className="flex-1 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-all cursor-pointer"
              >
                Accéder à la connexion
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Badge Token de Paiement Actif */}
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-emerald-300 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Paiement 25.000 FCFA validé</span>
              </div>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700">
                {paymentToken?.operator} • {paymentToken?.id.substring(0, 14)}...
              </span>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-950/70 border border-red-500/60 rounded-xl text-red-200 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* 1. Identifiants de connexion */}
            <div className="p-4 bg-slate-800/40 rounded-2xl border border-slate-800 space-y-3">
              <h3 className="text-xs font-black uppercase text-emerald-400 tracking-wider flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                Identifiants du compte pharmacien
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    Email professionnel <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                    <input
                      type="email"
                      required
                      placeholder="titulaire@pharmacie.tg"
                      value={emailPro}
                      onChange={(e) => setEmailPro(e.target.value)}
                      className="w-full bg-slate-800 text-white pl-9 pr-3 py-2.5 rounded-xl border border-slate-700 text-sm focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    Mot de passe <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Min. 6 caractères"
                    value={motDePasse}
                    onChange={(e) => setMotDePasse(e.target.value)}
                    className="w-full bg-slate-800 text-white px-3 py-2.5 rounded-xl border border-slate-700 text-sm focus:border-emerald-500 focus:outline-none font-mono"
                  />
                </div>
              </div>
            </div>

            {/* 2. Données Officine, IFU & Ordre */}
            <div className="p-4 bg-slate-800/40 rounded-2xl border border-slate-800 space-y-3">
              <h3 className="text-xs font-black uppercase text-blue-400 tracking-wider flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5" />
                Informations Officine & Agréments Officiels
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    Nom officiel de la pharmacie <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Grande Pharmacie de Dékon"
                    value={nomPharmacie}
                    onChange={(e) => setNomPharmacie(e.target.value)}
                    className="w-full bg-slate-800 text-white px-3 py-2.5 rounded-xl border border-slate-700 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* IFU Togo */}
                  <div>
                    <label className="block text-emerald-300 font-black mb-1 flex items-center gap-1">
                      <Hash className="w-3.5 h-3.5 text-emerald-400" />
                      Numéro IFU Togo <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: 1000123456"
                      value={ifu}
                      onChange={(e) => setIfu(e.target.value)}
                      className="w-full bg-slate-800 text-white font-mono px-3 py-2.5 rounded-xl border border-emerald-500/50 text-sm focus:border-emerald-400 focus:outline-none shadow-sm"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      Identifiant Fiscal Unique de l'officine
                    </span>
                  </div>

                  {/* Numéro Ordre */}
                  <div>
                    <label className="block text-amber-300 font-black mb-1 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                      Numéro Ordre (ONPT) <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: ONPT-TOGO-0248"
                      value={numeroOrdre}
                      onChange={(e) => setNumeroOrdre(e.target.value)}
                      className="w-full bg-slate-800 text-amber-300 font-mono font-bold px-3 py-2.5 rounded-xl border border-amber-500/60 text-sm focus:border-amber-400 focus:outline-none shadow-sm"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      Ordre National des Pharmaciens du Togo
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-bold mb-1">
                      Nom du Pharmacien Titulaire <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Dr. ..."
                      value={titulaire}
                      onChange={(e) => setTitulaire(e.target.value)}
                      className="w-full bg-slate-800 text-white px-3 py-2.5 rounded-xl border border-slate-700 text-sm focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-bold mb-1">
                      Téléphone WhatsApp officiel <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="+228 90 00 00 00"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-slate-800 text-white px-3 py-2.5 rounded-xl border border-slate-700 text-sm font-mono focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* 8. Quartier (saisie libre) & Adresse */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-bold mb-1">
                      Quartier <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Tokoin, Bè, Adidogomé..."
                      value={quartier}
                      onChange={(e) => setQuartier(e.target.value)}
                      className="w-full bg-slate-800 text-white px-3 py-2.5 rounded-xl border border-slate-700 text-sm focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-bold mb-1">
                      Adresse exacte / Repère <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Boulevard, carrefour ou repère"
                      value={adresse}
                      onChange={(e) => setAdresse(e.target.value)}
                      className="w-full bg-slate-800 text-white px-3 py-2.5 rounded-xl border border-slate-700 text-sm focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* 9 & 10. Latitude et Longitude côte à côte + Bouton "📍 Ma position" */}
                <div className="space-y-2 pt-1 border-t border-slate-800/80">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-blue-400" />
                      Coordonnées GPS officielles <span className="text-red-400">*</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleUseGps}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 text-xs font-bold transition-all cursor-pointer active:scale-95 self-start sm:self-auto"
                      title="Remplir automatiquement Latitude et Longitude avec le GPS"
                    >
                      <MapPin className="w-3.5 h-3.5 text-blue-400" />
                      <span>📍 Ma position</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-bold mb-1">
                        Latitude <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="number"
                        step="any"
                        required
                        placeholder="Ex: 6.1319"
                        value={lat}
                        onChange={(e) => setLat(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full bg-slate-800 text-white font-mono px-3 py-2.5 rounded-xl border border-slate-700 text-sm focus:border-emerald-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-bold mb-1">
                        Longitude <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="number"
                        step="any"
                        required
                        placeholder="Ex: 1.2228"
                        value={lng}
                        onChange={(e) => setLng(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full bg-slate-800 text-white font-mono px-3 py-2.5 rounded-xl border border-slate-700 text-sm focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Pièces justificatives & Photo */}
            <div className="p-4 bg-slate-800/40 rounded-2xl border border-slate-800 space-y-3">
              <h3 className="text-xs font-black uppercase text-amber-400 tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                Pièces justificatives (Sécurité & Agrément)
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Pièce: Carte d'ordre ou autorisation */}
                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    Justificatif : Licence / Carte d'Ordre
                  </label>
                  <label className="border-2 border-dashed border-slate-700 hover:border-slate-500 rounded-xl p-3 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors bg-slate-800/60 min-h-[75px]">
                    <Upload className="w-4 h-4 text-amber-400" />
                    <span className="text-[11px] text-slate-300 text-center">
                      {piecePreview ? 'Document joint ✓' : 'Télécharger justificatif'}
                    </span>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => handleFileUpload(e, setPiecePreview)}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Photo devanture */}
                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    Photo de la devanture
                  </label>
                  <label className="border-2 border-dashed border-slate-700 hover:border-slate-500 rounded-xl p-3 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors bg-slate-800/60 min-h-[75px]">
                    <Upload className="w-4 h-4 text-emerald-400" />
                    <span className="text-[11px] text-slate-300 text-center">
                      {devanturePreview ? 'Photo ajoutée ✓' : 'Télécharger photo devanture'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, setDevanturePreview)}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Note de vérification */}
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-start gap-2">
              <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong>Contrôle de vérification :</strong> Votre compte sera vérifié par l'Ordre sous 24h avant activation de votre accès au tableau de bord.
              </span>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full min-h-[50px] py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm shadow-xl shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Envoi du dossier officiel à l'Ordre...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5" />
                  <span>Soumettre mon inscription officielle</span>
                </>
              )}
            </button>

            {/* Lien Connexion */}
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={onNavigateToLogin}
                className="text-xs text-slate-400 hover:text-emerald-400 font-bold transition-colors cursor-pointer"
              >
                Déjà inscrit ? Se connecter à mon Dashboard →
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default PharmacienRegisterPage;
