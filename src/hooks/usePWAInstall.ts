import { useEffect, useState } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

// Module-level store so multiple consumers (Header + Homepage) share the same captured prompt
let sharedDeferredPrompt: BeforeInstallPromptEvent | null = null;
let sharedIsInstalled = false;
const listeners = new Set<() => void>();

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function detectIOS(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(ua);
}

function notifyListeners() {
  listeners.forEach((cb) => cb());
}

if (typeof window !== 'undefined') {
  sharedIsInstalled = detectStandalone();

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    sharedDeferredPrompt = e as BeforeInstallPromptEvent;
    notifyListeners();
  });

  window.addEventListener('appinstalled', () => {
    sharedIsInstalled = true;
    sharedDeferredPrompt = null;
    notifyListeners();
  });

  const mql = window.matchMedia('(display-mode: standalone)');
  if (typeof mql.addEventListener === 'function') {
    mql.addEventListener('change', (evt) => {
      if (evt.matches) {
        sharedIsInstalled = true;
        sharedDeferredPrompt = null;
        notifyListeners();
      }
    });
  }
}

export function usePWAInstall() {
  const [, setTick] = useState(0);
  const [isIOS] = useState(() => detectIOS());

  useEffect(() => {
    const sync = () => setTick((t) => t + 1);
    listeners.add(sync);
    // Sync standalone state on mount
    if (detectStandalone() && !sharedIsInstalled) {
      sharedIsInstalled = true;
      sync();
    }
    return () => {
      listeners.delete(sync);
    };
  }, []);

  const install = async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!sharedDeferredPrompt) {
      return 'unavailable';
    }
    await sharedDeferredPrompt.prompt();
    const { outcome } = await sharedDeferredPrompt.userChoice;
    if (outcome === 'accepted') {
      sharedIsInstalled = true;
      sharedDeferredPrompt = null;
      notifyListeners();
      return 'accepted';
    }
    return 'dismissed';
  };

  return {
    isInstallable: !!sharedDeferredPrompt,
    isInstalled: sharedIsInstalled,
    isIOS,
    install,
  };
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
