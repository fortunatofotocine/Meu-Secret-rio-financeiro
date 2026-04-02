import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { MessageCircle, CheckCircle2, ShieldCheck, ArrowRight, Loader2, Zap, Smartphone } from 'lucide-react';
import { motion } from 'motion/react';

const Activate: React.FC = () => {
    const navigate = useNavigate();
    const [status, setStatus] = useState<'checking' | 'pending' | 'active'>('checking');
    const [userName, setUserName] = useState('');

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const { data: { user: authUser } } = await supabase.auth.getUser();
                if (!authUser) {
                    navigate('/login');
                    return;
                }

                const { data: profile } = await supabase
                    .from('profiles')
                    .select('full_name, whatsapp_number')
                    .eq('id', authUser.id)
                    .maybeSingle();

                if (profile) {
                    setUserName(profile.full_name);
                    if (profile.whatsapp_number) {
                        setStatus('active');
                        setTimeout(() => navigate('/dashboard'), 2000);
                    } else {
                        setStatus('pending');
                    }
                } else {
                    console.log("Profile not found for user:", authUser.id);
                    setStatus('pending');
                }
            } catch (err) {
                console.error("Activation check error:", err);
                setStatus('pending');
            }
        };

        checkStatus();
        const subscription = supabase
            .channel('profile_activation')
            .on('postgres_changes', { 
                event: 'UPDATE', 
                schema: 'public', 
                table: 'profiles' 
            }, (payload) => {
                if (payload.new.whatsapp_number) {
                    setStatus('active');
                    setTimeout(() => navigate('/'), 2000);
                }
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [navigate]);

    const handleWhatsAppRedirect = () => {
        const message = encodeURIComponent("Quero ativar minha conta na ZLAI 🚀");
        const phone = "5512997508141";
        window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
    };

    if (status === 'checking') {
        return (
            <div className="min-h-screen bg-zlai-bg flex items-center justify-center p-4">
                <Loader2 className="w-12 h-12 text-zlai-primary animate-spin" />
            </div>
        );
    }

    if (status === 'active') {
        return (
            <div className="min-h-screen bg-zlai-bg flex items-center justify-center p-4">
                <div className="bg-white rounded-[2.5rem] p-10 shadow-xl shadow-orange-900/5 text-center max-w-md w-full">
                    <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 className="w-12 h-12 text-green-500" />
                    </div>
                    <h1 className="text-3xl font-black text-zlai-dark mb-4 uppercase tracking-tighter">CONTA ATIVADA!</h1>
                    <p className="text-zlai-gray font-medium">Parabéns, {userName.split(' ')[0]}! Seu WhatsApp já está conectado. Redirecionando...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zlai-bg flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-orange-500/5 rounded-full blur-3xl -mr-64 -mt-64" />
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-orange-500/5 rounded-full blur-3xl -ml-64 -mb-64" />

            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-xl relative z-10"
            >
                <div className="bg-white border border-slate-100 rounded-[3rem] p-10 shadow-2xl shadow-orange-900/10">
                    <div className="flex flex-col items-center text-center mb-10">
                        <div className="inline-flex items-center gap-2 bg-orange-50 text-zlai-primary px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest mb-6">
                            <Zap className="w-4 h-4" /> Etapa Final
                        </div>
                        <h1 className="text-4xl font-black text-zlai-dark tracking-tighter uppercase mb-4 leading-none">
                            Vincule seu <br/><span className="text-zlai-primary">WhatsApp</span>
                        </h1>
                        <p className="text-zlai-gray font-medium text-lg leading-relaxed max-w-sm">
                            Falta pouco para você ter sua assistente financeira pessoal operando via comandos.
                        </p>
                    </div>

                    <div className="space-y-6 mb-10">
                        <div className="flex gap-4 p-5 bg-slate-50 rounded-3xl border border-slate-100 transition-all hover:border-orange-200">
                            <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center flex-shrink-0">
                                <Smartphone className="w-6 h-6 text-zlai-primary" />
                            </div>
                            <div>
                                <h3 className="font-black text-zlai-dark uppercase text-sm mb-1 tracking-tight">Vínculo Direto</h3>
                                <p className="text-sm text-zlai-gray leading-snug">Usamos o número que você cadastrou para vincular sua conta instantaneamente.</p>
                            </div>
                        </div>

                        <div className="flex gap-4 p-5 bg-slate-50 rounded-3xl border border-slate-100 transition-all hover:border-orange-200">
                            <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center flex-shrink-0">
                                <ShieldCheck className="w-6 h-6 text-green-500" />
                            </div>
                            <div>
                                <h3 className="font-black text-zlai-dark uppercase text-sm mb-1 tracking-tight">Segurança Total</h3>
                                <p className="text-sm text-zlai-gray leading-snug">A ZLAI nunca compartilha seus dados e o acesso é exclusivo pelo seu número.</p>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleWhatsAppRedirect}
                        className="w-full bg-zlai-primary hover:bg-orange-600 text-white font-black uppercase py-5 rounded-[2rem] flex items-center justify-center gap-3 shadow-xl shadow-orange-500/30 active:scale-[0.98] transition-all tracking-wider text-xl"
                    >
                        🚀 ATIVAR ZLAI AGORA
                        <ArrowRight className="w-6 h-6" />
                    </button>

                    <p className="mt-8 text-center text-[10px] text-zlai-gray font-bold uppercase tracking-widest bg-slate-50 py-4 rounded-2xl">
                        Após clicar, basta enviar a mensagem automática que abriremos.
                    </p>
                </div>
            </motion.div>

            <p className="text-zlai-gray text-[10px] font-bold uppercase tracking-widest text-center mt-12 relative z-10 opacity-50">
                &copy; 2026 ZLAI &reg; - A Inteligência que cuida do que é seu
            </p>
        </div>
    );
};

export default Activate;
