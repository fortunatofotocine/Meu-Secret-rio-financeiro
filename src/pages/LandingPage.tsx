import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  CheckCircle2, 
  MessageCircle, 
  Mic, 
  Table, 
  Bell, 
  ShieldCheck, 
  ChevronDown, 
  ArrowRight, 
  TrendingUp, 
  Smartphone,
  Zap,
  Star,
  Lock,
  Calendar,
  Wallet
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-orange-100 selection:text-zlai-primary">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <img src="/zlai-logo.png" alt="ZLAI" className="h-10 w-auto" />
          </div>
          
          <div className="flex items-center gap-4 lg:gap-8">
            <Link to="/login" className="text-sm font-bold text-slate-500 hover:text-zlai-primary transition-colors uppercase tracking-wider">
              Login
            </Link>
            <Link 
              to="/register" 
              className="bg-zlai-primary text-white px-6 py-2.5 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-orange-600 transition-all shadow-lg shadow-orange-100"
            >
              Criar Conta Grátis
            </Link>
          </div>
        </div>
      </nav>

      <main className="pt-20">
        {/* Section 1: Hero */}
        <section className="relative py-20 lg:py-32 overflow-hidden">
          {/* Background Ornaments */}
          <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-[600px] h-[600px] bg-orange-50 rounded-full blur-3xl opacity-50 -z-10" />
          <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-[400px] h-[400px] bg-indigo-50 rounded-full blur-3xl opacity-50 -z-10" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="text-center lg:text-left space-y-8"
              >
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-50 text-zlai-primary border border-orange-100">
                   <Star className="w-4 h-4 fill-zlai-primary" />
                   <span className="text-xs font-black uppercase tracking-widest">Sua Inteligência Financeira</span>
                </div>
                
                <h1 className="text-5xl lg:text-7xl font-black text-zlai-dark tracking-tighter leading-[0.9] !mt-4">
                  Organize sua vida financeira pelo <span className="text-zlai-primary">WhatsApp</span>
                </h1>
                
                <p className="text-xl text-slate-500 font-medium max-w-xl mx-auto lg:mx-0 leading-relaxed">
                  Registre gastos, acompanhe contas, receba lembretes e tenha controle total do seu dinheiro sem planilhas ou apps complexos. No texto ou no áudio.
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
                  <Link 
                    to="/register" 
                    className="w-full sm:w-auto bg-zlai-primary text-white px-8 py-5 rounded-[2rem] font-black text-lg uppercase tracking-wider hover:bg-orange-600 transition-all shadow-[0_20px_40px_-10px_rgba(255,106,0,0.3)] hover:-translate-y-1 active:translate-y-0"
                  >
                    Começar 30 dias grátis
                  </Link>
                  <a href="#como-funciona" className="w-full sm:w-auto px-8 py-5 rounded-[2rem] border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
                    Ver como funciona
                  </a>
                </div>

                <div className="flex flex-wrap justify-center lg:justify-start items-center gap-6 pt-4 text-slate-400 font-medium text-sm">
                   <div className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-500" /> Sem cartão no teste</div>
                   <div className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-500" /> Cancele a qualquer momento</div>
                </div>
              </motion.div>

              <motion.div 
                 initial={{ opacity: 0, scale: 0.9, x: 20 }}
                 animate={{ opacity: 1, scale: 1, x: 0 }}
                 transition={{ duration: 0.8, delay: 0.2 }}
                 className="relative"
              >
                 <div className="relative z-10 rounded-[3rem] overflow-hidden shadow-2xl shadow-orange-900/20 border-8 border-white">
                    <img src="/zlai_whatsapp_mockup_1774734781750.png" alt="WhatsApp Mockup" className="w-full h-auto" />
                 </div>
                 {/* Decorative elements */}
                 <div className="absolute -top-10 -right-10 w-32 h-32 bg-orange-100 rounded-full blur-2xl -z-10" />
                 <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-slate-100 rounded-full blur-3xl -z-10" />
                 
                 {/* Floating Bubble Example 1 */}
                 <motion.div 
                    animate={{ y: [0, -10, 0] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute -left-4 top-1/4 bg-white p-4 rounded-2xl shadow-xl border border-slate-100 flex items-center gap-3 z-20 max-w-[200px]"
                 >
                    <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                       <Mic className="w-5 h-5" />
                    </div>
                    <div>
                       <p className="text-[10px] font-bold text-slate-400 leading-none mb-1">USER AUDIOS</p>
                       <p className="text-xs font-bold text-slate-700">"Gastei 20 no pão"</p>
                    </div>
                 </motion.div>

                 {/* Floating Bubble Example 2 */}
                 <motion.div 
                    animate={{ y: [0, 10, 0] }}
                    transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                    className="absolute -right-4 bottom-1/4 bg-white p-4 rounded-2xl shadow-xl border border-slate-100 flex items-center gap-3 z-20 max-w-[200px]"
                 >
                    <div className="w-10 h-10 rounded-full bg-orange-100 text-zlai-primary flex items-center justify-center shrink-0">
                       <Zap className="w-5 h-5" />
                    </div>
                    <div>
                       <p className="text-[10px] font-bold text-orange-400 leading-none mb-1">ZLAI AI</p>
                       <p className="text-xs font-bold text-slate-700">✅ Registrado!</p>
                    </div>
                 </motion.div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Section 2: Como Funciona */}
        <section id="como-funciona" className="py-24 bg-slate-50">
           <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center max-w-3xl mx-auto mb-20 space-y-4">
                 <h2 className="text-4xl font-black text-zlai-dark tracking-tighter uppercase">Simples como enviar um zap</h2>
                 <p className="text-lg text-slate-500 font-medium">Você já sabe usar. A ZLAI apenas dá inteligência ao seu WhatsApp.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                 <StepCard 
                    number="01" 
                    title="Crie sua conta" 
                    desc="Em menos de 30 segundos, seu perfil está pronto e seguro."
                    icon={Smartphone}
                 />
                 <StepCard 
                    number="02" 
                    title="Ativação Segura" 
                    desc="Conecte seu WhatsApp em um clique após o cadastro."
                    icon={MessageCircle}
                 />
                 <StepCard 
                    number="03" 
                    title="Fale ou Digite" 
                    desc="'Gastei 50 no mercado' ou áudio 'Paguei o condomínio'."
                    icon={Mic}
                 />
                 <StepCard 
                    number="04" 
                    title="Toda a visão" 
                    desc="Acompanhe resumos, metas e faturamento pelo painel."
                    icon={TrendingUp}
                 />
              </div>
           </div>
        </section>

        {/* Section 3: Showcase Inside ZLAI (NOVA) */}
        <section className="py-24 bg-white overflow-hidden">
           <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
                 <h2 className="text-4xl font-black text-zlai-dark tracking-tighter uppercase leading-none">Muito mais do que um assistente no WhatsApp</h2>
                 <p className="text-lg text-slate-500 font-medium">A ZLAI organiza, analisa e mostra sua vida financeira de forma clara e inteligente.</p>
              </div>

              <ShowcaseTabs />
           </div>
        </section>

        {/* Section 4: Benefícios */}
        <section className="py-24 overflow-hidden">
           <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                 <div className="space-y-12">
                    <div className="space-y-4">
                       <h2 className="text-4xl font-black text-zlai-dark tracking-tighter leading-none uppercase">Tudo o que você precisa em um só lugar</h2>
                       <p className="text-xl text-slate-500 font-medium">Esqueça as planilhas chatas e complexas. A ZLAI cuida de tudo para você.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                       <BenefitItem 
                          icon={Mic} 
                          title="Voz ou Texto" 
                          desc="Registre na hora que o gasto acontece, sem parar o que está fazendo."
                       />
                       <BenefitItem 
                          icon={Table} 
                          title="Relatórios PDF" 
                          desc="Exporte tudo detalhado para seu contador ou para sua própria visão."
                       />
                       <BenefitItem 
                          icon={Bell} 
                          title="Lembretes ZLAI" 
                          desc="Nunca mais esqueça de pagar uma conta ou um compromisso."
                       />
                       <BenefitItem 
                          icon={Target} 
                          title="Metas ZLAI" 
                          desc="Defina sonhos e deixe a ZLAI te ajudar a chegar lá mais rápido."
                       />
                    </div>
                 </div>

                 <div className="relative">
                    <div className="bg-orange-50 rounded-[3rem] p-8 lg:p-12 relative overflow-hidden group">
                       <div className="absolute top-0 right-0 w-32 h-32 bg-zlai-primary/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                       
                       <h3 className="text-3xl font-black text-zlai-primary mb-8 tracking-tighter uppercase leading-none">
                         A ZLAI zela pelo seu dinheiro por <span className="text-slate-900 underline decoration-orange-300">R$ 11,90/mês</span>
                       </h3>
                       
                       <div className="space-y-6">
                          <p className="text-slate-600 font-medium text-lg leading-relaxed">
                             Imagine ter um assistente pessoal que organiza sua vida financeira, lembra de tudo e te dá clareza total por menos de 40 centavos por dia.
                          </p>
                          <Link to="/register" className="inline-flex items-center gap-2 text-zlai-primary font-black uppercase tracking-widest text-sm group-hover:gap-4 transition-all">
                             QUERO EXPERIMENTAR GRÁTIS POR 30 DIAS <ArrowRight className="w-5 h-5" />
                          </Link>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        </section>

        {/* Section 4: Demo / Social Proof */}
        <section className="py-24 bg-slate-900 text-white relative overflow-hidden">
           <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-orange-500/10 via-transparent to-transparent opacity-50" />
           
           <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center space-y-16">
              <div className="space-y-4">
                 <h2 className="text-4xl lg:text-5xl font-black tracking-tighter uppercase leading-tight italic">
                   "A melhor ferramenta é aquela que você realmente usa."
                 </h2>
                 <p className="text-slate-400 font-medium text-lg max-w-2xl mx-auto">
                    A ZLAI foi desenhada para estar onde você já está: no WhatsApp. Sem fricção, sem enrolação.
                 </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                 <div className="bg-white/5 backdrop-blur-sm border border-white/10 p-8 rounded-[2.5rem] text-left space-y-4">
                    <div className="flex gap-1 text-orange-400"><Star className="fill-current w-4 h-4" /><Star className="fill-current w-4 h-4" /><Star className="fill-current w-4 h-4" /><Star className="fill-current w-4 h-4" /><Star className="fill-current w-4 h-4" /></div>
                    <p className="text-slate-300 font-medium italic">"Antes eu esquecia metade dos gastos do dia. Agora eu só mando um áudio na hora e tá feito. Mudou meu controle."</p>
                    <p className="font-bold text-white uppercase tracking-wider text-xs">— Ricardo G., Empresário</p>
                 </div>
                 <div className="bg-white/5 backdrop-blur-sm border border-white/10 p-8 rounded-[2.5rem] text-left space-y-4">
                    <div className="flex gap-1 text-orange-400"><Star className="fill-current w-4 h-4" /><Star className="fill-current w-4 h-4" /><Star className="fill-current w-4 h-4" /><Star className="fill-current w-4 h-4" /><Star className="fill-current w-4 h-4" /></div>
                    <p className="text-slate-300 font-medium italic">"Os lembretes de contas são sensacionais. Nunca mais paguei multa por atraso na fatura do cartão."</p>
                    <p className="font-bold text-white uppercase tracking-wider text-xs">— Camila M., Designer</p>
                 </div>
                 <div className="bg-white/5 backdrop-blur-sm border border-white/10 p-8 rounded-[2.5rem] text-left space-y-4">
                    <div className="flex gap-1 text-orange-400"><Star className="fill-current w-4 h-4" /><Star className="fill-current w-4 h-4" /><Star className="fill-current w-4 h-4" /><Star className="fill-current w-4 h-4" /><Star className="fill-current w-4 h-4" /></div>
                    <p className="text-slate-300 font-medium italic">"Visualizar o faturamento da minha loja no dashboard é muito prático. Tudo separado das minhas contas pessoais."</p>
                    <p className="font-bold text-white uppercase tracking-wider text-xs">— João P., Comerciante</p>
                 </div>
              </div>
           </div>
        </section>

        {/* Section 5: Segurança */}
        <section className="py-24">
           <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="bg-slate-50 rounded-[3rem] p-8 lg:p-20 flex flex-col md:flex-row items-center gap-12">
                 <div className="w-24 h-24 lg:w-32 lg:h-32 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-12 h-12 lg:w-16 lg:h-16" />
                 </div>
                 <div className="space-y-4 text-center md:text-left">
                    <h2 className="text-3xl font-black text-zlai-dark tracking-tighter uppercase">Segurança e Privacidade em Primeiro Lugar</h2>
                    <p className="text-lg text-slate-500 font-medium max-w-2xl leading-relaxed">
                       Seus dados são organizados de forma segura e criptografada. A conversa no WhatsApp é protegida e o acesso ao dashboard é individual via e-mail e senha. Você tem controle total sobre suas informações a qualquer momento.
                    </p>
                    <div className="flex flex-wrap justify-center md:justify-start gap-4 pt-4">
                       <span className="flex items-center gap-2 text-xs font-bold text-slate-400 px-3 py-1 bg-white rounded-lg border border-slate-200 uppercase tracking-widest"><Lock className="w-3 h-3" /> Criptografia Ponta a Ponta</span>
                       <span className="flex items-center gap-2 text-xs font-bold text-slate-400 px-3 py-1 bg-white rounded-lg border border-slate-200 uppercase tracking-widest"><User className="w-3 h-3" /> Acesso Individual</span>
                       <span className="flex items-center gap-2 text-xs font-bold text-slate-400 px-3 py-1 bg-white rounded-lg border border-slate-200 uppercase tracking-widest"><Smartphone className="w-3 h-3" /> WhatsApp Business Oficial</span>
                    </div>
                 </div>
              </div>
           </div>
        </section>

        {/* Section 6: Planos */}
        <section className="py-24 bg-white">
           <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
              <div className="max-w-3xl mx-auto mb-16 space-y-4">
                 <h2 className="text-4xl font-black text-zlai-dark tracking-tighter uppercase">Uma escolha inteligente</h2>
                 <p className="text-lg text-slate-500 font-medium">Preço justo para quem quer clareza financeira real.</p>
              </div>

              <div className="max-w-md mx-auto relative">
                 <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-emerald-500 text-white px-6 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transform -rotate-1 shadow-lg z-20">
                    Sua Melhor Decisão
                 </div>
                 <div className="bg-white border-4 border-orange-500 rounded-[3rem] p-10 py-16 shadow-[0_40px_80px_-20px_rgba(255,106,0,0.15)] space-y-10 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8">
                       <Wallet className="w-12 h-12 text-orange-50 opacity-50" />
                    </div>
                    
                    <div className="space-y-2">
                       <h3 className="text-xl font-black text-slate-400 uppercase tracking-widest">Assinatura Premium</h3>
                       <div className="flex items-center justify-center gap-2">
                          <span className="text-5xl font-black text-zlai-dark tracking-tighter">R$ 11,90</span>
                          <span className="text-slate-400 font-bold uppercase text-xs">/mês</span>
                       </div>
                    </div>

                    <ul className="text-left space-y-4 font-bold text-slate-600">
                       <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" /> Uso ilimitado pelo WhatsApp</li>
                       <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" /> Registro por Áudio e Texto</li>
                       <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" /> Lembretes diários de contas</li>
                       <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" /> Dashboard completo Mobile/Web</li>
                       <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" /> Exportação de relatórios PDF</li>
                       <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" /> Suporte prioritário</li>
                    </ul>

                    <div className="space-y-4">
                       <Link to="/register" className="block w-full bg-zlai-primary text-white py-5 rounded-[2rem] font-black uppercase tracking-widest shadow-xl shadow-orange-500/20 hover:bg-orange-600 transition-all hover:scale-[1.02] active:scale-100">
                          Começar 30 dias grátis
                       </Link>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Acesso imediato • Sem fidelidade • Cancele fácil</p>
                    </div>
                 </div>
              </div>
           </div>
        </section>

        {/* Section 7: FAQ */}
        <section className="py-24 bg-slate-50">
           <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
              <h2 className="text-3xl font-black text-zlai-dark tracking-tighter text-center uppercase mb-12">Perguntas Frequentes</h2>
              <div className="space-y-4">
                 <FAQItem 
                    q="O que é a ZLAI?" 
                    a="A ZLAI é sua assistente financeira inteligente. Ela funciona como um contato no seu WhatsApp onde você registra seus gastos e a ZLAI organiza tudo automaticamente em um painel de controle."
                 />
                 <FAQItem 
                    q="Como funciona no WhatsApp?" 
                    a="Após criar sua conta, você passará por uma etapa de ativação rápida onde seu WhatsApp é vinculado de forma segura à ZLAI. A partir daí, basta mandar mensagens como 'Gastei 50 no mercado'."
                 />
                 <FAQItem 
                    q="Posso usar áudio?" 
                    a="Sim! Você pode mandar áudios como 'ZLAI, paguei 20 reais na padaria agora'. Nossa IA transcreve e extrai os dados corretamente para o seu sistema."
                 />
                 <FAQItem 
                    q="Meus dados estão seguros?" 
                    a="Com certeza. Utilizamos criptografia de ponta a ponta e seus dados são armazenados em servidores protegidos. Somente você tem acesso ao seu dashboard via senha pessoal."
                 />
                 <FAQItem 
                    q="Como funciona o teste grátis?" 
                    a="Você tem 30 dias para usar todas as funcionalidades sem pagar nada. Não pedimos cartão de crédito para o teste. Se gostar, após 30 dias você pode assinar o plano premium."
                 />
                 <FAQItem 
                    q="Quanto custa a assinatura?" 
                    a="Apenas R$ 11,90 por mês. Um valor simbólico pela organização e paz mental que o controle financeiro te proporciona."
                 />
              </div>
           </div>
        </section>

        {/* Section 8: Final CTA */}
        <section className="py-24 bg-zlai-primary text-white text-center">
           <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
              <h2 className="text-4xl lg:text-5xl font-black tracking-tighter uppercase leading-[0.9]">
                 Comece agora e tenha controle do seu dinheiro
              </h2>
              <p className="text-orange-100 font-medium text-lg lg:text-xl max-w-2xl mx-auto">
                 Junte-se a centenas de pessoas que simplificaram sua vida financeira com a ZLAI. O primeiro mês é por nossa conta.
              </p>
              <div className="pt-6">
                <Link to="/register" className="inline-block bg-white text-zlai-primary px-12 py-6 rounded-[2.5rem] font-black text-xl uppercase tracking-widest shadow-2xl shadow-orange-900/40 hover:scale-105 transition-all active:scale-100">
                   Criar minha conta agora
                </Link>
              </div>
              <p className="text-orange-200 text-xs font-bold uppercase tracking-[0.2em]">30 dias grátis • R$ 11,90/mês • Sem compromisso</p>
           </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-12 border-t border-slate-100 bg-white">
         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-2">
               <img src="/zlai-logo.png" alt="ZLAI" className="h-8 w-auto grayscale opacity-50" />
               <span className="text-sm font-bold text-slate-300 uppercase tracking-widest">© 2026 ZLAI &reg;</span>
            </div>
            <div className="flex gap-8 text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">
               <Link to="/privacy" className="hover:text-zlai-primary transition-colors">Privacidade</Link>
               <a href="#" className="hover:text-zlai-primary transition-colors">Termos</a>
               <a href="#" className="hover:text-zlai-primary transition-colors">Contato</a>
            </div>
         </div>
         <p className="text-center text-[10px] text-slate-200 font-bold uppercase tracking-widest mt-8">A inteligência que cuida do que é seu.</p>
      </footer>
    </div>
  );
}

