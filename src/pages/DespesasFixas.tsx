import React, { useState, useEffect } from 'react';
import { supabase, type FixedExpense, type Transaction } from '../lib/supabase';
import { Plus, Search, Trash2, Edit2, CreditCard, Calendar, CheckCircle2, CircleDollarSign } from 'lucide-react';
import { cn } from '../lib/utils';
import FixedExpenseModal from '../components/FixedExpenseModal';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function DespesasFixas() {
    const [expenses, setExpenses] = useState<FixedExpense[]>([]);
    const [paidIds, setPaidIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState<FixedExpense | null>(null);

    useEffect(() => {
        fetchExpenses();
    }, []);

    async function fetchExpenses() {
        setLoading(true);

        const now = new Date();
        const start = startOfMonth(now).toISOString();
        const end = endOfMonth(now).toISOString();

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // 1. Fetch fixed expenses (Filtered by user)
        // 2. Fetch transactions for current month with fixed_expense_id (Filtered by user)
        const [expensesRes, transRes] = await Promise.all([
            supabase.from('fixed_expenses')
                .select('*')
                .eq('user_id', session.user.id)
                .order('due_day', { ascending: true }),
            supabase.from('transactions')
                .select('fixed_expense_id')
                .eq('user_id', session.user.id)
                .eq('type', 'expense')
                .not('fixed_expense_id', 'is', null)
                .gte('date', start)
                .lte('date', end)
        ]);

        if (expensesRes.data) setExpenses(expensesRes.data);
        if (transRes.data) {
            const ids = transRes.data.map(t => t.fixed_expense_id as string);
            setPaidIds(ids);
        }

        setLoading(false);
    }

    async function handlePay(expense: FixedExpense) {
        if (paidIds.includes(expense.id)) return;

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const transactionData = {
            description: `Pagamento: ${expense.description}`,
            amount: expense.amount,
            type: 'expense',
            category: expense.category,
            date: new Date().toISOString(),
            fixed_expense_id: expense.id,
            user_id: session.user.id
        };

        const { error } = await supabase.from('transactions').insert([transactionData]);

        if (!error) {
            fetchExpenses();
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

    const totalFixed = expenses.reduce((acc, curr) => acc + curr.amount, 0);
    const totalPaid = expenses
        .filter(e => paidIds.includes(e.id))
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
                    className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                >
                    <Plus className="w-5 h-5" />
                    Nova Despesa Fixa
                </button>
            </div>

            {/* Summary Chips */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-indigo-600 rounded-3xl p-6 text-white shadow-xl shadow-indigo-100 flex items-center justify-between overflow-hidden relative">
                    <div className="relative z-10">
                        <p className="text-indigo-100 text-sm font-medium mb-1">Total Mensal</p>
                        <h3 className="text-3xl font-black">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalFixed)}
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
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                                    </td>
                                </tr>
                            ) : expenses.length > 0 ? (
                                expenses.map((e) => {
                                    const isPaid = paidIds.includes(e.id);
                                    return (
                                        <tr key={e.id} className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={cn(
                                                        "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                                                        isPaid ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-600"
                                                    )}>
                                                        <CreditCard className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-800">{e.description}</p>
                                                        <p className="text-xs text-slate-400 font-medium">{e.category}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-medium text-slate-600">
                                                Dia {e.due_day}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-bold text-slate-800">
                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(e.amount)}
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
                                                            onClick={() => handlePay(e)}
                                                            title="Marcar como pago no financeiro"
                                                            className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all flex items-center gap-2"
                                                        >
                                                            <CircleDollarSign className="w-4 h-4" />
                                                            Pagar
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleEdit(e)}
                                                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(e.id)}
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
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                        </div>
                    ) : expenses.length > 0 ? (
                        expenses.map((e) => {
                            const isPaid = paidIds.includes(e.id);
                            return (
                                <div key={e.id} className="p-4 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                                                isPaid ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-600"
                                            )}>
                                                <CreditCard className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800">{e.description}</p>
                                                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{e.category}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-slate-800 whitespace-nowrap">
                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(e.amount)}
                                            </p>
                                            <div className={cn(
                                                "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                                                isPaid ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                                            )}>
                                                {isPaid ? "PAGO" : `DIA ${e.due_day}`}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-end gap-2 pt-2">
                                        {!isPaid && (
                                            <button
                                                onClick={() => handlePay(e)}
                                                className="flex-[2] py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm active:bg-emerald-700 transition-all"
                                            >
                                                <CircleDollarSign className="w-4 h-4" />
                                                Marcar como Pago
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleEdit(e)}
                                            className="flex-1 py-2.5 bg-slate-50 text-slate-600 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border border-slate-100 active:bg-indigo-50 active:text-indigo-600 active:border-indigo-100 transition-all"
                                        >
                                            <Edit2 className="w-3.5 h-3.5" />
                                            Editar
                                        </button>
                                        <button
                                            onClick={() => handleDelete(e.id)}
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
