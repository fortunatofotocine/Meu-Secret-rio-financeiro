import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register the service worker automatically
registerSW({ immediate: true });

// Global variable to catch the install prompt even before React is ready
let deferredPrompt: any = null;
window.addEventListener('beforeinstallprompt', (e) => {
  console.log('Capture: beforeinstallprompt global event fired');
  e.preventDefault();
  deferredPrompt = e;
  // Dispatch a custom event to notify React if it's already mounted
  window.dispatchEvent(new CustomEvent('pwa-prompt-ready', { detail: e }));
});

// Expose it to the window for React to read
(window as any).deferredInstallPrompt = deferredPrompt;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
