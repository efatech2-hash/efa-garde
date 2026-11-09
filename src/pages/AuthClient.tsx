import React, { useState } from 'react';
import { setSession } from '../lib/auth';
import { registerClientInDB } from '../services/store';
import { CheckCircle, MessageCircle, User } from 'lucide-react';
import { Logo } from '../components/Logo';

interface AuthClientProps {
  onSuccess: () => void;
  onBackToRoles?: () => void;
}

export const AuthClient: React.FC<AuthClientProps> = ({ onSuccess, onBackToRoles }) => {
  const [nom, setNom] = useState(() => localStorage.getItem('efa_client_nom') || '');
  const [phone, setPhone] = useState(() => localStorage.getItem('efa_client_whatsapp') || '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'form' | 'welcome'>('form');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNom = nom.trim();
    const cleanPhone = phone.trim().replace(/\s+/g, '');

    if (cleanNom.length < 2) {
      setError('Veuillez renseigner votre nom complet.');
      return;
    }
    if (cleanPhone.length < 8) {
      setError('Veuillez entrer un numéro WhatsApp valide (ex: 90 12 34 56).');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      // 1. Enregistrement direct dans Supabase table `clients`
      const registered = await registerClientInDB({
        nom: cleanNom,
        numero_whatsapp: cleanPhone,
      });

      // 2. Session persistante pour que la prochaine ouverture = entrée directe sans re-saisir
      setSession({
        role: 'client',
        phone: cleanPhone,
        pharmacieNom: cleanNom,
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem('role', 'client');
      localStorage.setItem('efa_garde_role', 'client');
      localStorage.setItem('efa_client_id', registered.id);
      localStorage.setItem('efa_client_nom', registered.nom);
      localStorage.setItem('efa_client_whatsapp', registered.numero_whatsapp);

      setLoading(false);
      setStep('welcome');

      setTimeout(() => {
        onSuccess();
      }, 700);
    } catch (err) {
      console.warn('Erreur inscription client:', err);
      // Fallback local persistant garanti
      setSession({
        role: 'client',
        phone: cleanPhone,
        pharmacieNom: cleanNom,
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem('role', 'client');
      localStorage.setItem('efa_garde_role', 'client');
      setLoading(false);
      onSuccess();
    }
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
            EFA GARDE • Espace Client
          </h1>
          <p className="text-xs text-slate-400">
            Inscription rapide : Nom & Numéro WhatsApp
          </p>
        </div>

        {step === 'form' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Nom complet */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">
                Votre nom complet :
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-3.5 text-slate-400">
                  <User className="w-5 h-5" />
                </span>
                <input
                  type="text"
                  required
                  placeholder="Ex: Koffi Mensah"
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  className="w-full h-14 bg-slate-800 text-white pl-12 pr-4 rounded-xl border border-slate-700 text-base focus:outline-none focus:border-emerald-500 transition-colors shadow-inner"
                />
              </div>
            </div>

            {/* Numéro WhatsApp */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">
                Numéro WhatsApp (+228 Togo) :
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-3.5 text-xs text-slate-400 font-mono">
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
              <span>{loading ? 'Enregistrement...' : 'Accéder aux pharmacies de garde'}</span>
            </button>

            <div className="p-3 bg-slate-800/40 rounded-xl text-[11px] text-slate-400 border border-slate-800 text-center">
              ✓ Inscription instantanée et unique<br />
              ✓ Prochaine ouverture = entrée directe sans re-saisie
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

        {step === 'welcome' && (
          <div className="text-center py-6 space-y-3 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/40">
              <CheckCircle className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-black text-white">
              Bienvenue sur EFA GARDE, {nom || 'Patient'} !
            </h2>
            <p className="text-xs text-slate-300">
              Votre compte client est enregistré. Accès direct à la carte de Lomé...
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
