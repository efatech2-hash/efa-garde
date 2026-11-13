import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/usePWAInstall';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div
      role="status"
      className="fixed bottom-16 md:bottom-4 left-1/2 -translate-x-1/2 z-[1100] flex items-center gap-2 rounded-xl bg-amber-950/95 border border-amber-500/50 px-4 py-2 text-xs font-bold text-amber-200 shadow-xl backdrop-blur-md whitespace-nowrap"
    >
      <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
      <span>Mode hors ligne — Données mises en cache affichées</span>
    </div>
  );
};
