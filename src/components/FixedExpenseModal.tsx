import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { supabase, type FixedExpense } from '../lib/supabase';
import { cn } from '../lib/utils';

interface FixedExpenseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    expense?: FixedExpense | null;
}

export default function FixedExpenseModal({ isOpen, onClose, onSave, expense }: FixedExpenseModalProps) {
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('');
    const [dueDay, setDueDay] = useState('1');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (expense) {
            setDescription(expense.description);
            setAmount(expense.amount.toString());
            setCategory(expense.category);
            setDueDay(expense.due_day.toString());
        } else {
            setDescription('');
            setAmount('');
            setCategory('');
            setDueDay('1');
        }
    }, [expense, isOpen]);

    if (!isOpen) return null;

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            alert('Você precisa estar logado.');
            setLoading(false);
            return;
        }

        const expenseData = {
            description,
            amount: parseFloat(amount),
            category,
            due_day: parseInt(dueDay),
            active: true,
            user_id: session.user.id
        };

        try {
            if (expense?.id) {
                const { error } = await supabase
                    .from('fixed_expenses')
                    .update(expenseData)
                    .eq('id', expense.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('fixed_expenses')
                    .insert([expenseData]);
                if (error) throw error;
            }
            onSave();
            onClose();
        } catch (error) {
            console.error('Error saving fixed expense:', error);
            alert('Erro ao salvar despesa fixa.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
                    <h3 className="text-xl font-bold text-slate-800">
                        {expense ? 'Editar Despesa Fixa' : 'Nova Despesa Fixa'}
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
                            placeholder="Ex: Aluguel, Internet, Netflix..."
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
                            <label className="block text-sm font-bold text-slate-700 mb-1">Dia do Vencimento</label>
                            <input
                                required
                                type="number"
                                min="1"
                                max="31"
                                className="w-full px-4 py-3 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                                placeholder="1-31"
                                value={dueDay}
                                onChange={(e) => setDueDay(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Categoria</label>
                        <input
                            required
                            type="text"
                            className="w-full px-4 py-3 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                            placeholder="Ex: Moradia, Assinaturas..."
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
                            {loading ? 'Salvando...' : 'Salvar Despesa'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
