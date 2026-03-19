import React from 'react';
import { Shield, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#FFF7F2] text-[#1C1C1C] font-sans selection:bg-[#FF6A00]/20">
      <div className="max-w-3xl mx-auto px-6 py-12 lg:py-20">
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-[#FF6A00] hover:text-[#e65f00] font-medium transition-colors mb-8 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Voltar para Home
        </Link>

        <header className="mb-12">
          <div className="w-16 h-16 bg-[#FF6A00]/10 rounded-2xl flex items-center justify-center mb-6">
            <Shield className="w-8 h-8 text-[#FF6A00]" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-4">Política de Privacidade - ZLAI</h1>
          <p className="text-xl text-[#6B7280]">
            Última atualização: {new Date().toLocaleDateString('pt-BR')}
          </p>
        </header>

        <main className="prose prose-zlai max-w-none space-y-8">
          <section>
            <p className="text-lg leading-relaxed">
              A ZLAI valoriza a privacidade dos seus usuários e está comprometida em proteger seus dados pessoais em conformidade com as leis aplicáveis.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold flex items-center gap-3">
              <span className="w-8 h-8 bg-white border border-[#FF6A00]/20 rounded-lg flex items-center justify-center text-sm text-[#FF6A00]">1</span>
              Informações Coletadas
            </h2>
            <p className="text-[#6B7280] leading-relaxed">
              Coletamos informações fornecidas diretamente pelo usuário, incluindo número de telefone e conteúdo das mensagens enviadas via WhatsApp, com a finalidade de fornecer funcionalidades da plataforma.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold flex items-center gap-3">
              <span className="w-8 h-8 bg-white border border-[#FF6A00]/20 rounded-lg flex items-center justify-center text-sm text-[#FF6A00]">2</span>
              Uso das Informações
            </h2>
            <p className="text-[#6B7280] leading-relaxed mb-2">
              As informações coletadas são utilizadas para:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-[#6B7280]">
              <li>Registrar e organizar dados financeiros enviados pelo usuário;</li>
              <li>Melhorar a experiência e funcionamento da plataforma;</li>
              <li>Processar mensagens por meio de sistemas automatizados, incluindo inteligência artificial.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold flex items-center gap-3">
              <span className="w-8 h-8 bg-white border border-[#FF6A00]/20 rounded-lg flex items-center justify-center text-sm text-[#FF6A00]">3</span>
              Compartilhamento de Dados
            </h2>
            <p className="text-[#6B7280] leading-relaxed">
              A ZLAI não compartilha dados pessoais com terceiros, exceto quando necessário para cumprimento de obrigações legais ou exigências regulatórias.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold flex items-center gap-3">
              <span className="w-8 h-8 bg-white border border-[#FF6A00]/20 rounded-lg flex items-center justify-center text-sm text-[#FF6A00]">4</span>
              Armazenamento e Segurança
            </h2>
            <p className="text-[#6B7280] leading-relaxed">
              Os dados são armazenados em ambiente seguro e protegidos contra acessos não autorizados.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold flex items-center gap-3">
              <span className="w-8 h-8 bg-white border border-[#FF6A00]/20 rounded-lg flex items-center justify-center text-sm text-[#FF6A00]">5</span>
              Direitos do Usuário
            </h2>
            <p className="text-[#6B7280] leading-relaxed">
              O usuário pode solicitar acesso, correção ou exclusão dos seus dados pessoais a qualquer momento.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold flex items-center gap-3">
              <span className="w-8 h-8 bg-white border border-[#FF6A00]/20 rounded-lg flex items-center justify-center text-sm text-[#FF6A00]">6</span>
              Contato
            </h2>
            <p className="text-[#6B7280] leading-relaxed">
              <a 
                href="mailto:zlaifinancas@gmail.com" 
                className="text-[#FF6A00] font-semibold hover:underline"
              >
                zlaifinancas@gmail.com
              </a>
            </p>
          </section>
        </main>

        <footer className="mt-20 pt-10 border-t border-[#FF6A00]/10 text-center">
          <p className="text-sm text-[#6B7280]">
            &copy; {new Date().getFullYear()} ZLAI. Todos os direitos reservados.
          </p>
        </footer>
      </div>
    </div>
  );
}
