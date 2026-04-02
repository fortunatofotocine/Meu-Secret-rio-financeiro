import React from 'react';
import { ShieldAlert, LogOut, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function AccessDenied() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 bg-[url('/zlai-bg-pattern.png')] bg-repeat bg-fixed">
      <div className="max-w-md w-full bg-white rounded-[40px] shadow-2xl p-8 lg:p-12 border border-slate-100 text-center">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-8 animate-pulse">
          <ShieldAlert className="w-10 h-10 text-red-500" />
        </div>

        <h1 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">
          Acesso Suspenso
        </h1>
        
        <p className="text-slate-500 text-sm leading-relaxed mb-8">
          Sua conta foi suspensa ou desativada temporariamente. Se você acredita que isso é um erro, entre em contato com nossa equipe de suporte via WhatsApp.
        </p>

        <div className="space-y-3">
          <a
            href="https://wa.me/5511999999999" // Placeholder for support
            target="_blank"
            rel="noopener noreferrer"
            className="w-full h-14 bg-[#25D366] text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-emerald-500/20"
          >
            <MessageCircle className="w-5 h-5" />
            <span>Falar com Suporte</span>
          </a>

          <button
            onClick={handleLogout}
            className="w-full h-14 bg-slate-100 text-slate-600 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-200 transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span>Sair da Conta</span>
          </button>
        </div>

        <div className="mt-10 pt-8 border-t border-slate-50">
          <img src="/zlai-logo.png" alt="ZLAI Logo" className="h-6 mx-auto opacity-30 grayscale" />
        </div>
      </div>
    </div>
  );
}
