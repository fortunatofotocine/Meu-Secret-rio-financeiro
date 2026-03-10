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

        // 1. Sign up user
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
        });

        if (authError) {
            setError(authError.message);
            setLoading(false);
            return;
        }

        if (authData.user) {
            // 2. Create Profile
            const { error: profileError } = await supabase.from('profiles').insert([
                {
                    id: authData.user.id,
                    full_name: fullName,
                    whatsapp_number: whatsapp.replace(/\D/g, ''), // Clean non-digits
                },
            ]);

            if (profileError) {
                setError("Erro ao criar perfil: " + profileError.message);
                setLoading(false);
            } else {
                // Success
                navigate('/');
            }
        }
    };

    return (
        <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Orbs */}
            <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] animate-pulse"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] animate-pulse"></div>

            <div className="w-full max-w-md relative z-10">
                <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 shadow-2xl">
                    <div className="flex flex-col items-center mb-6">
                        <div className="w-16 h-16 bg-gradient-to-tr from-blue-400 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 mb-4">
                            <UserPlus className="text-white w-10 h-10" />
                        </div>
                        <h1 className="text-3xl font-bold text-white tracking-tight">Crie sua conta</h1>
                        <p className="text-slate-400 mt-2">Comece a organizar suas finanças</p>
                    </div>

                    <form onSubmit={handleRegister} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5 ml-1">Nome Completo</label>
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                                <input
                                    type="text"
                                    required
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    placeholder="Seu nome"
                                    className="w-full bg-slate-900/50 border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl py-3 pl-12 pr-4 text-white placeholder:text-slate-600 outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5 ml-1">E-mail</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="exemplo@gmail.com"
                                    className="w-full bg-slate-900/50 border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl py-3 pl-12 pr-4 text-white placeholder:text-slate-600 outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5 ml-1">WhatsApp (com DDD)</label>
                            <div className="relative">
                                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                                <input
                                    type="text"
                                    required
                                    value={whatsapp}
                                    onChange={(e) => setWhatsapp(e.target.value)}
                                    placeholder="5512999999999"
                                    className="w-full bg-slate-900/50 border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl py-3 pl-12 pr-4 text-white placeholder:text-slate-600 outline-none transition-all"
                                />
                            </div>
                            <p className="text-[10px] text-slate-500 mt-1 ml-1">Número usado para enviar mensagens ao bot.</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5 ml-1">Senha</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Mínimo 6 caracteres"
                                    className="w-full bg-slate-900/50 border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl py-3 pl-12 pr-4 text-white placeholder:text-slate-600 outline-none transition-all"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 disabled:from-slate-700 disabled:to-slate-800 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all"
                        >
                            {loading ? (
                                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <ShieldCheck className="w-5 h-5" />
                                    Finalizar Cadastro
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 pt-6 border-t border-slate-700/50 text-center">
                        <p className="text-slate-400 text-sm">
                            Já tem uma conta?{' '}
                            <Link to="/login" className="text-blue-400 hover:text-blue-300 font-semibold transition-colors flex items-center justify-center gap-1 mt-1">
                                <LogIn className="w-4 h-4" />
                                Fazer login agora
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Register;
