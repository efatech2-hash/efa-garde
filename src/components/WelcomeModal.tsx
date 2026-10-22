import React from 'react';
import { Logo } from './Logo';

interface WelcomeModalProps {
  isOpen: boolean;
  onSelectClient: () => void;
  onSelectPharma: () => void;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({
  isOpen,
  onSelectClient,
  onSelectPharma,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1200] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center space-y-6 animate-in zoom-in-95 duration-200 border border-slate-100">
        {/* Logo / Badge */}
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100 p-2 mx-auto flex items-center justify-center shadow-sm">
          <Logo className="w-full h-full" variant="blue" />
        </div>

        {/* Title & Description */}
        <div className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Bienvenue sur EFA GARDE 💊
          </h2>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
            L'application vous permet de repérer sur la carte où se trouvent les pharmacies de garde les plus proches de vous et discuter avec eux instantanément.
          </p>
        </div>

        {/* Actions */}
        <div className="pt-2 space-y-1">
          {/* BTN OUI (vert grand pulse) */}
          <button
            onClick={onSelectClient}
            className="bg-green-500 hover:bg-green-600 active:scale-[0.98] text-white text-lg font-bold py-4 w-full animate-pulse rounded-xl shadow-lg shadow-green-500/30 transition-all cursor-pointer block"
          >
            Oui, je suis client(e)
          </button>

          {/* BTN NON (rouge petit) */}
          <button
            onClick={onSelectPharma}
            className="bg-red-100 hover:bg-red-200 active:scale-[0.98] text-red-600 text-sm font-semibold py-2 w-full rounded-xl transition-all cursor-pointer mt-4 block"
          >
            Non, je suis pharmacie
          </button>
        </div>
      </div>
    </div>
  );
};