function ShowcaseTabs() {
  const [activeTab, setActiveTab] = useState(0);

  const tabs = [
    {
      title: "Dashboard",
      subtitle: "Visão Geral",
      desc: "Acompanhe seu saldo acumulado, entradas e saídas mensais em um painel intuitivo e moderno.",
      image: "/zlai_real_dashboard_screenshot.png",
      features: ["Gráficos de gastos por categoria", "Resumo de faturamento mensal", "Saldo real atualizado"]
    },
    {
      title: "Transações",
      subtitle: "Histórico Inteligente",
      desc: "Todas as suas mensagens no WhatsApp viram registros detalhados com categoria, data e valor exato após a ativação rápida do seu número.",
      image: "/zlai_features_showcase_v177473584851874135500_1774735860577.png", // Usando o mesmo mockup triplo
      features: ["Busca rápida de lançamentos", "Filtros por categoria", "Exportação para PDF"]
    },
    {
      title: "Contas",
      subtitle: "Gestão de Pagamentos",
      desc: "Controle suas despesas fixas, parcelamentos e contas do mês sem esquecer nenhum vencimento.",
      image: "/zlai_features_showcase_v177473584851874135500_1774735860577.png",
      features: ["Lembretes de vencimento", "Controle de parcelas", "Status de pagamento"]
    },
    {
      title: "Agenda",
      subtitle: "Vida Integrada",
      desc: "Seus compromissos financeiros e pessoais em um só lugar, integrados à sua rotina no WhatsApp.",
      image: "/zlai_features_showcase_v177473584851874135500_1774735860577.png",
      features: ["Calendário dinâmico", "Compromissos do dia", "Lembretes proativos"]
    },
    {
      title: "Metas",
      subtitle: "Foco no Futuro",
      desc: "Transforme sobras financeiras em sonhos realizados com o acompanhamento de progresso das suas metas.",
      image: "/zlai_features_showcase_v177473584851874135500_1774735860577.png",
      features: ["Barras de progresso visual", "Aportes automáticos", "Previsão de conclusão"]
    }
  ];

  return (
    <div className="space-y-12">
      {/* Tab Switcher */}
      <div className="flex flex-wrap justify-center gap-2 lg:gap-4">
        {tabs.map((tab, idx) => (
          <button
            key={idx}
            onClick={() => setActiveTab(idx)}
            className={cn(
              "px-6 py-3 rounded-2xl font-bold text-sm uppercase tracking-widest transition-all border-2",
              activeTab === idx 
                ? "bg-orange-50 border-zlai-primary text-zlai-primary shadow-lg shadow-orange-100" 
                : "bg-white border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50"
            )}
          >
            {tab.title}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-slate-50 rounded-[3rem] p-8 lg:p-16 border border-slate-100 relative min-h-[500px] flex items-center">
         <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.4 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center w-full"
            >
               <div className="space-y-8 order-2 lg:order-1">
                  <div className="space-y-2">
                     <p className="text-xs font-black text-zlai-primary uppercase tracking-[0.3em]">{tabs[activeTab].subtitle}</p>
                     <h3 className="text-3xl font-black text-zlai-dark tracking-tighter uppercase">{tabs[activeTab].title}</h3>
                  </div>
                  <p className="text-lg text-slate-500 font-medium leading-relaxed">
                     {tabs[activeTab].desc}
                  </p>
                  <ul className="space-y-4">
                     {tabs[activeTab].features.map((f, i) => (
                       <li key={i} className="flex items-center gap-3 font-bold text-slate-600 text-sm">
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                          {f}
                       </li>
                     ))}
                  </ul>
                  <div className="pt-4">
                     <Link to="/register" className="bg-zlai-primary text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-orange-200 hover:bg-orange-600 transition-all inline-flex items-center gap-2">
                        Começar minha conta grátis
                     </Link>
                  </div>
               </div>

               <div className="order-1 lg:order-2">
                  <div className="relative rounded-3xl overflow-hidden shadow-2xl shadow-slate-200 border-4 border-white bg-white group">
                     <motion.img 
                        initial={{ scale: 1.1 }}
                        animate={{ scale: 1 }}
                        src={tabs[activeTab].image} 
                        alt={tabs[activeTab].title} 
                        className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-105"
                     />
                  </div>
               </div>
            </motion.div>
         </AnimatePresence>
      </div>
    </div>
  );
}

function StepCard({ number, title, desc, icon: Icon }: any) {
   return (
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative group hover:shadow-orange-900/5 transition-all">
         <div className="absolute top-8 right-8 text-4xl font-black text-slate-50 group-hover:text-orange-50 transition-colors">{number}</div>
         <div className="w-14 h-14 rounded-2xl bg-orange-50 text-zlai-primary flex items-center justify-center mb-6">
            <Icon className="w-6 h-6" />
         </div>
         <h4 className="text-xl font-bold text-zlai-dark mb-2 tracking-tight uppercase leading-tight">{title}</h4>
         <p className="text-sm text-slate-500 font-medium leading-relaxed">{desc}</p>
      </div>
   );
}

function BenefitItem({ icon: Icon, title, desc }: any) {
   return (
      <div className="flex gap-4">
         <div className="w-12 h-12 rounded-xl bg-orange-50 text-zlai-primary flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5" />
         </div>
         <div className="space-y-1">
            <h4 className="font-bold text-zlai-dark uppercase text-sm tracking-widest">{title}</h4>
            <p className="text-sm text-slate-500 font-medium leading-snug">{desc}</p>
         </div>
      </div>
   );
}

function FAQItem({ q, a }: { q: string, a: string }) {
   const [isOpen, setIsOpen] = useState(false);
   return (
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden transition-all">
         <button 
           onClick={() => setIsOpen(!isOpen)}
           className="w-full px-6 py-5 flex items-center justify-between text-left"
         >
            <span className="font-bold text-slate-700">{q}</span>
            <ChevronDown className={cn("w-5 h-5 text-slate-400 transition-transform", isOpen && "rotate-180")} />
         </button>
         <AnimatePresence>
            {isOpen && (
               <motion.div 
                 initial={{ height: 0, opacity: 0 }}
                 animate={{ height: 'auto', opacity: 1 }}
                 exit={{ height: 0, opacity: 0 }}
                 className="px-6 pb-6"
               >
                  <p className="text-sm text-slate-500 font-medium leading-relaxed">{a}</p>
               </motion.div>
            )}
         </AnimatePresence>
      </div>
   );
}

function Target(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  )
}

function User(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}
