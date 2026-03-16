import React, { useEffect, useState, useContext } from 'react';
import { LayoutDashboard, ReceiptText, CalendarDays, MessageSquare, Menu, Wallet, Repeat, LogOut, Target, Download } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { InstallContext } from '../App';

export default function Layout() {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [userName, setUserName] = useState('Usuário');
  const navigate = useNavigate();
  const { deferredPrompt, setDeferredPrompt } = useContext(InstallContext);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    setDeferredPrompt(null);
  };

  useEffect(() => {
    async function getProfile() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', session.user.id)
          .single();

        if (profile?.full_name) {
          setUserName(profile.full_name);
        }
      }
    }
    getProfile();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/financeiro', icon: ReceiptText, label: 'Financeiro' },
    { to: '/despesas-fixas', icon: Repeat, label: 'Despesas Fixas' },
    { to: '/agenda', icon: CalendarDays, label: 'Agenda' },
    { to: '/metas', icon: Target, label: 'Metas' },
    { to: '/mensagens', icon: MessageSquare, label: 'WhatsApp' },
  ];

  return (
    <div className="min-h-screen bg-zlai-bg flex text-zlai-dark font-sans">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 z-50 transform transition-transform duration-300 lg:translate-x-0 lg:static lg:inset-0",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="h-full flex flex-col">
          <div className="p-6 border-bottom border-slate-100">
            <div className="flex items-center gap-3">
              <img src="/zlai-logo.png" alt="ZLAI Logo" className="h-[30px] object-contain" />
            </div>
          </div>

          <nav className="flex-1 px-4 py-4 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setIsSidebarOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                    isActive
                      ? "bg-zlai-primary/10 text-zlai-primary font-semibold shadow-sm"
                      : "text-zlai-gray hover:bg-slate-50 hover:text-zlai-dark"
                  )
                }
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </NavLink>
            ))}

            {deferredPrompt && (
              <button
                onClick={handleInstallClick}
                className="w-full mt-2 flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-xl transition-all duration-300 text-white bg-gradient-to-r from-[#FF6A00] to-[#FF8C00] shadow-md shadow-orange-500/30 hover:shadow-orange-500/50 hover:-translate-y-0.5"
              >
                <Download className="w-5 h-5" />
                <span>Baixar App</span>
              </button>
            )}
          </nav>

          <div className="p-4 border-t border-slate-100 space-y-2">
            <div className="bg-slate-50 rounded-2xl p-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Status IA</p>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-slate-700">Assistente Ativo</span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl transition-all duration-200"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Sair</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 -ml-2 text-slate-500 lg:hidden"
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-zlai-dark">Olá, {userName.split(' ')[0]}</p>
              <p className="text-xs text-zlai-gray font-medium">ZLAI Premium</p>
            </div>
            <div className="w-10 h-10 rounded-full border-2 border-white shadow-sm overflow-hidden">
              <img src={`https://ui-avatars.com/api/?name=${userName}&background=FF6A00&color=fff`} alt="Avatar" referrerPolicy="no-referrer" />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
