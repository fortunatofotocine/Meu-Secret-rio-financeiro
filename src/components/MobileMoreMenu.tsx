import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { Target, CalendarDays, Repeat, LogOut, X, Download, ShieldCheck } from 'lucide-react';
import { cn } from '../lib/utils';

interface MobileMoreMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  userName: string;
  deferredPrompt: any;
  onInstall: () => void;
  userRole?: 'user' | 'admin';
}

export default function MobileMoreMenu({ isOpen, onClose, onLogout, userName, deferredPrompt, onInstall, userRole }: MobileMoreMenuProps) {
  const secondaryNav = [
    { to: '/metas', icon: Target, label: 'Metas Financeiras' },
    { to: '/agenda', icon: CalendarDays, label: 'Minha Agenda' },
    { to: '/despesas-fixas', icon: Repeat, label: 'Contas a Pagar' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] lg:hidden"
          />

          {/* Bottom Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[32px] z-[70] shadow-2xl p-6 lg:hidden"
          >
            {/* Header / Grabber */}
            <div className="flex flex-col items-center mb-6">
              <div className="w-12 h-1.5 bg-slate-200 rounded-full mb-6" />
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-zlai-primary font-bold">
                    {userName.charAt(0)}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-800">{userName}</span>
                    <span className="text-[10px] font-bold text-zlai-primary uppercase tracking-wider">ZLAI Premium</span>
                  </div>
                </div>
                <button onClick={onClose} className="p-2 bg-slate-50 rounded-full text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Navigation Group */}
            <div className="space-y-2 mb-8">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-3">Extras</p>
              
              {userRole === 'user' ? (
                <>
                  {secondaryNav.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={onClose}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-4 px-5 py-4 rounded-2xl transition-all font-bold text-sm",
                          isActive ? "bg-orange-50 text-zlai-primary" : "text-slate-600 active:bg-slate-50"
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
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-4 px-5 py-4 rounded-2xl transition-all font-bold text-sm",
                      isActive ? "bg-orange-50 text-zlai-primary" : "text-slate-600 active:bg-slate-50"
                    )
                  }
                >
                  <ShieldCheck className="w-5 h-5" />
                  <span>Painel de Controle</span>
                </NavLink>
              )}

              {deferredPrompt && (
                <button
                  onClick={() => { onInstall(); onClose(); }}
                  className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl font-bold text-sm text-white bg-gradient-to-r from-[#FF6A00] to-[#FF8C00] shadow-lg shadow-orange-500/20"
                >
                  <Download className="w-5 h-5" />
                  <span>Instalar Aplicativo</span>
                </button>
              )}
            </div>

            {/* Account / Action Group */}
            <div className="pt-4 border-t border-slate-100 mb-[env(safe-area-inset-bottom)]">
              <button
                onClick={() => { onLogout(); onClose(); }}
                className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-red-500 font-bold text-sm active:bg-red-50 transition-all"
              >
                <LogOut className="w-5 h-5" />
                <span>Sair da Conta</span>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
