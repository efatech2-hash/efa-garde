import React, { useEffect, useState } from 'react';
import { Logo } from '../components/Logo';

interface SplashProps {
  onComplete: () => void;
  duration?: number; // default 2000ms (2s)
}

/**
 * Splash screen: logo officiel centré sur fond blanc, durée 2s
 */
export const Splash: React.FC<SplashProps> = ({ onComplete, duration = 2000 }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / duration) * 100));
      setProgress(pct);

      if (elapsed >= duration) {
        clearInterval(interval);
        onComplete();
      }
    }, 40);

    return () => clearInterval(interval);
  }, [duration, onComplete]);

  return (
    <div className="fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center p-6 select-none animate-in fade-in duration-300">
      {/* Centered Official Logo on White Background */}
      <div className="flex flex-col items-center justify-center space-y-6 max-w-sm w-full text-center">
        {/* Official EFA Shield Logo */}
        <div className="w-44 h-44 sm:w-52 sm:h-52 flex items-center justify-center drop-shadow-sm transition-transform hover:scale-105">
          <Logo className="w-full h-full" variant="blue" />
        </div>

        {/* Brand Name */}
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-black text-[#0b5cb5] tracking-tight">
            EFA GARDE
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-slate-500 uppercase tracking-widest">
            Pharmacies de Garde • Lomé
          </p>
        </div>

        {/* 2s Minimal Progress Bar */}
        <div className="w-48 h-1 bg-slate-100 rounded-full overflow-hidden mt-6">
          <div
            className="h-full bg-[#0b5cb5] transition-all duration-75 ease-out rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Footer Tagline */}
      <div className="absolute bottom-6 text-[11px] font-medium text-slate-400">
        Ordre National des Pharmaciens du Togo
      </div>
    </div>
  );
};

export default Splash;
