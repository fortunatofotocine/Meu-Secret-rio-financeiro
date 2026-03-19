import React, { useEffect, useState, createContext } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Financeiro from './pages/Financeiro';
import DespesasFixas from './pages/DespesasFixas';
import Agenda from './pages/Agenda';
import Mensagens from './pages/Mensagens';
import Metas from './pages/Metas';
import Login from './pages/Login';
import Register from './pages/Register';
import PrivacyPolicy from './pages/PrivacyPolicy';
import ProtectedRoute from './components/ProtectedRoute';

export const InstallContext = createContext<{
  deferredPrompt: any;
  setDeferredPrompt: (prompt: any) => void;
}>({ deferredPrompt: null, setDeferredPrompt: () => {} });

export default function App() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // 1. Check if the event was already captured globally
    if ((window as any).deferredInstallPrompt) {
      setDeferredPrompt((window as any).deferredInstallPrompt);
    }

    // 2. Listen for the event in case it fires now
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      (window as any).deferredInstallPrompt = e;
      console.log('App: beforeinstallprompt received');
    };

    // 3. Listen for our custom event from main.tsx
    const customHandler = (e: any) => {
      setDeferredPrompt(e.detail);
    };
    
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('pwa-prompt-ready', customHandler);
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('pwa-prompt-ready', customHandler);
    };
  }, []);

  return (
    <InstallContext.Provider value={{ deferredPrompt, setDeferredPrompt }}>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />

        <Route path="/" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Dashboard />} />
          <Route path="financeiro" element={<Financeiro />} />
          <Route path="despesas-fixas" element={<DespesasFixas />} />
          <Route path="agenda" element={<Agenda />} />
          <Route path="mensagens" element={<Mensagens />} />
          <Route path="metas" element={<Metas />} />
        </Route>
      </Routes>
    </BrowserRouter>
    </InstallContext.Provider>
  );
}
