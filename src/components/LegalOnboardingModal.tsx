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
  ArrowRight,
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

            {/* Mention légale 18 ans */}
            <div className="text-[11px] text-slate-500 text-center italic">
              En cochant la case, vous déclarez avoir 18 ans ou plus et accepter ces deux documents.
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

      {/* A) MODAL : "Politique de confidentialité - EFA GARDE" */}
      {showPrivacyModal && (
        <div className="fixed inset-0 z-[1400] bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col border border-slate-200 text-slate-800 overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header bleu EFA #0A3D8F */}
            <div className="bg-[#0A3D8F] text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center text-white">
                  <Lock className="w-4 h-4" />
                </div>
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                  Politique de confidentialité - EFA GARDE
                </h2>
              </div>
              <button
                onClick={() => setShowPrivacyModal(false)}
                className="p-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-colors cursor-pointer"
                title="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content avec EXACTEMENT le texte demandé */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs sm:text-sm text-slate-700 leading-relaxed bg-white">
              <div className="font-semibold text-slate-500 pb-2 border-b border-slate-100">
                Dernière mise à jour : Novembre 2026 - EFA TECHNOLOGIE - Lomé, Togo
              </div>

              <div className="space-y-1">
                <h3 className="font-bold text-slate-900 text-sm">
                  1. Qui sommes-nous ?
                </h3>
                <p>
                  EFA GARDE est édité par EFA TECHNOLOGIE, RCCM : [ton RCCM], Lomé. Contact : efatech2@gmail.com / +228 96100972. Nous ne sommes pas une pharmacie. Nous sommes un annuaire.
                </p>
              </div>

              <div className="space-y-1">
                <h3 className="font-bold text-slate-900 text-sm">
                  2. Quelles données on collecte ?
                </h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    <strong>Pour les clients :</strong> Nom (facultatif), numéro de téléphone (si vous utilisez le chat), position GPS (uniquement pour vous montrer les pharmacies proches), photos d'ordonnances (si vous les envoyez au pharmacien).
                  </li>
                  <li>
                    <strong>Pour les pharmaciens :</strong> Nom, nom de pharmacie, adresse, téléphone, jours de garde.
                  </li>
                  <li>
                    <strong>Automatique :</strong> Modèle de téléphone, logs de connexion.
                  </li>
                </ul>
              </div>

              <div className="space-y-1">
                <h3 className="font-bold text-slate-900 text-sm">
                  3. Pourquoi on collecte ?
                </h3>
                <p>
                  Uniquement pour : afficher les pharmacies de garde sur la carte, permettre l'itinéraire et le contact, et pour que le pharmacien réponde à votre chat. Nous ne vendons JAMAIS de médicaments.
                </p>
              </div>

              <div className="space-y-1">
                <h3 className="font-bold text-slate-900 text-sm">
                  4. Photos d'ordonnances
                </h3>
                <p>
                  Si vous envoyez une photo d'ordonnance par chat, elle est transmise directement et uniquement au pharmacien choisi. Elle est supprimée automatiquement de nos serveurs après 7 jours. Ne jamais envoyer votre carte d'identité.
                </p>
              </div>

              <div className="space-y-1">
                <h3 className="font-bold text-slate-900 text-sm">
                  5. Où sont stockées les données ?
                </h3>
                <p>
                  Hébergement sécurisé (Europe/Afrique). Données conservées 2 ans maximum après votre dernière utilisation.
                </p>
              </div>

              <div className="space-y-1">
                <h3 className="font-bold text-slate-900 text-sm">
                  6. Vos droits (Loi Togolaise 2019-014)
                </h3>
                <p>
                  Vous avez droit d'accès, de rectification, de suppression. Pour exercer : écrivez-nous à efatech2@gmail.com avec votre numéro. Nous répondons sous 72h. Vous pouvez aussi saisir l'ATOP Togo.
                </p>
              </div>

              <div className="space-y-1">
                <h3 className="font-bold text-slate-900 text-sm">
                  7. Partage
                </h3>
                <p>
                  Nous ne vendons jamais vos données. Seul le pharmacien que VOUS contactez reçoit votre message. Les données des pharmacies (adresse, tel) sont publiques.
                </p>
              </div>

              <div className="space-y-1">
                <h3 className="font-bold text-slate-900 text-sm">
                  8. Cookies
                </h3>
                <p>
                  On utilise juste ce qu'il faut pour que la carte marche.
                </p>
              </div>
            </div>

            {/* Footer avec bouton FERMER */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowPrivacyModal(false)}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#0A3D8F] hover:bg-blue-900 text-white font-bold text-xs shadow-md transition-all cursor-pointer active:scale-95"
              >
                FERMER
              </button>
            </div>
          </div>
        </div>
      )}

      {/* B) MODAL : "Conditions d'utilisation - EFA GARDE" */}
      {showTermsModal && (
        <div className="fixed inset-0 z-[1400] bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col border border-slate-200 text-slate-800 overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header bleu EFA #0A3D8F */}
            <div className="bg-[#0A3D8F] text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center text-white">
                  <FileText className="w-4 h-4" />
                </div>
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                  Conditions d'utilisation - EFA GARDE
                </h2>
              </div>
              <button
                onClick={() => setShowTermsModal(false)}
                className="p-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-colors cursor-pointer"
                title="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content avec EXACTEMENT le texte demandé */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs sm:text-sm text-slate-700 leading-relaxed bg-white">
              <div className="space-y-1">
                <h3 className="font-bold text-slate-900 text-sm">
                  1. Objet du service
                </h3>
                <p>
                  EFA GARDE est un service d'information gratuit pour le public. Il affiche les pharmacies de garde et permet de les contacter. EFA GARDE ne vend, ne prescrit, ne conseille aucun médicament. La dispensation reste exclusivement au comptoir sous contrôle du pharmacien titulaire.
                </p>
              </div>

              <div className="space-y-1">
                <h3 className="font-bold text-slate-900 text-sm">
                  2. Engagement de l'utilisateur
                </h3>
                <p>
                  Vous vous engagez à ne pas utiliser le chat pour : injures, fausses alertes, demande de stupéfiants. Toute photo d'ordonnance envoyée doit être la vôtre. En cas d'abus, votre accès sera bloqué.
                </p>
              </div>

              <div className="space-y-1">
                <h3 className="font-bold text-slate-900 text-sm">
                  3. Engagement d'EFA GARDE
                </h3>
                <p>
                  Nous faisons de notre mieux pour que les infos de garde soient exactes, mais elles sont renseignées par les pharmaciens eux-mêmes. En cas d'erreur, EFA GARDE ne peut être tenu responsable. Toujours appeler avant de vous déplacer la nuit.
                </p>
              </div>

              <div className="space-y-1">
                <h3 className="font-bold text-slate-900 text-sm">
                  4. Urgence
                </h3>
                <p>
                  EFA GARDE n'est pas un service d'urgence. En cas d'urgence vitale, appelez le SAMU, le 118 ou allez directement à l'hôpital le plus proche.
                </p>
              </div>

              <div className="space-y-1">
                <h3 className="font-bold text-slate-900 text-sm">
                  5. Abonnement pharmaciens
                </h3>
                <p>
                  L'abonnement (25000F pour enregistrer sur l'application, 15.000F/mois ou 140000F/ans Et 90.000F/mois) est mensuel, sans engagement, facturé avec facture certifiée OTR. Résiliable à tout moment depuis le tableau de bord. Nous pouvons apporter des modifications à nos tarifs à tout moment.
                </p>
                <p>
                  Notre page de publicité, n'est destinée qu'à passer les annonces sur des services et produits légaux de divers acteurs économiques selon la législation togolaise.
                </p>
              </div>

              <div className="space-y-1">
                <h3 className="font-bold text-slate-900 text-sm">
                  6. Modification
                </h3>
                <p>
                  Nous pouvons modifier ces règles. La nouvelle version sera affichée dans l'app. Si vous continuez à utiliser l'app, vous acceptez.
                </p>
              </div>

              <div className="pt-2 p-3 bg-blue-50 border border-blue-100 rounded-2xl text-[11px] text-[#0A3D8F] font-semibold text-center">
                En cochant la case, vous déclarez avoir 18 ans ou plus et accepter ces deux documents.
              </div>
            </div>

            {/* Footer avec bouton FERMER */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowTermsModal(false)}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#0A3D8F] hover:bg-blue-900 text-white font-bold text-xs shadow-md transition-all cursor-pointer active:scale-95"
              >
                FERMER
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default LegalOnboardingModal;
