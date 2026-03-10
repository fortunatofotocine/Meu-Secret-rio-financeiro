import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { supabase, type Transaction } from '../lib/supabase';
import { cn } from '../lib/utils';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  transaction?: Transaction | null;
}

export default function TransactionModal({ isOpen, onClose, onSave, transaction }: TransactionModalProps) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (transaction) {
      setDescription(transaction.description);
      setAmount(transaction.amount.toString());
      setType(transaction.type);
      setCategory(transaction.category);
      setDate(new Date(transaction.date).toISOString().split('T')[0]);
    } else {
      setDescription('');
      setAmount('');
      setType('expense');
      setCategory('');
      setDate(new Date().toISOString().split('T')[0]);
    }
  }, [transaction, isOpen]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      alert('Sessão expirada. Por favor, faça login novamente.');
      setLoading(false);
      return;
    }

    const transactionData: any = {
      description,
      amount: parseFloat(amount),
      type,
      category,
      date: new Date(date).toISOString(),
      user_id: session.user.id
    };

    try {
      if (transaction?.id) {
        const { error } = await supabase
          .from('transactions')
          .update(transactionData)
          .eq('id', transaction.id)
          .eq('user_id', session.user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('transactions')
          .insert([transactionData]);
        if (error) throw error;
      }
      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving transaction:', error);
      alert('Erro ao salvar transação. Verifique o console.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
          <h3 className="text-xl font-bold text-slate-800">
            {transaction ? 'Editar Lançamento' : 'Novo Lançamento'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Descrição</label>
            <input
              required
              type="text"
              className="w-full px-4 py-3 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
              placeholder="Ex: Aluguel, Salário..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Valor</label>
              <input
                required
                type="number"
                step="0.01"
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Data</label>
              <input
                required
                type="date"
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Tipo</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType('income')}
                className={cn(
                  "py-3 rounded-2xl font-bold transition-all border-2",
                  type === 'income'
                    ? "bg-emerald-50 border-emerald-500 text-emerald-600"
                    : "bg-white border-slate-100 text-slate-400 hover:bg-slate-50"
                )}
              >
                Entrada
              </button>
              <button
                type="button"
                onClick={() => setType('expense')}
                className={cn(
                  "py-3 rounded-2xl font-bold transition-all border-2",
                  type === 'expense'
                    ? "bg-rose-50 border-rose-500 text-rose-600"
                    : "bg-white border-slate-100 text-slate-400 hover:bg-slate-50"
                )}
              >
                Saída
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Categoria</label>
            <input
              required
              type="text"
              className="w-full px-4 py-3 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
              placeholder="Ex: Lazer, Alimentação..."
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>

          <div className="pt-4">
            <button
              disabled={loading}
              type="submit"
              className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              {loading ? 'Salvando...' : 'Salvar Lançamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
