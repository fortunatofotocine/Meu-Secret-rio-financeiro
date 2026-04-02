import React from 'react';
import { motion } from 'framer-motion';
import { format, endOfMonth, differenceInDays, isToday, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TrendingDown, Calendar, ArrowRight, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { Transaction, Profile } from '../lib/supabase';

interface SmartGreetingProps {
  profile: Profile | null;
  transactions: Transaction[];
}

export default function SmartGreeting({ profile, transactions }: SmartGreetingProps) {
  const now = new Date();
  const hour = now.getHours();
  const navigate = useNavigate();
  
  // 1. Time-based Greeting
  let greeting = "Olá";
  if (hour >= 5 && hour < 12) greeting = "Bom dia";
  else if (hour >= 12 && hour < 18) greeting = "Boa tarde";
  else greeting = "Boa noite";

  const firstName = profile?.full_name?.split(' ')[0] || "por aqui";

  // 2. Financial Metrics (Current Month)
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  
  const monthlyExpenses = transactions.filter(t => {
    const d = new Date(t.date);
    return t.type === 'expense' && d >= monthStart && d <= monthEnd;
  }).reduce((acc, t) => acc + t.amount, 0);

  const dailyExpenses = transactions.filter(t => {
    const d = new Date(t.date);
    return t.type === 'expense' && isToday(d);
  }).reduce((acc, t) => acc + t.amount, 0);

  const daysLeft = differenceInDays(monthEnd, now) + 1;
  const salaryBase = profile?.monthly_income || 0;
  const percentUsed = salaryBase > 0 ? (monthlyExpenses / salaryBase) * 100 : 0;

  // 3. Dynamic Insights
  let line2 = "";
  let line3 = "";
  
  if (salaryBase > 0) {
    line2 = `Você consumiu ${percentUsed.toFixed(0)}% do seu salário base este mês.`;
    if (percentUsed > 90) {
      line3 = "Atenção redobrada nos próximos dias para não fechar no vermelho.";
    } else if (percentUsed > 60) {
      line3 = "O mês está avançando, mantenha o foco no que é essencial.";
    } else {
      line3 = "Suas finanças parecem sob controle por enquanto.";
    }
  } else {
    const formatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(monthlyExpenses);
    line2 = `Você já registrou ${formatted} em saídas este mês.`;
    line3 = `Restam ${daysLeft} dias para o fechamento do período.`;
  }

  // Overriding with daily context if relevant
  if (dailyExpenses > (salaryBase * 0.05) && dailyExpenses > 0) {
    const formattedDaily = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dailyExpenses);
    line2 = `Hoje você já investiu ${formattedDaily} em despesas.`;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-slate-100 rounded-3xl p-5 mb-6 shadow-sm shadow-orange-500/5"
    >
      <div className="flex justify-between items-start mb-1">
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">
          {greeting}, {firstName}.
        </h2>
        <div className="p-2 bg-orange-50 rounded-full">
           <Zap className="w-4 h-4 text-zlai-primary" />
        </div>
      </div>
      
      <div className="space-y-1 mb-4">
        <p className="text-sm font-medium text-slate-600 leading-relaxed">
          {line2}
        </p>
        <p className="text-xs text-slate-400 font-medium italic">
          {line3}
        </p>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-slate-50">
        <div className="flex items-center gap-4">
           <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hoje</span>
              <span className="text-sm font-black text-slate-700">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dailyExpenses)}
              </span>
           </div>
           <div className="w-px h-6 bg-slate-100" />
           <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dias Restantes</span>
              <span className="text-sm font-black text-slate-700">{daysLeft} dias</span>
           </div>
        </div>
        
        <button 
          onClick={() => navigate('/faturamento')}
          className="flex items-center gap-1.5 text-xs font-bold text-zlai-primary hover:bg-orange-50 px-3 py-1.5 rounded-xl transition-all"
        >
          <span>Relatórios</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </motion.div>
  );
}
