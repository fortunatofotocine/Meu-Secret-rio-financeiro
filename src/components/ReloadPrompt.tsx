import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function ReloadPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered: ' + r);
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  return (
    <AnimatePresence>
      {(offlineReady || needRefresh) && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-6 right-6 z-[9999] max-w-sm w-full bg-white rounded-2xl shadow-2xl border border-orange-100 p-6 flex flex-col gap-4"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-50 text-zlai-primary flex items-center justify-center shrink-0">
                <RefreshCw className={`w-5 h-5 ${needRefresh ? 'animate-spin-slow' : ''}`} />
              </div>
              <div>
                <h4 className="font-black text-zlai-dark uppercase text-xs tracking-widest">
                  {needRefresh ? 'Nova versão disponível!' : 'Pronto para uso offline'}
                </h4>
                <p className="text-sm text-slate-500 font-medium leading-relaxed">
                  {needRefresh 
                    ? 'Atualize agora para ver as melhorias e novos recursos da ZLAI.' 
                    : 'O sistema ZLAI agora funciona mesmo sem conexão com a internet.'}
                </p>
              </div>
            </div>
            <button 
              onClick={close}
              className="p-1 hover:bg-slate-50 rounded-lg text-slate-400 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {needRefresh && (
            <button
              onClick={() => updateServiceWorker(true)}
              className="w-full bg-zlai-primary text-white py-3 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg shadow-orange-100 hover:bg-orange-600 transition-all active:scale-95"
            >
              Atualizar ZLAI agora
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
