/// <reference types="vite/client" />
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { registerSW } from 'virtual:pwa-register';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// PWA: Aggressive auto-update
if (import.meta.env.PROD) {
  const updateSW = registerSW({
    onNeedRefresh() {
      // Automatically reload when a new version is ready
      // This is aggressive but ensures user gets the fixes
      console.log("PWA Update found: Reloading...");
      updateSW(true);
    },
    immediate: true
  });
}