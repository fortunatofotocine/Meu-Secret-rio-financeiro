import React, { useState, useEffect } from 'react';
import { supabase, type WhatsAppMessage } from '../lib/supabase';
import { MessageSquare, Check, AlertCircle, User, Bot } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';

export default function Mensagens() {
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel('whatsapp_messages_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_messages' }, (payload) => {
        setMessages(prev => [payload.new as WhatsAppMessage, ...prev]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchMessages() {
    setLoading(true);
    const { data, error } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) setMessages(data);
    setLoading(false);
  }

  async function handleConfirm(messageId: string, interpretation: any) {
    try {
      const response = await fetch('/api/messages/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, interpretation })
      });

      if (response.ok) {
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, status: 'processed' } : m));
      } else {
        alert('Erro ao confirmar mensagem.');
      }
    } catch (error) {
      console.error('Error confirming:', error);
    }
  }

  async function handleIgnore(messageId: string) {
    const { error } = await supabase
      .from('whatsapp_messages')
      .update({ status: 'error' })
      .eq('id', messageId);

    if (!error) {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, status: 'error' } : m));
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto h-full flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-zlai-dark tracking-tighter uppercase">ZLAI Messenger</h2>
          <p className="text-zlai-gray font-medium">Interações em tempo real com sua IA.</p>
        </div>
        <div className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 flex items-center gap-2">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-sm font-bold">Webhook Online</span>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zlai-primary"></div>
            </div>
          ) : messages.length > 0 ? (
            messages.map((msg) => (
              <div key={msg.id} className="space-y-4">
                {/* User Message */}
                <div className="flex items-start gap-4 max-w-[80%]">
                  <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-slate-500" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500">{msg.sender_number}</span>
                      <span className="text-[10px] text-slate-400">{format(new Date(msg.created_at), 'HH:mm', { locale: ptBR })}</span>
                    </div>
                    <div className="bg-slate-100 p-4 rounded-2xl rounded-tl-none text-slate-800 text-sm shadow-sm">
                      {msg.message_text}
                    </div>
                  </div>
                </div>

                {/* AI Response / Status */}
                <div className="flex items-start gap-4 max-w-[80%] ml-auto flex-row-reverse">
                  <div className="w-10 h-10 rounded-2xl bg-zlai-primary flex items-center justify-center shrink-0 shadow-lg shadow-orange-200">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <div className="space-y-1 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <span className="text-[10px] text-slate-400">{format(new Date(msg.created_at), 'HH:mm', { locale: ptBR })}</span>
                      <span className="text-xs font-bold text-zlai-primary">ZLAI Intelligence</span>
                    </div>
                    <div className={cn(
                      "p-4 rounded-2xl rounded-tr-none text-sm shadow-sm text-left",
                       msg.status === 'processed' ? "bg-zlai-primary text-white" :
                        msg.status === 'pending_confirmation' ? "bg-orange-50 text-orange-900 border border-orange-100" :
                          msg.status === 'error' ? "bg-slate-100 text-slate-400 italic" :
                            "bg-slate-50 text-slate-500 italic"
                    )}>
                      {msg.status === 'processed' ? (
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4" />
                          <span>Registro salvo com sucesso!</span>
                        </div>
                      ) : msg.status === 'pending_confirmation' ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            <span className="font-bold">Confirmação Necessária</span>
                          </div>
                          <p>Entendi isso como um {msg.interpretation?.type === 'finance' ? 'lançamento financeiro' : 'compromisso'}. Confirmar?</p>
                          <div className="flex gap-2 pt-2">
                            <button
                              onClick={() => handleConfirm(msg.id, msg.interpretation)}
                               className="px-3 py-1.5 bg-orange-200 text-orange-900 rounded-lg font-bold text-xs hover:bg-orange-300 transition-colors"
                            >
                              Confirmar
                            </button>
                            <button
                              onClick={() => handleIgnore(msg.id)}
                               className="px-3 py-1.5 bg-white text-orange-800 rounded-lg font-bold text-xs hover:bg-slate-50 transition-colors border border-orange-100"
                            >
                              Ignorar
                            </button>
                          </div>
                        </div>
                      ) : msg.status === 'error' ? (
                        <span>Ignorado ou Erro no processamento.</span>
                      ) : (
                        <span>Processando mensagem...</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                <MessageSquare className="w-10 h-10 text-slate-200" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Nenhuma mensagem ainda</h3>
              <p className="text-slate-500 max-w-xs mx-auto mt-2">
                As mensagens enviadas pelo WhatsApp aparecerão aqui em tempo real.
              </p>
            </div>
          )}
        </div>

        {/* Info Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Dica: Envie mensagens como "Gastei 30 reais com café" ou "Reunião amanhã às 15h".
          </p>
          <div className="flex items-center gap-4">
            <span className="text-xs font-bold text-slate-400">Total: {messages.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
