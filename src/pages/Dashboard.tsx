import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Wallet, Calendar, ArrowUpRight, ArrowDownRight, Edit3, Check, X, AlertCircle } from 'lucide-react';
import { supabase, type Transaction, type Event, type Profile } from '../lib/supabase';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export default function Dashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditingIncome, setIsEditingIncome] = useState(false);
  const [newIncome, setNewIncome] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const now = new Date();
    const start = startOfMonth(now).toISOString();
    const end = endOfMonth(now).toISOString();

    const { data: { session } } = await supabase.auth.getSession();

    const [transRes, eventsRes, profileRes] = await Promise.all([
      supabase.from('transactions').select('*').gte('date', start).lte('date', end).order('date', { ascending: false }),
      supabase.from('events').select('*').gte('start_time', now.toISOString()).order('start_time', { ascending: true }).limit(5),
      session ? supabase.from('profiles').select('*').eq('id', session.user.id).single() : Promise.resolve({ data: null })
    ]);

    if (transRes.data) setTransactions(transRes.data);
    if (eventsRes.data) setUpcomingEvents(eventsRes.data);
    if (profileRes.data) {
      setProfile(profileRes.data);
      setNewIncome(profileRes.data.monthly_income.toString());
    }
    setLoading(false);
  }

  async function handleUpdateIncome() {
    if (!profile) return;
    const amount = parseFloat(newIncome);
    if (isNaN(amount)) return;

    const { error } = await supabase
      .from('profiles')
      .update({ monthly_income: amount })
      .eq('id', profile.id);

    if (!error) {
      setProfile({ ...profile, monthly_income: amount });
      setIsEditingIncome(false);
    }
  }

  const incomeFromTransactions = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const expenses = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);

  // O salário mensal definido pelo usuário + rendas extras lançadas
  const totalMonthlyBudget = (profile?.monthly_income || 0) + incomeFromTransactions;
  const remainingBudget = totalMonthlyBudget - expenses;
  const isOverBudget = remainingBudget < 0;

  const categoryData = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc: any[], t) => {
      const existing = acc.find(item => item.name === t.category);
      if (existing) {
        existing.value += t.amount;
      } else {
        acc.push({ name: t.category, value: t.amount });
      }
      return acc;
    }, []);

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Visão Geral</h2>
          <p className="text-slate-500">Bem-vindo ao seu secretário financeiro pessoal.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-600">
              {format(new Date(), "MMMM yyyy", { locale: ptBR })}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Renda Mensal Card */}
        <motion.div
          whileHover={{ y: -4 }}
          className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-2xl bg-blue-50 text-blue-600">
              <TrendingUp className="w-6 h-6" />
            </div>
            {!isEditingIncome ? (
              <button
                onClick={() => setIsEditingIncome(true)}
                className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                title="Editar Salário"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            ) : null}
          </div>

          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">Meu Salário Base</p>
            {isEditingIncome ? (
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="number"
                  value={newIncome}
                  onChange={(e) => setNewIncome(e.target.value)}
                  className="w-full bg-slate-50 border border-indigo-100 rounded-lg px-2 py-1 text-lg font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
                <button onClick={handleUpdateIncome} className="p-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600">
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={() => setIsEditingIncome(false)} className="p-1.5 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <h4 className="text-2xl font-bold text-slate-800">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(profile?.monthly_income || 0)}
              </h4>
            )}
          </div>
        </motion.div>

        <StatCard
          title="Saídas do Mês"
          value={expenses}
          icon={TrendingDown}
          color="rose"
        />

        <StatCard
          title="Status do Orçamento"
          value={remainingBudget}
          icon={isOverBudget ? AlertCircle : Wallet}
          color={isOverBudget ? "rose" : "emerald"}
          isStatus
          statusText={isOverBudget ? "No Vermelho!" : "No Azul"}
        />

        <StatCard
          title="Sobrou no Bolso"
          value={remainingBudget}
          icon={TrendingUp}
          color="amber"
          isProfit
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart Section */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-lg text-slate-800">Gastos por Categoria</h3>
            <button className="text-sm font-medium text-indigo-600 hover:text-indigo-700">Ver Detalhes</button>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Upcoming Events */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-lg text-slate-800">Próximos Compromissos</h3>
            <Calendar className="w-5 h-5 text-slate-400" />
          </div>
          <div className="space-y-4">
            {upcomingEvents.length > 0 ? (
              upcomingEvents.map((event) => (
                <div key={event.id} className="flex items-start gap-4 p-3 rounded-2xl hover:bg-slate-50 transition-colors">
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 flex flex-col items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-indigo-400 uppercase">{format(new Date(event.start_time), 'MMM')}</span>
                    <span className="text-lg font-bold text-indigo-600 leading-none">{format(new Date(event.start_time), 'dd')}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 truncate">{event.title}</p>
                    <p className="text-xs text-slate-500">{format(new Date(event.start_time), 'HH:mm')} - {event.description || 'Sem descrição'}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-slate-400">Nenhum compromisso agendado.</p>
              </div>
            )}
          </div>
          <button className="w-full mt-6 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
            Ver Agenda Completa
          </button>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-lg text-slate-800">Últimos Lançamentos</h3>
          <button className="text-sm font-medium text-indigo-600 hover:text-indigo-700">Ver Todos</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Descrição</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Categoria</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Data</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.slice(0, 5).map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center",
                        t.type === 'income' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                      )}>
                        {t.type === 'income' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                      </div>
                      <span className="font-medium text-slate-700">{t.description}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
                      {t.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {format(new Date(t.date), 'dd/MM/yyyy')}
                  </td>
                  <td className={cn(
                    "px-6 py-4 text-sm font-bold text-right",
                    t.type === 'income' ? "text-emerald-600" : "text-rose-600"
                  )}>
                    {t.type === 'income' ? '+' : '-'} {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, trend, isProfit, isStatus, statusText }: any) {
  const colors: any = {
    indigo: "bg-indigo-50 text-indigo-600",
    emerald: "bg-emerald-50 text-emerald-600",
    rose: "bg-rose-50 text-rose-600",
    amber: "bg-amber-50 text-amber-600",
  };

  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden"
    >
      <div className="flex items-center justify-between mb-4">
        <div className={cn("p-3 rounded-2xl", colors[color])}>
          <Icon className="w-6 h-6" />
        </div>
        {isStatus && (
          <div className={cn(
            "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm",
            value >= 0 ? "bg-emerald-500 text-white" : "bg-rose-500 text-white animate-pulse"
          )}>
            {statusText}
          </div>
        )}
        {trend && !isStatus && (
          <div className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold",
            trend === 'up' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
          )}>
            {trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            12%
          </div>
        )}
      </div>
      <div>
        <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
        <h4 className={cn(
          "text-2xl font-bold",
          isProfit ? (value >= 0 ? "text-emerald-600" : "text-rose-600") : "text-slate-800"
        )}>
          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.abs(value))}
        </h4>
      </div>

      {isStatus && value < 0 && (
        <div className="absolute bottom-0 left-0 w-full h-1 bg-rose-500"></div>
      )}
    </motion.div>
  );
}
