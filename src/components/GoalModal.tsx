import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Target, Calendar, Wallet, Smile } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface GoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  goal?: any;
}

const CATEGORIES = ['Viagem', 'Veículo', 'Investimento', 'Reserva', 'Casa Própria', 'Educação', 'Lazer', 'Outros'];
const EMOJIS = ['🎯', '🏠', '🚗', '✈️', '💰', '🎓', '🏥', '🎮', '📱', '💍', '🏔️', '🏖️', '🏍️', '🚲', '🍕'];

export default function GoalModal({ isOpen, onClose, onSave, goal }: GoalModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    target_amount: '',
    current_amount: '0',
    target_date: '',
    category: 'Outros',
    icon: '🎯',
    status: 'in_progress'
  });

  useEffect(() => {
    if (goal) {
      setFormData({
        name: goal.name,
        target_amount: goal.target_amount.toString(),
        current_amount: goal.current_amount.toString(),
        target_date: goal.target_date || '',
        category: goal.category,
        icon: goal.icon || '🎯',
        status: goal.status
      });
    } else {
      setFormData({
        name: '',
        target_amount: '',
        current_amount: '0',
        target_date: '',
        category: 'Outros',
        icon: '🎯',
        status: 'in_progress'
      });
    }
  }, [goal, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const payload = {
        ...formData,
        user_id: user.id,
        target_amount: parseFloat(formData.target_amount),
        current_amount: parseFloat(formData.current_amount),
        target_date: formData.target_date || null
      };

      let error;
      if (goal) {
        ({ error } = await supabase
          .from('financial_goals')
          .update(payload)
          .eq('id', goal.id));
      } else {
        ({ error } = await supabase
          .from('financial_goals')
          .insert([payload]));
      }

      if (error) throw error;
      onSave();
      onClose();
    } catch (error) {
      console.error('Erro ao salvar meta:', error);
      alert('Erro ao salvar meta. Verifique os dados.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white w-full max-w-lg max-h-[90vh] rounded-[2.5rem] shadow-2xl overflow-y-auto border border-slate-100 custom-scrollbar"
        >
          <div className="p-6 sm:p-8">
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center">
                  <Target className="text-zlai-primary w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900">
                  {goal ? 'Editar Meta' : 'Nova Meta Financeira'}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-2 ml-1">Nome da Meta</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Viagem para o Japão"
                    className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 focus:ring-2 focus:ring-zlai-primary transition-all outline-none text-slate-800 placeholder:text-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2 ml-1">Valor do Objetivo</label>
                  <div className="relative">
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R$</span>
                    <input
                      type="number"
                      required
                      step="0.01"
                      value={formData.target_amount}
                      onChange={(e) => setFormData({ ...formData, target_amount: e.target.value })}
                      placeholder="0,00"
                      className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-14 pr-6 focus:ring-2 focus:ring-zlai-primary transition-all outline-none text-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2 ml-1 text-slate-400">Já guardado (Opcional)</label>
                  <div className="relative">
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 font-bold">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.current_amount}
                      onChange={(e) => setFormData({ ...formData, current_amount: e.target.value })}
                      placeholder="0,00"
                      className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-14 pr-6 focus:ring-2 focus:ring-zlai-primary transition-all outline-none text-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2 ml-1">Categoria</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 focus:ring-2 focus:ring-zlai-primary transition-all outline-none text-slate-800 appearance-none"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2 ml-1">Data Desejada (Opcional)</label>
                  <div className="relative">
                    <Calendar className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input
                      type="date"
                      value={formData.target_date}
                      onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
                      className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-14 pr-6 focus:ring-2 focus:ring-zlai-primary transition-all outline-none text-slate-800"
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-3 ml-1">Escolha um Ícone</label>
                  <div className="flex flex-wrap gap-3">
                    {EMOJIS.map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setFormData({ ...formData, icon: emoji })}
                        className={`w-12 h-12 flex items-center justify-center text-xl rounded-xl transition-all ${
                          formData.icon === emoji 
                            ? 'bg-zlai-primary shadow-lg shadow-orange-200 scale-110' 
                            : 'bg-slate-50 hover:bg-slate-100'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4 flex gap-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-4 px-6 rounded-2xl font-bold text-slate-500 border border-slate-100 hover:bg-slate-50 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-zlai-primary text-white py-4 px-6 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-orange-200 hover:bg-orange-600 transition-all disabled:opacity-50"
                >
                  {loading ? 'Salvando...' : goal ? 'Salvar ZLAI' : 'Criar Meta ZLAI'}
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
