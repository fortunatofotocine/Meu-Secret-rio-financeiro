import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { LogIn, UserPlus, ShieldCheck, Mail, Lock } from 'lucide-react';

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const { error: authError } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (authError) {
            setError(authError.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : authError.message);
            setLoading(false);
        } else {
            navigate('/');
        }
    };

    return (
        <div className="min-h-screen bg-zlai-bg flex items-center justify-center p-4 relative overflow-hidden">
            <div className="w-full max-w-md relative z-10">
                <div className="bg-white border border-slate-100 rounded-[2.5rem] pt-2 pb-10 px-10 shadow-xl shadow-orange-900/5">
                    <div className="flex flex-col items-center mb-0">
                        <img src="/zlai-logo.png" alt="ZLAI Logo" className="h-64 -mt-12 -mb-8 object-contain" />
                        <h1 className="text-3xl font-black text-zlai-dark tracking-tighter uppercase">Bem-vindo</h1>
                        <p className="text-zlai-gray mt-2 font-medium tracking-tight">Acesse sua inteligência financeira</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6">
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
                                    className="w-full bg-slate-50 border border-slate-100 focus:border-zlai-primary focus:ring-1 focus:ring-zlai-primary rounded-2xl py-4 pl-12 pr-4 text-zlai-dark placeholder:text-slate-300 outline-none transition-all font-medium"
                                />
                            </div>
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
                                    placeholder="••••••••"
                                    className="w-full bg-slate-50 border border-slate-100 focus:border-zlai-primary focus:ring-1 focus:ring-zlai-primary rounded-2xl py-4 pl-12 pr-4 text-zlai-dark placeholder:text-slate-300 outline-none transition-all font-medium"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="bg-red-50 text-red-500 text-sm px-4 py-4 rounded-2xl flex items-center gap-3 font-semibold border border-red-100">
                                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
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
                                    <LogIn className="w-5 h-5" />
                                    Acessar ZLAI
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-10 pt-8 border-t border-slate-50 text-center">
                        <p className="text-zlai-gray font-medium text-sm">
                            Novo por aqui?{' '}
                            <Link to="/register" className="text-zlai-primary hover:underline font-bold transition-colors inline-flex items-center gap-1">
                                <UserPlus className="w-4 h-4" />
                                Criar conta ZLAI
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

export default Login;
