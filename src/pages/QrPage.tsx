import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { Pharmacie } from '../types';
import { Logo } from '../components/Logo';
import {
  QrCode as QrIcon,
  Download,
  Printer,
  ExternalLink,
  Smartphone,
  Share2,
  Copy,
  Check,
  Star,
  ShieldCheck
} from 'lucide-react';

interface QrPageProps {
  pharmacies: Pharmacie[];
  activePharmaId: string;
  onSelectActivePharma: (id: string) => void;
  onNavigate: (tab: string) => void;
}

export const QrPage: React.FC<QrPageProps> = ({
  pharmacies,
  activePharmaId,
  onSelectActivePharma,
  onNavigate,
}) => {
  const currentPharma = pharmacies.find((p) => p.id === activePharmaId) || pharmacies[0];
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const qrUrl = currentPharma ? `https://efatech.com/p/${currentPharma.id}` : '';

  useEffect(() => {
    if (!qrUrl) return;

    QRCode.toDataURL(qrUrl, {
      width: 400,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => {
        setQrDataUrl(url);
      })
      .catch((err) => {
        console.error('Error generating QR code:', err);
      });
  }, [qrUrl]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(qrUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.download = `QR-EFA-GARDE-${currentPharma?.nom.replace(/\s+/g, '_')}.png`;
    link.href = qrDataUrl;
    link.click();
  };

  const handlePrint = () => {
    window.print();
  };

  if (!currentPharma) {
    return <div className="p-8 text-center text-slate-400">Aucune pharmacie disponible.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6 pb-28">
      {/* Header & Pharmacy selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-600/20 text-blue-400 flex items-center justify-center font-black">
            <QrIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white">
              QR Code Officiel Vitrine
            </h1>
            <p className="text-xs text-slate-400">
              Permettez aux passants et patients de scanner et chatter en direct avec votre officine
            </p>
          </div>
        </div>

        <div className="w-full sm:w-auto flex items-center gap-2">
          <span className="text-xs text-slate-400 shrink-0 font-medium">Officine :</span>
          <span className="bg-slate-800 text-emerald-400 text-xs font-bold px-3 py-2 rounded-xl border border-slate-700">
            {currentPharma.nom}
          </span>
        </div>
      </div>

      {/* Main Poster & Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Printable Poster Mockup (7 cols) */}
        <div className="md:col-span-7 bg-white text-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl border-4 border-emerald-500/80 flex flex-col items-center text-center space-y-4 print:border-none print:shadow-none">
          {/* Header on Poster */}
          <div className="flex items-center gap-2.5 bg-blue-600 text-white px-4 py-1.5 rounded-full text-xs font-black tracking-wider uppercase shadow">
            <div className="w-5 h-5 bg-white rounded-full p-0.5 flex items-center justify-center">
              <Logo className="w-full h-full" variant="blue" />
            </div>
            <span>EFA GARDE LOMÉ</span>
          </div>

          <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-snug">
            {currentPharma.nom}
          </h2>

          <p className="text-xs text-slate-600 max-w-sm">
            {currentPharma.adresse} • Tél: {currentPharma.tel}
          </p>

          {/* QR Code Canvas */}
          <div className="p-3 bg-white border-2 border-dashed border-slate-300 rounded-2xl shadow-inner">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`QR Code ${currentPharma.nom}`}
                className="w-56 h-56 sm:w-64 sm:h-64 object-contain rounded-xl"
              />
            ) : (
              <div className="w-56 h-56 flex items-center justify-center text-slate-400">
                Génération...
              </div>
            )}
          </div>

          <div className="space-y-1">
            <p className="text-sm font-extrabold text-slate-800">
              Scannez pour vérifier nos horaires & chatter avec nous
            </p>
            <p className="text-xs font-mono text-emerald-700 font-bold">
              {qrUrl}
            </p>
          </div>

          <div className="pt-2 border-t border-slate-200 w-full flex items-center justify-center gap-4 text-[11px] text-slate-500 font-medium">
            <span>✓ Statut de garde 24/7</span>
            <span>✓ Messagerie instantanée</span>
            <span>✓ Itinéraire GPS</span>
          </div>
        </div>

        {/* Action Buttons & App Download Link (5 cols) */}
        <div className="md:col-span-5 space-y-4">
          {/* Action Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Actions & Impression</span>
            </h3>

            <p className="text-xs text-slate-400">
              Téléchargez le QR code en haute définition pour vos affiches de garde sur vitrine, comptoir ou cartes de visite.
            </p>

            <div className="space-y-2 pt-1">
              <button
                onClick={handleDownloadQr}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Télécharger l’image QR (PNG)</span>
              </button>

              <button
                onClick={handlePrint}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimer l’Affiche Vitrine (A4)</span>
              </button>

              <button
                onClick={handleCopyLink}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Lien copié dans le presse-papier !' : 'Copier l’URL directe'}</span>
              </button>
            </div>
          </div>

          {/* Download Mobile App Shortcut Banner */}
          <div className="bg-gradient-to-br from-blue-950/60 to-slate-900 border border-blue-500/30 rounded-2xl p-5 shadow-xl space-y-3">
            <div className="flex items-center gap-2 text-blue-400 font-bold text-sm">
              <Smartphone className="w-4 h-4" />
              <span>Application Mobile EFA GARDE</span>
            </div>

            <p className="text-xs text-slate-300">
              Installez l’application sur Android & iOS avec géolocalisation en arrière-plan et notifications push de garde.
            </p>

            <button
              onClick={() => onNavigate('download')}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition-all"
            >
              <span>Accéder à la page de téléchargement</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
