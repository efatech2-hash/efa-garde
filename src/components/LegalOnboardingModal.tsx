import React, { useState } from 'react';
import { Logo } from './Logo';
import { saveUserConsent } from '../services/consentService';
import {
  ShieldCheck,
  FileText,
  Lock,
  X,
  MapPin,
  Clock,
  MessageSquare,
  Sparkles,
  ArrowRight,
  Check,
} from 'lucide-react';

interface LegalOnboardingModalProps {
  isOpen: boolean;
  onConsentAccepted: () => void;
}

export const LegalOnboardingModal: React.FC<LegalOnboardingModalProps> = ({
  isOpen,
  onConsentAccepted,
}) => {
  const [isChecked, setIsChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  if (!isOpen) return null;

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setIsChecked(checked);
    if (checked) {
      // Pré-déclenchement en arrière-plan pour enregistrer dès que l'utilisateur coche
      saveUserConsent().catch((err) =>
        console.warn('Consent save background notice:', err)
      );
    }
  };

  const handleContinue = async () => {
    if (!isChecked || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await saveUserConsent();
    } catch (err) {
      console.warn('Erreur validation consent:', err);
    } finally {
      setIsSubmitting(false);
      onConsentAccepted();
    }
  };

  return (
    <>
      {/* ÉCRAN BLOQUANT PRINCIPAL (Premier lancement avant d'accéder à la carte) */}
      <div className="fixed inset-0 z-[1300] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200">
        <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 max-w-lg w-full text-slate-900 space-y-6 animate-in zoom-in-95 duration-200 border border-slate-200 my-auto">
          {/* Logo EFA GARDE centré */}
          <div className="text-center space-y-3">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white p-2.5 mx-auto flex items-center justify-center shadow-lg border border-slate-200">
              <Logo className="w-full h-full" variant="blue" />
            </div>

            <div className="space-y-1">
              <span className="inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-[#0A3D8F] border border-blue-200">
                Lomé • Togo • 24/7
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
                Bienvenue sur EFA GARDE
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                Votre application officielle pour trouver les pharmacies de garde ouvertes à Lomé en direct et échanger en temps réel avec les pharmaciens.
              </p>
            </div>
          </div>

          {/* 3 Avantages clés */}
          <div className="grid grid-cols-3 gap-2 text-center py-1">
            <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
              <div className="w-7 h-7 rounded-lg bg-blue-100 text-[#0A3D8F] mx-auto flex items-center justify-center">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="text-[11px] font-black text-slate-900 leading-tight">
                Carte & GPS
              </div>
              <div className="text-[9px] text-slate-500">
                Officines 24/7
              </div>
            </div>

            <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <div className="text-[11px] font-black text-slate-900 leading-tight">
                En Direct
              </div>
              <div className="text-[9px] text-slate-500">
                Statuts vérifiés
              </div>
            </div>

            <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
              <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 mx-auto flex items-center justify-center">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div className="text-[11px] font-black text-slate-900 leading-tight">
                Chat Live
              </div>
              <div className="text-[9px] text-slate-500">
                Sans inscription
              </div>
            </div>
          </div>

          {/* SECTION BASSE : Checkbox légale + Phrase exacte + Bouton Continuer */}
          <div className="pt-2 border-t border-slate-100 space-y-4">
            {/* Checkbox et Phrase exacte demandée */}
            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 text-left">
              <input
                id="legal-consent-checkbox"
                type="checkbox"
                checked={isChecked}
                onChange={handleCheckboxChange}
                className="mt-0.5 w-5 h-5 rounded-md border-slate-400 text-[#0A3D8F] focus:ring-[#0A3D8F] cursor-pointer shrink-0 accent-[#0A3D8F]"
              />
              <label
                htmlFor="legal-consent-checkbox"
                className="text-xs sm:text-sm text-slate-700 leading-snug cursor-pointer select-none"
              >
                J'ai lu et j'accepte les{' '}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowTermsModal(true);
                  }}
                  className="font-bold text-[#0A3D8F] hover:underline cursor-pointer inline-block"
                >
                  Conditions d'utilisation
                </button>{' '}
                et la{' '}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowPrivacyModal(true);
                  }}
                  className="font-bold text-[#0A3D8F] hover:underline cursor-pointer inline-block"
                >
                  Politique de confidentialité
                </button>{' '}
                d'EFA GARDE.
              </label>
            </div>

            {/* Bouton CONTINUER : Grisé tant que case non cochée, BLEU EFA #0A3D8F dès que cochée */}
            <button
              type="button"
              disabled={!isChecked || isSubmitting}
              onClick={handleContinue}
              className={`w-full py-4 px-6 rounded-2xl font-black text-sm sm:text-base flex items-center justify-center gap-2 transition-all duration-200 select-none ${
                isChecked && !isSubmitting
                  ? 'bg-[#0A3D8F] hover:bg-blue-900 text-white shadow-xl shadow-blue-900/30 active:scale-95 cursor-pointer ring-2 ring-blue-500/30'
                  : 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed opacity-60'
              }`}
            >
              {isSubmitting ? (
                <span>Validation en cours...</span>
              ) : (
                <>
                  <span>CONTINUER</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* MODAL 1 SÉPARÉ : Conditions d'utilisation */}
      {showTermsModal && (
        <div className="fixed inset-0 z-[1400] bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col border border-slate-200 text-slate-800 animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#0A3D8F] flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <h2 className="text-base font-black text-slate-900">
                  Conditions d'utilisation
                </h2>
              </div>
              <button
                onClick={() => setShowTermsModal(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                title="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs sm:text-sm text-slate-600 leading-relaxed">
              <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-2xl text-[11px] text-[#0A3D8F] font-semibold">
                Version 1.0 • En vigueur pour l'agglomération de Lomé (Togo)
              </div>

              <section className="space-y-1.5">
                <h3 className="font-extrabold text-slate-900 text-sm">
                  1. Objet et Présentation du Service
                </h3>
                <p>
                  L'application <strong>EFA GARDE</strong> a pour vocation de faciliter l'accès aux soins d'urgence en permettant aux citoyens de repérer en temps réel les pharmacies de garde ouvertes à Lomé et dans ses environs, ainsi que de communiquer directement avec les équipes officinales.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="font-extrabold text-slate-900 text-sm">
                  2. Accès Gratuit aux Patients
                </h3>
                <p>
                  L'accès à la carte des pharmacies de garde, la recherche de proximité, la consultation des horaires et l'utilisation de la messagerie instantanée sont entièrement <strong>gratuits</strong> pour l'ensemble des usagers. Aucun paiement ni abonnement n'est exigé des patients.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="font-extrabold text-slate-900 text-sm">
                  3. Absence de Téléconsultation Médicale Directe
                </h3>
                <p>
                  La messagerie d'EFA GARDE permet de vérifier la disponibilité d'un médicament ou de transmettre une ordonnance pour préparation. Elle ne remplace en aucun cas une consultation médicale ni un diagnostic délivré par un médecin habilité.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="font-extrabold text-slate-900 text-sm">
                  4. Urgences Vitales
                </h3>
                <p>
                  En cas d'urgence vitale ou d'accident grave, contactez immédiatement les services officiels togolais :
                </p>
                <ul className="list-disc pl-5 space-y-0.5 text-xs text-slate-700">
                  <li><strong>SAMU Lomé :</strong> 22 25 15 15</li>
                  <li><strong>Pompiers (Accidents & Secours) :</strong> 118</li>
                  <li><strong>Police Secours :</strong> 170</li>
                </ul>
              </section>

              <section className="space-y-1.5">
                <h3 className="font-extrabold text-slate-900 text-sm">
                  5. Propriété Intellectuelle
                </h3>
                <p>
                  Les marques, logos, graphismes et codes sources d'EFA GARDE sont la propriété exclusive d'EFA Tech. Toute reproduction non autorisée est strictement interdite.
                </p>
              </section>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 shrink-0">
              <button
                onClick={() => setShowTermsModal(false)}
                className="w-full py-3 rounded-xl bg-[#0A3D8F] hover:bg-blue-900 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                J'ai compris et je ferme
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2 SÉPARÉ : Politique de confidentialité */}
      {showPrivacyModal && (
        <div className="fixed inset-0 z-[1400] bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col border border-slate-200 text-slate-800 animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <Lock className="w-4 h-4" />
                </div>
                <h2 className="text-base font-black text-slate-900">
                  Politique de confidentialité
                </h2>
              </div>
              <button
                onClick={() => setShowPrivacyModal(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                title="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs sm:text-sm text-slate-600 leading-relaxed">
              <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-2xl text-[11px] text-emerald-800 font-semibold">
                Engagement de protection des données personnelles & de santé • Version 1.0
              </div>

              <section className="space-y-1.5">
                <h3 className="font-extrabold text-slate-900 text-sm">
                  1. Minimisation des Données Collectées
                </h3>
                <p>
                  EFA GARDE applique le principe de minimisation absolue. Nous ne collectons que les informations strictement nécessaires au fonctionnement du service :
                </p>
                <ul className="list-disc pl-5 space-y-0.5 text-xs text-slate-700">
                  <li><strong>Localisation GPS :</strong> Utilisée uniquement avec votre autorisation pour calculer la distance vers les officines les plus proches. Votre position n'est jamais stockée de manière permanente.</li>
                  <li><strong>Identifiant de consentement :</strong> Horodatage, version et adresse IP (pour prouver la conformité légale de votre consentement).</li>
                </ul>
              </section>

              <section className="space-y-1.5">
                <h3 className="font-extrabold text-slate-900 text-sm">
                  2. Règle Stricte d'Éphémérité 48H des Messages
                </h3>
                <p>
                  Tous les échanges de messagerie (textes, photos d'ordonnances, notes vocales) sont soumis à un <strong>nettoyage automatique permanent après 48 heures</strong>. Aucun historique médical n'est conservé au-delà de cette durée légale de garde.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="font-extrabold text-slate-900 text-sm">
                  3. Pas de Revente de Données
                </h3>
                <p>
                  EFA GARDE s'engage formellement à <strong>ne jamais vendre, louer ni céder</strong> vos données personnelles ou de santé à des tiers, régies publicitaires ou courtiers de données.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="font-extrabold text-slate-900 text-sm">
                  4. Sécurité & Chiffrement
                </h3>
                <p>
                  Toutes les communications entre votre appareil et nos serveurs sont protégées par le protocole sécurisé <strong>HTTPS / TLS 1.3</strong>.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="font-extrabold text-slate-900 text-sm">
                  5. Exercice de Vos Droits
                </h3>
                <p>
                  Vous disposez d'un droit permanent d'accès, de rectification et de suppression totale de vos données. Vous pouvez nous contacter directement sur WhatsApp au <strong>+228 96 10 09 72</strong> ou par e-mail.
                </p>
              </section>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 shrink-0">
              <button
                onClick={() => setShowPrivacyModal(false)}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                J'ai compris et je ferme
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default LegalOnboardingModal;
