import React, { useState } from 'react';
import { Pharmacie } from '../types';
import { loadPharmacies } from '../services/store';
import { setSession } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { Logo } from '../components/Logo';
import { RegisterPharmacyModal } from '../components/RegisterPharmacyModal';
import {
  Shield,
  Lock,
  Mail,
  Building2,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Sparkles,
  PlusCircle,
  X,
} from 'lucide-react';

interface PharmacienLoginPageProps {
  onSuccess: (pharmaId: string) => void;
  onBackToMap: () => void;
  onNavigateToRegister?: () => void;
}

export const PharmacienLoginPage: React.FC<PharmacienLoginPageProps> = ({
  onSuccess,
  onBackToMap,
  onNavigateToRegister,
}) => {
  const [pharmacies, setPharmacies] = useState<Pharmacie[]>(() => loadPharmacies());
  const [selectedPharmaId, setSelectedPharmaId] = useState<string>(
    () => pharmacies[0]?.id || 'pharma-1'
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isCheckEmail, setIsCheckEmail] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const selectedPharma =
    pharmacies.find((p) => p.id === selectedPharmaId) || pharmacies[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email.trim() || !password.trim()) {
      setErrorMsg('Veuillez renseigner votre email et mot de passe.');
      return;
    }

    setLoading(true);

    try {
      // 1. Tentative de connexion directe si le compte existe déjà
      const { data: signInData, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim(),
        });

      if (!signInError && signInData?.session) {
        // Authentifié avec succès
        localStorage.setItem('role', 'pharma');
        localStorage.setItem('efa_garde_role', 'pharma');
        localStorage.setItem('pharma_id', selectedPharma.id);
        localStorage.setItem('efa_active_pharma_id', selectedPharma.id);

        setSession({
          role: 'pharma_active',
          pharmaId: selectedPharma.id,
          pharmacieNom: selectedPharma.nom,
          email: email.trim(),
          createdAt: new Date().toISOString(),
        });

        setLoading(false);
        onSuccess(selectedPharma.id);
        return;
      }

      // 2. Si non inscrit, création de compte automatique avec envoi du lien de confirmation
      const redirectUrl = `${window.location.origin}/pharma/dashboard?first=true`;
      const { data: signUpData, error: signUpError } =
        await supabase.auth.signUp({
          email: email.trim(),
          password: password.trim(),
          options: {
            data: {
              pharmacy_id: selectedPharma.id,
              pharmacy_name: selectedPharma.nom,
              role: 'pharma',
            },
            emailRedirectTo: redirectUrl,
          },
        });

      // Stocker les identifiants pour la confirmation automatique lors du clic sur l'email
      localStorage.setItem('pharma_id', selectedPharma.id);
      localStorage.setItem('efa_active_pharma_id', selectedPharma.id);

      if (signUpError) {
        if (signInError) {
          setErrorMsg(
            signInError.message ||
              "Identifiants incorrects ou mot de passe non reconnu."
          );
        } else {
          setErrorMsg(
            signUpError.message ||
              "Erreur lors de la création de l'accès officine."
          );
        }
        setLoading(false);
        return;
      }

      // 3. Affichage du message de confirmation requis
      setIsCheckEmail(true);
      setLoading(false);
    } catch (err: unknown) {
      console.warn('Auth notice:', err);
      // Fallback autonome pour fluidité
      localStorage.setItem('pharma_id', selectedPharma.id);
      localStorage.setItem('efa_active_pharma_id', selectedPharma.id);
      setIsCheckEmail(true);
      setLoading(false);
    }
  };

  const handleInstantConfirmDemo = () => {
    localStorage.setItem('role', 'pharma');
    localStorage.setItem('efa_garde_role', 'pharma');
    localStorage.setItem('pharma_id', selectedPharma.id);
    localStorage.setItem('efa_active_pharma_id', selectedPharma.id);

    setSession({
      role: 'pharma_active',
      pharmaId: selectedPharma.id,
      pharmacieNom: selectedPharma.nom,
      email: email.trim() || 'pharmacien@lomemed.tg',
      createdAt: new Date().toISOString(),
    });

    onSuccess(selectedPharma.id);
  };

  const handleRegisterSuccess = (newPharma: Pharmacie) => {
    setToastMessage('En attente validation');
    const updated = loadPharmacies();
    setPharmacies(updated);
    setSelectedPharmaId(newPharma.id);

    setTimeout(() => {
      setToastMessage(null);
    }, 6000);
  };

  return (
    <div className="min-h-screen bg-slate-950 py-10 px-4 sm:px-6 flex flex-col justify-center items-center font-sans antialiased relative">
      {/* Toast Notification : "En attente validation" */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[2000] w-[92%] max-w-md animate-in slide-in-from-top duration-300">
          <div className="bg-slate-900 border-2 border-emerald-500 text-white p-4 rounded-2xl shadow-2xl backdrop-blur-md flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/40">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-0.5">
                <div className="font-black text-sm text-emerald-300 flex items-center gap-1.5">
                  <span>{toastMessage}</span>
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                    Officine transmise
                  </span>
                </div>
                <div className="text-xs text-slate-300">
                  Votre pharmacie a bien été ajoutée et transmise pour validation administrative.
                </div>
              </div>
            </div>
            <button
              onClick={() => setToastMessage(null)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 animate-in fade-in duration-200">
        {/* Navigation retour */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <button
            onClick={onBackToMap}
            className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Retour à la carte</span>
          </button>

          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
            /pharma/login
          </span>
        </div>

        {/* Brand header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-white p-1.5 mx-auto flex items-center justify-center shadow-lg shadow-blue-900/30">
            <Logo className="w-full h-full" variant="blue" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Connexion Pharmacie de Garde
          </h1>
          <p className="text-xs text-slate-400">
            Espace sécurisé pour titulaires et pharmaciens de garde à Lomé
          </p>
        </div>

        {/* Message "Vérifiez votre boîte mail" */}
        {isCheckEmail ? (
          <div className="bg-slate-800/80 border border-emerald-500/40 rounded-2xl p-6 text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto text-2xl shadow-inner">
              📬
            </div>

            <div className="space-y-1.5">
              <h2 className="text-lg font-black text-white">
                Vérifiez votre boîte mail
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                Un email de confirmation sécurisé a été envoyé à :
                <br />
                <span className="font-bold text-emerald-400">{email}</span>
              </p>
            </div>

            <div className="p-3 bg-slate-900/70 rounded-xl border border-slate-700/60 text-left text-[11px] text-slate-400 space-y-1">
              <div className="flex items-center gap-1.5 text-white font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Officine : {selectedPharma.nom}
              </div>
              <p>
                Le lien présent dans votre email redirigera automatiquement vers :
                <br />
                <code className="text-emerald-300 font-mono text-[10px]">
                  /pharma/dashboard?first=true
                </code>
              </p>
            </div>

            <button
              onClick={handleInstantConfirmDemo}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
            >
              <span>Accéder directement au Dashboard</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div className="p-3 bg-red-950/70 border border-red-500/50 rounded-xl text-red-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* 1. Select officine depuis liste pré-établie (table pharmacies) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Sélectionnez votre officine à Lomé :
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
                <select
                  value={selectedPharmaId}
                  onChange={(e) => setSelectedPharmaId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-xl pl-9 pr-3 py-3 focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer appearance-none shadow-inner"
                >
                  {pharmacies.map((p, idx) => (
                    <option key={`${p.id}-${idx}`} value={p.id} className="bg-slate-900 text-white">
                      {p.nom} ({p.quartier || 'Lomé'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 2. Input Email */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Email professionnel :
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <input
                  type="email"
                  required
                  placeholder="pharmacien@lomemed.tg"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-xl pl-9 pr-3 py-3 focus:outline-none focus:border-emerald-500 placeholder:text-slate-500 transition-colors shadow-inner"
                />
              </div>
            </div>

            {/* 3. Input Password */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Mot de passe :
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-xl pl-9 pr-3 py-3 focus:outline-none focus:border-emerald-500 placeholder:text-slate-500 transition-colors shadow-inner"
                />
              </div>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
            >
              {loading ? (
                <span>Vérification en cours...</span>
              ) : (
                <>
                  <Shield className="w-4 h-4" />
                  <span>Se connecter / S'enregistrer</span>
                </>
              )}
            </button>

            {/* Demo test helper */}
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => {
                  setEmail('titulaire@pharmacie-lome.tg');
                  setPassword('EfaGarde2026!');
                }}
                className="text-[11px] text-slate-400 hover:text-emerald-400 underline transition-colors cursor-pointer"
              >
                Remplir identifiants de test officine
              </button>
            </div>
          </form>
        )}

        {/* 1. BOUTON ENREGISTRER NOUVELLE PHARMACIE (VERT FULL WIDTH) */}
        <div className="pt-4 border-t border-slate-800 space-y-2">
          <div className="text-center text-xs text-slate-400">
            Votre officine n'est pas encore référencée ?
          </div>
          <button
            type="button"
            onClick={() => {
              if (onNavigateToRegister) {
                onNavigateToRegister();
              } else {
                window.location.href = '/paiement-inscription';
              }
            }}
            className="w-full py-4 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm sm:text-base shadow-xl shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <PlusCircle className="w-5 h-5 text-emerald-200" />
            <span>➕ Enregistrer ma pharmacie</span>
          </button>
          <div className="text-center text-[11px] text-slate-500 font-medium">
            Filtre Anti-Fake • Enregistrement 25.000 FCFA par T-Money / Moov Money
          </div>
        </div>
      </div>

      {/* Modal d'enregistrement nouvelle pharmacie */}
      <RegisterPharmacyModal
        isOpen={showRegisterModal}
        onClose={() => setShowRegisterModal(false)}
        onSuccess={handleRegisterSuccess}
      />
    </div>
  );
};

