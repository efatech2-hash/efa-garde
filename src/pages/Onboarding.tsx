import React from 'react';
import { setSession } from '../lib/auth';
import {
  Compass,
  MapPin,
  Shield,
  MessageSquare,
  ArrowRight,
  User,
  Building2,
  Sparkles
} from 'lucide-react';

import { Logo } from '../components/Logo';

interface OnboardingProps {
  onSelectClient: () => void;
  onSelectPharma: () => void;
  onGuestBypass: () => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({
  onSelectClient,
  onSelectPharma,
  onGuestBypass,
}) => {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#0b5cb5]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-8 relative z-10 text-center">
        {/* Logo & Headline */}
        <div className="space-y-3">
          <div className="w-20 h-20 rounded-3xl bg-white mx-auto flex items-center justify-center p-2.5 shadow-xl shadow-blue-900/30">
            <Logo className="w-full h-full" variant="blue" />
          </div>

          <div className="space-y-1">
            <span className="px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Lomé • Togo 24/7
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight pt-1">
              Bienvenue sur EFA GARDE
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-sm mx-auto leading-relaxed">
              Le réseau officiel des pharmacies de garde à Lomé. Statut en direct, GPS et messagerie instantanée.
            </p>
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-3 gap-2.5 text-left py-2 border-y border-slate-800">
          <div className="p-3 bg-slate-800/40 rounded-2xl border border-slate-800 space-y-1">
            <Compass className="w-4 h-4 text-blue-400" />
            <div className="text-xs font-bold text-white">3 Plus Proches</div>
            <div className="text-[10px] text-slate-400 leading-tight">Calcul GPS instantané</div>
          </div>
          <div className="p-3 bg-slate-800/40 rounded-2xl border border-slate-800 space-y-1">
            <Shield className="w-4 h-4 text-emerald-400" />
            <div className="text-xs font-bold text-white">En Garde Live</div>
            <div className="text-[10px] text-slate-400 leading-tight">Marqueurs en temps réel</div>
          </div>
          <div className="p-3 bg-slate-800/40 rounded-2xl border border-slate-800 space-y-1">
            <MessageSquare className="w-4 h-4 text-amber-400" />
            <div className="text-xs font-bold text-white">Chat Direct</div>
            <div className="text-[10px] text-slate-400 leading-tight">Sans mot de passe</div>
          </div>
        </div>

        {/* Role Choice Actions */}
        <div className="space-y-3">
          <button
            onClick={onSelectClient}
            className="w-full py-4 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm shadow-xl shadow-emerald-600/30 transition-all flex items-center justify-between group cursor-pointer active:scale-95"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <div className="text-sm font-black">Je suis Patient / Client</div>
                <div className="text-[11px] text-emerald-100 font-normal">
                  Trouver une pharmacie & chatter
                </div>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>

          <button
            onClick={onSelectPharma}
            className="w-full py-4 px-5 rounded-2xl bg-slate-800 hover:bg-slate-750 text-white font-bold text-sm border border-slate-700 transition-all flex items-center justify-between group cursor-pointer active:scale-95"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-700 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="text-left">
                <div className="text-sm font-black">Espace Pharmacien</div>
                <div className="text-[11px] text-slate-400 font-normal">
                  Gérer la garde & les messages
                </div>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform text-slate-400 group-hover:text-white" />
          </button>
        </div>

        {/* Guest Quick Access */}
        <div className="pt-2">
          <button
            onClick={onGuestBypass}
            className="text-xs text-slate-400 hover:text-emerald-400 transition-colors font-medium cursor-pointer"
          >
            Continuer directement en mode découverte →
          </button>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
