import React, { useState } from 'react';
import { 
  X, 
  ShieldAlert, 
  UserX, 
  Zap, 
  CheckCircle2, 
  RotateCcw, 
  Trash2, 
  UserCheck, 
  AlertCircle,
  MessageCircle,
  Calendar,
  DollarSign
} from 'lucide-react';
import { Profile } from '../../lib/supabase';
import { AdminService } from '../../services/admin/adminService';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface UserModalProps {
  user: Profile;
  adminId: string;
  onClose: () => void;
  onUpdate: () => void;
}

export default function UserModal({ user, adminId, onClose, onUpdate }: UserModalProps) {
  const [loading, setLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    type: string;
    title: string;
    message: string;
    execute: () => Promise<void>;
  } | null>(null);

  const isSelf = user.id === adminId;

  const handleAction = async (execute: () => Promise<void>) => {
    setLoading(true);
    try {
      await execute();
      onUpdate();
      setConfirmAction(null);
    } catch (error: any) {
      alert(error.message || 'Erro ao executar ação');
    } finally {
      setLoading(false);
    }
  };

  const getSubStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-100 text-emerald-700';
      case 'trialing': return 'bg-blue-100 text-blue-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getAccessStatus = () => {
    if (user.deleted_at) return { label: 'Desativado', color: 'bg-black text-white' };
    if (user.is_blocked) return { label: 'Bloqueado', color: 'bg-red-100 text-red-700' };
    return { label: 'Liberado', color: 'bg-emerald-100 text-emerald-700 font-bold' };
  };

  const access = getAccessStatus();

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-slate-50 shadow-sm">
              <img src={`https://ui-avatars.com/api/?name=${user.full_name}&background=FF6A00&color=fff`} alt="" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 leading-tight">{user.full_name}</h2>
              <p className="text-sm text-slate-400 font-medium">{user.whatsapp_number}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {/* Quick Info Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-50 rounded-2xl">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status Acesso</p>
              <span className={`px-2 py-0.5 rounded-full text-[11px] uppercase font-black ${access.color}`}>
                {access.label}
              </span>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status Assinatura</p>
              <span className={`px-2 py-0.5 rounded-full text-[11px] uppercase font-black ${getSubStatusColor(user.subscription_status || '')}`}>
                {user.subscription_status || 'Sem status'}
              </span>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Criado em</p>
              <p className="text-xs font-bold text-slate-700">{format(new Date(user.created_at), 'dd/MM/yyyy')}</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Expira em</p>
              <p className="text-xs font-bold text-slate-700">
                {user.trial_ends_at ? format(new Date(user.trial_ends_at), 'dd/MM/yyyy') : 'N/A'}
              </p>
            </div>
          </div>

          {/* Detailed Info Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-400 flex items-center gap-2">
              <AlertCircle size={16} />
              INFORMAÇÕES DETALHADAS
            </h3>
            <div className="bg-slate-50 rounded-3xl p-5 space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">ID do Usuário</span>
                <code className="text-xs font-mono bg-white px-2 py-1 rounded-lg border border-slate-100">{user.id}</code>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Papel (Role)</span>
                <span className="font-bold flex items-center gap-2">
                  {user.role === 'admin' ? <ShieldAlert size={14} className="text-orange-500" /> : null}
                  {user.role.toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm pt-4 border-t border-slate-200/50">
                <span className="text-slate-500">Renda Mensal Declarada</span>
                <span className="font-bold text-slate-900">R$ {user.monthly_income?.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* ACTIONS Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-400 flex items-center gap-2">
              <Zap size={16} />
              AÇÕES ADMINISTRATIVAS
            </h3>
            
            {isSelf && (
              <div className="p-4 bg-orange-50 text-orange-700 rounded-2xl flex items-start gap-3 text-sm">
                <AlertCircle size={20} className="shrink-0" />
                <p>Você está visualizando seu próprio perfil. Ações de bloqueio ou remoção de permissão foram desativadas para sua segurança.</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Access Management */}
              {!user.is_blocked ? (
                <button
                  disabled={loading || isSelf}
                  onClick={() => setConfirmAction({
                    type: 'block',
                    title: 'Bloquear Usuário',
                    message: 'Tem certeza que deseja bloquear o acesso deste usuário? Ele será desconectado e não conseguirá entrar no sistema.',
                    execute: () => AdminService.blockUser(adminId, user)
                  })}
                  className="flex items-center gap-3 p-4 border border-red-100 text-red-600 rounded-2xl hover:bg-red-50 transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <UserX size={20} />
                  <span>Bloquear Acesso</span>
                </button>
              ) : (
                <button
                  disabled={loading}
                  onClick={() => handleAction(() => AdminService.unblockUser(adminId, user))}
                  className="flex items-center gap-3 p-4 border border-emerald-100 text-emerald-600 rounded-2xl hover:bg-emerald-50 transition-all font-bold"
                >
                  <UserCheck size={20} />
                  <span>Desbloquear Acesso</span>
                </button>
              )}

              {/* Trial Management */}
              <button
                disabled={loading}
                onClick={() => setConfirmAction({
                  type: 'trial',
                  title: 'Resetar Período de Teste',
                  message: 'O período de teste será renovado para mais 30 dias a partir de agora. Confirmar?',
                  execute: () => AdminService.resetTrial(adminId, user)
                })}
                className="flex items-center gap-3 p-4 border border-blue-100 text-blue-600 rounded-2xl hover:bg-blue-50 transition-all font-bold"
              >
                <RotateCcw size={20} />
                <span>Resetar Trial (30 dias)</span>
              </button>

              {/* Sub Management */}
              <button
                disabled={loading}
                onClick={() => setConfirmAction({
                  type: 'manual',
                  title: 'Ativar Assinatura Manual',
                  message: 'Isso definirá o status para ATIVO e concederá acesso por 1 ano. Use para parcerias ou pagamentos manuais.',
                  execute: () => AdminService.activateManually(adminId, user)
                })}
                className="flex items-center gap-3 p-4 border border-orange-100 text-orange-600 rounded-2xl hover:bg-orange-50 transition-all font-bold"
              >
                <CheckCircle2 size={20} />
                <span>Ativar Assinatura Manual</span>
              </button>

              {/* Soft Delete */}
              {!user.deleted_at ? (
                <button
                  disabled={loading || isSelf}
                  onClick={() => setConfirmAction({
                    type: 'delete',
                    title: 'Desativar Usuário',
                    message: 'Isso ocultará o usuário das listas principais e impedirá o acesso. A ação pode ser revertida depois.',
                    execute: () => AdminService.softDelete(adminId, user)
                  })}
                  className="flex items-center gap-3 p-4 bg-slate-900 text-white rounded-2xl hover:bg-slate-800 transition-all font-bold disabled:opacity-50"
                >
                  <Trash2 size={20} />
                  <span>Desativar Conta</span>
                </button>
              ) : (
                <button
                  disabled={loading}
                  onClick={() => handleAction(() => AdminService.restoreUser(adminId, user))}
                  className="flex items-center gap-3 p-4 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 transition-all font-bold"
                >
                  <RotateCcw size={20} />
                  <span>Restaurar Conta</span>
                </button>
              )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-50 text-center">
          <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">ZLAI Administrativo v4.0</p>
        </div>
      </div>

      {/* Confirmation Modal Overlay */}
      {confirmAction && (
        <div className="absolute inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
          <div className="bg-white max-w-sm w-full rounded-[40px] p-8 shadow-2xl text-center">
            <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-6 text-orange-500">
              <AlertCircle size={32} />
            </div>
            <h4 className="text-xl font-black text-slate-900 mb-2">{confirmAction.title}</h4>
            <p className="text-slate-500 text-sm mb-8 leading-relaxed">{confirmAction.message}</p>
            
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setConfirmAction(null)}
                className="h-14 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
              >
                Cancelar
              </button>
              <button
                disabled={loading}
                onClick={() => handleAction(confirmAction.execute)}
                className="h-14 bg-zlai-primary text-white rounded-2xl font-bold hover:opacity-90 transition-all shadow-lg shadow-orange-500/20"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
