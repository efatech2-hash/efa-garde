import React, { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  // Masqué automatiquement si l'application est déjà installée
  if (isInstalled) {
    return null;
  }

  // Affiché via beforeinstallprompt sur desktop + mobile, ou guide iOS sur Safari iOS
  if (!isInstallable && !isIOS) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
    } else if (isIOS) {
      setShowGuide(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#0b5cb5] hover:bg-[#094b96] text-white border border-blue-400/40 text-[11px] sm:text-xs font-bold transition-all cursor-pointer shadow-sm shadow-blue-900/40 active:scale-95 shrink-0 whitespace-nowrap"
        title="Installer l'application EFA Garde"
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span>Installer l&apos;application</span>
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setShowGuide(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-5 shadow-2xl text-slate-100 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-base font-extrabold text-white">
                Installer EFA Garde sur iPhone / iPad
              </h3>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-sm text-slate-300 leading-relaxed">
              <p className="flex items-start gap-2">
                <span className="font-bold text-blue-400 shrink-0">1.</span>
                <span>
                  Appuyez sur le bouton{' '}
                  <span className="inline-flex items-center gap-1 font-semibold text-white">
                    Partager <Share className="w-3.5 h-3.5 text-blue-400" />
                  </span>{' '}
                  dans la barre Safari.
                </span>
              </p>
              <p className="flex items-start gap-2">
                <span className="font-bold text-blue-400 shrink-0">2.</span>
                <span>
                  Faites défiler et appuyez sur{' '}
                  <strong className="text-white">Sur l&apos;écran d&apos;accueil</strong>.
                </span>
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="w-full py-2.5 rounded-xl bg-[#0b5cb5] hover:bg-[#094b96] text-white text-sm font-bold transition-colors cursor-pointer"
            >
              Compris
            </button>
          </div>
        </div>
      )}
    </>
  );
};
