import React, { useState } from 'react';
import { Pharmacie, PlanType } from '../types';
import { updatePharmacyPlan } from '../services/store';
import { supabase } from '../lib/supabase';
import {
  Star,
  Check,
  Zap,
  ShieldCheck,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Building2,
  CalendarCheck,
  CheckSquare
} from 'lucide-react';

interface SubscriptionPageProps {
  pharmacies: Pharmacie[];
  activePharmaId: string;
  onSelectActivePharma: (id: string) => void;
  onRefresh: () => void;
}

interface SelectedPlanInfo {
  type: PlanType;
  title: string;
  amount: string;
  amountNumber: number;
}

export const SubscriptionPage: React.FC<SubscriptionPageProps> = ({
  pharmacies,
  activePharmaId,
  onRefresh,
}) => {
  const currentPharma = pharmacies.find((p) => p.id === activePharmaId) || pharmacies[0];

  // Sub-choice for Card 2 (Monthly 15.000 FCFA vs Annual 140.000 FCFA)
  const [starCycle, setStarCycle] = useState<'month' | 'year'>('month');

  // Redirection directe WhatsApp wa.me/22896100972
  const handlePayWhatsApp = (formule: string) => {
    const pharmaName = currentPharma?.nom || 'ma pharmacie';
    const message = `Bonjour EFA TECH, je souhaite payer l'abonnement ${formule} pour ${pharmaName}`;
    const whatsappNum = (process.env.WHATSAPP_NUMBER || '22896100972').replace(/[^0-9]/g, '');
    const url = `https://wa.me/${whatsappNum}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8 pb-28">
      {/* Header */}
      <div className="text-center space-y-3 max-w-2xl mx-auto">
        <span className="px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
          Formules d’Abonnement EFA GARDE Togo
        </span>
        <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
          Maximisez votre visibilité de garde à Lomé
        </h1>
        <p className="text-sm text-slate-300">
          Rejoignez le réseau leader des pharmacies de garde. Recevez des appels directs et des messages de patients en détresse 24h/24 via T-Money et Moov Money.
        </p>

        {/* Auto-synced Pharmacy Badge */}
        <div className="pt-2 flex items-center justify-center gap-2">
          <span className="text-xs text-slate-400 font-medium">Officine :</span>
          <span className="bg-slate-800 text-emerald-400 text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-700">
            {currentPharma?.nom} (Plan actuel : {currentPharma?.plan.toUpperCase()})
          </span>
        </div>
      </div>

      {/* 4 PRICING CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
        
        {/* CARTE 1 : Enregistrement Officine Lomé (25.000 FCFA) */}
        <div className="bg-gradient-to-b from-blue-950/40 via-slate-900 to-slate-900 border-2 border-blue-500/60 rounded-3xl p-6 shadow-xl flex flex-col justify-between hover:border-blue-400 transition-all">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-extrabold text-blue-400 uppercase tracking-wider">
                Officine Lomé
              </span>
              <span className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
                <Building2 className="w-5 h-5" />
              </span>
            </div>

            <h3 className="text-lg font-black text-white tracking-tight mb-2">
              Enregistrement Officine Lomé
            </h3>

            <div className="flex items-baseline gap-1 text-white mb-2">
              <span className="text-3xl font-black">25.000</span>
              <span className="text-base font-bold text-blue-300">FCFA</span>
            </div>

            <p className="text-xs text-slate-300 mb-6 leading-relaxed">
              Activez la visibilité prioritaire de <strong className="text-white">{currentPharma?.nom}</strong> sur Lomé. Accès direct aux patients en détresse, chat live illimité et statut de garde garanti.
            </p>

            <ul className="space-y-2.5 text-xs text-slate-200 mb-6">
              <li className="flex items-center gap-2 font-bold text-blue-300">
                <Check className="w-4 h-4 text-blue-400 shrink-0" />
                <span>25.000 FCFA paiement unique</span>
              </li>
              <li className="flex items-center gap-2 font-bold text-emerald-300">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>T-Money & Moov Money</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Activation Immédiate</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Validation officielle au registre des officines</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Fiche officine vérifiée avec badge officiel EFA GARDE</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Chat Live instantané activé avec les patients</span>
              </li>
            </ul>
          </div>

          <div className="pt-2">
            <button
              onClick={() => handlePayWhatsApp('Enregistrement Officine Lomé 25.000 FCFA')}
              className="w-full py-3.5 px-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs sm:text-sm shadow-xl shadow-blue-600/30 transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2 text-center"
            >
              <Smartphone className="w-4 h-4 shrink-0" />
              <span>Payer par T-Money / Flooz / Moov</span>
            </button>
          </div>
        </div>

        {/* CARTE 2 : Choix le plus populaire TOP (Plan Star Mensuel) */}
        <div className="relative bg-gradient-to-b from-amber-950/50 via-slate-900 to-slate-900 border-2 border-amber-400 rounded-3xl p-6 shadow-2xl flex flex-col justify-between ring-4 ring-amber-400/20 transform lg:-translate-y-2">
          {/* Top Badge */}
          <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-[11px] px-3.5 py-1 rounded-full shadow-lg flex items-center gap-1.5 uppercase tracking-wider whitespace-nowrap">
            <Star className="w-3.5 h-3.5 fill-slate-950" />
            Le plus populaire
          </div>

          <div>
            <div className="flex items-center justify-between mb-3 mt-1">
              <span className="text-xs font-extrabold text-amber-400 uppercase tracking-wider">
                Plan Star Mensuel
              </span>
              <span className="p-2 rounded-xl bg-amber-400/20 text-amber-400">
                <Star className="w-5 h-5 fill-amber-400" />
              </span>
            </div>

            <h3 className="text-lg font-black text-white tracking-tight mb-2">
              Plan Star Mensuel
            </h3>

            {/* Cycle Selector: Mois vs An */}
            <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800 mb-3 text-xs">
              <button
                type="button"
                onClick={() => setStarCycle('month')}
                className={`flex-1 py-1 px-2 rounded-lg font-bold transition-all ${
                  starCycle === 'month'
                    ? 'bg-amber-400 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                15.000 FCFA / mois
              </button>
              <button
                type="button"
                onClick={() => setStarCycle('year')}
                className={`flex-1 py-1 px-2 rounded-lg font-bold transition-all ${
                  starCycle === 'year'
                    ? 'bg-amber-400 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                140.000 FCFA / an
              </button>
            </div>

            <div className="flex items-baseline gap-1 text-white mb-0.5">
              <span className="text-3xl font-black">
                {starCycle === 'month' ? '15.000' : '140.000'}
              </span>
              <span className="text-base font-bold text-amber-300">FCFA</span>
              <span className="text-xs text-slate-400">
                {starCycle === 'month' ? '/ mois' : '/ an'}
              </span>
            </div>
            {/* SOUS 15.000F/mois : écrit en petit vert */}
            <p className="text-xs font-bold text-emerald-400 mb-3">
              Payez 11 mois, le 12ème OFFERT
            </p>

            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              Propulsez votre officine au rang #1 des recherches. Votre icône brille avec une étoile dorée sur toute la carte de Lomé.
            </p>

            <ul className="space-y-2 text-xs text-slate-200 mb-5">
              <li className="flex items-center gap-2 font-bold text-amber-300">
                <Check className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Toujours affiché en tête (#1) des résultats</span>
              </li>
              <li className="flex items-center gap-2 font-bold text-white">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Icône étoile dorée ★ & radar lumineux sur la carte</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Chat Live illimité avec les clients 24/7</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Badge vérifié officiel EFA GARDE</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Support prioritaire WhatsApp & téléphone</span>
              </li>
            </ul>
          </div>

          <div className="space-y-2 pt-1">
            <button
              onClick={() =>
                handlePayWhatsApp(
                  `Plan Star Mensuel ${starCycle === 'month' ? '15.000 FCFA/mois' : '140.000 FCFA/an'}`
                )
              }
              className="w-full py-3.5 px-3 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs sm:text-sm shadow-xl shadow-amber-500/30 transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2 text-center"
            >
              <Smartphone className="w-4 h-4 shrink-0" />
              <span>Payer par T-Money / Flooz / Moov</span>
            </button>
          </div>
        </div>

        {/* CARTE 3 : Plan Annuel Officine (90.000 FCFA / an) */}
        <div className="bg-gradient-to-b from-emerald-950/40 via-slate-900 to-slate-900 border-2 border-emerald-500/80 rounded-3xl p-6 shadow-xl flex flex-col justify-between hover:border-emerald-400 transition-all">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-extrabold text-emerald-400 uppercase tracking-wider">
                Plan Annuel
              </span>
              <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
              </span>
            </div>

            <h3 className="text-lg font-black text-white tracking-tight mb-2">
              Plan Annuel Officine
            </h3>

            <div className="flex items-baseline gap-1 text-white mb-0.5">
              <span className="text-3xl font-black">90.000</span>
              <span className="text-base font-bold text-emerald-400">FCFA</span>
              <span className="text-xs text-slate-400">/ an</span>
            </div>
            {/* SOUS 90.000F/an : écrit en petit vert */}
            <p className="text-xs font-bold text-emerald-400 mb-3">
              Soit 250F / jour seulement
            </p>

            <p className="text-xs text-slate-300 mb-6 leading-relaxed">
              Rentabilisez sur l’année entière. Statut de garde vert en direct et géolocalisation optimisée.
            </p>

            <ul className="space-y-2.5 text-xs text-slate-200 mb-6">
              <li className="flex items-center gap-2 font-bold text-emerald-300">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Marker VERT éclatant dès que de garde</span>
              </li>
              <li className="flex items-center gap-2 font-medium">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Chat Live instantané pour les urgences</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Calcul automatique des 3 pharmacies les plus proches</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Programmation mensuelle des gardes</span>
              </li>
              <li className="flex items-center gap-2 text-slate-400">
                <span className="text-slate-500">✕</span>
                <span>Position #1 garantie (réservé au plan TOP)</span>
              </li>
            </ul>
          </div>

          <div className="space-y-2 pt-1">
            <button
              onClick={() => handlePayWhatsApp('Plan Annuel Officine 90.000 FCFA/an')}
              className="w-full py-3.5 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs sm:text-sm shadow-xl shadow-emerald-600/30 transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2 text-center"
            >
              <Smartphone className="w-4 h-4 shrink-0" />
              <span>Payer par T-Money / Flooz / Moov</span>
            </button>
          </div>
        </div>

        {/* CARTE 4 : Plan Gratuit (0 FCFA) - Tel quel */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 shadow-lg flex flex-col justify-between opacity-80 hover:opacity-100 transition-opacity">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Plan Gratuit
              </span>
              <span className="p-2 rounded-xl bg-slate-800 text-slate-400">
                <Zap className="w-5 h-5" />
              </span>
            </div>

            <h3 className="text-lg font-bold text-slate-300 tracking-tight mb-2">
              Plan Gratuit
            </h3>

            <div className="flex items-baseline gap-1 text-white mb-2">
              <span className="text-3xl font-bold text-slate-300">0</span>
              <span className="text-base font-medium text-slate-400">FCFA</span>
            </div>

            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              Présence de base sur la carte de Lomé avec statut standard.
            </p>

            <ul className="space-y-2.5 text-xs text-slate-400 mb-6">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-slate-500 shrink-0" />
                <span>Fiche d’adresse et numéro de téléphone</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-slate-500 shrink-0" />
                <span>Itinéraire Google Maps</span>
              </li>
              <li className="flex items-center gap-2 text-slate-600">
                <span>✕</span>
                <span>Marker gris (pas de couleur verte prioritaire)</span>
              </li>
              <li className="flex items-center gap-2 text-slate-600">
                <span>✕</span>
                <span>Chat live désactivé pour les clients</span>
              </li>
              <li className="flex items-center gap-2 text-slate-600">
                <span>✕</span>
                <span>Pas de mise en tête de liste</span>
              </li>
            </ul>
          </div>

          <div className="pt-2">
            {currentPharma.plan === 'free' ? (
              <div className="w-full py-3.5 rounded-2xl bg-slate-800 text-slate-400 font-semibold text-center text-xs border border-slate-700">
                Plan Basique Actuel
              </div>
            ) : (
              <button
                onClick={() => {
                  updatePharmacyPlan(currentPharma.id, 'free');
                  onRefresh();
                }}
                className="w-full py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors"
              >
                Rétrograder au Plan Gratuit
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionPage;
