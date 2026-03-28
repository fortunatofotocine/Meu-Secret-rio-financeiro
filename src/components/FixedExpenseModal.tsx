import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { supabase, type FixedExpense, type FixedExpenseType } from '../lib/supabase';
import { cn } from '../lib/utils';
import { addMonths, format } from 'date-fns';

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
    const [type, setType] = useState<FixedExpenseType>('fixed');
    const [installmentCount, setInstallmentCount] = useState('2');
    const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [notifyWhatsapp, setNotifyWhatsapp] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (expense) {
            setDescription(expense.description);
            setAmount(expense.amount.toString());
            setCategory(expense.category);
            setDueDay(expense.due_day.toString());
            setType(expense.type || 'fixed');
            setInstallmentCount(expense.installment_count?.toString() || '2');
            setStartDate(expense.start_date || format(new Date(), 'yyyy-MM-dd'));
            setNotifyWhatsapp(expense.notify_whatsapp || false);
        } else {
            setDescription('');
            setAmount('');
            setCategory('');
            setDueDay('1');
            setType('fixed');
            setInstallmentCount('2');
            setStartDate(format(new Date(), 'yyyy-MM-dd'));
            setNotifyWhatsapp(false);
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
            user_id: session.user.id,
            type,
            installment_count: type === 'installment' ? parseInt(installmentCount) : null,
            installment_amount: type === 'installment' ? parseFloat(amount) : null,
            total_amount: type === 'installment' ? parseFloat(amount) * parseInt(installmentCount) : parseFloat(amount),
            start_date: startDate,
            notify_whatsapp: notifyWhatsapp
        };

        setLoading(true);

        try {
            if (expense?.id) {
                const { error } = await supabase
                    .from('fixed_expenses')
                    .update(expenseData)
                    .eq('id', expense.id);
                if (error) throw error;
            } else {
                const { data, error } = await supabase
                    .from('fixed_expenses')
                    .insert([expenseData])
                    .select()
                    .single();
                
                if (error) throw error;

                if (data) {
                    // Generate instances
                    const instances = [];
                    const baseDate = new Date(startDate + 'T12:00:00'); // Use mid-day to avoid TZ issues
                    
                    if (type === 'fixed') {
                        // Generate only for the current month
                        instances.push({
                            user_id: session.user.id,
                            fixed_expense_id: data.id,
                            type: 'fixed',
                            amount: parseFloat(amount),
                            due_date: format(baseDate, 'yyyy-MM-dd'),
                            status: 'pending'
                        });
                    } else if (type === 'installment') {
                        const count = parseInt(installmentCount);
                        for (let i = 1; i <= count; i++) {
                            const dueDate = addMonths(baseDate, i - 1);
                            instances.push({
                                user_id: session.user.id,
                                fixed_expense_id: data.id,
                                type: 'installment',
                                installment_number: i,
                                installment_label: `${i}/${count}`,
                                amount: parseFloat(amount),
                                due_date: format(dueDate, 'yyyy-MM-dd'),
                                status: 'pending'
                            });
                        }
                    } else if (type === 'one_time') {
                        instances.push({
                            user_id: session.user.id,
                            fixed_expense_id: data.id,
                            type: 'one_time',
                            amount: parseFloat(amount),
                            due_date: format(baseDate, 'yyyy-MM-dd'),
                            status: 'pending'
                        });
                    }

                    if (instances.length > 0) {
                        const { error: instError } = await supabase
                            .from('fixed_expense_instances')
                            .insert(instances);
                        if (instError) throw instError;
                    }
                }
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
                    <h3 className="text-xl font-bold text-zlai-dark uppercase tracking-tighter">
                        {expense ? 'Editar Despesa ZLAI' : 'Nova Despesa ZLAI'}
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
                            className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 focus:ring-2 focus:ring-zlai-primary transition-all font-medium text-zlai-dark outline-none"
                            placeholder="Ex: Aluguel, Internet, Netflix..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Tipo</label>
                            <select
                                className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 focus:ring-2 focus:ring-zlai-primary transition-all font-medium text-zlai-dark outline-none"
                                value={type}
                                onChange={(e) => setType(e.target.value as FixedExpenseType)}
                            >
                                <option value="fixed">Mensal (Fixo)</option>
                                <option value="installment">Parcelado</option>
                                <option value="one_time">Único (Avulso)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Categoria</label>
                            <input
                                required
                                type="text"
                                className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 focus:ring-2 focus:ring-zlai-primary transition-all font-medium text-zlai-dark outline-none"
                                placeholder="Ex: Moradia..."
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">
                                {type === 'installment' ? 'Valor da Parcela' : 'Valor'}
                            </label>
                            <input
                                required
                                type="number"
                                step="0.01"
                                className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 focus:ring-2 focus:ring-zlai-primary transition-all font-medium text-zlai-dark outline-none"
                                placeholder="0,00"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                            />
                        </div>
                        
                        {type === 'fixed' ? (
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Dia do Vencimento</label>
                                <input
                                    required
                                    type="number"
                                    min="1"
                                    max="31"
                                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 focus:ring-2 focus:ring-zlai-primary transition-all font-medium text-zlai-dark outline-none"
                                    placeholder="1-31"
                                    value={dueDay}
                                    onChange={(e) => setDueDay(e.target.value)}
                                />
                            </div>
                        ) : type === 'installment' ? (
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Qtd Parcelas</label>
                                <input
                                    required
                                    type="number"
                                    min="2"
                                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 focus:ring-2 focus:ring-zlai-primary transition-all font-medium text-zlai-dark outline-none"
                                    value={installmentCount}
                                    onChange={(e) => setInstallmentCount(e.target.value)}
                                />
                            </div>
                        ) : (
                             <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Vencimento</label>
                                <input
                                    required
                                    type="date"
                                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 focus:ring-2 focus:ring-zlai-primary transition-all font-medium text-zlai-dark outline-none"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                />
                            </div>
                        )}
                    </div>

                    {(type === 'installment' || type === 'fixed') && (
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">
                                {type === 'installment' ? 'Primeiro Vencimento' : 'Início do Controle'}
                            </label>
                            <input
                                required
                                type="date"
                                className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 focus:ring-2 focus:ring-zlai-primary transition-all font-medium text-zlai-dark outline-none"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                    )}

                    <div className="flex items-center gap-2 py-2">
                        <input
                            id="notify_whatsapp"
                            type="checkbox"
                            className="w-5 h-5 rounded border-slate-300 text-zlai-primary focus:ring-zlai-primary"
                            checked={notifyWhatsapp}
                            onChange={(e) => setNotifyWhatsapp(e.target.checked)}
                        />
                        <label htmlFor="notify_whatsapp" className="text-sm font-bold text-slate-700">
                            Enviar Lembretes no WhatsApp
                        </label>
                    </div>

                    <div className="pt-4">
                        <button
                            disabled={loading}
                            type="submit"
                            className="w-full bg-zlai-primary text-white py-4 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-orange-600 transition-all shadow-lg shadow-orange-100 disabled:opacity-50"
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
