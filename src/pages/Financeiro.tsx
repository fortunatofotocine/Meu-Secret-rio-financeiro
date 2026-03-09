import React, { useState, useEffect } from 'react';
import { supabase, type Transaction } from '../lib/supabase';
import { Plus, Search, Download, ArrowUpRight, ArrowDownRight, Trash2, Edit2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import TransactionModal from '../components/TransactionModal';

export default function Financeiro() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  useEffect(() => {
    fetchTransactions();
  }, []);

  async function fetchTransactions() {
    setLoading(true);
    let query = supabase.from('transactions').select('*').order('date', { ascending: false });

    const { data, error } = await query;
    if (data) setTransactions(data);
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Tem certeza que deseja excluir esta transação?')) return;

    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (!error) {
      fetchTransactions();
    } else {
      alert('Erro ao excluir transação.');
    }
  }

  function handleEdit(transaction: Transaction) {
    setEditingTransaction(transaction);
    setIsModalOpen(true);
  }

  function handleAdd() {
    setEditingTransaction(null);
    setIsModalOpen(true);
  }

  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || t.type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Financeiro</h2>
          <p className="text-slate-500">Gerencie suas entradas e saídas.</p>
        </div>
        <button
          onClick={handleAdd}
          className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
        >
          <Plus className="w-5 h-5" />
          Novo Lançamento
        </button>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por descrição ou categoria..."
            className="w-full pl-12 pr-4 py-3 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 lg:pb-0">
          <FilterButton
            active={filterType === 'all'}
            onClick={() => setFilterType('all')}
            label="Todos"
          />
          <FilterButton
            active={filterType === 'income'}
            onClick={() => setFilterType('income')}
            label="Entradas"
            color="emerald"
          />
          <FilterButton
            active={filterType === 'expense'}
            onClick={() => setFilterType('expense')}
            label="Saídas"
            color="rose"
          />
        </div>
        <button className="px-4 py-3 rounded-2xl bg-slate-100 text-slate-600 font-semibold flex items-center justify-center gap-2 hover:bg-slate-200 transition-all">
          <Download className="w-5 h-5" />
          Exportar
        </button>
      </div>

      {/* Transactions List */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Descrição</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Categoria</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Data</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Valor</th>
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
              ) : filteredTransactions.length > 0 ? (
                filteredTransactions.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                          t.type === 'income' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                        )}>
                          {t.type === 'income' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{t.description}</p>
                          <p className="text-xs text-slate-500">ID: {t.id.slice(0, 8)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
                        {t.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {format(new Date(t.date), 'dd/MM/yyyy')}
                    </td>
                    <td className={cn(
                      "px-6 py-4 text-sm font-bold",
                      t.type === 'income' ? "text-emerald-600" : "text-rose-600"
                    )}>
                      {t.type === 'income' ? '+' : '-'} {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.amount)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleEdit(t)}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(t.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                    Nenhum lançamento encontrado.
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
        transaction={editingTransaction}
      />
    </div>
  );
}

function FilterButton({ active, onClick, label, color = 'indigo' }: any) {
  const colors: any = {
    indigo: active ? "bg-indigo-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50",
    emerald: active ? "bg-emerald-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50",
    rose: active ? "bg-rose-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50",
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "px-6 py-3 rounded-2xl font-bold text-sm transition-all border border-slate-200 whitespace-nowrap",
        colors[color]
      )}
    >
      {label}
    </button>
  );
}
