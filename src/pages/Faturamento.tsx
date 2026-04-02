import React, { useState, useEffect } from 'react';
import { supabase, type Transaction } from '../lib/supabase';
import { Plus, Search, Download, ArrowUpRight, TrendingUp, Filter, Calendar, Briefcase, DollarSign } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';
import TransactionModal from '../components/TransactionModal';
import { motion } from 'motion/react';

export default function Faturamento() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchTransactions();
  }, []);

  async function fetchTransactions() {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    let query = supabase
      .from('transactions')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('type', 'income') // Key difference: Only incomes
      .order('date', { ascending: false });

    const { data, error } = await query;
    if (data) setTransactions(data);
    setLoading(false);
  }

  const startCurrent = startOfMonth(selectedMonth);
  const endCurrent = endOfMonth(selectedMonth);
  const startLast = startOfMonth(subMonths(selectedMonth, 1));
  const endLast = endOfMonth(subMonths(selectedMonth, 1));

  const currentMonthIncomes = transactions.filter(t => {
    const d = new Date(t.date);
    return d >= startCurrent && d <= endCurrent;
  });

  const lastMonthIncomes = transactions.filter(t => {
    const d = new Date(t.date);
    return d >= startLast && d <= endLast;
  });

  const totalCurrent = currentMonthIncomes.reduce((acc, t) => acc + t.amount, 0);
  const totalLast = lastMonthIncomes.reduce((acc, t) => acc + t.amount, 0);
  
  const growth = totalLast > 0 ? ((totalCurrent - totalLast) / totalLast) * 100 : 0;

  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.category.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
             <Briefcase className="w-6 h-6 text-zlai-primary" />
             Gestão de Faturamento
          </h2>
          <p className="text-slate-500">Controle seus recebimentos de clientes e vendas.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-zlai-primary text-white px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-orange-600 transition-all shadow-lg shadow-orange-100"
        >
          <Plus className="w-5 h-5" />
          Registrar Recebimento
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard 
          title="Faturamento do Mês" 
          value={totalCurrent} 
          subtitle={format(selectedMonth, 'MMMM yyyy', { locale: ptBR })}
          icon={DollarSign}
          color="zlai"
        />
        <MetricCard 
          title="Faturamento Mês Anterior" 
          value={totalLast} 
          subtitle={format(subMonths(selectedMonth, 1), 'MMMM yyyy', { locale: ptBR })}
          icon={Calendar}
          color="slate"
        />
        <MetricCard 
          title="Crescimento" 
          value={growth} 
          isPercentage
          subtitle="Em relação ao mês anterior"
          icon={TrendingUp}
          color={growth >= 0 ? "emerald" : "rose"}
        />
      </div>

      {/* List Area */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col lg:flex-row gap-4 justify-between items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por cliente ou serviço..."
              className="w-full pl-12 pr-4 py-3 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-zlai-primary transition-all font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 w-full lg:w-auto">
             <button className="flex-1 lg:flex-none px-4 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-200 transition-all">
                <Filter className="w-4 h-4" />
                Filtros
             </button>
             <button className="flex-1 lg:flex-none px-4 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-200 transition-all">
                <Download className="w-4 h-4" />
                Exportar
             </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
             <thead>
                <tr className="border-b border-slate-100">
                   <th className="pb-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Cliente / Descrição</th>
                   <th className="pb-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Categoria</th>
                   <th className="pb-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Data</th>
                   <th className="pb-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Valor</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center">
                       <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zlai-primary mx-auto"></div>
                    </td>
                  </tr>
                ) : filteredTransactions.length > 0 ? (
                  filteredTransactions.map(t => (
                    <tr key={t.id} className="group hover:bg-slate-50/50 transition-colors">
                       <td className="py-4">
                          <div className="flex items-center gap-3">
                             <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                <ArrowUpRight className="w-5 h-5" />
                             </div>
                             <div>
                                <p className="font-bold text-slate-800">{t.description}</p>
                                <p className="text-[11px] text-slate-400">ID: {t.id.slice(0, 8)}</p>
                             </div>
                          </div>
                       </td>
                       <td className="py-4">
                          <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
                             {t.category}
                          </span>
                       </td>
                       <td className="py-4 text-sm text-slate-500 font-medium">
                          {format(new Date(t.date), 'dd/MM/yyyy')}
                       </td>
                       <td className="py-4 text-right">
                          <span className="text-emerald-600 font-black text-lg">
                             {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.amount)}
                          </span>
                       </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-400 font-medium">
                       Nenhum recebimento registrado.
                    </td>
                  </tr>
                )}
             </tbody>
          </table>
        </div>
      </div>

      <TransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={fetchTransactions}
        transaction={null}
        defaultType="income"
      />
    </div>
  );
}

function MetricCard({ title, value, subtitle, icon: Icon, color, isPercentage }: any) {
  const colors: any = {
    zlai: "bg-orange-50 text-zlai-primary",
    emerald: "bg-emerald-50 text-emerald-600",
    rose: "bg-rose-50 text-rose-600",
    slate: "bg-slate-50 text-slate-600",
  };

  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm"
    >
      <div className="flex items-center justify-between mb-4">
        <div className={cn("p-3 rounded-2xl", colors[color])}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
      <div>
        <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">{title}</p>
        <h4 className="text-2xl font-black text-slate-800 my-1">
          {isPercentage ? `${value.toFixed(1)}%` : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}
        </h4>
        <p className="text-xs text-slate-400 font-medium capitalize">{subtitle}</p>
      </div>
    </motion.div>
  );
}
