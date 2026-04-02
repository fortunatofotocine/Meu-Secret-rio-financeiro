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
import LandingPage from './pages/LandingPage';
import Activate from './pages/Activate';
import SubscriptionExpired from './pages/SubscriptionExpired';
import Faturamento from './pages/Faturamento';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import ReloadPrompt from './components/ReloadPrompt';
import { supabase } from './lib/supabase';
import { Navigate } from 'react-router-dom';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import AccessDenied from './pages/AccessDenied';

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
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/activate" element={<Activate />} />
        <Route path="/subscription-expired" element={<SubscriptionExpired />} />
        <Route path="/access-denied" element={<AccessDenied />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />

        {/* User Protected Routes */}
        <Route element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="financeiro" element={<Financeiro />} />
          <Route path="faturamento" element={<Faturamento />} />
          <Route path="despesas-fixas" element={<DespesasFixas />} />
          <Route path="agenda" element={<Agenda />} />
          <Route path="mensagens" element={<Mensagens />} />
          <Route path="metas" element={<Metas />} />
          
          {/* Admin Protected Routes */}
          <Route path="admin" element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          } />
        </Route>
      </Routes>
      <ReloadPrompt />
    </BrowserRouter>
    </InstallContext.Provider>
  );
}

function Home() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zlai-primary"></div>
      </div>
    );
  }

  if (session) {
    // We want a role-aware redirect here too
    return <HomeRedirect session={session} />;
  }

  return <LandingPage />;
}

function HomeRedirect({ session }: { session: any }) {
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function getRole() {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();
      
      setRole(profile?.role || 'user');
      setLoading(false);
    }
    getRole();
  }, [session.user.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zlai-primary"></div>
      </div>
    );
  }

  if (role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  return <Navigate to="/dashboard" replace />;
}
