import React, { useState } from 'react';
import { Pub } from '../types';
import { loadPubs } from '../services/store';
import {
  Megaphone,
  ExternalLink,
  MessageCircle,
  Sparkles,
  Calendar,
  Tag,
  ShieldCheck,
  CheckCircle2,
  Building,
  ArrowRight
} from 'lucide-react';

interface EspacePubPageProps {
  onBackToMap?: () => void;
}

export const EspacePubPage: React.FC<EspacePubPageProps> = () => {
  const [pubs] = useState<Pub[]>(() => loadPubs());

  const rawWhatsapp = (process.env.WHATSAPP_NUMBER || '22896100972').replace(/[^0-9]/g, '');
  const whatsappPubContactUrl = `https://wa.me/${rawWhatsapp}?text=${encodeURIComponent(
    "Bonjour EFA GARDE, je souhaite diffuser une publicité sponsorisée pour mon entreprise / produit de santé sur votre application à Lomé."
  )}`;

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-8 pb-28 font-sans antialiased">
      {/* Hero Header */}
      <div className="text-center space-y-3 max-w-2xl mx-auto animate-in fade-in duration-200">
        <span className="px-3.5 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 inline-flex items-center gap-1.5 shadow-sm">
          <Megaphone className="w-4 h-4 text-emerald-400" />
          Offres Partenaires Santé & Bien-être
        </span>
        <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
          Espace Pub 📢
        </h1>
        <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-normal">
          Retrouvez les meilleures offres de nos partenaires officiels à Lomé : laboratoires, mutuelles et assurances santé, matériel médical et parapharmacie.
        </p>
      </div>

      {/* CTA BANNER : "Faites votre pub ici - Contactez-nous" bouton WhatsApp */}
      <div className="relative overflow-hidden bg-gradient-to-r from-emerald-900/60 via-slate-900 to-slate-900 border border-emerald-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2 text-emerald-400 font-extrabold text-xs uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            Visibilité Maximale à Lomé
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white">
            Faites votre pub ici — Contactez-nous
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
            Touchez quotidiennement des milliers de patients et professionnels de santé en recherche active de pharmacies et produits médicaux à Lomé.
          </p>
        </div>

        <a
          href={whatsappPubContactUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 px-6 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-extrabold text-sm sm:text-base shadow-xl shadow-emerald-500/30 transition-all transform active:scale-95 flex items-center gap-3 cursor-pointer"
        >
          <MessageCircle className="w-5 h-5 fill-current" />
          <span>Contacter par WhatsApp</span>
        </a>
      </div>

      {/* Grid 2 colonnes cards pub (Responsive pub cards) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {pubs.map((pub) => (
          <div
            key={pub.id}
            className="group bg-slate-900 border border-slate-800 hover:border-emerald-500/50 rounded-3xl overflow-hidden shadow-xl transition-all duration-300 flex flex-col hover:-translate-y-1 hover:shadow-2xl hover:shadow-emerald-950/20"
          >
            {/* Image Container with Badge "Sponsorisé" */}
            <div className="relative h-52 sm:h-56 w-full overflow-hidden bg-slate-950">
              <img
                src={pub.image}
                alt={pub.titre}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent opacity-60" />

              {/* Badge Sponsorisé */}
              <div className="absolute top-3.5 left-3.5 flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/90 text-white text-[11px] font-black uppercase tracking-wider shadow-lg backdrop-blur-md">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Sponsorisé</span>
              </div>

              {/* Prix Badge if available */}
              {pub.prix && (
                <div className="absolute bottom-3 right-3 px-3 py-1 rounded-xl bg-slate-900/90 border border-amber-500/40 text-amber-300 text-xs font-black shadow-lg backdrop-blur-md">
                  {pub.prix}
                </div>
              )}
            </div>

            {/* Content Body */}
            <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                {pub.sponsor && (
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                    <Building className="w-3.5 h-3.5" />
                    {pub.sponsor}
                  </span>
                )}

                <h3 className="text-base sm:text-lg font-black text-white leading-snug group-hover:text-emerald-300 transition-colors">
                  {pub.titre}
                </h3>

                {pub.description && (
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
                    {pub.description}
                  </p>
                )}
              </div>

              {/* Footer details & Action */}
              <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                {pub.date_fin ? (
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>Valable jusqu'au {pub.date_fin}</span>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400">Offre continue</div>
                )}

                <a
                  href={pub.lien}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm group-hover:border-emerald-500/40"
                >
                  <span>Voir l'offre</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Assurance / Confiance Note */}
      <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl flex items-center justify-center gap-3 text-xs text-slate-400 text-center">
        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
        <span>
          Toutes les offres publiées sur EFA GARDE respectent la déontologie pharmaceutique et médicale en vigueur au Togo.
        </span>
      </div>
    </div>
  );
};
