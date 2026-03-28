import React, { useState, useEffect } from 'react';
import { supabase, type FixedExpense, type FixedExpenseInstance, type Transaction } from '../lib/supabase';
import { Plus, Search, Trash2, Edit2, CreditCard, Calendar, CheckCircle2, CircleDollarSign } from 'lucide-react';
import { cn } from '../lib/utils';
import FixedExpenseModal from '../components/FixedExpenseModal';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function DespesasFixas() {
    const [expenses, setExpenses] = useState<FixedExpense[]>([]);
    const [instances, setInstances] = useState<FixedExpenseInstance[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState<FixedExpense | null>(null);

    useEffect(() => {
        fetchExpenses();
    }, []);

    async function fetchExpenses() {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const now = new Date();
        const start = startOfMonth(now).toISOString();
        const end = endOfMonth(now).toISOString();
        const startStr = format(startOfMonth(now), 'yyyy-MM-dd');

        // 1. Fetch rules (fixed_expenses)
        const { data: rulesRes, error: rulesErr } = await supabase
            .from('fixed_expenses')
            .select('*')
            .eq('user_id', session.user.id)
            .eq('active', true);
        
        if (rulesErr) throw rulesErr;
        setExpenses(rulesRes || []);

        // 2. Fetch instances for this month
        const { data: instRes, error: instErr } = await supabase
            .from('fixed_expense_instances')
            .select('*')
            .eq('user_id', session.user.id)
            .gte('due_date', start)
            .lte('due_date', end);
        
        if (instErr) throw instErr;

        // 3. Logic for 'fixed' (monthly) rules that might not have an instance this month
        const monthlyRules = rulesRes?.filter(r => r.type === 'fixed') || [];
        const missingInstances = [];

        for (const rule of monthlyRules) {
            const hasInstance = instRes?.some(i => i.fixed_expense_id === rule.id);
            if (!hasInstance) {
                // Determine due date for this month
                const dueDate = new Date(now.getFullYear(), now.getMonth(), rule.due_day, 12, 0, 0);
                missingInstances.push({
                    user_id: session.user.id,
                    fixed_expense_id: rule.id,
                    amount: rule.amount,
                    due_date: format(dueDate, 'yyyy-MM-dd'),
                    status: 'pending'
                });
            }
        }

        if (missingInstances.length > 0) {
            const { data: newInsts, error: createErr } = await supabase
                .from('fixed_expense_instances')
                .insert(missingInstances)
                .select();
            
            if (!createErr && newInsts) {
                setInstances([...(instRes || []), ...newInsts]);
            } else {
                setInstances(instRes || []);
            }
        } else {
            setInstances(instRes || []);
        }

        setLoading(false);
    }

    async function handlePay(instance: FixedExpenseInstance) {
        if (instance.status === 'paid') return;

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const rule = expenses.find(e => e.id === instance.fixed_expense_id);
        if (!rule) return;

        const transactionData = {
            description: `Pagamento: ${rule.description} ${instance.installment_label ? `(${instance.installment_label})` : ''}`,
            amount: instance.amount,
            type: 'expense',
            category: rule.category,
            date: new Date().toISOString(),
            fixed_expense_id: rule.id,
            fixed_expense_instance_id: instance.id,
            user_id: session.user.id
        };

        const { error } = await supabase.from('transactions').insert([transactionData]);

        if (!error) {
            // Update instance status locally
            const { error: updateErr } = await supabase
                .from('fixed_expense_instances')
                .update({ status: 'paid', paid_at: new Date().toISOString() })
                .eq('id', instance.id);
            
            if (!updateErr) {
                fetchExpenses();
            } else {
                alert('Pagamento registrado, mas houve erro ao atualizar status do vencimento.');
            }
        } else {
            alert('Erro ao registrar pagamento.');
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Excluir esta despesa fixa?')) return;
        const { error } = await supabase.from('fixed_expenses').delete().eq('id', id);
        if (!error) fetchExpenses();
    }

    function handleEdit(expense: FixedExpense) {
        setEditingExpense(expense);
        setIsModalOpen(true);
    }

    function handleAdd() {
        setEditingExpense(null);
        setIsModalOpen(true);
    }

    const totalMonth = instances.reduce((acc, curr) => acc + curr.amount, 0);
    const totalPaid = instances
        .filter(i => i.status === 'paid')
        .reduce((acc, curr) => acc + curr.amount, 0);

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Despesas Fixas</h2>
                    <p className="text-slate-500">Controle o que você paga todo mês.</p>
                </div>
                <button
                    onClick={handleAdd}
                    className="bg-zlai-primary text-white px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-orange-600 transition-all shadow-lg shadow-orange-100"
                >
                    <Plus className="w-5 h-5" />
                    Nova Despesa ZLAI
                </button>
            </div>

            {/* Summary Chips */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-zlai-primary rounded-3xl p-6 text-white shadow-xl shadow-orange-100 flex items-center justify-between overflow-hidden relative">
                    <div className="relative z-10">
                        <p className="text-orange-100 text-sm font-medium mb-1 uppercase tracking-widest font-bold">Total Mensal</p>
                        <h3 className="text-3xl font-black">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalMonth)}
                        </h3>
                    </div>
                    <CreditCard className="w-12 h-12 text-white/20 relative z-10" />
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10" />
                </div>

                <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex items-center justify-between overflow-hidden relative">
                    <div className="relative z-10">
                        <p className="text-slate-500 text-sm font-medium mb-1">Pago em {format(new Date(), 'MMMM', { locale: ptBR })}</p>
                        <h3 className="text-3xl font-black text-emerald-600">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPaid)}
                        </h3>
                    </div>
                    <CheckCircle2 className="w-12 h-12 text-emerald-100" />
                </div>
            </div>

            {/* List */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                    <h3 className="font-bold text-lg text-slate-800">Status de Pagamentos</h3>
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50">
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Descrição</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Vencimento</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Valor</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zlai-primary mx-auto"></div>
                                    </td>
                                </tr>
                            ) : instances.length > 0 ? (
                                instances.map((instance) => {
                                    const rule = expenses.find(e => e.id === instance.fixed_expense_id);
                                    if (!rule) return null;
                                    const isPaid = instance.status === 'paid';
                                    return (
                                        <tr key={instance.id} className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={cn(
                                                        "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                                                        isPaid ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-600"
                                                    )}>
                                                        <CreditCard className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-bold text-slate-800">{rule.description}</p>
                                                            {instance.installment_label && (
                                                                <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md font-bold uppercase">
                                                                    {instance.installment_label}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-slate-400 font-medium">{rule.category}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-medium text-slate-600">
                                                {format(new Date(instance.due_date + 'T12:00:00'), 'dd/MM/yyyy')}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-bold text-slate-800">
                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(instance.amount)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className={cn(
                                                    "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold",
                                                    isPaid ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                                                )}>
                                                    <div className={cn("w-1.5 h-1.5 rounded-full", isPaid ? "bg-emerald-500" : "bg-amber-500")} />
                                                    {isPaid ? "PAGO" : "PENDENTE"}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {!isPaid && (
                                                        <button
                                                            onClick={() => handlePay(instance)}
                                                            title="Marcar como pago no financeiro"
                                                            className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all flex items-center gap-2"
                                                        >
                                                            <CircleDollarSign className="w-4 h-4" />
                                                            Pagar
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleEdit(rule)}
                                                        className="p-2 text-slate-400 hover:text-zlai-primary hover:bg-orange-50 rounded-lg transition-all"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(rule.id)}
                                                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                        Nenhuma despesa fixa cadastrada.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden divide-y divide-slate-100">
                    {loading ? (
                        <div className="px-6 py-12 text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zlai-primary mx-auto"></div>
                        </div>
                    ) : instances.length > 0 ? (
                        instances.map((instance) => {
                            const rule = expenses.find(e => e.id === instance.fixed_expense_id);
                            if (!rule) return null;
                            const isPaid = instance.status === 'paid';
                            return (
                                <div key={instance.id} className="p-4 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                                                isPaid ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-600"
                                            )}>
                                                <CreditCard className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-bold text-slate-800">{rule.description}</p>
                                                    {instance.installment_label && (
                                                        <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md font-bold uppercase">
                                                            {instance.installment_label}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{rule.category}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-slate-800 whitespace-nowrap">
                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(instance.amount)}
                                            </p>
                                            <div className={cn(
                                                "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                                                isPaid ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                                            )}>
                                                {isPaid ? "PAGO" : format(new Date(instance.due_date + 'T12:00:00'), 'dd/MM')}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-end gap-2 pt-2">
                                        {!isPaid && (
                                            <button
                                                onClick={() => handlePay(instance)}
                                                className="flex-[2] py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm active:bg-emerald-700 transition-all"
                                            >
                                                <CircleDollarSign className="w-4 h-4" />
                                                Marcar como Pago
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleEdit(rule)}
                                            className="flex-1 py-2.5 bg-slate-50 text-slate-600 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border border-slate-100 active:bg-orange-50 active:text-zlai-primary active:border-orange-100 transition-all"
                                        >
                                            <Edit2 className="w-3.5 h-3.5" />
                                            Editar
                                        </button>
                                        <button
                                            onClick={() => handleDelete(rule.id)}
                                            className="flex-1 py-2.5 bg-slate-50 text-slate-600 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border border-slate-100 active:bg-rose-50 active:text-rose-600 active:border-rose-100 transition-all"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            Excluir
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="px-6 py-12 text-center text-slate-400">
                            Nenhuma despesa fixa cadastrada.
                        </div>
                    )}
                </div>
            </div>

            <FixedExpenseModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={fetchExpenses}
                expense={editingExpense}
            />
        </div>
    );
}
