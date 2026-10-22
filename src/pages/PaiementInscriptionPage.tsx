import React, { useState } from 'react';
import { saveRegistrationPaymentToken } from '../lib/paymentTokens';
import { Logo } from '../components/Logo';
import {
  ShieldCheck,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Lock,
  Building2,
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
  const [operator, setOperator] = useState<'TMONEY' | 'MOOV'>('TMONEY');
  const [phoneNumber, setPhoneNumber] = useState('90 12 34 56');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanPhone = phoneNumber.replace(/\s+/g, '');
    if (cleanPhone.length < 8) {
      setErrorMessage('Veuillez renseigner un numéro de téléphone valide à 8 chiffres.');
      return;
    }

    setIsProcessing(true);

    // Simulation validation USSD instantanée Mobile Money au Togo
    setTimeout(() => {
      const token = saveRegistrationPaymentToken({
        operator,
        phone: cleanPhone,
      });

      setIsProcessing(false);
      setIsSuccess(true);

      // Redirection automatique après 1.2s vers le formulaire d'enregistrement
      setTimeout(() => {
        onSuccess(token.id);
      }, 1200);
    }, 1500);
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
            Filtre Anti-Fake
          </span>
        </div>

        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-white p-2 shadow-lg shadow-emerald-900/30 border border-slate-200 flex items-center justify-center">
            <Logo className="w-full h-full" variant="blue" />
          </div>
          
          {/* Titre demandé exactement */}
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight pt-1">
            Enregistrement Officine - 25.000 FCFA
          </h1>

          {/* Texte demandé exactement */}
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
                Paiement de 25.000 FCFA Confirmé !
              </h3>
              <p className="text-xs text-slate-300">
                Token de paiement anti-fake validé. Redirection vers le formulaire officiel...
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 text-xs text-emerald-400 font-semibold pt-2">
              <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
              <span>Ouverture du formulaire d'enregistrement...</span>
            </div>
          </div>
        ) : (
          <form onSubmit={handlePay} className="space-y-5">
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
                <span className="text-slate-400 font-medium">Disponibilité :</span>
                <span className="text-slate-200 font-medium">Déblocage immédiat du formulaire</span>
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-red-950/70 border border-red-500/60 text-red-200 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Operator Selector (T-Money vs Moov Money) */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 block">
                Sélectionnez votre moyen de paiement Mobile Money :
              </label>
              <div className="grid grid-cols-2 gap-3">
                {/* Togocom T-Money */}
                <button
                  type="button"
                  onClick={() => setOperator('TMONEY')}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    operator === 'TMONEY'
                      ? 'bg-amber-500/20 border-amber-400 ring-2 ring-amber-400/40 text-white font-black shadow-lg shadow-amber-900/20'
                      : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-7 h-7 rounded-lg bg-yellow-400 text-slate-950 font-black text-xs flex items-center justify-center shadow">
                      T
                    </div>
                    <span className="text-sm font-black">T-Money</span>
                  </div>
                  <div className="text-[10px] text-slate-400">Togocom (*145#)</div>
                </button>

                {/* Moov Money / Flooz */}
                <button
                  type="button"
                  onClick={() => setOperator('MOOV')}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    operator === 'MOOV'
                      ? 'bg-blue-500/20 border-blue-400 ring-2 ring-blue-400/40 text-white font-black shadow-lg shadow-blue-900/20'
                      : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-7 h-7 rounded-lg bg-blue-600 text-white font-black text-[10px] flex items-center justify-center shadow">
                      Moov
                    </div>
                    <span className="text-sm font-black">Moov Money</span>
                  </div>
                  <div className="text-[10px] text-slate-400">Flooz (*155#)</div>
                </button>
              </div>
            </div>

            {/* Phone Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">
                Numéro Mobile Money Togo (+228) :
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
                  className="w-full bg-slate-800 text-white pl-16 pr-4 py-3 rounded-xl border border-slate-700 font-mono text-sm focus:outline-none focus:border-emerald-500 transition-colors shadow-inner"
                />
              </div>
            </div>

            {/* USSD Info Note */}
            <div className="p-3 bg-slate-800/60 border border-slate-700/60 rounded-xl text-xs text-slate-400 space-y-1">
              <p className="flex items-center gap-1.5 text-slate-300 font-semibold">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Paiement sécurisé par push USSD</span>
              </p>
              <p className="text-[11px] leading-relaxed">
                Après avoir cliqué, vous recevrez un prompt sur votre téléphone{' '}
                <strong className="text-slate-200">
                  {operator === 'TMONEY' ? 'Togocom' : 'Moov Africa'}
                </strong>{' '}
                pour valider les 25.000 FCFA avec votre code secret.
              </p>
            </div>

            {/* Bouton demandé exactement */}
            <button
              type="submit"
              disabled={isProcessing}
              className="w-full min-h-[52px] py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm sm:text-base shadow-xl shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-60"
            >
              {isProcessing ? (
                <>
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Traitement USSD Mobile Money...</span>
                </>
              ) : (
                <>
                  <Smartphone className="w-5 h-5" />
                  <span>Payer par T-Money / Moov Money</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default PaiementInscriptionPage;
