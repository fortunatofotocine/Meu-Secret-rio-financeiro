import React, { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { UserPlus, LogIn, ShieldCheck, Mail, Lock, Phone, User } from 'lucide-react';

const Register: React.FC = () => {
    const [searchParams] = useSearchParams();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [whatsapp, setWhatsapp] = useState(searchParams.get('whatsapp') || '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const cleanWhatsapp = whatsapp.replace(/\D/g, '');

        // 0. Validação prévia de WhatsApp duplicado
        const { data: existingProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('whatsapp_number', cleanWhatsapp)
            .maybeSingle();

        if (existingProfile) {
            setError("Este número de WhatsApp já está cadastrado em outra conta.");
            setLoading(false);
            return;
        }

        // 1. Sign up user (incluindo metadados para o trigger do banco)
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                    whatsapp_number: whatsapp.replace(/\D/g, ''),
                }
            }
        });

        if (authError) {
            setError(authError.message);
            setLoading(false);
            return;
        }

        if (authData.user) {
            // Sucesso: O perfil é criado automaticamente via TRIGGER no banco de dados
            navigate('/');
        }
    };

    return (
        <div className="min-h-screen bg-zlai-bg flex items-center justify-center p-4 relative overflow-hidden">
            <div className="w-full max-w-md relative z-10">
                <div className="bg-white border border-slate-100 rounded-[2.5rem] pt-2 pb-10 px-10 shadow-xl shadow-orange-900/5">
                    <div className="flex flex-col items-center mb-0">
                        <img src="/zlai-logo.png" alt="ZLAI Logo" className="h-64 -mt-12 -mb-8 object-contain" />
                        <h1 className="text-3xl font-black text-zlai-dark tracking-tighter uppercase">Criar Conta</h1>
                        <p className="text-zlai-gray mt-2 font-medium tracking-tight text-center">Comece a zelar pelo seu dinheiro hoje</p>
                    </div>

                    <form onSubmit={handleRegister} className="space-y-5">
                        <div>
                            <label className="block text-sm font-bold text-zlai-dark mb-2 ml-1">Nome Completo</label>
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-zlai-gray w-5 h-5" />
                                <input
                                    type="text"
                                    required
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    placeholder="Seu nome"
                                    className="w-full bg-slate-50 border border-slate-100 focus:border-zlai-primary focus:ring-1 focus:ring-zlai-primary rounded-2xl py-3.5 pl-12 pr-4 text-zlai-dark placeholder:text-slate-300 outline-none transition-all font-medium"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-zlai-dark mb-2 ml-1">E-mail</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zlai-gray w-5 h-5" />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="seu@email.com"
                                    className="w-full bg-slate-50 border border-slate-100 focus:border-zlai-primary focus:ring-1 focus:ring-zlai-primary rounded-2xl py-3.5 pl-12 pr-4 text-zlai-dark placeholder:text-slate-300 outline-none transition-all font-medium"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-zlai-dark mb-2 ml-1">WhatsApp (com DDD)</label>
                            <div className="relative">
                                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-zlai-gray w-5 h-5" />
                                <input
                                    type="text"
                                    required
                                    value={whatsapp}
                                    onChange={(e) => setWhatsapp(e.target.value)}
                                    placeholder="5512999999999"
                                    className="w-full bg-slate-50 border border-slate-100 focus:border-zlai-primary focus:ring-1 focus:ring-zlai-primary rounded-2xl py-3.5 pl-12 pr-4 text-zlai-dark placeholder:text-slate-300 outline-none transition-all font-medium"
                                />
                            </div>
                            <p className="text-[10px] text-zlai-gray mt-1 ml-1 font-bold uppercase tracking-tighter">Número para o bot do WhatsApp.</p>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-zlai-dark mb-2 ml-1">Senha</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zlai-gray w-5 h-5" />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Mínimo 6 caracteres"
                                    className="w-full bg-slate-50 border border-slate-100 focus:border-zlai-primary focus:ring-1 focus:ring-zlai-primary rounded-2xl py-3.5 pl-12 pr-4 text-zlai-dark placeholder:text-slate-300 outline-none transition-all font-medium"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="bg-red-50 text-red-500 text-sm px-4 py-4 rounded-2xl flex items-center gap-3 font-semibold border border-red-100">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-zlai-primary hover:bg-orange-600 disabled:bg-slate-200 disabled:cursor-not-allowed text-white font-black uppercase py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 active:scale-[0.98] transition-all tracking-wider"
                        >
                            {loading ? (
                                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <ShieldCheck className="w-5 h-5" />
                                    Finalizar Cadastro ZLAI
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-slate-50 text-center">
                        <p className="text-zlai-gray font-medium text-sm">
                            Já tem conta?{' '}
                            <Link to="/login" className="text-zlai-primary font-bold hover:underline inline-flex items-center gap-1">
                                <LogIn className="w-4 h-4" />
                                Fazer Login
                            </Link>
                        </p>
                    </div>
                </div>
                <p className="text-zlai-gray text-[10px] font-bold uppercase tracking-widest text-center mt-10">
                    &copy; 2026 ZLAI &reg; - A IA que zela pelo seu dinheiro
                </p>
            </div>
        </div>
    );
};

export default Register;
