import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Target, 
  Plus, 
  TrendingUp, 
  Calendar, 
  Wallet, 
  ChevronRight,
  TrendingDown,
  Clock,
  CheckCircle2,
  AlertCircle,
  Edit3
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format, differenceInMonths, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import GoalModal from '../components/GoalModal';
import GoalContributionModal from '../components/GoalContributionModal';

interface Goal {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string | null;
  category: string;
  icon: string | null;
  status: 'in_progress' | 'completed' | 'paused';
}

export default function Metas() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [isContributionModalOpen, setIsContributionModalOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);

  useEffect(() => {
    fetchGoals();
  }, []);

  async function fetchGoals() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('financial_goals')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGoals(data || []);
    } catch (error) {
      console.error('Erro ao buscar metas:', error);
    } finally {
      setLoading(false);
    }
  }

  const getStatusConfig = (status: string, progress: number) => {
    if (progress >= 100) return { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50', label: 'Concluída' };
    if (status === 'paused') return { icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50', label: 'Pausada' };
    return { icon: Target, color: 'text-zlai-primary', bg: 'bg-orange-50', label: 'Em andamento' };
  };

  const calculateMonthlySaving = (target: number, current: number, dateStr: string | null) => {
    if (!dateStr) return null;
    const remaining = target - current;
    if (remaining <= 0) return 0;
    
    const targetDate = new Date(dateStr);
    const months = differenceInMonths(targetDate, new Date());
    return months > 0 ? remaining / months : remaining;
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Metas Financeiras</h1>
          <p className="text-slate-500 mt-1">Transforme seus sonhos em objetivos reais.</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            setSelectedGoal(null);
            setIsGoalModalOpen(true);
          } }
          className="flex items-center justify-center gap-2 bg-zlai-primary text-white px-6 py-3 rounded-2xl font-semibold shadow-lg shadow-orange-200 hover:bg-orange-600 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nova Meta
        </motion.button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 bg-white rounded-3xl border border-slate-100 animate-pulse" />
          ))}
        </div>
      ) : goals.length === 0 ? (
        <div className="bg-white rounded-[2rem] p-12 text-center border border-slate-100 shadow-sm">
          <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Target className="w-10 h-10 text-zlai-primary" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Nenhuma meta cadastrada</h2>
          <p className="text-slate-500 max-w-sm mx-auto mb-8">
            Comece definindo seu primeiro objetivo financeiro para acompanhar seu progresso.
          </p>
          <button
            onClick={() => setIsGoalModalOpen(true)}
            className="text-zlai-primary font-semibold hover:underline"
          >
            Cadastrar minha primeira meta
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {goals.map((goal) => {
            const progress = Math.min((goal.current_amount / goal.target_amount) * 100, 100);
            const statusConfig = getStatusConfig(goal.status, progress);
            const monthlySaving = calculateMonthlySaving(goal.target_amount, goal.current_amount, goal.target_date);

            return (
              <motion.div
                key={goal.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300 group relative overflow-hidden"
              >
                {/* Header: Icon, Info, Status & Edit */}
                <div className="flex items-start justify-between gap-3 mb-6">
                  <div className="flex items-start gap-4 min-w-0 flex-1">
                    <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-2xl shadow-inner group-hover:bg-orange-50 group-hover:scale-110 transition-all duration-300 shrink-0">
                      {goal.icon || '🎯'}
                    </div>
                    <div className="min-w-0 flex-1 pt-1">
                      <h3 className="font-bold text-zlai-dark group-hover:text-zlai-primary transition-colors truncate uppercase text-sm sm:text-base leading-tight">
                        {goal.name}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">{goal.category}</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className={`px-2.5 py-1 rounded-full ${statusConfig.bg} ${statusConfig.color} text-[9px] font-black uppercase tracking-tighter flex items-center gap-1 shadow-sm border border-current/10`}>
                      <statusConfig.icon className="w-2.5 h-2.5" />
                      {statusConfig.label}
                    </div>
                    <button 
                      onClick={() => {
                        setSelectedGoal(goal);
                        setIsGoalModalOpen(true);
                      }}
                      className="p-1.5 bg-slate-50 text-slate-400 hover:text-zlai-primary hover:bg-orange-50 rounded-lg transition-all border border-slate-100 hover:border-orange-100"
                      title="Editar meta"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Progress Tracking */}
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Acumulado</p>
                      <p className="text-lg font-bold text-slate-900">
                        {goal.current_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Objetivo</p>
                      <p className="text-sm font-medium text-slate-600">
                        {goal.target_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="relative h-3 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                      className={`absolute inset-y-0 left-0 rounded-full ${progress >= 100 ? 'bg-emerald-500' : 'bg-zlai-primary'} shadow-[0_0_10px_rgba(255,106,0,0.3)]`}
                    />
                  </div>
                  
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-zlai-primary">{progress.toFixed(0)}% atingido</span>
                    <span className="text-slate-400">Falta {(goal.target_amount - goal.current_amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>
                </div>

                {/* Prediction / Footer */}
                <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between">
                  {goal.target_date ? (
                    <div className="flex items-center gap-2 text-slate-500">
                      <Calendar className="w-4 h-4" />
                      <span className="text-xs">{format(new Date(goal.target_date), "MMM 'de' yyyy", { locale: ptBR })}</span>
                    </div>
                  ) : (
                    <div />
                  )}
                  
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setSelectedGoal(goal);
                      setIsContributionModalOpen(true);
                    }}
                    className="bg-slate-900 text-white p-2 rounded-xl shadow-lg hover:bg-slate-800 transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                  </motion.button>
                </div>

                {/* Monthly Saving Tip */}
                {monthlySaving !== null && monthlySaving > 0 && progress < 100 && (
                  <div className="mt-4 bg-orange-50/50 rounded-2xl p-4 flex items-start gap-3">
                    <TrendingUp className="w-4 h-4 text-zlai-primary mt-0.5" />
                    <p className="text-[10px] text-orange-900 leading-relaxed">
                      Guarde <span className="font-bold">{monthlySaving.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>/mês para atingir seu objetivo no prazo.
                    </p>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      <GoalModal 
        isOpen={isGoalModalOpen} 
        onClose={() => setIsGoalModalOpen(false)} 
        onSave={fetchGoals} 
        goal={selectedGoal} 
      />

      <GoalContributionModal
        isOpen={isContributionModalOpen}
        onClose={() => setIsContributionModalOpen(false)}
        onSave={fetchGoals}
        goal={selectedGoal}
      />
    </div>
  );
}
