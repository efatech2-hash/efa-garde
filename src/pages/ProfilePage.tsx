import React, { useState } from 'react';
import { Pharmacie } from '../types';
import { getSession, clearSession } from '../lib/auth';
import {
  User,
  Shield,
  MapPin,
  Phone,
  MessageSquare,
  LogOut,
  ExternalLink,
  Lock,
  Sparkles,
  Megaphone,
  CreditCard,
  QrCode,
  HeartHandshake,
  CheckCircle2,
  ChevronRight,
  Info
} from 'lucide-react';

interface ProfilePageProps {
  pharmacies: Pharmacie[];
  activePharmaId: string;
  onNavigate: (path: string) => void;
  onLogout: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  pharmacies,
  activePharmaId,
  onNavigate,
  onLogout,
}) => {
  const session = getSession();
  const storedRole =
    localStorage.getItem('efa_garde_role') ||
    localStorage.getItem('role') ||
    session?.role;

  const isPharma =
    storedRole === 'pharma' ||
    session?.role === 'pharma' ||
    session?.role === 'pharma_active';

  const pharma =
    pharmacies.find((p) => p.id === (session?.pharmaId || activePharmaId)) ||
    pharmacies[0];

  const [copied, setCopied] = useState(false);

  const handleShareApp = () => {
    if (navigator.share) {
      navigator
        .share({
          title: 'EFA GARDE - Lomé',
          text: 'Trouvez facilement les pharmacies de garde à Lomé 24h/24 et 7j/7 !',
          url: window.location.origin,
        })
        .catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6 pb-28 font-sans antialiased animate-in fade-in duration-200">
      {/* Header Profile Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
            <User className="w-7 h-7 text-green-400" />
            Mon Profil & Paramètres
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Gérez vos préférences, votre statut et l'accès à vos services EFA GARDE.
          </p>
        </div>

        <span
          className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${
            isPharma
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
              : 'bg-blue-500/15 border-blue-500/40 text-blue-300'
          }`}
        >
          {isPharma ? 'Compte Pharmacie' : 'Patient / Client'}
        </span>
      </div>

      {/* Main Account Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-green-900/30 shrink-0">
              {isPharma ? '💊' : '👤'}
            </div>
            <div>
              <div className="text-lg sm:text-xl font-bold text-white">
                {isPharma ? pharma?.nom || 'Pharmacie de Lomé' : 'Client Lomé (Invité)'}
              </div>
              <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-slate-500" />
                <span>
                  {isPharma ? pharma?.adresse || 'Lomé, Togo' : 'Position GPS Lomé activée'}
                </span>
              </div>
              {isPharma && (
                <div className="flex items-center gap-2 mt-2">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      pharma?.is_online
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        pharma?.is_online ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                      }`}
                    />
                    {pharma?.is_online ? 'De garde en ligne' : 'Hors garde actuellement'}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 sm:pt-0">
            <button
              onClick={handleShareApp}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-white text-xs font-bold border border-slate-700 transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              {copied ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Lien copié !</span>
                </>
              ) : (
                <>
                  <ExternalLink className="w-4 h-4 text-slate-400" />
                  <span>Partager l'application</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Pharma Specific Quick Actions */}
      {isPharma ? (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider px-1">
            Espace de Gestion Pharmacie
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => onNavigate('/pharma/dashboard')}
              className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-green-500/50 hover:bg-slate-850 transition-all text-left flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">Tableau de Bord Officine</div>
                  <div className="text-[11px] text-slate-400">Statut de garde, calendrier & planning</div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-white transition-colors" />
            </button>

            <button
              onClick={() => onNavigate('/inbox')}
              className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-green-500/50 hover:bg-slate-850 transition-all text-left flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">Messagerie WhatsApp Clients</div>
                  <div className="text-[11px] text-slate-400">Réception ordonnances et questions</div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-white transition-colors" />
            </button>

            <button
              onClick={() => onNavigate('/abonnement')}
              className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-green-500/50 hover:bg-slate-850 transition-all text-left flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">Abonnement Officine (15.000 FCFA)</div>
                  <div className="text-[11px] text-slate-400">Gérer mon abonnement annuel / mensuel</div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-white transition-colors" />
            </button>

            <button
              onClick={() => onNavigate('/qr')}
              className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-green-500/50 hover:bg-slate-850 transition-all text-left flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">Mon QR Code Comptoir</div>
                  <div className="text-[11px] text-slate-400">Affichage pour vos patients</div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-white transition-colors" />
            </button>
          </div>
        </div>
      ) : (
        /* Client Quick Actions : GARDE SEULEMENT Pharmacie de garde Lomé & Espace publicitaire */
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider px-1">
            Services & Accès Direct
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => onNavigate('/client')}
              className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-blue-500/50 hover:bg-slate-850 transition-all text-left flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">Pharmacie de garde Lomé</div>
                  <div className="text-[11px] text-slate-400">Trouver les officines ouvertes près de vous</div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-white transition-colors" />
            </button>

            <button
              onClick={() => onNavigate('/pub')}
              className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-850 transition-all text-left flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">Espace publicitaire</div>
                  <div className="text-[11px] text-slate-400">Offres santé, parrainages & visibilité</div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-white transition-colors" />
            </button>
          </div>
        </div>
      )}

      {/* Emergency & Assistance Section : GARDE Numéros utiles & Urgences médicales Lomé */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
        <div className="space-y-1">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Phone className="w-5 h-5 text-emerald-400" />
            Numéros utiles & Urgences médicales Lomé
          </h3>
          <p className="text-xs text-slate-400">
            Lignes d’urgence accessibles 24h/24 et assistance directe EFA GARDE à Lomé.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center text-xs">
          <a
            href="tel:118"
            className="p-3.5 rounded-2xl bg-slate-800/90 hover:bg-slate-750 text-white font-bold transition-all hover:scale-[1.02] cursor-pointer border border-slate-700/80 block shadow-sm"
          >
            <div className="text-lg text-red-400 font-black">118</div>
            <div className="text-[11px] text-slate-300 font-semibold mt-0.5">Pompiers</div>
            <div className="text-[9px] text-slate-400 mt-0.5">Urgences Lomé</div>
          </a>
          <a
            href="tel:170"
            className="p-3.5 rounded-2xl bg-slate-800/90 hover:bg-slate-750 text-white font-bold transition-all hover:scale-[1.02] cursor-pointer border border-slate-700/80 block shadow-sm"
          >
            <div className="text-lg text-blue-400 font-black">170</div>
            <div className="text-[11px] text-slate-300 font-semibold mt-0.5">Police Secours</div>
            <div className="text-[9px] text-slate-400 mt-0.5">Sécurité Lomé</div>
          </a>
          <a
            href="tel:22251515"
            className="p-3.5 rounded-2xl bg-slate-800/90 hover:bg-slate-750 text-white font-bold transition-all hover:scale-[1.02] cursor-pointer border border-slate-700/80 block shadow-sm"
          >
            <div className="text-lg text-emerald-400 font-black">22 25 15 15</div>
            <div className="text-[11px] text-slate-300 font-semibold mt-0.5">SAMU Togo</div>
            <div className="text-[9px] text-slate-400 mt-0.5">Urgences médicales</div>
          </a>
          <a
            href={`https://wa.me/${(process.env.WHATSAPP_NUMBER || '22896100972').replace(/[^0-9]/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-3.5 rounded-2xl bg-emerald-600/20 hover:bg-emerald-600/30 text-white font-bold transition-all hover:scale-[1.02] cursor-pointer border border-emerald-500/40 block shadow-sm"
          >
            <div className="text-lg text-emerald-300 font-black">WhatsApp</div>
            <div className="text-[11px] text-emerald-200 font-semibold mt-0.5">Assistance EFA</div>
            <div className="text-[9px] text-emerald-400 mt-0.5">+228 96 10 09 72</div>
          </a>
        </div>
      </div>

      {/* Disconnect visible ONLY for professional pharmacy account */}
      {isPharma && (
        <div className="pt-2 flex justify-center">
          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 font-bold text-xs transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Déconnexion Pharmacien</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
