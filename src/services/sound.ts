/**
 * Service de Notification Sonore & Vibreur (Style WhatsApp - Pop court 0.5s)
 * Joue public/notification.mp3 avec fallback Web Audio API et déclenche navigator.vibrate(200)
 */

let cachedAudio: HTMLAudioElement | null = null;

export function playNotificationSound() {
  // 1. Déclenchement Vibreur haptique (si supporté sur mobile)
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(200);
    }
  } catch {
    // ignore
  }

  // 2. Lecture fichier MP3 public/notification.mp3
  try {
    if (!cachedAudio) {
      cachedAudio = new Audio('/notification.mp3');
      cachedAudio.volume = 0.85;
    }
    cachedAudio.currentTime = 0;
    const playPromise = cachedAudio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Fallback Web Audio API si l'élément Audio est bloqué par autoplay policy
        playWebAudioPop();
      });
    }
  } catch {
    playWebAudioPop();
  }
}

/**
 * Fallback Web Audio API synthétique pur (aucun risque de 404 ni délai réseau)
 */
function playWebAudioPop() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Fréquence pop montant (880Hz -> 1320Hz)
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1318.5, now + 0.1);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);
  } catch (err) {
    console.warn('Audio chime notice suppressed:', err);
  }
}
