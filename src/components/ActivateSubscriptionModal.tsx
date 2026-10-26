import React, { useState } from 'react';
import { Pharmacie } from '../types';
import { activateSubscriptionInDB } from '../services/store';
import {
  X,
  Star,
  ShieldCheck,
  Calendar,
  CheckCircle2,
  Clock,
  Sparkles,
  Building,
  Check,
  Loader2,
} from 'lucide-react';

interface ActivateSubscriptionModalProps {
  isOpen: boolean;
  pharmacie: Pharmacie | null;
  onClose: () => void;
  onSuccess: (updatedPharma: Pharmacie) => void;
}

type PlanOption = 'premium_140k' | 'premium_15k' | 'basic_90k';

export const ActivateSubscriptionModal: React.FC<ActivateSubscriptionModalProps> = ({
  isOpen,
  pharmacie,
  onClose,
  onSuccess,
}) => {
  const [selectedPlan, setSelectedPlan] = useState<PlanOption>('premium_140k');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !pharmacie) return null;

  const handleConfirm = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const updated = await activateSubscriptionInDB(pharmacie.id, {
        planType: selectedPlan,
      });
      if (updated) {
        onSuccess(updated);
        onClose();
      } else {
        setErrorMsg("Impossible de mettre à jour l'officine.");
      }
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : "Erreur lors de l'activation en base de données.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                Super Admin • Activation Abonnement DB
              </span>
              <h2 className="text-lg font-black text-white">
                {pharmacie.nom}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto text-xs">
          <p className="text-slate-300">
            Sélectionnez la formule officielle et la durée à appliquer en base de données pour{' '}
            <strong className="text-white">{pharmacie.nom}</strong>. Le compte à rebours client sera
            synchronisé instantanément via Supabase Realtime sans rafraîchissement.
          </p>

          {errorMsg && (
            <div className="p-3 bg-red-950/80 border border-red-500 text-red-200 rounded-xl font-bold">
              {errorMsg}
            </div>
          )}

          {/* Choix des formules */}
          <div className="space-y-3">
            {/* Option 1 : Populaire Annuel (140.000 FCFA) */}
            <div
              onClick={() => setSelectedPlan('premium_140k')}
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative ${
                selectedPlan === 'premium_140k'
                  ? 'border-yellow-400 bg-amber-500/10 shadow-lg shadow-amber-500/10 ring-2 ring-yellow-400/20'
                  : 'border-slate-800 bg-slate-800/40 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-yellow-500/20 text-yellow-400">
                    <Star className="w-4 h-4 fill-yellow-400" />
                  </span>
                  <div>
                    <span className="font-black text-sm text-white block">
                      POPULAIRE ANNUEL (140.000 FCFA / an)
                    </span>
                    <span className="text-[10px] text-yellow-300 font-bold uppercase">
                      Offre Gold • 1 an (+365 jours)
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-mono text-xs font-black text-yellow-400 block">
                    140.000 F
                  </span>
                  <span className="text-[10px] text-slate-400">365 jours</span>
                </div>
              </div>
              <ul className="text-[11px] text-slate-300 space-y-1 pl-7 list-disc">
                <li><strong className="text-white">Étoile dorée ⭐</strong> affichée sur la card</li>
                <li><strong className="text-white">Tête de liste à Lomé (Position 0)</strong></li>
                <li>Statut : <span className="text-emerald-400 font-bold">Actif garanti 365j</span></li>
              </ul>
              {selectedPlan === 'premium_140k' && (
                <div className="absolute top-3 right-3 text-yellow-400">
                  <CheckCircle2 className="w-5 h-5 fill-yellow-400 text-slate-950" />
                </div>
              )}
            </div>

            {/* Option 2 : Populaire Mensuel (15.000 FCFA) */}
            <div
              onClick={() => setSelectedPlan('premium_15k')}
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative ${
                selectedPlan === 'premium_15k'
                  ? 'border-yellow-400 bg-amber-500/10 shadow-lg shadow-amber-500/10 ring-2 ring-yellow-400/20'
                  : 'border-slate-800 bg-slate-800/40 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-yellow-500/20 text-yellow-400">
                    <Star className="w-4 h-4 fill-yellow-400" />
                  </span>
                  <div>
                    <span className="font-black text-sm text-white block">
                      POPULAIRE MENSUEL (15.000 FCFA / mois)
                    </span>
                    <span className="text-[10px] text-yellow-300 font-bold uppercase">
                      Offre Gold • 1 mois (+30 jours)
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-mono text-xs font-black text-yellow-400 block">
                    15.000 F
                  </span>
                  <span className="text-[10px] text-slate-400">30 jours</span>
                </div>
              </div>
              <ul className="text-[11px] text-slate-300 space-y-1 pl-7 list-disc">
                <li><strong className="text-white">Étoile dorée ⭐</strong> sur la card</li>
                <li><strong className="text-white">Tête de liste à Lomé (Position 0)</strong></li>
                <li>Durée : <span className="text-emerald-400 font-bold">30 jours</span> renouvelable</li>
              </ul>
              {selectedPlan === 'premium_15k' && (
                <div className="absolute top-3 right-3 text-yellow-400">
                  <CheckCircle2 className="w-5 h-5 fill-yellow-400 text-slate-950" />
                </div>
              )}
            </div>

            {/* Option 3 : Standard 90k Annuel */}
            <div
              onClick={() => setSelectedPlan('basic_90k')}
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative ${
                selectedPlan === 'basic_90k'
                  ? 'border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/10 ring-2 ring-emerald-500/20'
                  : 'border-slate-800 bg-slate-800/40 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                    <ShieldCheck className="w-4 h-4" />
                  </span>
                  <div>
                    <span className="font-black text-sm text-white block">
                      STANDARD ANNUEL (90.000 FCFA / an)
                    </span>
                    <span className="text-[10px] text-emerald-300 font-bold uppercase">
                      Offre Standard • 1 an (+365 jours)
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-mono text-xs font-black text-emerald-400 block">
                    90.000 F
                  </span>
                  <span className="text-[10px] text-slate-400">365 jours</span>
                </div>
              </div>
              <ul className="text-[11px] text-slate-300 space-y-1 pl-7 list-disc">
                <li>Affichage standard vérifié sur la carte et filtre de garde</li>
                <li>Chat et appels directs avec les patients</li>
                <li>Durée : <span className="text-emerald-400 font-bold">1 an (365 jours)</span></li>
              </ul>
              {selectedPlan === 'basic_90k' && (
                <div className="absolute top-3 right-3 text-emerald-400">
                  <CheckCircle2 className="w-5 h-5 fill-emerald-400 text-slate-950" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-5 sm:p-6 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Mise à jour en DB...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Confirmer l'activation en DB</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
