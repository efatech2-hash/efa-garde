/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Pharmacie } from './types';
import {
  loadAllPharmaciesWithPending,
  subscribeToStore,
  cleanExpiredMessages,
} from './services/store';
import { getSession, clearSession, setSession } from './lib/auth';
import { Map } from './pages/Map';
import { DashboardPharma } from './pages/DashboardPharma';
import { PharmacienLoginPage } from './pages/PharmacienLoginPage';
import { ClientChatPage } from './pages/ClientChatPage';
import { PharmaInboxPage } from './pages/PharmaInboxPage';
import { SubscriptionPage } from './pages/SubscriptionPage';
import { QrPage } from './pages/QrPage';
import { AppMobile } from './pages/AppMobile';
import { EspacePubPage } from './pages/EspacePubPage';
import { ProfilePage } from './pages/ProfilePage';
import { PharmacienRegisterPage } from './pages/PharmacienRegisterPage';
import { PaiementInscriptionPage } from './pages/PaiementInscriptionPage';
import { AdminPharmaciesPage } from './pages/AdminPharmaciesPage';
import { hasValidRegistrationPaymentToken } from './lib/paymentTokens';
import { Splash } from './pages/Splash';
import { Logo } from './components/Logo';
import { BottomNav } from './components/BottomNav';
import { Sidebar } from './components/Sidebar';
import { WelcomeModal } from './components/WelcomeModal';
import { supabase } from './lib/supabase';
import {
  LogOut,
  Shield,
  User,
  MapPin,
  Megaphone,
  Phone,
  MessageCircle,
  X,
  ChevronRight,
} from 'lucide-react';

