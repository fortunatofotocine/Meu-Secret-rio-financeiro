import React, { useEffect, useState, useContext } from 'react';
import { LayoutDashboard, ReceiptText, CalendarDays, MessageSquare, Menu, Wallet, Repeat, LogOut, Target, Download, Briefcase, ShieldCheck } from 'lucide-react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { InstallContext } from '../App';
import BottomNav from './BottomNav';
import MobileMoreMenu from './MobileMoreMenu';

export default function Layout() {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = React.useState(false);
  const [userName, setUserName] = useState('Usuário');
  const [userRole, setUserRole] = useState<'user' | 'admin'>('user');
  const [isActivated, setIsActivated] = useState(true);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
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
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, role, whatsapp_number')
          .eq('id', session.user.id)
          .single();

        if (profile?.full_name) {
          setUserName(profile.full_name);
        }
        if (profile?.role) {
          setUserRole(profile.role);
        }
        setIsActivated(!!profile?.whatsapp_number);
      }
      setLoading(false);
    }
    getProfile();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Visão Geral' },
    { to: '/faturamento', icon: Briefcase, label: 'Faturamento' },
    { to: '/financeiro', icon: ReceiptText, label: 'Financeiro' },
    { to: '/despesas-fixas', icon: Repeat, label: 'Despesas Fixas' },
    { to: '/agenda', icon: CalendarDays, label: 'Agenda' },
    { to: '/metas', icon: Target, label: 'Metas' },
    { to: '/mensagens', icon: MessageSquare, label: 'WhatsApp' },
  ];

  const pageTitle = navItems.find(item => item.to === location.pathname)?.label || (location.pathname.startsWith('/admin') ? 'Painel de Controle' : 'ZLAI');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zlai-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zlai-bg flex text-zlai-dark font-sans">
      {/* Mobile Sidebar Overlay (Keeping for iPad/Larger screens or as legacy) */}
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

      {/* Sidebar - HIDDEN ON MOBILE */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 z-50 transform transition-transform duration-300 lg:translate-x-0 lg:static lg:inset-0",
          "hidden lg:flex lg:flex-col",
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
            {userRole === 'user' ? (
              <>
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
              </>
            ) : (
              /* Admin Dedicated Experience */
              <NavLink
                to="/admin"
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
                <ShieldCheck className="w-5 h-5" />
                <span>Painel de Controle</span>
              </NavLink>
            )}

            {userRole === 'user' && !isActivated && (
              <button
                onClick={() => navigate('/activate')}
                className="w-full mt-4 group relative flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-xl transition-all duration-300 text-white bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
              >
                <MessageSquare className="w-5 h-5" />
                <span>Ativar WhatsApp</span>
                <div className="absolute top-0 right-0 w-2 h-2 bg-white rounded-full -mr-0.5 -mt-0.5 animate-ping opacity-75" />
              </button>
            )}

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
        {/* Header - Compact for Mobile */}
        <header className="h-14 lg:h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-6 shrink-0 z-30">
          <div className="flex items-center gap-2">
            {/* Logo on mobile header for balance */}
            <img src="/zlai-icon.png" alt="Z" className="h-7 lg:hidden" />
            <h1 className="text-lg font-bold text-slate-800 lg:hidden truncate max-w-[150px]">{pageTitle}</h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-zlai-dark truncate">Olá, {userName.split(' ')[0]}</p>
              <p className="text-[10px] text-zlai-primary font-black uppercase tracking-widest">Premium</p>
            </div>
            <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-full border-2 border-white shadow-sm overflow-hidden flex-shrink-0">
              <img src={`https://ui-avatars.com/api/?name=${userName}&background=FF6A00&color=fff`} alt="Avatar" referrerPolicy="no-referrer" />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8 pb-24 lg:pb-8 custom-scrollbar">
          <Outlet />
        </div>

        {/* Mobile Navigation */}
        <BottomNav onMoreClick={() => setIsMoreMenuOpen(true)} />
        <MobileMoreMenu 
          isOpen={isMoreMenuOpen} 
          onClose={() => setIsMoreMenuOpen(false)}
          onLogout={handleLogout}
          userName={userName}
          deferredPrompt={deferredPrompt}
          onInstall={handleInstallClick}
          userRole={userRole}
        />
      </main>
    </div>
  );
}
