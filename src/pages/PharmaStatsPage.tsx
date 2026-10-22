import React, { useState, useEffect, useRef } from 'react';
import { Pharmacie } from '../types';
import {
  getPharmacyStats,
  recordClientContact,
  subscribeToStore,
  PharmacyStatsSummary,
  loadPharmacies,
} from '../services/store';
import { getSession } from '../lib/auth';
import { PharmaLayout } from '../components/PharmaLayout';
import { Logo } from '../components/Logo';
import Chart from 'chart.js/auto';
import {
  BarChart3,
  Users,
  Calendar,
  MessageSquare,
  TrendingUp,
  ArrowLeft,
  RefreshCw,
  Sparkles,
  CheckCircle,
  PlusCircle,
} from 'lucide-react';

interface PharmaStatsPageProps {
  pharmacies: Pharmacie[];
  activePharmaId: string;
  onSelectActivePharma: (id: string) => void;
  onNavigate: (path: string) => void;
}

export const PharmaStatsPage: React.FC<PharmaStatsPageProps> = ({
  pharmacies,
  activePharmaId,
  onNavigate,
}) => {
  const session = getSession();
  const targetId =
    session?.pharmaId ||
    activePharmaId ||
    localStorage.getItem('efa_active_pharma_id') ||
    pharmacies[0]?.id;

  const currentPharma =
    pharmacies.find((p) => p.id === targetId) || pharmacies[0];

  const [period, setPeriod] = useState<'7d' | '30d'>('7d');
  const [stats, setStats] = useState<PharmacyStatsSummary>(() =>
    getPharmacyStats(currentPharma?.id || 'pharma-1')
  );
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  // Reload stats whenever store changes or pharmacy changes
  useEffect(() => {
    if (!currentPharma?.id) return;
    const update = () => {
      setStats(getPharmacyStats(currentPharma.id));
    };
    update();
    const unsub = subscribeToStore(update);
    return () => unsub();
  }, [currentPharma?.id]);

  // Chart.js Rendering logic
  useEffect(() => {
    if (!canvasRef.current || !stats) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // Destroy existing chart if present
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
      chartInstanceRef.current = null;
    }

    const dataSeries =
      period === '7d' ? stats.dailyStats7Days : stats.dailyStats30Days;
    const labels = dataSeries.map((d) => d.label);
    const dataValues = dataSeries.map((d) => d.count);

    // Create Bar Chart with Chart.js
    chartInstanceRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Clients ayant contacté',
            data: dataValues,
            backgroundColor: '#0A3D8F',
            hoverBackgroundColor: '#1d4ed8',
            borderRadius: 6,
            borderSkipped: false,
            maxBarThickness: period === '7d' ? 42 : 16,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            backgroundColor: '#0f172a',
            titleColor: '#ffffff',
            bodyColor: '#93c5fd',
            padding: 10,
            cornerRadius: 10,
            displayColors: false,
            callbacks: {
              label: (context) => ` ${context.parsed.y} client(s) ont contacté`,
            },
          },
        },
        scales: {
          x: {
            grid: {
              display: false,
            },
            ticks: {
              color: '#64748b',
              font: {
                size: period === '7d' ? 11 : 9,
                weight: 'bold',
              },
              maxRotation: period === '7d' ? 0 : 45,
            },
          },
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1,
              color: '#64748b',
              font: {
                size: 11,
              },
            },
            grid: {
              color: 'rgba(226, 232, 240, 0.8)',
            },
          },
        },
      },
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [stats, period]);

  const handleSimulateContact = () => {
    if (!currentPharma) return;
    recordClientContact(currentPharma.id);
    setFeedbackMsg('+1 contact client enregistré en direct !');
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  if (!currentPharma) {
    return (
      <div className="p-8 text-center text-slate-400">
        Chargement des statistiques...
      </div>
    );
  }

  return (
    <PharmaLayout
      role={session?.role}
      pharmaNom={currentPharma.nom}
      onRefreshRole={() => {}}
    >
      <div className="w-full max-w-full overflow-x-hidden px-3 sm:px-6 py-4 space-y-6 pb-28 flex flex-col animate-in fade-in duration-200">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <button
            onClick={() => onNavigate('/pharma/dashboard')}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer border border-slate-700"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Retour Dashboard</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-slate-300 font-semibold">
              Statistiques officielles en temps réel • Lomé
            </span>
          </div>
        </div>

        {/* Header Title Banner */}
        <div className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white p-2 flex items-center justify-center shadow-lg shrink-0">
              <Logo className="w-full h-full" variant="blue" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-extrabold tracking-wider text-emerald-400">
                  Rapports & Fréquentation
                </span>
                <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700 font-mono">
                  {currentPharma.nom}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                <BarChart3 className="w-6 h-6 text-[#3b82f6]" />
                <span>Statistiques Pharmacien</span>
              </h1>
            </div>
          </div>

          <button
            onClick={handleSimulateContact}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 hover:text-white border border-blue-500/40 text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95"
            title="Tester l'incrémentation en direct"
          >
            <PlusCircle className="w-4 h-4 text-blue-400" />
            <span>Tester +1 Contact Patient</span>
          </button>
        </div>

        {feedbackMsg && (
          <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle className="w-4 h-4" />
            <span>{feedbackMsg}</span>
          </div>
        )}

        {/* 2 CARDS EN HAUT: "Cette semaine: X clients" / "Ce mois: Y clients" */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Card 1: Cette semaine */}
          <div className="bg-white text-slate-900 border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-lg flex flex-col justify-between relative overflow-hidden group hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-[#0A3D8F]" />
                Cette semaine
              </span>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                7 derniers jours
              </span>
            </div>

            <div className="my-3">
              <div className="text-4xl sm:text-5xl font-black text-[#0A3D8F] tracking-tight">
                {stats.totalThisWeek}
              </div>
              <div className="text-sm font-bold text-slate-700 mt-1">
                Clients ayant contacté l'officine
              </div>
            </div>

            <div className="text-xs text-slate-500 pt-2 border-t border-slate-100 flex items-center justify-between">
              <span>Clics tchat & appels</span>
              <span className="font-semibold text-slate-700">Moyenne : {(stats.totalThisWeek / 7).toFixed(1)}/jour</span>
            </div>
          </div>

          {/* Card 2: Ce mois */}
          <div className="bg-white text-slate-900 border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-lg flex flex-col justify-between relative overflow-hidden group hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-[#0A3D8F]" />
                Ce mois
              </span>
              <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                30 derniers jours
              </span>
            </div>

            <div className="my-3">
              <div className="text-4xl sm:text-5xl font-black text-[#0A3D8F] tracking-tight">
                {stats.totalThisMonth}
              </div>
              <div className="text-sm font-bold text-slate-700 mt-1">
                Clients au total ce mois
              </div>
            </div>

            <div className="text-xs text-slate-500 pt-2 border-t border-slate-100 flex items-center justify-between">
              <span>Fréquentation cumulée</span>
              <span className="font-semibold text-slate-700">Moyenne : {(stats.totalThisMonth / 30).toFixed(1)}/jour</span>
            </div>
          </div>
        </div>

        {/* 3ème Indicateur: Nombre de conversations prises en charge */}
        <div className="bg-white text-slate-900 border border-slate-200/90 rounded-3xl p-5 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#0A3D8F] flex items-center justify-center shrink-0 border border-blue-100">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Messagerie de garde pharmacien
              </div>
              <div className="text-base font-black text-slate-900">
                Nombre de conversations prises en charge
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 self-stretch sm:self-auto justify-between sm:justify-end">
            <div className="text-right">
              <div className="text-3xl font-black text-[#0A3D8F] leading-none">
                {stats.conversationsHandled}
              </div>
              <div className="text-[11px] text-slate-500 font-semibold mt-0.5">
                conversations actives
              </div>
            </div>

            <button
              onClick={() => onNavigate('/inbox')}
              className="px-4 py-2.5 rounded-xl bg-[#0A3D8F] hover:bg-blue-900 text-white text-xs font-bold shadow-md transition-all cursor-pointer active:scale-95 shrink-0"
            >
              Voir la boîte de réception
            </button>
          </div>
        </div>

        {/* GRAPHIQUE SIMPLE (BAR CHART) : Clients par jour sur 7 jours et sur 30 jours */}
        <div className="bg-white text-slate-900 border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[#0A3D8F]" />
                <h2 className="text-lg font-black text-slate-900">
                  Affluence des Clients par Jour
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Nombre de patients ayant contacté {currentPharma.nom} (chat en direct & appels).
              </p>
            </div>

            {/* Toggle 7 jours / 30 jours */}
            <div className="inline-flex p-1 rounded-2xl bg-slate-100 border border-slate-200 self-stretch sm:self-auto">
              <button
                onClick={() => setPeriod('7d')}
                className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                  period === '7d'
                    ? 'bg-[#0A3D8F] text-white shadow-md'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                7 derniers jours
              </button>
              <button
                onClick={() => setPeriod('30d')}
                className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                  period === '30d'
                    ? 'bg-[#0A3D8F] text-white shadow-md'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                30 derniers jours
              </button>
            </div>
          </div>

          {/* Bar Chart Canvas with Chart.js */}
          <div className="w-full h-64 sm:h-80 relative pt-2">
            <canvas ref={canvasRef} />
          </div>

          <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100 gap-2">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-[#0A3D8F]" />
              <span>Barres en bleu EFA (#0A3D8F) : Contacts patients enregistrés</span>
            </div>
            <span className="font-mono text-[11px] text-slate-400">
              Source: Table stats (Supabase & LocalStorage)
            </span>
          </div>
        </div>
      </div>
    </PharmaLayout>
  );
};

export default PharmaStatsPage;
