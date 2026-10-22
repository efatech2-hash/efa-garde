import React, { useState, useEffect } from 'react';
import { Pharmacie, Garde } from '../types';
import {
  loadPharmacies,
  loadGardes,
  addGarde,
  deleteGarde,
  updatePharmacyStatus,
  isPharmacyCurrentlyOnDuty,
  loadConversations,
  getPharmacyStats,
  PharmacyStatsSummary,
} from '../services/store';
import { getSession } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { PharmaLayout } from '../components/PharmaLayout';
import { Logo } from '../components/Logo';
import {
  Shield,
  Calendar,
  Clock,
  CheckCircle,
  AlertTriangle,
  Plus,
  Trash2,
  Star,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Phone,
  MapPin,
  MessageSquare,
  CreditCard,
  Building2,
  Sparkles,
  BarChart3,
  TrendingUp,
  Users,
} from 'lucide-react';

interface DashboardPharmaProps {
  onNavigate: (tab: string) => void;
  onRefresh: () => void;
}

export const DashboardPharma: React.FC<DashboardPharmaProps> = ({
  onNavigate,
  onRefresh,
}) => {
  const session = getSession();
  const [pharmacies, setPharmacies] = useState<Pharmacie[]>(() => loadPharmacies());

  // FIX 1: Auto Sync Pharmacie - SELECT * FROM pharmacies WHERE user_id = auth.user.id LIMIT 1
  // Uses session pharmaId with zero dropdown / zero choice
  const targetId = session?.pharmaId || localStorage.getItem('efa_active_pharma_id') || pharmacies[0]?.id;
  const currentPharma = pharmacies.find((p) => p.id === targetId) || pharmacies[0];

  const [gardes, setGardes] = useState<Garde[]>([]);
  const [autoSync, setAutoSync] = useState(true);
  const [conversationsCount, setConversationsCount] = useState(0);
  const [stats, setStats] = useState<PharmacyStatsSummary>(() =>
    getPharmacyStats(currentPharma?.id || 'pharma-1')
  );

  // Paiement 15.000 FCFA caller
  const [isCallingPayment15000, setIsCallingPayment15000] = useState(false);
  const [paymentNotice15000, setPaymentNotice15000] = useState<string | null>(null);

  const handleDirectPayment15000 = async () => {
    if (!currentPharma) return;
    setIsCallingPayment15000(true);
    setPaymentNotice15000(null);

    try {
      console.log('Appel de la passerelle de paiement pour 15.000 FCFA...');
      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: {
          amount: 15000,
          currency: 'FCFA',
          pharmacy_id: currentPharma.id,
          pharmacy_name: currentPharma.nom,
          pharmacy_tel: currentPharma.tel,
          description: `Abonnement Officine EFA GARDE - 15.000 FCFA (${currentPharma.nom})`,
          return_url: window.location.href,
        },
      });

      if (error) {
        console.error('Erreur create-payment:', error);
        setPaymentNotice15000(`Erreur: ${error.message || 'Impossible d’appeler la fonction create-payment'}`);
      } else {
        console.log('Réponse reçue de create-payment:', data);
        const redirectUrl = data?.payment_url || data?.url || data?.checkout_url;
        if (redirectUrl) {
          setPaymentNotice15000('Redirection vers la passerelle de paiement...');
          setTimeout(() => {
            window.location.href = redirectUrl;
          }, 1000);
        } else {
          setPaymentNotice15000(data?.message || 'Abonnement 15.000 FCFA activé avec succès !');
          setPharmacies(loadPharmacies());
          onRefresh();
        }
      }
    } catch (err: any) {
      console.error('Exception create-payment:', err);
      setPaymentNotice15000(`Erreur appel create-payment: ${err?.message || err}`);
    } finally {
      setIsCallingPayment15000(false);
    }
  };

  // New Garde Form Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMinutes(0);
    return d.toISOString().slice(0, 16);
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date(Date.now() + 24 * 3600 * 1000);
    d.setMinutes(0);
    return d.toISOString().slice(0, 16);
  });

  // Calendar month state
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());

  // Reload gardes & conversations for current pharmacy ONLY
  const refreshPharmaData = () => {
    if (!currentPharma) return;
    const gList = loadGardes(currentPharma.id);
    setGardes(gList);
    const cList = loadConversations(currentPharma.id);
    setConversationsCount(cList.length);
    setStats(getPharmacyStats(currentPharma.id));
  };

  useEffect(() => {
    refreshPharmaData();
  }, [currentPharma?.id]);

  // AUTO ON/OFF Check according to programmed schedule
  useEffect(() => {
    if (!currentPharma || !autoSync) return;
    const shouldBeOnline = isPharmacyCurrentlyOnDuty(currentPharma.id);
    if (shouldBeOnline !== currentPharma.is_online) {
      updatePharmacyStatus(currentPharma.id, shouldBeOnline);
      setPharmacies(loadPharmacies());
      onRefresh();
    }
  }, [gardes, currentPharma?.id, autoSync]);

  // Toggle "Je suis de garde ON/OFF"
  const handleToggleDuty = (newState: boolean) => {
    if (!currentPharma) return;
    updatePharmacyStatus(currentPharma.id, newState);
    setPharmacies(loadPharmacies());
    onRefresh();
  };

  // Add new garde
  const handleCreateGarde = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPharma) return;

    if (new Date(startDate) >= new Date(endDate)) {
      alert('La date de fin doit être postérieure à la date de début.');
      return;
    }

    addGarde({
      pharmacie_id: currentPharma.id,
      date_debut: new Date(startDate).toISOString(),
      date_fin: new Date(endDate).toISOString(),
    });

    setShowAddModal(false);
    refreshPharmaData();
    onRefresh();
  };

  const handleDeleteGarde = (id: string) => {
    deleteGarde(id);
    refreshPharmaData();
    onRefresh();
  };

  if (!currentPharma) {
    return (
      <div className="p-8 text-center text-slate-400">
        Chargement de votre officine...
      </div>
    );
  }

  // Calendar helpers
  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = (new Date(year, month, 1).getDay() + 6) % 7; // Monday = 0

  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  const isDayInGuard = (dayNum: number) => {
    const dayStart = new Date(year, month, dayNum, 0, 0, 0).getTime();
    const dayEnd = new Date(year, month, dayNum, 23, 59, 59).getTime();

    return gardes.some((g) => {
      const gStart = new Date(g.date_debut).getTime();
      const gEnd = new Date(g.date_fin).getTime();
      return gStart <= dayEnd && gEnd >= dayStart;
    });
  };

  const isToday = (dayNum: number) => {
    const today = new Date();
    return today.getDate() === dayNum && today.getMonth() === month && today.getFullYear() === year;
  };

    const isFirstLogin = new URLSearchParams(window.location.search).get('first') === 'true';

    return (
    <PharmaLayout
      role={session?.role}
      pharmaNom={currentPharma.nom}
      onRefreshRole={() => setPharmacies(loadPharmacies())}
    >
      <div className="w-full max-w-full overflow-x-hidden px-3 sm:px-6 py-4 space-y-6 pb-28 flex flex-col animate-in fade-in duration-200">
        {/* First Login Confirmation Banner */}
        {isFirstLogin && (
          <div className="w-full bg-emerald-500/15 border border-emerald-500/40 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-emerald-200 animate-in fade-in">
            <div className="flex items-center gap-3">
              <span className="text-2xl shrink-0">🎉</span>
              <div>
                <p className="font-extrabold text-white text-sm">
                  Compte Officine Confirmé avec Succès !
                </p>
                <p className="text-xs text-emerald-300">
                  Bienvenue sur votre Dashboard EFA GARDE. Vous pouvez gérer votre statut de garde, vos plannings et vos messages clients.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                const url = new URL(window.location.href);
                url.searchParams.delete('first');
                window.history.replaceState({}, '', url.pathname);
              }}
              className="text-xs text-emerald-400 hover:text-white px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 cursor-pointer self-end sm:self-center"
            >
              Fermer
            </button>
          </div>
        )}

        {/* 1. MON PROFIL PHARMA (Officine assignée unique - AUCUN sélecteur / AUCUN bouton voir autres) */}
        <div className="w-full bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-white p-2 flex items-center justify-center shadow-lg shrink-0">
              <Logo className="w-full h-full" variant="blue" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-extrabold tracking-wider text-emerald-400">
                  Mon Officine EFA GARDE
                </span>
                <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700 font-mono">
                  Agrément #TG-2026
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {currentPharma.nom}
              </h1>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1">
                <span className="flex items-center gap-1 text-slate-300">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  {currentPharma.adresse}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 font-mono text-slate-300">
                  <Phone className="w-3.5 h-3.5 text-blue-400" />
                  {currentPharma.tel}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions & Status */}
          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
            <button
              onClick={() => onNavigate('pharma/stats')}
              className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#0A3D8F]/25 hover:bg-[#0A3D8F]/40 text-blue-300 hover:text-white border border-blue-500/40 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
              title="Consulter les statistiques clients & affluence"
            >
              <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
              <span>STATISTIQUES</span>
            </button>

            <span
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 border ${
                currentPharma.is_online
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  currentPharma.is_online ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                }`}
              />
              {currentPharma.is_online ? 'EN LIGNE (DE GARDE)' : 'HORS GARDE'}
            </span>
          </div>
        </div>

        {/* 2. MON STATUT GARDE ON/OFF (Gros switch facile au pouce) */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-2">
              <span className="text-xs uppercase font-extrabold tracking-wider text-slate-400 flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    currentPharma.is_online ? 'bg-emerald-400 animate-ping' : 'bg-slate-600'
                  }`}
                />
                Statut de Disponibilité en Direct à Lomé
              </span>

              <h2 className="text-2xl sm:text-3xl font-black text-white">
                {currentPharma.is_online ? (
                  <span className="text-emerald-400 flex items-center gap-2">
                    <CheckCircle className="w-8 h-8 shrink-0" />
                    JE SUIS DE GARDE (ACTIVÉ)
                  </span>
                ) : (
                  <span className="text-slate-400 flex items-center gap-2">
                    <AlertTriangle className="w-8 h-8 text-slate-500 shrink-0" />
                    JE SUIS HORS GARDE (ARRÊTÉ)
                  </span>
                )}
              </h2>

              <p className="text-sm text-slate-300 max-w-xl leading-relaxed">
                {currentPharma.is_online
                  ? 'Votre pharmacie apparaît en VERT vif sur la carte publique des patients de Lomé. Le chat en direct et les appels d’urgence sont ouverts.'
                  : 'Votre pharmacie apparaît en GRIS. Le chat est suspendu. Basculez l’interrupteur pour activer immédiatement votre garde.'}
              </p>

              <div className="pt-2">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoSync}
                    onChange={(e) => setAutoSync(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span>
                    Synchronisation automatique selon le calendrier de garde ci-dessous
                  </span>
                </label>
              </div>
            </div>

            {/* Big Interactive Toggle Switch */}
            <div className="flex flex-col items-center gap-2 self-center md:self-auto">
              <button
                onClick={() => handleToggleDuty(!currentPharma.is_online)}
                className={`relative inline-flex h-16 w-36 items-center rounded-full transition-colors focus:outline-none shadow-2xl p-1 cursor-pointer ${
                  currentPharma.is_online
                    ? 'bg-emerald-600 shadow-emerald-500/40'
                    : 'bg-slate-700 shadow-black/50'
                }`}
              >
                <span
                  className={`inline-block h-14 w-14 transform rounded-full bg-white shadow-md transition-transform flex items-center justify-center font-bold text-xs ${
                    currentPharma.is_online
                      ? 'translate-x-20 text-emerald-700'
                      : 'translate-x-1 text-slate-700'
                  }`}
                >
                  {currentPharma.is_online ? 'ON' : 'OFF'}
                </span>
                <span
                  className={`absolute font-extrabold text-xs uppercase tracking-wider ${
                    currentPharma.is_online ? 'left-5 text-white' : 'right-5 text-slate-300'
                  }`}
                >
                  {currentPharma.is_online ? 'GARDE' : 'ARRÊT'}
                </span>
              </button>
              <span className="text-[11px] text-slate-400 font-medium">
                Cliquez pour basculer
              </span>
            </div>
          </div>
        </div>

        {/* 3. CARDS: MES MESSAGES CLIENTS & MON ABONNEMENT (1 col mobile, 2 cols desktop) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Mes Messages Clients */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs uppercase font-extrabold text-slate-400">
                  Messagerie Directe Patients
                </span>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
                  {conversationsCount} conversation{conversationsCount > 1 ? 's' : ''}
                </span>
              </div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-emerald-400" />
                <span>Mes Messages Clients</span>
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
                Répondez instantanément aux ordonnances et questions de disponibilité avec alerte sonore.
              </p>
            </div>

            <button
              onClick={() => onNavigate('inbox')}
              className="w-full min-h-[48px] py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <span>Ouvrir ma boîte de réception ({conversationsCount})</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Mon Abonnement */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs uppercase font-extrabold text-slate-400">
                  Visibilité Officine Lomé
                </span>
                {currentPharma.plan === 'top' ? (
                  <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-400/20 text-amber-300 border border-amber-400/40 flex items-center gap-1">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    TOP 1 (10k/mois)
                  </span>
                ) : currentPharma.plan === '60k' ? (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Annuel 60k/an
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700">
                    Plan Gratuit
                  </span>
                )}
              </div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-amber-400" />
                <span>Mon Abonnement EFA GARDE</span>
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
                {currentPharma.plan === 'top'
                  ? 'Votre pharmacie est affichée avec une étoile dorée et en 1ère position absolue.'
                  : currentPharma.plan === '60k'
                  ? 'Votre pharmacie apparaît avec un marqueur VERT vif de garde et priorité standard.'
                  : 'Passez au plan TOP pour garantir la première place et doubler vos clients.'}
              </p>
            </div>

            {paymentNotice15000 && (
              <div className="p-3 rounded-xl text-xs bg-slate-800 border border-blue-500/40 text-blue-300">
                {paymentNotice15000}
              </div>
            )}

            <div className="space-y-2 pt-2 w-full flex flex-col">
              <button
                onClick={() => {
                  const msg = `Bonjour EFA GARDE, je veux payer abonnement Plan Star 15.000 FCFA pour ${currentPharma.nom}`;
                  window.open(`https://wa.me/22896100972?text=${encodeURIComponent(msg)}`, '_blank');
                }}
                className="w-full min-h-[48px] py-3.5 px-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs sm:text-sm shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 text-center"
              >
                <CreditCard className="w-4 h-4 shrink-0" />
                <span>Payer par T-Money / Flooz / Moov (15.000 FCFA)</span>
              </button>

              <button
                onClick={() => onNavigate('abonnement')}
                className="w-full min-h-[44px] py-2.5 px-3 rounded-2xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs border border-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer text-center"
              >
                <span>Voir toutes les formules T-Money / Flooz / Moov</span>
                <ArrowRight className="w-3.5 h-3.5 shrink-0" />
              </button>
            </div>
          </div>
        </div>

        {/* 4. MON CALENDRIER MENSUEL DES GARDES (Mes gardes programmées) */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-400" />
                <h3 className="text-lg font-black text-white">
                  Mes Périodes de Garde Programmées
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Programmez vos tours de nuit et week-ends pour {currentPharma.nom}.
              </p>
            </div>

            <button
              onClick={() => setShowAddModal(true)}
              className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Programmer une Garde</span>
            </button>
          </div>

          {/* Month Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <button
              onClick={() =>
                setCurrentMonthDate(new Date(year, month - 1, 1))
              }
              className="min-h-[40px] min-w-[40px] p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-base font-black text-white">
              {monthNames[month]} {year}
            </span>
            <button
              onClick={() =>
                setCurrentMonthDate(new Date(year, month + 1, 1))
              }
              className="min-h-[40px] min-w-[40px] p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-xs">
            {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => (
              <div key={d} className="font-bold text-slate-400 py-1 uppercase text-[11px]">
                {d}
              </div>
            ))}

            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="h-14 sm:h-20 rounded-xl bg-slate-900/30 opacity-20" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const inGuard = isDayInGuard(dayNum);
              const today = isToday(dayNum);

              return (
                <div
                  key={`day-${dayNum}`}
                  onClick={() => {
                    const s = new Date(year, month, dayNum, 8, 0).toISOString().slice(0, 16);
                    const e = new Date(year, month, dayNum + 1, 8, 0).toISOString().slice(0, 16);
                    setStartDate(s);
                    setEndDate(e);
                    setShowAddModal(true);
                  }}
                  className={`h-14 sm:h-20 rounded-xl p-1.5 flex flex-col justify-between border cursor-pointer transition-all hover:scale-[1.02] ${
                    inGuard
                      ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-200'
                      : 'bg-slate-800/40 border-slate-700/60 text-slate-300 hover:bg-slate-800/70'
                  } ${today ? 'ring-2 ring-blue-500 font-extrabold' : ''}`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span>{dayNum}</span>
                    {today && (
                      <span className="text-[9px] px-1 bg-blue-500 text-white rounded font-bold">
                        Auj.
                      </span>
                    )}
                  </div>

                  {inGuard ? (
                    <div className="text-[9px] sm:text-[10px] font-bold text-emerald-400 bg-emerald-500/20 py-0.5 rounded px-1 truncate">
                      DE GARDE
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-500 hidden sm:block">+ Ajouter</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Gardes list cards */}
          <div className="pt-4 border-t border-slate-800 space-y-3">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span>Plages horaires de garde enregistrées ({gardes.length})</span>
            </h4>

            {gardes.length === 0 ? (
              <p className="text-xs text-slate-400 italic">
                Aucun tour de garde programmé ce mois-ci. Cliquez sur une case du calendrier pour en ajouter un.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {gardes.map((g) => {
                  const s = new Date(g.date_debut);
                  const e = new Date(g.date_fin);
                  const now = new Date().getTime();
                  const isActiveNow = now >= s.getTime() && now <= e.getTime();

                  return (
                    <div
                      key={g.id}
                      className={`flex items-center justify-between p-3.5 rounded-2xl border text-xs ${
                        isActiveNow
                          ? 'bg-emerald-950/30 border-emerald-500/60'
                          : 'bg-slate-800/60 border-slate-700'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          {isActiveNow ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                              En cours maintenant
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-700 text-slate-300">
                              Programmé
                            </span>
                          )}
                        </div>
                        <div className="text-slate-200 font-bold text-sm">
                          Du {s.toLocaleDateString('fr-FR')} à {s.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="text-slate-400 text-xs">
                          Au {e.toLocaleDateString('fr-FR')} à {e.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteGarde(g.id)}
                        className="min-h-[44px] min-w-[44px] p-2.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors flex items-center justify-center cursor-pointer"
                        title="Supprimer cette garde"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 5. CARTE RÉSUMÉ STATISTIQUES EN BAS DU DASHBOARD */}
        <div className="bg-white text-slate-900 border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0A3D8F] flex items-center justify-center border border-blue-100 shrink-0">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  Statistiques & Affluence de votre Officine
                </h3>
                <p className="text-xs text-slate-500">
                  Fréquentation en temps réel et contacts patients à Lomé
                </p>
              </div>
            </div>

            <button
              onClick={() => onNavigate('pharma/stats')}
              className="px-3.5 py-1.5 rounded-xl bg-[#0A3D8F] hover:bg-blue-900 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <span>Voir détails & graphiques</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 3 Métriques clés */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Cette semaine
              </span>
              <div className="text-3xl font-black text-[#0A3D8F] my-1">
                {stats.totalThisWeek}
              </div>
              <span className="text-xs text-slate-600 font-medium">
                Clients ayant contacté
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Ce mois
              </span>
              <div className="text-3xl font-black text-[#0A3D8F] my-1">
                {stats.totalThisMonth}
              </div>
              <span className="text-xs text-slate-600 font-medium">
                Total clients 30 jours
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Conversations
              </span>
              <div className="text-3xl font-black text-[#0A3D8F] my-1">
                {stats.conversationsHandled}
              </div>
              <span className="text-xs text-slate-600 font-medium">
                Prises en charge
              </span>
            </div>
          </div>

          {/* Mini preview barres 7 jours */}
          <div className="pt-2">
            <div className="text-xs font-bold text-slate-700 mb-2 flex items-center justify-between">
              <span>Activité des 7 derniers jours :</span>
              <span className="text-[11px] text-slate-500 font-normal">Chiffres en bleu EFA</span>
            </div>
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2 text-center">
              {stats.dailyStats7Days.map((d, idx) => {
                const maxVal = Math.max(...stats.dailyStats7Days.map((item) => item.count), 1);
                const pct = Math.max(Math.round((d.count / maxVal) * 100), 12);
                return (
                  <div key={idx} className="flex flex-col items-center gap-1">
                    <div className="w-full h-16 sm:h-20 bg-slate-100 rounded-xl flex items-end p-1 justify-center">
                      <div
                        style={{ height: `${pct}%` }}
                        className="w-full bg-[#0A3D8F] hover:bg-blue-600 rounded-lg transition-all"
                        title={`${d.label}: ${d.count} clients`}
                      />
                    </div>
                    <span className="text-[10px] font-extrabold text-[#0A3D8F]">
                      {d.count}
                    </span>
                    <span className="text-[9px] text-slate-500 truncate w-full">
                      {d.label.replace("Aujourd'hui", 'Auj.')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            onClick={() => onNavigate('pharma/stats')}
            className="w-full py-3 rounded-2xl bg-[#0A3D8F] hover:bg-blue-900 text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <BarChart3 className="w-4 h-4" />
            <span>Ouvrir l'onglet STATISTIQUES complet (Graphiques 7j & 30j)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Modal: Programmer une Garde */}
        {showAddModal && (
          <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-emerald-400" />
                  <span>Programmer une Garde pour {currentPharma.nom}</span>
                </h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateGarde} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Date & Heure de début :</label>
                  <input
                    type="datetime-local"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full h-14 bg-slate-800 text-white p-3 rounded-xl border border-slate-700 focus:outline-none focus:border-emerald-500 text-sm shadow-inner"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Date & Heure de fin :</label>
                  <input
                    type="datetime-local"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full h-14 bg-slate-800 text-white p-3 rounded-xl border border-slate-700 focus:outline-none focus:border-emerald-500 text-sm shadow-inner"
                  />
                </div>

                <div className="p-3 bg-slate-800/60 rounded-xl text-slate-400 border border-slate-700/60">
                  Votre officine sera automatiquement affichée de garde en vert vif sur la carte publique pour les habitants de Lomé.
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="min-h-[48px] px-4 py-3 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-750 font-bold"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="min-h-[48px] px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/30"
                  >
                    Enregistrer la Garde
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </PharmaLayout>
  );
};

export default DashboardPharma;
