import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ReceiptText, Briefcase, MessageSquare, PlusCircle } from 'lucide-react';
import { cn } from '../lib/utils';

interface BottomNavProps {
  onMoreClick: () => void;
}

export default function BottomNav({ onMoreClick }: BottomNavProps) {
  const items = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Visão Geral' },
    { to: '/financeiro', icon: ReceiptText, label: 'Financeiro' },
    { to: '/faturamento', icon: Briefcase, label: 'Faturamento' },
    { to: '/mensagens', icon: MessageSquare, label: 'Assistente' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-200 px-2 pt-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))] lg:hidden z-40 flex items-center justify-around">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            cn(
              "flex flex-col items-center gap-1 min-w-[64px] transition-all duration-200",
              isActive ? "text-zlai-primary" : "text-slate-400"
            )
          }
        >
          <item.icon className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-tight truncate w-full text-center">
            {item.label}
          </span>
        </NavLink>
      ))}

      <button
        onClick={onMoreClick}
        className="flex flex-col items-center gap-1 min-w-[64px] text-slate-400 hover:text-zlai-primary transition-all duration-200"
      >
        <PlusCircle className="w-5 h-5" />
        <span className="text-[10px] font-bold uppercase tracking-tight">Mais</span>
      </button>
    </nav>
  );
}