export default function App() {
  const [pharmacies, setPharmacies] = useState<Pharmacie[]>(() =>
    loadAllPharmaciesWithPending()
  );
  const [activePharmaId, setActivePharmaId] = useState<string>(() => {
    return (
      localStorage.getItem('pharma_id') ||
      localStorage.getItem('efa_active_pharma_id') ||
      'pharma-1'
    );
  });

  // Splash Screen & Auth Lifecycle
  const [showSplash, setShowSplash] = useState(true);
  const [session, setLocalSession] = useState(() => getSession());

  // Welcome modal trigger : si aucun rôle n'a encore été choisi
  const [showWelcomeModal, setShowWelcomeModal] = useState<boolean>(() => {
    return (
      localStorage.getItem('efa_garde_role') == null &&
      localStorage.getItem('role') == null
    );
  });

  // Current Route State
  const [currentPath, setCurrentPath] = useState<string>(() => {
    const path = window.location.pathname || '/';
    return path === '' ? '/' : path;
  });

  const [chatPharmaId, setChatPharmaId] = useState<string>('pharma-1');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Fermer le menu profil si clic en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setShowProfileMenu(false);
      }
    };
    if (showProfileMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProfileMenu]);

  const navigateTo = (path: string) => {
    if (path.startsWith('/chat/')) {
      const id = path.replace('/chat/', '');
      setChatPharmaId(id);
    }
    setCurrentPath(path);
    window.history.pushState(null, '', path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Active Pharmacie & Role Resolver
  const activePharma =
    pharmacies.find((p) => p.id === activePharmaId) || pharmacies[0];

  const storedRole =
    localStorage.getItem('efa_garde_role') ||
    localStorage.getItem('role') ||
    session?.role;

  const isPharmaUser =
    storedRole === 'pharma' ||
    session?.role === 'pharma' ||
    session?.role === 'pharma_active' ||
    session?.role === 'pharma_pending';

  const userRole: 'client' | 'pharma' | 'pharma_active' | 'pharma_pending' =
    session?.role === 'pharma_pending'
      ? 'pharma_pending'
      : isPharmaUser
      ? 'pharma_active'
      : 'client';

  // Auto-nettoyage des messages de plus de 48h
  useEffect(() => {
    cleanExpiredMessages();
    const interval = setInterval(() => {
      cleanExpiredMessages();
    }, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Sync route on browser navigation & hash
  useEffect(() => {
    const handlePopState = () => {
      const pathname = window.location.pathname || '/';
      const hash = window.location.hash.replace('#', '');
      const active = hash
        ? hash.startsWith('/')
          ? hash
          : `/${hash}`
        : pathname;

      if (active.startsWith('/chat/')) {
        const id = active.replace('/chat/', '');
        setChatPharmaId(id);
      }
      setCurrentPath(active);
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);
    handlePopState();

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
    };
  }, []);

  // Subscribe to store updates
  useEffect(() => {
    const unsubscribe = subscribeToStore(() => {
      setPharmacies(loadAllPharmaciesWithPending());
    });
    return () => unsubscribe();
  }, []);

  // 3. GLOBAL RESPONSIVE : Body overflow-hidden sur page chat, overflow-auto ailleurs
  useEffect(() => {
    if (currentPath.startsWith('/chat')) {
      document.body.classList.add('overflow-hidden');
      document.body.classList.remove('overflow-auto');
    } else {
      document.body.classList.remove('overflow-hidden');
      document.body.classList.add('overflow-auto');
    }
    return () => {
      document.body.classList.remove('overflow-hidden');
      document.body.classList.add('overflow-auto');
    };
  }, [currentPath]);

  // 3. SECURITE : Route /ajouter-pharmacie & /pro : bloque si role != pharmacien valide (redirect /home)
  useEffect(() => {
    const isRestrictedRoute =
      currentPath === '/ajouter-pharmacie' ||
      currentPath === '/pro' ||
      currentPath === '/dashboard';

    if (isRestrictedRoute && !isPharmaUser) {
      navigateTo('/home');
    }
  }, [currentPath, isPharmaUser]);

  // SECURITE : /enregistrer-pharmacie bloqué si pas de token paiement 25k valide (redirect /paiement-inscription)
  useEffect(() => {
    const isEnregistrerRoute =
      currentPath === '/enregistrer-pharmacie' ||
      currentPath === '/Enregistrer-pharmacie';

    if (isEnregistrerRoute && !hasValidRegistrationPaymentToken()) {
      navigateTo('/paiement-inscription?reason=token_required');
    }
  }, [currentPath]);

  // AUTO REDIRECTION AU DÉMARRAGE (useEffect)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isFirstConfirm = params.get('first') === 'true';
    const hash = window.location.hash;
    const hasAuthToken =
      hash.includes('access_token') || hash.includes('type=signup');
    const path = window.location.pathname || '/';

    // A. Si redirection depuis email avec ?first=true ou access token
    if (isFirstConfirm || hasAuthToken || path === '/pharma/dashboard') {
      const targetPharmaId =
        localStorage.getItem('pharma_id') ||
        localStorage.getItem('efa_active_pharma_id') ||
        'pharma-1';

      localStorage.setItem('role', 'pharma');
      localStorage.setItem('efa_garde_role', 'pharma');
      localStorage.setItem('pharma_id', targetPharmaId);

      const targetPharma =
        pharmacies.find((p) => p.id === targetPharmaId) || pharmacies[0];

      const newSession = {
        role: 'pharma_active' as const,
        pharmaId: targetPharmaId,
        pharmacieNom: targetPharma?.nom || 'Pharmacie de Garde',
        createdAt: new Date().toISOString(),
      };

      setSession(newSession);
      setLocalSession(newSession);
      setActivePharmaId(targetPharmaId);
      setShowWelcomeModal(false);
      navigateTo('/pharma/dashboard');
      return;
    }

    // B. Vérification du rôle stocké
    const storedRole =
      localStorage.getItem('efa_garde_role') || localStorage.getItem('role');

    if (storedRole === 'client') {
      if (path === '/' || path === '') {
        navigateTo('/client');
      }
    } else if (storedRole === 'pharma') {
      const activeSess = getSession();
      if (
        activeSess &&
        (activeSess.role === 'pharma' ||
          activeSess.role === 'pharma_active') &&
        activeSess.pharmaId
      ) {
        if (path === '/' || path === '') {
          navigateTo('/pharma/dashboard');
        }
      } else {
        if (path === '/' || path === '') {
          navigateTo('/pharma/dashboard');
        }
      }
    } else {
      // Aucun rôle existant -> Affichage du Welcome Modal
      setShowWelcomeModal(true);
    }
  }, []);

  const handleSelectActivePharma = (id: string) => {
    setActivePharmaId(id);
    localStorage.setItem('pharma_id', id);
    localStorage.setItem('efa_active_pharma_id', id);
  };

  const handleLogout = () => {
    clearSession();
    setLocalSession(null);
    localStorage.removeItem('role');
    localStorage.removeItem('efa_garde_role');
    localStorage.removeItem('pharma_id');
    setShowWelcomeModal(true);
    navigateTo('/');
  };

  // 1. WELCOME MODAL ACTIONS
  const handleWelcomeSelectClient = () => {
    localStorage.setItem('role', 'client');
    localStorage.setItem('efa_garde_role', 'client');
    const guestSession = {
      role: 'client' as const,
      phone: 'Client Lomé',
      createdAt: new Date().toISOString(),
    };
    setSession(guestSession);
    setLocalSession(guestSession);
    setShowWelcomeModal(false);
    navigateTo('/client');
  };

  const handleWelcomeSelectPharma = () => {
    setShowWelcomeModal(false);
    navigateTo('/pharma/login');
  };

  const handleAuthPharmaSuccess = (pharmaId: string) => {
    localStorage.setItem('role', 'pharma');
    localStorage.setItem('efa_garde_role', 'pharma');
    localStorage.setItem('pharma_id', pharmaId);
    localStorage.setItem('efa_active_pharma_id', pharmaId);

    const s = getSession();
    setLocalSession(s);
    setActivePharmaId(pharmaId);
    setShowWelcomeModal(false);
    navigateTo('/pharma/dashboard');
  };

  // 1. SPLASH SCREEN: Logo centré sur fond blanc, 1.8s
  if (showSplash) {
    return (
      <Splash
        duration={1800}
        onComplete={() => {
          setShowSplash(false);
          const storedRole =
            localStorage.getItem('efa_garde_role') ||
            localStorage.getItem('role');
          const activeSession = getSession();
          setLocalSession(activeSession);

          const params = new URLSearchParams(window.location.search);
          if (params.get('first') === 'true') {
            navigateTo('/pharma/dashboard');
            return;
          }

          if (storedRole === 'pharma') {
            if (activeSession?.pharmaId) {
              setActivePharmaId(activeSession.pharmaId);
            }
            if (
              window.location.pathname === '/' ||
              window.location.pathname === ''
            ) {
              navigateTo('/pharma/dashboard');
            }
          } else if (storedRole === 'client') {
            if (
              window.location.pathname === '/' ||
              window.location.pathname === ''
            ) {
              navigateTo('/client');
            }
          } else {
            setShowWelcomeModal(true);
          }
        }}
      />
    );
  }

  // Route Content Resolver
  let content = null;
  if (
    currentPath === '/' ||
    currentPath === '/home' ||
    currentPath === '/carte' ||
    currentPath === '/client' ||
    currentPath === '/map'
  ) {
    content = (
      <Map
        pharmacies={pharmacies}
        onOpenChat={(id) => navigateTo(`/chat/${id}`)}
        onRefresh={() => setPharmacies(loadAllPharmaciesWithPending())}
      />
    );
  } else if (currentPath === '/ajouter-pharmacie') {
    // 3. SECURITE : Route /ajouter-pharmacie : bloque si role != pharmacien valide (redirect /home)
    if (!isPharmaUser) {
      setTimeout(() => navigateTo('/home'), 0);
      content = (
        <Map
          pharmacies={pharmacies}
          onOpenChat={(id) => navigateTo(`/chat/${id}`)}
          onRefresh={() => setPharmacies(loadAllPharmaciesWithPending())}
        />
      );
    } else {
      content = (
        <PharmacienRegisterPage
          onSuccess={() => {
            setPharmacies(loadAllPharmaciesWithPending());
            navigateTo('/pharma/dashboard');
          }}
          onNavigateToLogin={() => navigateTo('/pharma/dashboard')}
          onNavigateToPayment={() => navigateTo('/paiement-inscription')}
          onBackToMap={() => navigateTo('/pharma/dashboard')}
        />
      );
    }
  } else if (
    currentPath.startsWith('/paiement-inscription') ||
    currentPath === '/paiement'
  ) {
    // PAGE PAIEMENT 25.000F : Enregistrement Officine Lomé - 25.000 FCFA
    content = (
      <PaiementInscriptionPage
        onSuccess={() => {
          navigateTo('/enregistrer-pharmacie');
        }}
        onBackToLogin={() => navigateTo('/pharma/login')}
      />
    );
  } else if (
    currentPath === '/enregistrer-pharmacie' ||
    currentPath === '/Enregistrer-pharmacie'
  ) {
    // FORMULAIRE ENREGISTRER PHARMACIE : vérifie token 25k
    // Si pas de token paiement => bloqué, redirect /paiement-inscription
    if (!hasValidRegistrationPaymentToken()) {
      setTimeout(() => navigateTo('/paiement-inscription?reason=token_required'), 0);
      content = (
        <PaiementInscriptionPage
          onSuccess={() => {
            navigateTo('/enregistrer-pharmacie');
          }}
          onBackToLogin={() => navigateTo('/pharma/login')}
        />
      );
    } else {
      content = (
        <PharmacienRegisterPage
          onSuccess={() => {
            setPharmacies(loadAllPharmaciesWithPending());
          }}
          onNavigateToLogin={() => navigateTo('/pharma/login')}
          onNavigateToPayment={() => navigateTo('/paiement-inscription')}
          onBackToMap={() => navigateTo('/home')}
        />
      );
    }
  } else if (currentPath === '/pro' || currentPath === '/dashboard') {
    if (isPharmaUser) {
      content = (
        <DashboardPharma
          onNavigate={(tab) =>
            navigateTo(tab === 'dashboard' ? '/pharma/dashboard' : `/${tab}`)
          }
          onRefresh={() => setPharmacies(loadAllPharmaciesWithPending())}
        />
      );
    } else {
      setTimeout(() => navigateTo('/home'), 0);
      content = (
        <Map
          pharmacies={pharmacies}
          onOpenChat={(id) => navigateTo(`/chat/${id}`)}
          onRefresh={() => setPharmacies(loadAllPharmaciesWithPending())}
        />
      );
    }
  } else if (currentPath === '/admin' || currentPath === '/admin/pharmacies') {
    content = (
      <AdminPharmaciesPage
        onBackToMap={() => navigateTo('/home')}
        onRefresh={() => setPharmacies(loadAllPharmaciesWithPending())}
      />
    );
  } else if (currentPath === '/pharma/login') {
    content = (
      <PharmacienLoginPage
        onSuccess={handleAuthPharmaSuccess}
        onBackToMap={() => navigateTo('/home')}
        onNavigateToRegister={() =>
          navigateTo('/paiement-inscription?plan=enregistrement_lome')
        }
      />
    );
  } else if (
    currentPath === '/pharma/dashboard' ||
    currentPath === '/dashboard-pharma'
  ) {
    content = (
      <DashboardPharma
        onNavigate={(tab) =>
          navigateTo(tab === 'dashboard' ? '/pharma/dashboard' : `/${tab}`)
        }
        onRefresh={() => setPharmacies(loadAllPharmaciesWithPending())}
      />
    );
  } else if (
    currentPath === '/pub' ||
    currentPath === '/app-mobile' ||
    currentPath === '/download'
  ) {
    content = <EspacePubPage onBackToMap={() => navigateTo('/client')} />;
  } else if (currentPath.startsWith('/chat')) {
    content = (
      <ClientChatPage
        pharmacieId={chatPharmaId}
        pharmacies={pharmacies}
        onBack={() => navigateTo('/client')}
      />
    );
  } else if (currentPath === '/inbox') {
    content = (
      <PharmaInboxPage
        pharmacies={pharmacies}
        activePharmaId={activePharmaId}
        onSelectActivePharma={handleSelectActivePharma}
      />
    );
  } else if (currentPath === '/abonnement') {
    content = (
      <SubscriptionPage
        pharmacies={pharmacies}
        activePharmaId={activePharmaId}
        onSelectActivePharma={handleSelectActivePharma}
        onRefresh={() => setPharmacies(loadAllPharmaciesWithPending())}
      />
    );
  } else if (currentPath === '/qr') {
    content = (
      <QrPage
        pharmacies={pharmacies}
        activePharmaId={activePharmaId}
        onSelectActivePharma={handleSelectActivePharma}
        onNavigate={(tab) => navigateTo(`/${tab}`)}
      />
    );
  } else if (currentPath === '/profil') {
    content = (
      <ProfilePage
        pharmacies={pharmacies}
        activePharmaId={activePharmaId}
        onNavigate={navigateTo}
        onLogout={handleLogout}
      />
    );
  } else {
    content = (
      <Map
        pharmacies={pharmacies}
        onOpenChat={(id) => navigateTo(`/chat/${id}`)}
        onRefresh={() => setPharmacies(loadAllPharmaciesWithPending())}
      />
    );
  }

  // Fullscreen WhatsApp chat mode (100dvh)
  const isChatRoute = currentPath.startsWith('/chat');
  if (isChatRoute) {
    return (
      <div className="h-[100dvh] w-full bg-[#0b141a] text-slate-100 flex flex-col overflow-hidden">
        {content}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex font-sans antialiased">
      {/* Desktop Sidebar (Role Filtered) */}
      <Sidebar
        role={userRole}
        currentPath={currentPath}
        onNavigate={navigateTo}
        onLogout={handleLogout}
      />

      {/* Main App Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header: Logo petit à gauche + EFA GARDE */}
        <header className="sticky top-0 z-[800] bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shadow-md w-full overflow-x-hidden">
          <div className="w-full max-w-7xl mx-auto px-2.5 sm:px-6 h-16 flex items-center justify-between gap-2 overflow-x-hidden">
            {/* Header Brand */}
            <div
              onClick={() =>
                navigateTo(
                  userRole === 'client' ? '/client' : '/pharma/dashboard'
                )
              }
              className="flex items-center gap-2 sm:gap-3 cursor-pointer select-none group min-w-0 shrink"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white p-1 flex items-center justify-center shadow-md shadow-blue-900/40 group-hover:scale-105 transition-transform border border-slate-200 shrink-0">
                <Logo className="w-full h-full" variant="blue" />
              </div>
              <div className="min-w-0 truncate">
                <div className="text-sm sm:text-lg font-black tracking-tight text-white flex items-center gap-1 sm:gap-1.5 truncate">
                  EFA GARDE
                  <span className="text-[9px] sm:text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-[#0b5cb5]/20 text-[#3b82f6] border border-[#0b5cb5]/30">
                    LOMÉ
                  </span>
                </div>
                <div className="text-[9px] sm:text-[10px] text-slate-400 font-medium truncate">
                  {userRole === 'client'
                    ? 'Pharmacies de Garde 24/7'
                    : 'Espace Pharmacien'}
                </div>
              </div>
            </div>

            {/* Right Tools */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* BOUTON SWITCH EN HAUT ANGLE PHARMA : icone 👁️ "Voir comme client" */}
              {isPharmaUser && (
                <button
                  onClick={() => navigateTo('/client')}
                  className="flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 hover:text-white border border-blue-500/40 text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
                  title="Voir l'application comme un patient (sans effacer votre rôle pharmacie)"
                >
                  <span className="text-sm">👁️</span>
                  <span className="hidden md:inline">Vue client</span>
                </button>
              )}

              {/* Statut de garde actif si pharmacie connectée */}
              {isPharmaUser && activePharma && (
                <div
                  onClick={() => navigateTo('/pharma/dashboard')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition-all shrink-0 ${
                    activePharma.is_online
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                  title="Gérer le statut de garde"
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      activePharma.is_online
                        ? 'bg-emerald-400 animate-pulse'
                        : 'bg-slate-500'
                    }`}
                  />
                  <span className="text-[10px] sm:text-xs uppercase font-extrabold">
                    {activePharma.is_online ? 'ON' : 'OFF'}
                  </span>
                </div>
              )}

              {/* Bouton DECONNEXION TOUJOURS VISIBLE en haut à droite mobile */}
              {isPharmaUser && (
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-300 hover:text-white border border-red-500/40 text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
                  title="Déconnexion Pharmacien"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="text-[11px] sm:text-xs">Quitter</span>
                </button>
              )}

              {/* CÔTÉ CLIENT : Menu PROFIL en haut à droite (avatar) */}
              {!isPharmaUser && (
                <div className="relative" ref={profileMenuRef}>
                  <button
                    onClick={() => setShowProfileMenu((prev) => !prev)}
                    className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-md active:scale-95 ${
                      showProfileMenu
                        ? 'bg-[#0A3D8F] text-white ring-2 ring-blue-400 shadow-blue-900/50'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                    }`}
                    title="Menu Profil"
                    aria-label="Menu Profil"
                  >
                    <User className="w-4 h-4 sm:w-5 sm:h-5 text-current" />
                  </button>

                  {/* Dropdown Menu PROFIL */}
                  {showProfileMenu && (
                    <div className="absolute right-0 mt-2 w-80 sm:w-88 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-3 z-[999] animate-in fade-in slide-in-from-top-2 duration-150 space-y-2">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800 px-1">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-[#0A3D8F] text-white flex items-center justify-center text-xs font-bold">
                            <User className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white leading-tight">
                              Menu EFA GARDE
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Lomé • Patient 24/7
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => setShowProfileMenu(false)}
                          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* 1. Pharmacie de garde Lomé */}
                      <button
                        onClick={() => {
                          navigateTo('/client');
                          setShowProfileMenu(false);
                        }}
                        className="w-full p-2.5 rounded-xl hover:bg-slate-800/80 transition-all text-left flex items-center justify-between group cursor-pointer border border-transparent hover:border-slate-700"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                            <MapPin className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white group-hover:text-blue-300 transition-colors">
                              Pharmacie de garde Lomé
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Voir la carte et les officines ouvertes
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
                      </button>

                      {/* 2. Espace publicitaire */}
                      <button
                        onClick={() => {
                          navigateTo('/pub');
                          setShowProfileMenu(false);
                        }}
                        className="w-full p-2.5 rounded-xl hover:bg-slate-800/80 transition-all text-left flex items-center justify-between group cursor-pointer border border-transparent hover:border-slate-700"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                            <Megaphone className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
                              Espace publicitaire
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Offres partenaires santé & bien-être
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
                      </button>

                      {/* 3 & 4. Numéros utiles & Urgences médicales Lomé */}
                      <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
                        <div className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Numéros utiles & Urgences médicales Lomé</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1 text-center pt-0.5">
                          <a
                            href="tel:118"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-white font-bold transition-colors border border-slate-700 block"
                          >
                            <div className="text-xs text-red-400 font-extrabold">118</div>
                            <div className="text-[9px] text-slate-400 font-normal">Pompiers</div>
                          </a>
                          <a
                            href="tel:170"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-white font-bold transition-colors border border-slate-700 block"
                          >
                            <div className="text-xs text-blue-400 font-extrabold">170</div>
                            <div className="text-[9px] text-slate-400 font-normal">Police</div>
                          </a>
                          <a
                            href="tel:22251515"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-white font-bold transition-colors border border-slate-700 block"
                          >
                            <div className="text-xs text-emerald-400 font-extrabold truncate">22 25 15 15</div>
                            <div className="text-[9px] text-slate-400 font-normal">SAMU</div>
                          </a>
                        </div>
                      </div>

                      {/* 5. Bouton WhatsApp assistance EFA : dirige vers WhatsApp +22896100972 */}
                      <a
                        href="https://wa.me/22896100972"
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setShowProfileMenu(false)}
                        className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
                      >
                        <MessageCircle className="w-4 h-4 fill-current" />
                        <span>WhatsApp assistance EFA (+228 96 10 09 72)</span>
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 w-full overflow-x-hidden">{content}</main>
      </div>

      {/* MOBILE BOTTOM NAVIGATION */}
      <BottomNav
        role={userRole}
        currentPath={currentPath}
        onNavigate={navigateTo}
      />

      {/* 1. WELCOME MODAL PREMIER LANCEMENT */}
      <WelcomeModal
        isOpen={showWelcomeModal}
        onSelectClient={handleWelcomeSelectClient}
        onSelectPharma={handleWelcomeSelectPharma}
      />
    </div>
  );
}
