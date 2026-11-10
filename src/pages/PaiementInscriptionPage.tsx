import React, { useState } from 'react';
import { saveRegistrationPaymentToken } from '../lib/paymentTokens';
import { createSubscriptionPaymentRequest, verifyRegistrationCode } from '../services/store';
import { Logo } from '../components/Logo';
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Lock,
  MessageCircle,
  KeyRound,
  Sparkles,
} from 'lucide-react';

interface PaiementInscriptionPageProps {
  onSuccess: (token: string) => void;
  onBackToLogin: () => void;
}

export const PaiementInscriptionPage: React.FC<PaiementInscriptionPageProps> = ({
  onSuccess,
  onBackToLogin,
}) => {
  const [nomPharmacie, setNomPharmacie] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [codeValidation, setCodeValidation] = useState('');

  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const [hasSentRequest, setHasSentRequest] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const rawWhatsapp = (
    import.meta.env.VITE_WHATSAPP_NUMBER ||
    '22896100972'
  ).replace(/[^0-9]/g, '');

  const cleanNom = nomPharmacie.trim();
  const cleanPhone = phoneNumber.replace(/\s+/g, '');

  // 1. Clic "Payer 25.000F via WhatsApp"
  // - Ouvre WhatsApp
  // - Crée automatiquement une demande dans Super Admin > Nouvel Abonnement
  const handleOpenWhatsAppAndCreateDemand = async () => {
    setErrorMessage(null);

    if (!cleanNom) {
      setErrorMessage('Veuillez renseigner le nom de votre pharmacie.');
      return;
    }
    if (cleanPhone.length < 8) {
      setErrorMessage('Veuillez renseigner un numéro WhatsApp valide à au moins 8 chiffres.');
      return;
    }

    setIsSendingWhatsApp(true);

    try {
      // 1. Crée la demande d'abonnement / enregistrement dans Supabase
      await createSubscriptionPaymentRequest({
        nom_pharmacie: cleanNom,
        telephone: cleanPhone,
        email: email.trim() || undefined,
        montant: 25000,
      });

      setHasSentRequest(true);

      // 2. Ouvre le lien WhatsApp officiel
      const msg = `Bonjour EFA TECH, je souhaite payer les 25.000 FCFA pour enregistrer ma pharmacie "${cleanNom}". Tel: ${cleanPhone}${email.trim() ? ' - Email: ' + email.trim() : ''}`;
      const url = `https://wa.me/${rawWhatsapp}?text=${encodeURIComponent(msg)}`;
      window.open(url, '_blank');
    } catch (err) {
      console.warn('Erreur création demande abonnement:', err);
      // Ouvre tout de même WhatsApp pour ne pas bloquer le pharmacien
      const msg = `Bonjour EFA TECH, je souhaite payer les 25.000 FCFA pour enregistrer ma pharmacie "${cleanNom}". Tel: ${cleanPhone}`;
      window.open(`https://wa.me/${rawWhatsapp}?text=${encodeURIComponent(msg)}`, '_blank');
      setHasSentRequest(true);
    } finally {
      setIsSendingWhatsApp(false);
    }
  };

  // 2. Vérification du code 4 chiffres envoyé par le Super Admin
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanCode = codeValidation.trim();
    if (cleanCode.length !== 4) {
      setErrorMessage('Veuillez renseigner le code à 4 chiffres reçu par WhatsApp.');
      return;
    }

    setIsVerifyingCode(true);

    try {
      const res = await verifyRegistrationCode(cleanCode, cleanPhone);

      if (!res.valid) {
        setErrorMessage(
          res.error ||
            'Code à 4 chiffres incorrect ou paiement non encore validé par l\'administrateur. Veuillez patienter ou contacter le support sur WhatsApp.'
        );
        setIsVerifyingCode(false);
        return;
      }

      // Code BON = Débloque la suite
      const token = saveRegistrationPaymentToken({
        operator: 'TMONEY',
        phone: cleanPhone || res.demande?.telephone || '22890000000',
      });

      setIsVerifyingCode(false);
      setIsSuccess(true);

      setTimeout(() => {
        onSuccess(token.id);
      }, 1200);
    } catch (err) {
      console.warn('Erreur vérification code:', err);
      setErrorMessage('Erreur lors de la vérification du code. Réessayez.');
      setIsVerifyingCode(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 py-8 px-4 sm:px-6 flex flex-col justify-center items-center font-sans antialiased text-slate-100">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden animate-in fade-in duration-200">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Back Link */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <button
            onClick={onBackToLogin}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Retour connexion</span>
          </button>
          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
            Étape 1 / 2 : Paiement
          </span>
        </div>

        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-white p-2 shadow-lg shadow-emerald-900/30 border border-slate-200 flex items-center justify-center">
            <Logo className="w-full h-full" variant="blue" />
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight pt-1">
            Enregistrement Officine - 25.000 FCFA
          </h1>

          <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed max-w-md mx-auto">
            Pour éviter les fausses pharmacies, l'enregistrement nécessite 25.000 FCFA
          </p>
        </div>

        {/* Success Screen */}
        {isSuccess ? (
          <div className="py-8 text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/40">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-black text-white">
                Code Validé avec Succès !
              </h3>
              <p className="text-xs text-slate-300">
                Paiement vérifié. Déblocage du formulaire officiel d'enregistrement...
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 text-xs text-emerald-400 font-semibold pt-2">
              <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
              <span>Redirection en cours...</span>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Box Récapitulative Sécurisée */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Motif :</span>
                <span className="text-white font-bold">Frais de validation & référencement</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Montant officiel :</span>
                <span className="text-base font-black text-emerald-400">25.000 FCFA</span>
              </div>
              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/80">
                <span className="text-slate-400 font-medium">Validation :</span>
                <span className="text-slate-200 font-medium">Code secret à 4 chiffres envoyé sur WhatsApp</span>
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-red-950/70 border border-red-500/60 text-red-200 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Formulaire Demandeur (Nom + WhatsApp) */}
            <div className="space-y-3.5 bg-slate-950/40 p-4 rounded-2xl border border-slate-800/60">
              <div className="text-xs font-extrabold uppercase tracking-wider text-emerald-400">
                1. Vos coordonnées pour la validation
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 block">
                  Nom de la pharmacie * :
                </label>
                <input
                  type="text"
                  required
                  value={nomPharmacie}
                  onChange={(e) => setNomPharmacie(e.target.value)}
                  placeholder="Ex: Pharmacie du Progrès Lomé"
                  className="w-full bg-slate-800 text-white px-3.5 py-3 rounded-xl border border-slate-700 text-xs focus:outline-none focus:border-emerald-500 shadow-inner"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 block">
                  Numéro WhatsApp de contact * (+228) :
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-xs text-slate-400 font-mono font-bold">
                    +228
                  </span>
                  <input
                    type="tel"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="90 12 34 56"
                    className="w-full bg-slate-800 text-white pl-16 pr-4 py-3 rounded-xl border border-slate-700 font-mono text-xs focus:outline-none focus:border-emerald-500 transition-colors shadow-inner"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 block">
                  Email professionnel (optionnel) :
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@pharmacie.tg"
                  className="w-full bg-slate-800 text-white px-3.5 py-2.5 rounded-xl border border-slate-700 text-xs focus:outline-none focus:border-emerald-500 shadow-inner"
                />
              </div>

              {/* BOUTON OFFICIEL WHATSAPP : Ouvre WhatsApp + Crée auto une demande dans Super Admin > Nouvel Abonnement */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleOpenWhatsAppAndCreateDemand}
                  disabled={isSendingWhatsApp}
                  className="w-full min-h-[52px] py-3.5 px-6 rounded-2xl bg-[#25D366] hover:bg-[#20ba59] active:bg-[#1da850] text-slate-950 font-black text-sm sm:text-base shadow-xl shadow-[#25D366]/30 transition-all flex items-center justify-center gap-2.5 cursor-pointer text-center active:scale-98 border border-emerald-300"
                >
                  <MessageCircle className="w-5 h-5 fill-slate-950 text-slate-950 shrink-0" />
                  <span>
                    {isSendingWhatsApp ? 'Création de la demande...' : 'Payer 25.000F via WhatsApp'}
                  </span>
                </button>
                <div className="text-center text-[10px] text-slate-400 mt-1.5 font-medium">
                  Cliquez pour ouvrir WhatsApp EFA TECH (+228 96 10 09 72) et créer votre dossier.
                </div>
              </div>
            </div>

            {hasSentRequest && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Demande transmise au Super Administrateur !</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Après confirmation de votre paiement, l'administrateur vous transmettra votre code à 4 chiffres sur WhatsApp. Saisissez-le ci-dessous.
                </p>
              </div>
            )}

            {/* 2. CASE CODE 4 CHIFFRES : Code faux = bloqué, Code bon = débloque suite */}
            <form onSubmit={handleVerifyCode} className="space-y-3.5 bg-slate-950/80 p-5 rounded-2xl border-2 border-emerald-500/40">
              <div className="flex items-center gap-2 text-xs font-black text-white uppercase tracking-wider">
                <KeyRound className="w-4 h-4 text-emerald-400" />
                <span>2. Déblocage : Saisissez votre code 4 chiffres</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Entrez le code secret à 4 chiffres généré et envoyé par le Super Administrateur sur WhatsApp après réception de votre paiement.
              </p>

              <div className="space-y-1">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  required
                  value={codeValidation}
                  onChange={(e) => setCodeValidation(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="Ex: 4829"
                  className="w-full h-14 bg-slate-900 border-2 border-emerald-500/50 text-emerald-400 text-2xl font-black text-center tracking-[0.5em] rounded-xl focus:outline-none focus:border-emerald-400 shadow-inner"
                />
              </div>

              <button
                type="submit"
                disabled={isVerifyingCode || codeValidation.length !== 4}
                className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-sm shadow-lg shadow-emerald-600/30 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
              >
                {isVerifyingCode ? (
                  <span>Vérification en base de données...</span>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Valider le code & Remplir le formulaire</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaiementInscriptionPage;
