import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, TrendingUp, Calendar, Wallet } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface GoalContributionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  goal: any;
}

export default function GoalContributionModal({ isOpen, onClose, onSave, goal }: GoalContributionModalProps) {
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('goal_contributions')
        .insert([{
          goal_id: goal.id,
          user_id: user.id,
          amount: parseFloat(amount),
          date,
          description: description || `Aporte para ${goal.name}`
        }]);

      if (error) throw error;
      onSave();
      onClose();
      // Reset
      setAmount('');
      setDescription('');
    } catch (error) {
      console.error('Erro ao adicionar aporte:', error);
      alert('Erro ao processar aporte.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !goal) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white w-full max-w-md max-h-[90vh] rounded-[2.5rem] shadow-2xl overflow-y-auto border border-slate-100 custom-scrollbar"
        >
          <div className="p-6 sm:p-8">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center">
                  <TrendingUp className="text-zlai-primary w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Adicionar Valor</h2>
                  <p className="text-xs text-slate-500">Meta: {goal.name}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 ml-1">Valor do Aporte</label>
                <div className="relative">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R$</span>
                  <input
                    type="number"
                    required
                    step="0.01"
                    autoFocus
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0,00"
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-14 pr-6 focus:ring-2 focus:ring-zlai-primary transition-all outline-none text-zlai-dark text-xl font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 ml-1">Data</label>
                <div className="relative">
                  <Calendar className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-14 pr-6 focus:ring-2 focus:ring-zlai-primary transition-all outline-none text-zlai-dark font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 ml-1">Observação (Opcional)</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Parte do bônus"
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 focus:ring-2 focus:ring-zlai-primary transition-all outline-none text-zlai-dark font-medium"
                />
              </div>

              <div className="pt-2 flex gap-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-4 rounded-2xl font-bold text-slate-500 border border-slate-100 hover:bg-slate-50 transition-all font-sans"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || !amount}
                  className="flex-1 bg-zlai-primary text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-orange-100 hover:bg-orange-600 transition-all disabled:opacity-50"
                >
                  {loading ? 'Processando...' : 'Confirmar Aporte ZLAI'}
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
