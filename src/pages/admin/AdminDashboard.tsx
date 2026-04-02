import React, { useEffect, useState } from 'react';
import { 
  Users, 
  UserCheck, 
  Clock, 
  ShieldX, 
  Search, 
  Filter, 
  MoreHorizontal, 
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  History,
  List
} from 'lucide-react';
import { supabase, Profile, AdminLog } from '../../lib/supabase';
import { cn } from '../../lib/utils';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import AdminUserModal from '../../components/admin/AdminUserModal';

type FilterStatus = 'all' | 'trialing' | 'active' | 'expired' | 'blocked' | 'deleted';
type TabType = 'users' | 'logs';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('users');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [logs, setLogs] = useState<(AdminLog & { admin: any, target: any })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [adminId, setAdminId] = useState<string>('');

  const fetchProfiles = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (session) setAdminId(session.user.id);

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setProfiles(data as Profile[]);
    }
    setLoading(false);
  };

  const fetchLogs = async () => {
    const { data, error } = await supabase
      .from('admin_logs')
      .select(`
        *,
        admin:admin_id(full_name),
        target:target_user_id(full_name, whatsapp_number)
      `)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setLogs(data as any);
    }
  };

  useEffect(() => {
    fetchProfiles();
    fetchLogs();
  }, []);

  const filteredProfiles = profiles.filter(p => {
    const matchesSearch = 
      p.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.whatsapp_number?.includes(searchTerm);
    
    if (!matchesSearch) return false;

    switch (filterStatus) {
      case 'trialing': return p.subscription_status === 'trialing' && !p.deleted_at;
      case 'active': return p.subscription_status === 'active' && !p.deleted_at;
      case 'expired': return p.subscription_status === 'expired' && !p.deleted_at;
      case 'blocked': return p.is_blocked && !p.deleted_at;
      case 'deleted': return !!p.deleted_at;
      default: return !p.deleted_at;
    }
  });

  const filteredLogs = logs.filter(l => {
    const term = searchTerm.toLowerCase();
    return (
      l.admin?.full_name?.toLowerCase().includes(term) ||
      l.target?.full_name?.toLowerCase().includes(term) ||
      l.target?.whatsapp_number?.includes(term) ||
      l.action.includes(term)
    );
  });

  const metrics = {
    total: profiles.filter(p => !p.deleted_at).length,
    active: profiles.filter(p => p.subscription_status === 'active' && !p.deleted_at).length,
    trialEnding: profiles.filter(p => {
      if (!p.trial_ends_at || p.deleted_at) return false;
      const days = differenceInDays(new Date(p.trial_ends_at), new Date());
      return days >= 0 && days <= 5;
    }).length,
    blocked: profiles.filter(p => p.is_blocked && !p.deleted_at).length
  };

  const getLogActionLabel = (action: string) => {
    switch(action) {
      case 'block': return <span className="text-red-600 font-bold">Bloqueio</span>;
      case 'unblock': return <span className="text-emerald-600 font-bold">Desbloqueio</span>;
      case 'reset_trial': return <span className="text-blue-600 font-bold">Resete de Trial</span>;
      case 'manual_activation': return <span className="text-orange-600 font-bold">Ativação Manual</span>;
      case 'soft_delete': return <span className="text-slate-900 font-bold">Desativação</span>;
      case 'restore': return <span className="text-emerald-600 font-bold">Restauração</span>;
      default: return action;
    }
  };

  const getSubBadge = (status: string) => {
    switch (status) {
      case 'active': return <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-emerald-100 text-emerald-600">Ativa</span>;
      case 'trialing': return <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-blue-100 text-blue-600">Trial</span>;
      default: return <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-slate-100 text-slate-500">Expirada</span>;
    }
  };

  const getAccessBadge = (p: Profile) => {
    if (p.deleted_at) return <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-black text-white">Desativado</span>;
    if (p.is_blocked) return <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-red-100 text-red-600">Bloqueado</span>;
    return <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-emerald-50 text-emerald-500">Liberado</span>;
  };

  return (
    <div className="flex-1 bg-slate-50 overflow-y-auto pb-20 lg:pb-0">
      <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-8">
        
        {/* Header Area */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="text-zlai-primary w-5 h-5" />
              <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Painel de Controle</h1>
            </div>
            <p className="text-slate-400 text-sm font-medium">Gestão profissional de usuários e assinaturas ZLAI.</p>
          </div>
          
          <div className="flex bg-white p-1 rounded-2xl border border-slate-100 shadow-sm self-start">
            <button 
              onClick={() => setActiveTab('users')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all",
                activeTab === 'users' ? "bg-zlai-primary text-white text-shadow-sm font-black" : "text-slate-400 hover:text-slate-600"
              )}
            >
              <List size={18} />
              Usuários
            </button>
            <button 
              onClick={() => setActiveTab('logs')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all",
                activeTab === 'logs' ? "bg-zlai-primary text-white text-shadow-sm font-black" : "text-slate-400 hover:text-slate-600"
              )}
            >
              <History size={18} />
              Logs
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          <MetricCard 
            label="Total Usuários" 
            value={metrics.total} 
            icon={Users} 
            color="bg-blue-500" 
          />
          <MetricCard 
            label="Assinaturas Ativas" 
            value={metrics.active} 
            icon={UserCheck} 
            color="bg-emerald-500" 
          />
          <MetricCard 
            label="Trial Vencendo" 
            subLabel="(5 dias)" 
            value={metrics.trialEnding} 
            icon={Clock} 
            color="bg-orange-500" 
            alert={metrics.trialEnding > 0}
          />
          <MetricCard 
            label="Bloqueados" 
            value={metrics.blocked} 
            icon={ShieldX} 
            color="bg-red-500" 
          />
        </div>

        {/* List Section */}
        <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden">
          
          {/* Filters Bar */}
          <div className="p-6 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="relative flex-1 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-zlai-primary transition-colors" size={18} />
              <input 
                type="text" 
                placeholder={activeTab === 'users' ? "Buscar por nome ou WhatsApp..." : "Buscar nos registros..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-12 pl-12 pr-6 bg-slate-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-zlai-primary/20 transition-all"
              />
            </div>

            {activeTab === 'users' && (
              <div className="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0 scrollbar-hide">
                <FilterTab label="Todos" active={filterStatus === 'all'} onClick={() => setFilterStatus('all')} />
                <FilterTab label="Ativos" active={filterStatus === 'active'} onClick={() => setFilterStatus('active')} />
                <FilterTab label="Trial" active={filterStatus === 'trialing'} onClick={() => setFilterStatus('trialing')} />
                <FilterTab label="Bloqueados" active={filterStatus === 'blocked'} onClick={() => setFilterStatus('blocked')} />
                <FilterTab label="Excluídos" active={filterStatus === 'deleted'} onClick={() => setFilterStatus('deleted')} />
              </div>
            )}
          </div>

          {/* Table Area */}
          <div className="overflow-x-auto min-h-[300px]">
            {activeTab === 'users' ? (
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-16">Adm</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Usuário</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Assinatura</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Acesso</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Cadastro</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan={6} className="px-6 py-4 h-20 bg-slate-50/30"></td>
                      </tr>
                    ))
                  ) : filteredProfiles.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-20 text-center text-slate-400 font-bold">Nenhum usuário encontrado.</td>
                    </tr>
                  ) : (
                    filteredProfiles.map((user) => (
                      <tr 
                        key={user.id} 
                        className="hover:bg-slate-50/50 transition-colors group cursor-pointer" 
                        onClick={() => setSelectedUser(user)}
                      >
                        <td className="px-6 py-4 text-center">
                          {user.role === 'admin' ? <ShieldCheck className="mx-auto text-orange-500" size={18} /> : null}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-slate-100 flex-shrink-0 text-[10px] flex items-center justify-center font-bold text-slate-400">
                              {user.full_name?.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900 tracking-tight">{user.full_name}</p>
                              <p className="text-[11px] text-slate-400 font-medium">{user.whatsapp_number}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {getSubBadge(user.subscription_status || '')}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {getAccessBadge(user)}
                        </td>
                        <td className="px-6 py-4 text-center text-[12px] font-bold text-slate-500">
                          {format(new Date(user.created_at), 'dd/MM/yy')}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button className="p-2 text-slate-300 group-hover:text-zlai-primary transition-all group-hover:translate-x-1">
                            <ChevronRight size={20} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Admin</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ação</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Alvo</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-20 text-center text-slate-400 font-bold">Sem registros de auditoria até o momento.</td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="text-sm font-bold text-slate-900 tracking-tight">{log.admin?.full_name || 'Sistema'}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm tracking-tight">{getLogActionLabel(log.action)}</p>
                          {log.details?.reason && <p className="text-[10px] text-slate-400">{log.details.reason}</p>}
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-bold text-slate-700 tracking-tight">{log.target?.full_name}</p>
                          <p className="text-[10px] text-slate-400">{log.target?.whatsapp_number}</p>
                        </td>
                        <td className="px-6 py-4 text-center text-[12px] font-medium text-slate-500 whitespace-nowrap">
                          {format(new Date(log.created_at), "dd/MM HH:mm", { locale: ptBR })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {selectedUser && (
        <AdminUserModal 
          user={selectedUser} 
          adminId={adminId}
          onClose={() => setSelectedUser(null)}
          onUpdate={() => {
            fetchProfiles();
            fetchLogs();
          }}
        />
      )}
    </div>
  );
}

function MetricCard({ label, value, subLabel, icon: Icon, color, alert }: any) {
  return (
    <div className="bg-white p-5 lg:p-6 rounded-[32px] border border-slate-100 shadow-sm relative overflow-hidden group">
      <div className={cn("absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-[0.03] group-hover:scale-110 transition-transform", color)} />
      <div className={cn("w-10 h-10 lg:w-12 lg:h-12 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-105", color, "bg-opacity-10")}>
        <Icon className={cn("w-5 h-5 lg:w-6 lg:h-6", color.replace('bg-', 'text-'))} />
      </div>
      <div>
        <div className="flex items-center gap-1">
          <p className="text-[10px] lg:text-[11px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
          {subLabel && <span className="text-[8px] font-bold text-slate-300">{subLabel}</span>}
        </div>
        <div className="flex items-end justify-between">
          <h3 className="text-2xl lg:text-3xl font-black text-slate-900 leading-none">{value}</h3>
          {alert && <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />}
        </div>
      </div>
    </div>
  );
}

function FilterTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all",
        active 
          ? "bg-zlai-primary text-white shadow-lg shadow-orange-500/20 active:scale-95 shadow-sm" 
          : "bg-slate-50 text-slate-400 hover:bg-slate-100"
      )}
    >
      {label}
    </button>
  );
}
