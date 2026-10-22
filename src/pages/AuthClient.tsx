import React, { useState } from 'react';
import { setSession } from '../lib/auth';
import { Smartphone, CheckCircle, ArrowRight, ShieldCheck, Sparkles, MessageCircle } from 'lucide-react';

import { Logo } from '../components/Logo';

interface AuthClientProps {
  onSuccess: () => void;
  onBackToRoles?: () => void;
}

export const AuthClient: React.FC<AuthClientProps> = ({ onSuccess, onBackToRoles }) => {
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState<'phone' | 'otp' | 'welcome'>('phone');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.trim().replace(/\s+/g, '');
    if (cleanPhone.length < 8) {
      setError('Veuillez entrer un numéro valide (ex: 90 12 34 56)');
      return;
    }
    setError(null);
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep('otp');
    }, 400);
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp !== '1234' && otp.trim() !== '1234') {
      setError('Code incorrect. Utilisez le code mock : 1234');
      return;
    }

    setError(null);
    setLoading(true);

    setTimeout(() => {
      // Set permanent session in localStorage
      setSession({
        role: 'client',
        phone: '+228 ' + phone,
        createdAt: new Date().toISOString(),
      });

      setLoading(false);
      setStep('welcome');

      // Auto redirect after welcome greeting
      setTimeout(() => {
        onSuccess();
      }, 1000);
    }, 400);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Glow */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#0b5cb5]/10 rounded-full blur-2xl pointer-events-none" />

        {/* Header */}
        <div className="text-center space-y-2 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-white mx-auto flex items-center justify-center p-2 shadow-lg shadow-blue-950/30">
            <Logo className="w-full h-full" variant="blue" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            EFA GARDE • Espace Patient
          </h1>
          <p className="text-xs text-slate-400">
            Connexion unique sans mot de passe ni code PIN
          </p>
        </div>

        {step === 'phone' && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">
                Numéro WhatsApp (+228 Togo) :
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-3 text-xs text-slate-400 font-mono">
                  +228
                </span>
                <input
                  type="tel"
                  required
                  placeholder="90 12 34 56"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full h-14 bg-slate-800 text-white pl-16 pr-4 rounded-xl border border-slate-700 font-mono text-base focus:outline-none focus:border-emerald-500 transition-colors shadow-inner"
                />
              </div>
            </div>

            {error && (
              <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[48px] py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base shadow-xl shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <MessageCircle className="w-5 h-5" />
              <span>{loading ? 'Envoi...' : 'Recevoir le code WhatsApp'}</span>
            </button>

            <div className="p-3 bg-slate-800/40 rounded-xl text-[11px] text-slate-400 border border-slate-800 text-center">
              ✓ Aucune création de mot de passe requise<br />
              ✓ Session persistante et instantanée
            </div>

            {onBackToRoles && (
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={onBackToRoles}
                  className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
                >
                  ← Changer de rôle
                </button>
              </div>
            )}
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-center text-xs text-emerald-300">
              Code envoyé sur WhatsApp au <span className="font-bold">+228 {phone}</span>
              <div className="mt-1 font-mono text-emerald-400 font-bold bg-emerald-900/50 py-1 rounded inline-block px-3">
                Code test : 1234
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block text-center">
                Entrez le code OTP (4 chiffres) :
              </label>
              <input
                type="text"
                maxLength={4}
                required
                autoFocus
                placeholder="1234"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full h-14 bg-slate-800 text-white text-center tracking-[0.5em] font-mono text-2xl rounded-xl border border-slate-700 focus:outline-none focus:border-emerald-500 shadow-inner"
              />
            </div>

            {error && (
              <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[48px] py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base shadow-xl shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <CheckCircle className="w-5 h-5" />
              <span>{loading ? 'Validation...' : 'Valider et continuer'}</span>
            </button>

            <div className="flex justify-between items-center text-xs text-slate-400 pt-1">
              <button
                type="button"
                onClick={() => setStep('phone')}
                className="hover:text-slate-200"
              >
                Modifier le numéro
              </button>
              <button
                type="button"
                onClick={() => setOtp('1234')}
                className="text-emerald-400 font-medium hover:underline"
              >
                Remplir (1234)
              </button>
            </div>
          </form>
        )}

        {step === 'welcome' && (
          <div className="text-center py-6 space-y-3 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/40">
              <CheckCircle className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-black text-white">
              Bienvenue sur EFA GARDE !
            </h2>
            <p className="text-xs text-slate-300">
              Votre session est enregistrée. Redirection vers la carte de Lomé...
            </p>
            <div className="pt-2">
              <span className="inline-block w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthClient;
