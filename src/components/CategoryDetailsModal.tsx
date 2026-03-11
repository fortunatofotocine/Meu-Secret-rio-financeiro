import React from 'react';
import { X, ArrowRight, PieChart as PieChartIcon } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';

interface CategoryDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: { name: string; value: number }[];
  colors: string[];
}

export default function CategoryDetailsModal({ isOpen, onClose, data, colors }: CategoryDetailsModalProps) {
  const navigate = useNavigate();
  const total = data.reduce((acc, item) => acc + item.value, 0);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600">
                <PieChartIcon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800">Detalhamento de Gastos</h3>
                <p className="text-sm text-slate-500">Distribuição por categoria este mês</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 group"
            >
              <X className="w-6 h-6 group-hover:text-slate-600" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
            {/* Chart Section */}
            <div className="h-[250px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={colors[index % colors.length]} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ 
                      borderRadius: '16px', 
                      border: 'none', 
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                      padding: '12px'
                    }}
                    itemStyle={{ fontWeight: 'bold' }}
                    formatter={(value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total</span>
                <span className="text-xl font-bold text-slate-800">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)}
                </span>
              </div>
            </div>

            {/* List Section */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest px-1">Categorias</h4>
              <div className="grid grid-cols-1 gap-2">
                {data.sort((a, b) => b.value - a.value).map((item, index) => {
                  const percentage = ((item.value / total) * 100).toFixed(1);
                  const color = colors[data.findIndex(d => d.name === item.name) % colors.length];
                  
                  return (
                    <div key={item.name} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-white hover:shadow-md transition-all group">
                      <div className="flex items-center gap-4">
                        <div 
                          className="w-4 h-4 rounded-full" 
                          style={{ backgroundColor: color }}
                        />
                        <div>
                          <p className="font-bold text-slate-700">{item.name}</p>
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                              <div 
                                className="h-full rounded-full transition-all duration-1000" 
                                style={{ 
                                  width: `${percentage}%`,
                                  backgroundColor: color 
                                }}
                              />
                            </div>
                            <span className="text-xs font-bold text-slate-400">{percentage}%</span>
                          </div>
                        </div>
                      </div>
                      <span className="font-bold text-slate-800">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.value)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-slate-100 bg-slate-50/50">
            <button
              onClick={() => {
                onClose();
                navigate('/financeiro');
              }}
              className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 group"
            >
              Ver todos os lançamentos
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
