import React from 'react';
import { getSession, setSession, UserRole } from '../lib/auth';
import { Logo } from './Logo';
import { ShieldCheck, Clock, CheckCircle, AlertCircle, LogOut } from 'lucide-react';

interface PharmaLayoutProps {
  role?: UserRole;
  pharmaNom?: string;
  onRefreshRole?: () => void;
  onLogout?: () => void;
  children: React.ReactNode;
}

export const PharmaLayout: React.FC<PharmaLayoutProps> = ({
  role,
  pharmaNom,
  onRefreshRole,
  onLogout,
  children,
}) => {
  const session = getSession();
  const currentRole = role || session?.role || 'pharma_active';

  // FIX 3: IF user.role=pharma_pending => montre écran attente "Vérification licence en cours"
  if (currentRole === 'pharma_pending') {
    const handleApproveSimulation = () => {
      if (session) {
        const updated = { ...session, role: 'pharma_active' as UserRole };
        setSession(updated);
        if (onRefreshRole) onRefreshRole();
      }
    };

    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-6 animate-in fade-in duration-300">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 mx-auto flex items-center justify-center border border-amber-500/40">
            <Clock className="w-9 h-9" />
          </div>

          <div className="space-y-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30">
              Dossier en attente de validation
            </span>
            <h1 className="text-2xl font-black text-white tracking-tight pt-1">
              Vérification licence en cours
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Votre demande d'activation pour{' '}
              <span className="font-bold text-white">{pharmaNom || 'votre officine'}</span> est actuellement en cours d'examen auprès de l’Ordre National des Pharmaciens du Togo.
            </p>
          </div>

          <div className="p-4 bg-slate-800/60 rounded-2xl border border-slate-700/60 text-left space-y-2 text-xs text-slate-300">
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
              <span className="text-slate-400">Officine rattachée :</span>
              <span className="font-bold text-white">{pharmaNom || 'Pharmacie Lomé'}</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
              <span className="text-slate-400">Contact pharmacien :</span>
              <span className="font-mono text-white">{session?.phone || 'Non renseigné'}</span>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-slate-400">Statut Ordre des Pharmaciens :</span>
              <span className="font-bold text-amber-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                En cours d'audit
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-400">
            Une notification vous sera envoyée dès validation définitive de votre agrément (délai moyen : &lt; 24h).
          </p>

          <div className="space-y-2 pt-2">
            {/* Quick Testing Trigger to unblock pending state */}
            <button
              onClick={handleApproveSimulation}
              className="w-full min-h-[48px] py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-xl shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Simuler Validation Licence (Test Direct)</span>
            </button>

            {onLogout && (
              <button
                onClick={onLogout}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-slate-200 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Changer de compte</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // IF user.role=pharma_active => montre direct dashboard de SA pharmacie
  return <>{children}</>;
};

export default PharmaLayout;
