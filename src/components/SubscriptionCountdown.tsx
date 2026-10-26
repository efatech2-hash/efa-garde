import React, { useState, useEffect } from 'react';
import { Pharmacie } from '../types';
import { supabase } from '../lib/supabase';
import { subscribeToStore, loadPharmacies } from '../services/store';
import {
  Clock,
  Star,
  AlertTriangle,
  CalendarCheck,
  Zap,
  CheckCircle2,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

interface SubscriptionCountdownProps {
  pharmacie: Pharmacie;
  onUpdate?: (updated: Pharmacie) => void;
  onNavigateToPlans?: () => void;
}

export const SubscriptionCountdown: React.FC<SubscriptionCountdownProps> = ({
  pharmacie,
  onUpdate,
  onNavigateToPlans,
}) => {
  const [currentPharma, setCurrentPharma] = useState<Pharmacie>(pharmacie);
  const [daysLeft, setDaysLeft] = useState<number | null>(() => {
    const rawEnd = pharmacie.subscription_end_at || pharmacie.subscription_end;
    if (!rawEnd) return null;
    const end = new Date(rawEnd).getTime();
    return Math.ceil((end - Date.now()) / 86400000);
  });

  // 1. Synchronisation avec les props
  useEffect(() => {
    setCurrentPharma(pharmacie);
  }, [pharmacie]);

  // 2. Fetch direct Supabase au montage (Source unique DB)
  useEffect(() => {
    if (!pharmacie?.id) return;
    const loadFresh = async () => {
      try {
        const { data, error } = await supabase
          .from('pharmacies')
          .select('*')
          .eq('id', pharmacie.id)
          .maybeSingle();
        if (!error && data) {
          setCurrentPharma(data as Pharmacie);
          onUpdate?.(data as Pharmacie);
        }
      } catch (err: unknown) {
        console.warn('[Countdown] initial fetch fallback:', err);
      }
    };
    loadFresh();
  }, [pharmacie?.id]);

  // 3. Écoute temps réel Supabase : channel('pharmacie-' + id)
  // Démarre INSTANTANÉMENT le compte à rebours dès que l'admin active, sans refresh !
  useEffect(() => {
    if (!currentPharma?.id) return;

    const channel = supabase
      .channel('pharmacie-' + currentPharma.id)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pharmacies',
          filter: `id=eq.${currentPharma.id}`,
        },
        (payload) => {
          if (payload.new) {
            const updated = payload.new as Pharmacie;
            setCurrentPharma(updated);
            onUpdate?.(updated);
          }
        }
      )
      .subscribe();

    // Également écouteur de synchronisation intra-onglets / local
    const unsub = subscribeToStore(() => {
      const list = loadPharmacies();
      const fresh = list.find((p) => p.id === currentPharma.id);
      if (fresh) {
        setCurrentPharma(fresh);
      }
    });

    return () => {
      supabase.removeChannel(channel);
      unsub();
    };
  }, [currentPharma?.id]);

  // 4. Calcul dynamique du compte à rebours : recalcul chaque heure (1000 * 60 * 60)
  useEffect(() => {
    const rawEnd = currentPharma.subscription_end_at || currentPharma.subscription_end;
    if (!rawEnd) {
      setDaysLeft(null);
      return;
    }

    const end = new Date(rawEnd);
    const updateDiff = () => {
      const diff = end.getTime() - Date.now();
      setDaysLeft(Math.ceil(diff / 86400000));
    };

    updateDiff();
    const timer = setInterval(updateDiff, 1000 * 60 * 60);

    return () => clearInterval(timer);
  }, [currentPharma.subscription_end_at, currentPharma.subscription_end]);

  const rawEnd = currentPharma.subscription_end_at || currentPharma.subscription_end;
  const isPop =
    currentPharma.subscription_plan === 'premium' ||
    currentPharma.plan === 'populaire_mensuel' ||
    currentPharma.plan === 'populaire_annuel' ||
    currentPharma.plan === 'top' ||
    Boolean(currentPharma.etoile_doree) ||
    Boolean(currentPharma.is_premium);

  const planBadgeText =
    currentPharma.plan === 'populaire_annuel'
      ? 'POPULAIRE - ANNUEL 140.000F'
      : currentPharma.plan === 'populaire_mensuel'
      ? 'POPULAIRE - 15.000F/mois'
      : currentPharma.subscription_plan === 'premium'
      ? 'POPULAIRE GOLD'
      : currentPharma.plan === 'annual' || currentPharma.plan === '60k' || currentPharma.subscription_plan === 'basic'
      ? 'STANDARD - 90.000F/an'
      : currentPharma.is_registered
      ? 'ENREGISTREMENT - 25.000F'
      : 'PLAN BASE';

  const isUrgentRenew = daysLeft !== null && daysLeft < 7 && daysLeft >= 0;
  const isExpired = daysLeft !== null && daysLeft <= 0;

  // Calcul pour la barre de progression
  const totalDays = (() => {
    if (currentPharma.subscription_start_at && rawEnd) {
      const s = new Date(currentPharma.subscription_start_at).getTime();
      const e = new Date(rawEnd).getTime();
      const diff = Math.ceil((e - s) / 86400000);
      if (diff > 0) return diff;
    }
    return currentPharma.plan === 'populaire_mensuel' ? 30 : 365;
  })();

  const progressPercent =
    daysLeft !== null && daysLeft > 0
      ? Math.max(0, Math.min(100, Math.round((daysLeft / totalDays) * 100)))
      : 0;

  const formatExpDate = () => {
    if (!rawEnd) return 'Non défini';
    const d = new Date(rawEnd);
    if (isNaN(d.getTime())) return 'Non défini';
    return d.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }) + ' à 23h59';
  };

  const rawWhatsapp = (
    import.meta.env.VITE_WHATSAPP_NUMBER || '22896100972'
  ).replace(/[^0-9]/g, '');

  const planForMsg = currentPharma.plan || (isPop ? 'POPULAIRE' : 'STANDARD');
  const renewWUrl = `https://wa.me/${rawWhatsapp}?text=${encodeURIComponent(
    `Bonjour EFA GARDE je veux renouveler ${currentPharma.nom} Plan ${planForMsg}`
  )}`;

  return (
    <div
      className={`p-5 rounded-3xl border transition-all space-y-4 shadow-xl ${
        isPop
          ? 'bg-gradient-to-br from-amber-950/30 via-slate-900 to-slate-950 border-amber-400/80 text-amber-100 shadow-amber-500/10'
          : 'bg-slate-900/90 border-slate-700 text-slate-200'
      }`}
    >
      {/* 1. Header Card Compte à Rebours */}
      <div className="flex items-center justify-between pb-3 border-b border-amber-500/20">
        <div className="flex items-center gap-2">
          <div
            className={`p-2 rounded-xl ${
              isPop
                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                : 'bg-emerald-500/20 text-emerald-400'
            }`}
          >
            <Clock className="w-4 h-4 shrink-0" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 block">
              Compte à Rebours Abonnement
            </span>
            <span className="text-xs font-bold text-white">
              Synchronisé en direct avec le Super Admin
            </span>
          </div>
        </div>

        <span
          className={`font-mono text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${
            isPop
              ? 'bg-yellow-500/20 text-yellow-300 border-yellow-400/40 shadow-xs'
              : 'bg-slate-800 text-slate-300 border-slate-700'
          }`}
        >
          {isPop ? '⭐ OFFRE GOLD' : 'STANDARD'}
        </span>
      </div>

      {/* 2. Privilège Tête de liste si POPULAIRE */}
      {isPop && (
        <div className="p-2.5 rounded-2xl bg-amber-500/15 border border-amber-400/40 text-amber-200 text-xs font-black flex items-center gap-2 shadow-xs">
          <Star className="w-4 h-4 text-yellow-400 fill-yellow-400 shrink-0" />
          <span>Votre pharmacie est en TÊTE DE LISTE avec étoile dorée à Lomé.</span>
        </div>
      )}

      {/* 3. Ligne Formule / Plan Actuel */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400 font-medium">Vous avez l'abonnement :</span>
        <span className="font-black text-white bg-slate-950/80 px-2.5 py-1 rounded-xl border border-slate-800">
          [{planBadgeText}]
        </span>
      </div>

      {/* 4. Compte à Rebours dynamique */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400 font-medium">Il vous reste :</span>
        {daysLeft !== null ? (
          isExpired ? (
            <span className="font-black text-xs text-red-300 bg-red-950/80 px-2.5 py-1 rounded-xl border border-red-500/40">
              Abonnement expiré (0 jour restant)
            </span>
          ) : (
            <span
              className={`font-black text-sm px-2.5 py-0.5 rounded-xl ${
                isUrgentRenew
                  ? 'text-red-300 bg-red-950/80 border border-red-500/60 animate-pulse'
                  : isPop
                  ? 'text-yellow-400 bg-amber-950/60 border border-amber-500/30'
                  : 'text-emerald-400 bg-emerald-950/60 border border-emerald-500/30'
              }`}
            >
              {daysLeft} jour{daysLeft > 1 ? 's' : ''}
            </span>
          )
        ) : (
          <span className="italic text-slate-500 text-xs">Non défini (en attente activation)</span>
        )}
      </div>

      {/* 5. Date d'expiration */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400 font-medium">Expire le :</span>
        <span className="font-mono font-bold text-white bg-slate-950/50 px-2 py-0.5 rounded-lg">
          {formatExpDate()}
        </span>
      </div>

      {/* 6. Barre de progression dynamique */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span>Progression de la période</span>
          <span className="font-mono font-bold text-slate-300">
            {progressPercent}% restant ({daysLeft !== null ? Math.max(0, daysLeft) : 0}/{totalDays}j)
          </span>
        </div>
        <div className="w-full h-2.5 rounded-full bg-slate-950 border border-slate-800 overflow-hidden p-0.5">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${
              isUrgentRenew || isExpired
                ? 'bg-red-500'
                : isPop
                ? 'bg-gradient-to-r from-yellow-500 via-amber-400 to-yellow-300'
                : 'bg-gradient-to-r from-emerald-500 to-teal-400'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* 7. Alerte Rouge clignotante si < 7 jours */}
      {(isUrgentRenew || isExpired) && (
        <div className="p-3 rounded-2xl bg-red-950/90 border-2 border-red-500 text-red-200 text-xs font-black flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-pulse shadow-lg shadow-red-900/30">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <div>
              <span className="block text-red-100 uppercase tracking-wide">
                Renouvellement urgent
              </span>
              <span className="text-[11px] text-red-300 font-normal">
                {isExpired
                  ? "Votre abonnement est expiré. Renouvelez pour redevenir prioritaire."
                  : `Il ne reste que ${daysLeft} jour(s) avant la fin de vos privilèges.`}
              </span>
            </div>
          </div>
          <a
            href={renewWUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-slate-950 font-black text-xs shrink-0 flex items-center justify-center gap-1.5 shadow-md"
          >
            <span>Renouveler WhatsApp</span>
          </a>
        </div>
      )}

      {/* 8. Boutons d'actions client */}
      <div className="space-y-2 pt-2 border-t border-slate-800">
        <a
          href={renewWUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full min-h-[48px] py-3.5 px-3 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 text-center"
        >
          <Star className="w-4 h-4 fill-slate-950 shrink-0" />
          <span>Voir mes formules / Renouveler</span>
        </a>

        {onNavigateToPlans && (
          <button
            onClick={onNavigateToPlans}
            className="w-full min-h-[42px] py-2.5 px-3 rounded-2xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs border border-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer text-center"
          >
            <span>Consulter les formules d'abonnement</span>
            <ArrowRight className="w-3.5 h-3.5 shrink-0" />
          </button>
        )}
      </div>
    </div>
  );
};
