import React from 'react';
import { CreditCard, MessageCircle, AlertTriangle } from 'lucide-react';

const SubscriptionExpired: React.FC = () => {
    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-slate-800 rounded-3xl p-8 border border-slate-700 shadow-2xl text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-500/10 mb-6">
                    <AlertTriangle className="w-10 h-10 text-amber-500" />
                </div>
                
                <h1 className="text-3xl font-bold text-white mb-2">Período de Teste Finalizado</h1>
                <p className="text-slate-400 mb-8 leading-relaxed">
                    Seus 30 dias de teste grátis da ZLAI chegaram ao fim. 
                    Esperamos que tenha gostado de organizar sua vida financeira de forma inteligente!
                </p>

                <div className="bg-slate-900/50 rounded-2xl p-6 mb-8 border border-slate-700/50">
                    <div className="text-slate-500 text-sm uppercase tracking-wider font-semibold mb-1">Assinatura Mensal</div>
                    <div className="text-4xl font-black text-emerald-500">R$ 11,90</div>
                    <div className="text-slate-500 text-xs mt-1">Cancele a qualquer momento</div>
                </div>

                <div className="space-y-4">
                    <button 
                        onClick={() => window.open('https://buy.stripe.com/cNi14n0nNfJc1qG3f51B600', '_blank')}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 px-6 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-lg shadow-emerald-600/20"
                    >
                        <CreditCard className="w-5 h-5" />
                        Assinar com Cartão/Pix (Stripe)
                    </button>
                    
                    <button 
                        onClick={() => window.location.href = 'https://wa.me/5512997508141?text=Tenho+dúvidas+sobre+a+assinatura'}
                        className="w-full bg-transparent border border-slate-700 hover:border-slate-600 text-slate-300 font-medium py-3 px-6 rounded-2xl transition-all flex items-center justify-center gap-3"
                    >
                        <MessageCircle className="w-5 h-5" />
                        Falar com Suporte
                    </button>
                </div>

                <p className="mt-8 text-xs text-slate-500 italic">
                    Seus dados continuam salvos e seguros. Assim que a assinatura for confirmada, 
                    você terá acesso total ao Dashboard e ao WhatsApp novamente.
                </p>
            </div>
        </div>
    );
};

export default SubscriptionExpired;
