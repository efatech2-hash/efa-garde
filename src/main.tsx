import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

// Enregistrement du Service Worker PWA sans bloquer l'app ni interférer avec Supabase
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  try {
    registerSW({
      immediate: true,
      onRegisterError(error) {
        console.warn('Service Worker non enregistré:', error);
      },
    });
  } catch (err) {
    console.warn('Erreur initialisation Service Worker:', err);
  }
}

createRoot(document.getElementById('root')!).render(<App />);
