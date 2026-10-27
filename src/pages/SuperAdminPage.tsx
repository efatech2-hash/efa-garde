import React, { useState, useEffect } from 'react';
import { Pharmacie } from '../types';
import {
  loadPharmacies,
  savePharmacies,
  updatePharmacySuperAdmin,
  subscribeToStore,
  getSupabaseClient,
  fetchPharmacies,
  activateSubscriptionInDB,
} from '../services/store';
import { getSession, setSession, clearSession } from '../lib/auth';
import { checkRateLimit } from '../utils/security';
import { Logo } from '../components/Logo';
import { ActivateSubscriptionModal } from '../components/ActivateSubscriptionModal';
import {
  ShieldCheck,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Calendar,
  AlertTriangle,
  LogOut,
  ArrowLeft,
  Building2,
  Mail,
  MapPin,
  RefreshCw,
  Phone,
  Check,
  Power,
  ChevronRight,
  Filter,
  Eye,
  EyeOff,
} from 'lucide-react';

interface SuperAdminPageProps {
  onBackToMap: () => void;
  onNavigateToLogin: () => void;
}

export const SuperAdminPage: React.FC<SuperAdminPageProps> = ({
  onBackToMap,
  onNavigateToLogin,
}) => {
  const superAdminEmail = (
    import.meta.env.VITE_SUPER_ADMIN_EMAIL ||
    'efatech2@gmail.com'
  )
    .trim()
    .toLowerCase();
  const superAdminPassword = (
    import.meta.env.VITE_SUPER_ADMIN_PASSWORD ||
    ''
  ).trim();

  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const s = getSession();
    const isSuperLocal = localStorage.getItem('is_super_admin') === 'true';
    const emailMatches = s?.email && s.email.toLowerCase() === superAdminEmail;
    return Boolean(isSuperLocal && emailMatches);
  });

  // Login Gate inputs (if not already authenticated)
  const [gateEmail, setGateEmail] = useState('');
  const [gatePassword, setGatePassword] = useState('');
  const [showGatePassword, setShowGatePassword] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);

  // Pharmacy Data
  const [pharmacies, setPharmacies] = useState<Pharmacie[]>(() => loadPharmacies());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedPharmaForModal, setSelectedPharmaForModal] = useState<Pharmacie | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Listen to store updates
  useEffect(() => {
    const unsub = subscribeToStore(() => {
      setPharmacies(loadPharmacies());
    });
    return () => unsub();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleGateLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setGateError(null);

    const cleanE = gateEmail.trim().toLowerCase();
    const cleanP = gatePassword.trim();

    const rateCheck = checkRateLimit('superadmin_gate_login', 5, 60 * 1000, 10 * 60 * 1000);
    if (!rateCheck.allowed) {
      setGateError(`Portail Super Admin verrouillé contre les attaques de force brute. Réessayez dans ${rateCheck.retryAfterSeconds} secondes.`);
      return;
    }

    if (cleanE === superAdminEmail && cleanP === superAdminPassword) {
      localStorage.setItem('is_super_admin', 'true');
      localStorage.setItem('role', 'pharma');
      localStorage.setItem('efa_garde_role', 'pharma');
      setSession({
        role: 'pharma_active',
        pharmaId: pharmacies[0]?.id || 'pharma-1',
        pharmacieNom: 'Super Administration EFA',
        email: cleanE,
        createdAt: new Date().toISOString(),
      });
      setIsAuthenticated(true);
      showToast('Connexion Super Admin réussie');
    } else {
      setGateError('Email ou mot de passe Super Admin invalide. Accès strictement réservé.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('is_super_admin');
    clearSession();
    setIsAuthenticated(false);
    onNavigateToLogin();
  };

  // 1. Action: BOUTON POPULAIRE MENSUEL (15.000F) : couleur GOLD bg-yellow-500
  // Au clic : subscription_plan='premium', subscription_status='active', subscription_start_at=NOW(), subscription_end_at=NOW() + 30 days
  const handleActivatePopulaireMensuel = async (p: Pharmacie) => {
    await activateSubscriptionInDB(p.id, { planType: 'premium_15k' });
    await fetchPharmacies();
    setPharmacies(loadPharmacies());
    showToast(`⭐ "${p.nom}" activée en POPULAIRE MENSUEL (15.000F) pour 30 jours en DB !`);
  };

  // 2. Action: BOUTON POPULAIRE ANNUEL (140.000F) : couleur GOLD dégradé bg-gradient-to-r from-yellow-400 to-yellow-600
  // Au clic : subscription_plan='premium', subscription_status='active', subscription_start_at=NOW(), subscription_end_at=NOW() + 365 days
  const handleActivatePopulaireAnnuel = async (p: Pharmacie) => {
    await activateSubscriptionInDB(p.id, { planType: 'premium_140k' });
    await fetchPharmacies();
    setPharmacies(loadPharmacies());
    showToast(`👑 "${p.nom}" activée en POPULAIRE ANNUEL (140.000F) pour 1 an en DB !`);
  };

  // 3. Action: Activer 1 an (90.000F) => subscription_plan='basic', subscription_status='active', subscription_end_at = now + 365j
  const handleActivate1Year = async (p: Pharmacie) => {
    await activateSubscriptionInDB(p.id, { planType: 'basic_90k' });
    await fetchPharmacies();
    setPharmacies(loadPharmacies());
    showToast(`💼 "${p.nom}" activée pour 1 an STANDARD (90.000F) en DB !`);
  };

  // 4. Action: Activer enregistrement (25.000F) => is_registered=true, is_active=true
  const handleActivateRegistration = async (p: Pharmacie) => {
    const updates: Partial<Pharmacie> = {
      is_registered: true,
      is_active: true,
      statut: 'approved',
      prix: 25000,
    };

    try {
      const client = getSupabaseClient();
      if (client) {
        await client.from('pharmacies').update(updates).eq('id', p.id);
      }
    } catch (err) {
      console.warn('Supabase update warning:', err);
    }

    updatePharmacySuperAdmin(p.id, updates);
    await fetchPharmacies();
    setPharmacies(loadPharmacies());
    showToast(`✅ Enregistrement (25.000F) validé pour "${p.nom}". Officine active.`);
  };

  // 5. Action: Désactiver => is_active=false
  const handleDeactivate = async (p: Pharmacie) => {
    const updates: Partial<Pharmacie> = {
      is_active: false,
    };

    try {
      const client = getSupabaseClient();
      if (client) {
        await client.from('pharmacies').update(updates).eq('id', p.id);
      }
    } catch (err) {
      console.warn('Supabase update warning:', err);
    }

    updatePharmacySuperAdmin(p.id, updates);
    await fetchPharmacies();
    setPharmacies(loadPharmacies());
    showToast(`⛔ "${p.nom}" désactivée.`);
  };

  // 6. Action: Réactiver => is_active=true
  const handleReactivate = async (p: Pharmacie) => {
    const updates: Partial<Pharmacie> = {
      is_active: true,
    };

    try {
      const client = getSupabaseClient();
      if (client) {
        await client.from('pharmacies').update(updates).eq('id', p.id);
      }
    } catch (err) {
      console.warn('Supabase update warning:', err);
    }

    updatePharmacySuperAdmin(p.id, updates);
    await fetchPharmacies();
    setPharmacies(loadPharmacies());
    showToast(`✅ "${p.nom}" réactivée.`);
  };

  // 7. Action: Prolonger (+30 jours)
  const handleExtend = async (p: Pharmacie) => {
    const rawEnd = p.subscription_end_at || p.subscription_end;
    const currentEnd = rawEnd ? new Date(rawEnd) : new Date();
    const baseTime = currentEnd.getTime() > Date.now() ? currentEnd.getTime() : Date.now();
    const newEnd = new Date(baseTime + 30 * 24 * 3600 * 1000);
    const daysLeft = Math.ceil((newEnd.getTime() - Date.now()) / 86400000);
    const updates: Partial<Pharmacie> = {
      is_active: true,
      subscription_status: 'active',
      subscription_end_at: newEnd.toISOString(),
      subscription_end: newEnd.toISOString(),
      subscription_days_left: daysLeft,
    };

    try {
      const client = getSupabaseClient();
      if (client) {
        await client.from('pharmacies').update(updates).eq('id', p.id);
      }
    } catch (err) {
      console.warn('Supabase update warning:', err);
    }

    updatePharmacySuperAdmin(p.id, updates);
    await fetchPharmacies();
    setPharmacies(loadPharmacies());
    showToast(`⏳ Abonnement prolongé de 30 jours pour "${p.nom}" (Fin : ${newEnd.toLocaleDateString('fr-FR')}).`);
  };

  // Computed Stats
  const totalCount = pharmacies.length;
  const activeCount = pharmacies.filter((p) => p.is_active !== false).length;
  const inactiveCount = pharmacies.filter((p) => p.is_active === false).length;

  // Filtered pharmacies
  const filteredPharmacies = pharmacies.filter((p) => {
    const term = searchTerm.toLowerCase().trim();
    const matchName = p.nom.toLowerCase().includes(term);
    const matchEmail = (p.email_pro || '').toLowerCase().includes(term);
    const matchQuartier = (p.quartier || p.adresse || '').toLowerCase().includes(term);
    const matchesSearch = !term || matchName || matchEmail || matchQuartier;

    if (!matchesSearch) return false;

    if (statusFilter === 'active') {
      return p.is_active !== false;
    }
    if (statusFilter === 'inactive') {
      return p.is_active === false;
    }
    return true;
  });

  // Helper formatting subscription end date
  const formatSubscriptionEnd = (p: Pharmacie) => {
    const rawEnd = p.subscription_end_at || p.subscription_end;
    if (!rawEnd) {
      return <span className="text-slate-500 italic text-xs">Non défini</span>;
    }
    const end = new Date(rawEnd);
    const isExpired = end.getTime() < Date.now();
    const daysLeft = Math.ceil((end.getTime() - Date.now()) / (24 * 3600 * 1000));

    return (
      <div className="flex flex-col">
        <span className={`font-mono text-xs font-bold ${isExpired ? 'text-red-400' : 'text-emerald-300'}`}>
          {end.toLocaleDateString('fr-FR')}
        </span>
        <span className="text-[10px] text-slate-400">
          {isExpired ? 'Expiré' : `(reste ${daysLeft}j)`}
        </span>
      </div>
    );
  };

  // If NOT authenticated, render the dedicated Super Admin Gate
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 py-10 px-4 sm:px-6 flex flex-col items-center justify-center font-sans antialiased text-slate-100">
        <div className="w-full max-w-md bg-slate-900 border-2 border-amber-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden animate-in fade-in">
          <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Header */}
          <div className="text-center space-y-2">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold text-2xl shadow-lg">
              👑
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Espace Super Admin
            </h1>
            <p className="text-xs text-amber-200/80 font-medium">
              Accès ultra-sécurisé réservé à l'administration EFA GARDE Togo
            </p>
          </div>

          {gateError && (
            <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-500/60 text-red-200 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{gateError}</span>
            </div>
          )}

          <form onSubmit={handleGateLogin} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300">
                Email Super Admin :
              </label>
              <input
                type="email"
                required
                value={gateEmail}
                onChange={(e) => setGateEmail(e.target.value)}
                placeholder="efatech2@gmail.com"
                className="w-full bg-slate-800 text-white px-4 py-3 rounded-xl border border-slate-700 text-sm focus:outline-none focus:border-amber-400 shadow-inner font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300">
                Mot de passe Super Admin :
              </label>
              <div className="relative">
                <input
                  type={showGatePassword ? "text" : "password"}
                  required
                  value={gatePassword}
                  onChange={(e) => setGatePassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-800 text-white pl-4 pr-10 py-3 rounded-xl border border-slate-700 text-sm focus:outline-none focus:border-amber-400 shadow-inner font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowGatePassword(!showGatePassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-gray-500 hover:text-gray-300 transition-colors p-1"
                  aria-label={showGatePassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                >
                  {showGatePassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full min-h-[50px] py-3.5 px-6 rounded-2xl bg-amber-500 hover:bg-amber-400 active:bg-amber-300 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              <span>Déverrouiller le Super Admin</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </form>

          <div className="pt-2 border-t border-slate-800 text-center">
            <button
              type="button"
              onClick={onNavigateToLogin}
              className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              ← Retour à la connexion pharmacien
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Super Admin Authenticated View
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased pb-20">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-slate-950 font-black px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2 text-xs sm:text-sm animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white p-1.5 flex items-center justify-center shadow-md">
              <Logo className="w-full h-full" variant="blue" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase text-amber-400 tracking-wider">
                  SUPER ADMIN DASHBOARD
                </span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30 font-mono">
                  PROD / TOGO
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Gestion officielle des officines de garde de Lomé
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onBackToMap}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Carte publique</span>
            </button>

            <button
              onClick={handleLogout}
              className="px-3 py-2 rounded-xl bg-red-950/50 hover:bg-red-900/60 border border-red-500/30 text-red-200 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              title="Déconnexion"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Quitter</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* STATS EN HAUT : Total, Actifs, Inactifs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {/* Total */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg flex items-center justify-between">
            <div>
              <span className="text-xs uppercase font-extrabold text-slate-400 tracking-wider">
                Total Pharmacies
              </span>
              <div className="text-2xl sm:text-3xl font-black text-white mt-1">
                {totalCount}
              </div>
              <span className="text-[11px] text-slate-400">
                Officines référencées à Lomé
              </span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold text-xl border border-blue-500/20">
              <Building2 className="w-6 h-6" />
            </div>
          </div>

          {/* Actifs */}
          <div className="bg-slate-900 border border-emerald-500/30 rounded-3xl p-5 shadow-lg flex items-center justify-between bg-gradient-to-br from-slate-900 to-emerald-950/20">
            <div>
              <span className="text-xs uppercase font-extrabold text-emerald-400 tracking-wider">
                Officines Actives
              </span>
              <div className="text-2xl sm:text-3xl font-black text-emerald-300 mt-1">
                {activeCount}
              </div>
              <span className="text-[11px] text-emerald-400/80">
                Visibles et vérifiées sur la carte
              </span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xl border border-emerald-500/40">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>

          {/* Inactifs */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg flex items-center justify-between">
            <div>
              <span className="text-xs uppercase font-extrabold text-slate-400 tracking-wider">
                Officines Inactives
              </span>
              <div className="text-2xl sm:text-3xl font-black text-slate-400 mt-1">
                {inactiveCount}
              </div>
              <span className="text-[11px] text-slate-500">
                Suspendues ou non renouvelées
              </span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center font-bold text-xl border border-slate-700">
              <XCircle className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* SEARCH & FILTERS BAR */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Recherche pharmacie par nom/email */}
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Recherche pharmacie par nom, email, quartier..."
              className="w-full bg-slate-950 text-white pl-11 pr-4 py-3 rounded-2xl border border-slate-800 text-sm focus:outline-none focus:border-amber-400 transition-colors shadow-inner"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3.5 top-3.5 text-xs text-slate-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 shrink-0">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Toutes ({totalCount})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'active'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Actives ({activeCount})
            </button>
            <button
              onClick={() => setStatusFilter('inactive')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'inactive'
                  ? 'bg-slate-800 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Inactives ({inactiveCount})
            </button>
          </div>
        </div>

        {/* TABLEAU : Nom | Email | Quartier | Statut (Actif/Inactif) | Fin Abonnement | Actions */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-xl overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <span>Officines de Lomé</span>
              <span className="text-xs font-mono font-bold bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                {filteredPharmacies.length} affichée(s)
              </span>
            </h2>
            <button
              onClick={() => {
                setPharmacies(loadPharmacies());
                showToast('Liste rafraîchie');
              }}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              title="Rafraîchir les données"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Actualiser</span>
            </button>
          </div>

          {filteredPharmacies.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <p className="text-sm font-semibold">Aucune pharmacie ne correspond à votre recherche.</p>
              <p className="text-xs text-slate-500">Essayez avec un autre mot-clé ou réinitialisez les filtres.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/70 border-b border-slate-800 text-[11px] font-black uppercase text-slate-400 tracking-wider">
                    <th className="py-3.5 px-4 sm:px-6">Nom</th>
                    <th className="py-3.5 px-4">Email</th>
                    <th className="py-3.5 px-4">Quartier</th>
                    <th className="py-3.5 px-4">Statut</th>
                    <th className="py-3.5 px-4">Fin Abonnement</th>
                    <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-xs text-slate-200">
                  {filteredPharmacies.map((p) => {
                    const isActive = p.is_active !== false;
                    const isRegistered = p.is_registered === true || p.statut === 'approved';

                    return (
                      <tr
                        key={p.id}
                        className="hover:bg-slate-800/40 transition-colors"
                      >
                        {/* Nom */}
                        <td className="py-4 px-4 sm:px-6 font-bold text-white">
                          <div className="flex flex-col">
                            <span className="text-sm font-black">{p.nom}</span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                {p.id}
                              </span>
                              {p.plan && (
                                <span className="text-[10px] uppercase font-bold text-slate-400">
                                  Plan: {p.plan}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Email */}
                        <td className="py-4 px-4 font-mono text-slate-300">
                          {p.email_pro ? (
                            <span className="truncate max-w-[160px] block" title={p.email_pro}>
                              {p.email_pro}
                            </span>
                          ) : (
                            <span className="text-slate-500 italic">Non renseigné</span>
                          )}
                        </td>

                        {/* Quartier */}
                        <td className="py-4 px-4 text-slate-300">
                          <span className="font-medium">
                            {p.quartier || p.adresse.split(',')[0] || 'Lomé'}
                          </span>
                        </td>

                        {/* Statut (Actif/Inactif + Plan Badge) */}
                        <td className="py-4 px-4">
                          <div className="flex flex-col gap-1.5 items-start">
                            {isActive ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                Actif
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black bg-slate-800 text-slate-400 border border-slate-700">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                                Inactif
                              </span>
                            )}

                            {/* Badges officiels du plan EFA GARDE */}
                            {p.plan === 'populaire_annuel' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-gradient-to-r from-yellow-400 to-yellow-600 text-slate-950 shadow-xs">
                                👑 POPULAIRE ANNUEL
                              </span>
                            )}
                            {p.plan === 'populaire_mensuel' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-yellow-500 text-slate-950 shadow-xs">
                                ⭐ POPULAIRE MENSUEL
                              </span>
                            )}
                            {(p.plan === 'annual' || p.plan === '60k') && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                💼 90K ANNUEL
                              </span>
                            )}
                            {p.is_registered && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                                📝 ENREGISTREMENT 25K
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Fin Abonnement */}
                        <td className="py-4 px-4">
                          {formatSubscriptionEnd(p)}
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-4 sm:px-6 text-right">
                          <div className="flex items-center justify-end flex-wrap gap-1.5">
                            {/* BOUTON MODAL CHOIX PLAN + DURÉE */}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPharmaForModal(p);
                                setIsModalOpen(true);
                              }}
                              className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-[11px] shadow-sm transition-all cursor-pointer active:scale-95 flex items-center gap-1"
                              title="Ouvrir le modal de sélection plan + durée DB"
                            >
                              <Sparkles className="w-3.5 h-3.5 fill-slate-950" />
                              <span>⚡ Choix plan (Modal)</span>
                            </button>

                            {/* BOUTON POPULAIRE MENSUEL (15.000F) : couleur GOLD bg-yellow-500 */}
                            <button
                              type="button"
                              onClick={() => handleActivatePopulaireMensuel(p)}
                              className="px-2.5 py-1.5 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-black text-[11px] shadow-sm transition-all cursor-pointer active:scale-95"
                              title="Activer POPULAIRE MENSUEL (15.000F / mois, privilèges Gold, position 0)"
                            >
                              ⭐ Populaire Mensuel (15.000F)
                            </button>

                            {/* BOUTON POPULAIRE ANNUEL (140.000F) : couleur GOLD dégradé bg-gradient-to-r from-yellow-400 to-yellow-600 */}
                            <button
                              type="button"
                              onClick={() => handleActivatePopulaireAnnuel(p)}
                              className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-600 hover:from-yellow-300 hover:to-yellow-500 text-slate-950 font-black text-[11px] shadow-md transition-all cursor-pointer active:scale-95"
                              title="Activer POPULAIRE ANNUEL (140.000F / an, privilèges Gold, position 0)"
                            >
                              👑 Populaire Annuel (140.000F)
                            </button>

                            {/* Activer 1 an 90k */}
                            <button
                              type="button"
                              onClick={() => handleActivate1Year(p)}
                              className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 hover:text-white font-bold text-[11px] transition-all cursor-pointer shadow-xs active:scale-95"
                              title="Activer l'officine pour 1 an (90.000 FCFA)"
                            >
                              💼 Activer 1 an (90.000F)
                            </button>

                            {/* Activer enregistrement (25.000F) */}
                            <button
                              type="button"
                              onClick={() => handleActivateRegistration(p)}
                              className="px-2.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 hover:text-white font-bold text-[11px] transition-all cursor-pointer shadow-xs active:scale-95"
                              title="Valider l'enregistrement officiel (25.000 FCFA)"
                            >
                              📝 Activer enreg. (25.000F)
                            </button>

                            {/* Prolonger +30j */}
                            <button
                              type="button"
                              onClick={() => handleExtend(p)}
                              className="px-2.5 py-1.5 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-300 hover:text-white font-bold text-[11px] transition-all cursor-pointer shadow-xs active:scale-95"
                              title="Prolonger l'abonnement de 30 jours"
                            >
                              ⏳ Prolonger +30j
                            </button>

                            {/* Désactiver / Réactiver toggle */}
                            {isActive ? (
                              <button
                                type="button"
                                onClick={() => handleDeactivate(p)}
                                className="px-2.5 py-1.5 rounded-xl bg-red-950/60 hover:bg-red-900 border border-red-500/40 text-red-300 font-bold text-[11px] transition-all cursor-pointer shadow-xs active:scale-95"
                                title="Désactiver l'officine"
                              >
                                Désactiver
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleReactivate(p)}
                                className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition-all cursor-pointer shadow-xs active:scale-95"
                                title="Réactiver l'officine"
                              >
                                Réactiver
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Modal d'activation abonnement direct en DB */}
      <ActivateSubscriptionModal
        isOpen={isModalOpen}
        pharmacie={selectedPharmaForModal}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedPharmaForModal(null);
        }}
        onSuccess={async (updated) => {
          await fetchPharmacies();
          setPharmacies(loadPharmacies());
          showToast(`⚡ Abonnement de "${updated.nom}" activé avec succès en DB ! Compte à rebours synchronisé.`);
        }}
      />
    </div>
  );
};

export default SuperAdminPage;
