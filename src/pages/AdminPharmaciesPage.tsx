import React, { useState, useEffect } from 'react';
import {
  loadPendingPharmacies,
  approvePendingPharmacy,
  rejectPendingPharmacy,
  addPendingPharmacy,
  loadPharmacies,
  fetchPharmacies,
} from '../services/store';
import { PharmaciePending, Pharmacie } from '../types';
import { ActivateSubscriptionModal } from '../components/ActivateSubscriptionModal';
import { Logo } from '../components/Logo';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Building,
  User,
  Phone,
  MapPin,
  FileText,
  ArrowLeft,
  Sparkles,
  RefreshCw,
  Eye,
  Check,
  Star,
} from 'lucide-react';

interface AdminPharmaciesPageProps {
  onBackToMap: () => void;
  onRefresh: () => void;
}

export const AdminPharmaciesPage: React.FC<AdminPharmaciesPageProps> = ({
  onBackToMap,
  onRefresh,
}) => {
  const [pendingList, setPendingList] = useState<PharmaciePending[]>(() =>
    loadPendingPharmacies()
  );
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'abonnements' | 'all'>('pending');
  const [allPharmacies, setAllPharmacies] = useState<Pharmacie[]>(() => loadPharmacies());
  const [selectedPharmaToActivate, setSelectedPharmaToActivate] = useState<Pharmacie | null>(null);
  const [isActivateModalOpen, setIsActivateModalOpen] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const refreshList = () => {
    setPendingList(loadPendingPharmacies());
    setAllPharmacies(loadPharmacies());
    fetchPharmacies().then((data) => {
      if (data && data.length > 0) setAllPharmacies(data);
    }).catch(() => {});
    onRefresh();
  };

  useEffect(() => {
    refreshList();
  }, []);

  const handleApprove = async (id: string, nom: string) => {
    setProcessingId(id);
    setActionNotice(null);
    try {
      await approvePendingPharmacy(id);
      refreshList();
      setActionNotice(`✅ "${nom}" a été validée avec succès ! Elle s'affiche maintenant sur la carte publique en vert.`);
      setTimeout(() => setActionNotice(null), 5000);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'approbation.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string, nom: string) => {
    if (!window.confirm(`Confirmer le refus de l'officine "${nom}" ?`)) return;
    setProcessingId(id);
    setActionNotice(null);
    try {
      await rejectPendingPharmacy(id);
      refreshList();
      setActionNotice(`❌ "${nom}" a été refusée.`);
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err) {
      console.error(err);
      alert('Erreur lors du rejet.');
    } finally {
      setProcessingId(null);
    }
  };

  // Helper pour insérer une demande de test si la file est vide
  const handleAddSamplePending = async () => {
    await addPendingPharmacy({
      nom: 'Pharmacie Saint-Joseph Tokoin',
      quartier: 'Tokoin',
      adresse: 'Avenue de la Nouvelle Marche, Face Lycée Tokoin',
      phone: '+228 90 45 67 89',
      titulaire: 'Dr. Paul Koffi',
      numero_ordre: 'ONPT-TOGO-0312',
      email_pro: 'stjoseph@ordredespharmaciens.tg',
      lat: 6.142,
      lng: 1.218,
    });
    refreshList();
  };

  const isPendingStatus = (s: string) => s === 'pending' || s === 'en_attente';
  const pendingCount = pendingList.filter((p) => isPendingStatus(p.statut)).length;
  const filteredList =
    activeTab === 'pending'
      ? pendingList.filter((p) => isPendingStatus(p.statut))
      : pendingList;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-8 px-4 sm:px-6 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl">
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToMap}
              className="p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Retourner à la carte publique"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/40">
                  Administration EFA GARDE
                </span>
                <span className="text-xs text-slate-400 font-mono">Contrôle Ordre des Pharmaciens</span>
              </div>
              <h1 className="text-2xl font-black text-white tracking-tight mt-0.5">
                Validation des Pharmaciens & Officines
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={refreshList}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              title="Actualiser la liste"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Notice feedback */}
        {actionNotice && (
          <div className="p-4 bg-emerald-950/70 border border-emerald-500/60 rounded-2xl text-emerald-200 text-sm font-semibold flex items-center gap-3 animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{actionNotice}</span>
          </div>
        )}

        {/* Tab switcher */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center flex-wrap gap-2">
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'pending'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20'
                  : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>En attente ({pendingCount})</span>
            </button>

            <button
              onClick={() => setActiveTab('abonnements')}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'abonnements'
                  ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20'
                  : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Abonnements & Plans ({allPharmacies.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-slate-700 text-white font-black'
                  : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              Historique ({pendingList.length})
            </button>
          </div>

          {pendingCount === 0 && (
            <button
              onClick={handleAddSamplePending}
              className="text-xs font-bold text-emerald-400 hover:text-emerald-300 underline cursor-pointer"
            >
              + Ajouter une demande de test
            </button>
          )}
        </div>

        {/* VIEW 1 : ONGLET ABONNEMENTS & OFFRES */}
        {activeTab === 'abonnements' ? (
          <div className="space-y-4">
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-3xl flex items-center justify-between text-xs">
              <span className="text-slate-300 font-bold">
                Gestion des Abonnements ({allPharmacies.length} officines de Lomé)
              </span>
              <span className="text-amber-400 font-mono">
                Source unique : DB Supabase (Temps réel)
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {allPharmacies.map((pharma) => {
                const isPop =
                  pharma.subscription_plan === 'premium' ||
                  pharma.plan === 'populaire_mensuel' ||
                  pharma.plan === 'populaire_annuel' ||
                  Boolean(pharma.etoile_doree);

                const rawEnd = pharma.subscription_end_at || pharma.subscription_end;
                const daysLeft = rawEnd
                  ? Math.ceil((new Date(rawEnd).getTime() - Date.now()) / 86400000)
                  : null;

                return (
                  <div
                    key={pharma.id}
                    className={`bg-slate-900 border rounded-3xl p-5 shadow-xl transition-all space-y-4 ${
                      isPop
                        ? 'border-yellow-500/40 bg-gradient-to-br from-slate-900 to-amber-950/20'
                        : 'border-slate-800'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          {isPop ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-yellow-500 text-slate-950 flex items-center gap-1 shadow-xs">
                              <Star className="w-3 h-3 fill-slate-950" />
                              POPULAIRE GOLD
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                              STANDARD
                            </span>
                          )}

                          {pharma.is_active !== false ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-500/30">
                              ● Actif
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400">
                              ○ Inactif
                            </span>
                          )}

                          <span className="text-[11px] font-mono text-slate-400">
                            ID: {pharma.id}
                          </span>
                        </div>

                        <h3 className="text-lg font-black text-white mt-1.5 flex items-center gap-2">
                          <Building className="w-5 h-5 text-emerald-400" />
                          <span>{pharma.nom}</span>
                        </h3>
                        <p className="text-xs text-slate-400">
                          {pharma.adresse} {pharma.quartier ? `(${pharma.quartier})` : ''} • {pharma.tel}
                        </p>
                      </div>

                      {/* Bouton Activer / Gérer Abonnement */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPharmaToActivate(pharma);
                          setIsActivateModalOpen(true);
                        }}
                        className="px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2 cursor-pointer active:scale-95 shrink-0"
                      >
                        <Sparkles className="w-4 h-4 fill-slate-950" />
                        <span>⚡ Activer / Modifier Abonnement</span>
                      </button>
                    </div>

                    {/* Données d'expiration & jours restants */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
                      <div>
                        <span className="text-slate-400 block mb-0.5">Plan actuel :</span>
                        <span className="font-bold text-white uppercase">
                          {pharma.plan || 'Base'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-0.5">Fin d'abonnement :</span>
                        <span className="font-mono font-bold text-slate-200">
                          {rawEnd ? new Date(rawEnd).toLocaleDateString('fr-FR') : 'Non défini'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-0.5">Jours restants :</span>
                        {daysLeft !== null ? (
                          <span
                            className={`font-black ${
                              daysLeft <= 0
                                ? 'text-red-400'
                                : daysLeft < 7
                                ? 'text-amber-400 animate-pulse'
                                : 'text-emerald-400'
                            }`}
                          >
                            {daysLeft > 0 ? `${daysLeft} jours` : 'Expiré (0j)'}
                          </span>
                        ) : (
                          <span className="italic text-slate-500">Non défini</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : filteredList.length === 0 ? (
          /* Empty state */
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-emerald-400" />
            </div>
            <h3 className="text-lg font-black text-white">Toutes les demandes sont traitées !</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Aucune officine n'est en attente de validation. Les demandes des pharmaciens inscrivant leur numéro d'Ordre apparaîtront ici.
            </p>
            <button
              onClick={handleAddSamplePending}
              className="mt-3 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold text-xs border border-slate-700"
            >
              Créer une demande d'exemple
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredList.map((p) => {
              const isPending = p.statut === 'pending' || p.statut === 'en_attente';

              return (
                <div
                  key={p.id}
                  className={`bg-slate-900 border rounded-3xl p-5 sm:p-6 shadow-xl transition-all space-y-4 ${
                    isPending
                      ? 'border-amber-500/50 ring-2 ring-amber-500/10'
                      : p.statut === 'approved'
                      ? 'border-emerald-500/30'
                      : 'border-red-500/30 opacity-70'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-black uppercase px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                          Ordre: {p.numero_ordre || 'En vérification'}
                        </span>

                        <span
                          className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                            p.statut === 'approved'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : p.statut === 'rejected'
                              ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          }`}
                        >
                          {p.statut === 'approved'
                            ? 'APPROUVÉE ✓'
                            : p.statut === 'rejected'
                            ? 'REFUSÉE ✕'
                            : 'EN ATTENTE DE VÉRIFICATION'}
                        </span>

                        <span className="text-[11px] text-slate-500">
                          {new Date(p.created_at).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <h2 className="text-xl font-black text-white mt-2 flex items-center gap-2">
                        <Building className="w-5 h-5 text-emerald-400" />
                        <span>{p.nom}</span>
                      </h2>
                    </div>

                    {/* Action buttons (Approver / Refuser / Activer Abonnement) */}
                    <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto shrink-0">
                      {isPending && (
                        <>
                          <button
                            onClick={() => handleReject(p.id, p.nom)}
                            disabled={processingId === p.id}
                            className="px-3.5 py-2.5 rounded-2xl bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/40 font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                          >
                            <XCircle className="w-4 h-4 text-red-400" />
                            <span>Refuser</span>
                          </button>

                          <button
                            onClick={() => handleApprove(p.id, p.nom)}
                            disabled={processingId === p.id}
                            className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                          >
                            <Check className="w-4 h-4" />
                            <span>Approuver</span>
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          const matchingPharma = allPharmacies.find((ph) => ph.id === p.id) || {
                            id: p.id,
                            nom: p.nom,
                            tel: p.phone,
                            lat: p.lat,
                            lng: p.lng,
                            adresse: p.adresse,
                            plan: 'populaire_mensuel',
                            is_online: true,
                            titulaire: p.titulaire,
                            quartier: p.quartier,
                            email_pro: p.email_pro,
                          };
                          setSelectedPharmaToActivate(matchingPharma);
                          setIsActivateModalOpen(true);
                        }}
                        className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                      >
                        <Sparkles className="w-4 h-4 fill-slate-950" />
                        <span>⚡ Activer Abonnement</span>
                      </button>
                    </div>
                  </div>

                  {/* Details grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs bg-slate-800/40 p-4 rounded-2xl border border-slate-800/80">
                    <div>
                      <span className="text-slate-400 block mb-0.5">Titulaire :</span>
                      <span className="font-bold text-white flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-blue-400" />
                        {p.titulaire}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block mb-0.5">Téléphone WhatsApp :</span>
                      <span className="font-mono font-bold text-emerald-300 flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-emerald-400" />
                        {p.phone}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block mb-0.5">Quartier & Adresse :</span>
                      <span className="text-slate-200 truncate block">
                        {p.adresse} ({p.quartier})
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block mb-0.5">Coordonnées GPS :</span>
                      <span className="font-mono text-slate-300">
                        {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
                      </span>
                    </div>
                  </div>

                  {/* Documents & Photos preview */}
                  {(p.photo_url || p.piece_url) && (
                    <div className="flex flex-wrap items-center gap-4 pt-1">
                      {p.photo_url && (
                        <div className="space-y-1">
                          <span className="text-[11px] font-bold text-slate-400 block">
                            Photo de devanture :
                          </span>
                          <img
                            src={p.photo_url}
                            alt="Devanture"
                            className="w-24 h-16 object-cover rounded-xl border border-slate-700 shadow"
                          />
                        </div>
                      )}

                      {p.piece_url && (
                        <div className="space-y-1">
                          <span className="text-[11px] font-bold text-slate-400 block">
                            Pièce / Carte d'Ordre :
                          </span>
                          <img
                            src={p.piece_url}
                            alt="Carte Ordre"
                            className="w-24 h-16 object-cover rounded-xl border border-slate-700 shadow"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Modal d'activation abonnement direct en DB */}
        <ActivateSubscriptionModal
          isOpen={isActivateModalOpen}
          pharmacie={selectedPharmaToActivate}
          onClose={() => {
            setIsActivateModalOpen(false);
            setSelectedPharmaToActivate(null);
          }}
          onSuccess={(updated) => {
            refreshList();
            setActionNotice(`⚡ Abonnement "${updated.nom}" activé avec succès en DB ! Compte à rebours synchronisé en direct.`);
            setTimeout(() => setActionNotice(null), 5000);
          }}
        />
      </div>
    </div>
  );
};
export default AdminPharmaciesPage;
