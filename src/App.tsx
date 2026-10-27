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
import { SuperAdminPage } from './pages/SuperAdminPage';
import { hasValidRegistrationPaymentToken } from './lib/paymentTokens';
import { Splash } from './pages/Splash';
import { PharmaStatsPage } from './pages/PharmaStatsPage';
import { Logo } from './components/Logo';
import { BottomNav } from './components/BottomNav';
import { Sidebar } from './components/Sidebar';
import { WelcomeModal } from './components/WelcomeModal';
import { LegalOnboardingModal } from './components/LegalOnboardingModal';
import { hasUserConsentSync, checkUserConsent } from './services/consentService';
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
  BarChart3,
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

  // Legal Onboarding Modal (Premier Lancement bloquant avant d'accéder à la carte)
  const [showLegalConsent, setShowLegalConsent] = useState<boolean>(
    () => !hasUserConsentSync()
  );

  // Vérification de secours asynchrone (check localStorage + Supabase user_consents)
  useEffect(() => {
    if (!hasUserConsentSync()) {
      checkUserConsent().then((consented) => {
        if (consented) {
          setShowLegalConsent(false);
        }
      });
    }
  }, []);

  // Current Route State
  const [currentPath, setCurrentPath] = useState<string>(() => {
    const path = window.location.pathname || '/';
    return path === '' ? '/' : path;
  });

  const [chatPharmaId, setChatPharmaId] = useState<string>('pharma-1');


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

  const superAdminEnvEmail = (
    import.meta.env.VITE_SUPER_ADMIN_EMAIL || 'efatech2@gmail.com'
  )
    .trim()
    .toLowerCase();

  const isSuperAdminUser =
    localStorage.getItem('is_super_admin') === 'true' &&
    session?.email?.trim().toLowerCase() === superAdminEnvEmail;

  const userRole: 'client' | 'pharma' | 'pharma_active' | 'pharma_pending' =
    session?.role === 'pharma_pending'
      ? 'pharma_pending'
      : isPharmaUser
      ? 'pharma_active'
      : 'client';

  // Auto-nettoyage des messages et photos de plus de 24h (cycle auto-delete 24h)
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

  // 3. SECURITE : Routes pharmacien protégées : redirige vers /pharma/login si rôle invalide ou non connecté
  useEffect(() => {
    const isPharmaRestrictedRoute =
      currentPath === '/ajouter-pharmacie' ||
      currentPath === '/pro' ||
      currentPath === '/dashboard' ||
      currentPath === '/pharma/dashboard' ||
      currentPath === '/dashboard-pharma' ||
      currentPath === '/inbox' ||
      currentPath === '/abonnement' ||
      currentPath === '/qr' ||
      currentPath === '/profil' ||
      currentPath === '/pharma/stats' ||
      currentPath === '/stats' ||
      currentPath === '/statistiques';

    if (isPharmaRestrictedRoute && !isPharmaUser) {
      navigateTo('/pharma/login');
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

  // SECURITE : /super-admin & /admin accessible UNIQUEMENT au super admin (redirection vers /login si non autorisé)
  useEffect(() => {
    const isSuperRoute =
      currentPath === '/super-admin' ||
      currentPath === '/superadmin' ||
      currentPath === '/admin' ||
      currentPath === '/admin/pharmacies';

    if (isSuperRoute) {
      const activeSess = getSession();
      const superAdminEnvEmail = (
        import.meta.env.VITE_SUPER_ADMIN_EMAIL ||
        'efatech2@gmail.com'
      )
        .trim()
        .toLowerCase();
      const isSuper =
        localStorage.getItem('is_super_admin') === 'true' &&
        activeSess?.email &&
        activeSess.email.trim().toLowerCase() === superAdminEnvEmail;

      if (!isSuper) {
        navigateTo('/login');
      }
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

  // 0. LEGAL CONSENT ACCEPTED (Premier Lancement)
  const handleLegalConsentAccepted = () => {
    setShowLegalConsent(false);
    const storedRole =
      localStorage.getItem('efa_garde_role') || localStorage.getItem('role');
    if (!storedRole) {
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
    }
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

  // Route /super-admin : Super Admin Dashboard caché
  if (currentPath === '/super-admin' || currentPath === '/superadmin') {
    return (
      <SuperAdminPage
        onBackToMap={() => navigateTo('/home')}
        onNavigateToLogin={() => navigateTo('/login')}
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
          onNavigate={(tab) => {
            const clean = tab.startsWith('/') ? tab : `/${tab}`;
            navigateTo(clean === '/dashboard' ? '/pharma/dashboard' : clean);
          }}
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
    if (isSuperAdminUser) {
      content = (
        <AdminPharmaciesPage
          onBackToMap={() => navigateTo('/home')}
          onRefresh={() => setPharmacies(loadAllPharmaciesWithPending())}
        />
      );
    } else {
      setTimeout(() => navigateTo('/login'), 0);
      content = (
        <PharmacienLoginPage
          onSuccess={handleAuthPharmaSuccess}
          onBackToMap={() => navigateTo('/home')}
          onNavigateToRegister={() =>
            navigateTo('/paiement-inscription?plan=enregistrement_lome')
          }
        />
      );
    }
  } else if (
    currentPath === '/pharma/login' ||
    currentPath === '/login' ||
    currentPath === '/connexion'
  ) {
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
    if (isPharmaUser) {
      content = (
        <DashboardPharma
          onNavigate={(tab) => {
            const clean = tab.startsWith('/') ? tab : `/${tab}`;
            navigateTo(clean === '/dashboard' ? '/pharma/dashboard' : clean);
          }}
          onRefresh={() => setPharmacies(loadAllPharmaciesWithPending())}
        />
      );
    } else {
      setTimeout(() => navigateTo('/pharma/login'), 0);
      content = (
        <PharmacienLoginPage
          onSuccess={handleAuthPharmaSuccess}
          onBackToMap={() => navigateTo('/home')}
          onNavigateToRegister={() =>
            navigateTo('/paiement-inscription?plan=enregistrement_lome')
          }
        />
      );
    }
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
    if (isPharmaUser) {
      content = (
        <PharmaInboxPage
          pharmacies={pharmacies}
          activePharmaId={activePharmaId}
          onSelectActivePharma={handleSelectActivePharma}
        />
      );
    } else {
      setTimeout(() => navigateTo('/pharma/login'), 0);
      content = (
        <PharmacienLoginPage
          onSuccess={handleAuthPharmaSuccess}
          onBackToMap={() => navigateTo('/home')}
          onNavigateToRegister={() =>
            navigateTo('/paiement-inscription?plan=enregistrement_lome')
          }
        />
      );
    }
  } else if (currentPath === '/abonnement') {
    if (isPharmaUser) {
      content = (
        <SubscriptionPage
          pharmacies={pharmacies}
          activePharmaId={activePharmaId}
          onSelectActivePharma={handleSelectActivePharma}
          onRefresh={() => setPharmacies(loadAllPharmaciesWithPending())}
        />
      );
    } else {
      setTimeout(() => navigateTo('/pharma/login'), 0);
      content = (
        <PharmacienLoginPage
          onSuccess={handleAuthPharmaSuccess}
          onBackToMap={() => navigateTo('/home')}
          onNavigateToRegister={() =>
            navigateTo('/paiement-inscription?plan=enregistrement_lome')
          }
        />
      );
    }
  } else if (
    currentPath === '/pharma/stats' ||
    currentPath === '/stats' ||
    currentPath === '/statistiques'
  ) {
    if (isPharmaUser) {
      content = (
        <PharmaStatsPage
          pharmacies={pharmacies}
          activePharmaId={activePharmaId}
          onSelectActivePharma={handleSelectActivePharma}
          onNavigate={navigateTo}
        />
      );
    } else {
      setTimeout(() => navigateTo('/pharma/login'), 0);
      content = (
        <PharmacienLoginPage
          onSuccess={handleAuthPharmaSuccess}
          onBackToMap={() => navigateTo('/home')}
          onNavigateToRegister={() =>
            navigateTo('/paiement-inscription?plan=enregistrement_lome')
          }
        />
      );
    }
  } else if (currentPath === '/qr') {
    if (isPharmaUser) {
      content = (
        <QrPage
          pharmacies={pharmacies}
          activePharmaId={activePharmaId}
          onSelectActivePharma={handleSelectActivePharma}
          onNavigate={(tab) => navigateTo(`/${tab}`)}
        />
      );
    } else {
      setTimeout(() => navigateTo('/pharma/login'), 0);
      content = (
        <PharmacienLoginPage
          onSuccess={handleAuthPharmaSuccess}
          onBackToMap={() => navigateTo('/home')}
          onNavigateToRegister={() =>
            navigateTo('/paiement-inscription?plan=enregistrement_lome')
          }
        />
      );
    }
  } else if (currentPath === '/profil') {
    if (isPharmaUser) {
      content = (
        <ProfilePage
          pharmacies={pharmacies}
          activePharmaId={activePharmaId}
          onNavigate={navigateTo}
          onLogout={handleLogout}
        />
      );
    } else {
      setTimeout(() => navigateTo('/pharma/login'), 0);
      content = (
        <PharmacienLoginPage
          onSuccess={handleAuthPharmaSuccess}
          onBackToMap={() => navigateTo('/home')}
          onNavigateToRegister={() =>
            navigateTo('/paiement-inscription?plan=enregistrement_lome')
          }
        />
      );
    }
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
    <div
      className={`min-h-screen bg-slate-950 text-slate-100 flex font-sans antialiased ${
        currentPath === '/inbox' ? 'h-screen max-h-screen overflow-hidden' : ''
      }`}
    >
      {/* Desktop Sidebar (Role Filtered) */}
      <Sidebar
        role={userRole}
        currentPath={currentPath}
        onNavigate={navigateTo}
        onLogout={handleLogout}
      />

      {/* Main App Container */}
      <div
        className={`flex-1 flex flex-col min-w-0 ${
          currentPath === '/inbox' ? 'h-full max-h-full overflow-hidden' : ''
        }`}
      >
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
              {/* BOUTON STATISTIQUES PHARMA */}
              {isPharmaUser && (
                <button
                  onClick={() => navigateTo('/pharma/stats')}
                  className={`flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95 shrink-0 ${
                    currentPath === '/pharma/stats' || currentPath === '/stats'
                      ? 'bg-[#0A3D8F] text-white border-blue-400'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700'
                  }`}
                  title="Consulter les statistiques de fréquentation"
                >
                  <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
                  <span className="hidden sm:inline">Stats</span>
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

              {/* CÔTÉ CLIENT : Aucun bouton profil (supprimé) */}
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main
          className={`flex-1 w-full ${
            currentPath === '/inbox'
              ? 'h-[calc(100vh-4rem)] flex flex-col min-h-0 overflow-hidden pb-14 md:pb-0'
              : 'overflow-x-hidden'
          }`}
        >
          {content}
        </main>
      </div>

      {/* MOBILE BOTTOM NAVIGATION */}
      <BottomNav
        role={userRole}
        currentPath={currentPath}
        onNavigate={navigateTo}
      />

      {/* 1. LEGAL ONBOARDING PREMIER LANCEMENT (Écran bloquant avant d'accéder à la carte) */}
      <LegalOnboardingModal
        isOpen={showLegalConsent}
        onConsentAccepted={handleLegalConsentAccepted}
      />

      {/* 2. WELCOME MODAL CHOIX RÔLE (Si consent déjà donné et rôle non défini) */}
      <WelcomeModal
        isOpen={showWelcomeModal && !showLegalConsent}
        onSelectClient={handleWelcomeSelectClient}
        onSelectPharma={handleWelcomeSelectPharma}
      />
    </div>
  );
}
