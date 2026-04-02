import { CommandResult, UserContext, Intent, ConversationStatus, ConversationState } from "./types.js";

export interface ResponseMetadata {
  text: string;
  buttons?: { id: string, title: string }[];
  stateToSet?: Partial<ConversationState>;
}

export class ResponseComposerService {
  static compose(user: UserContext, result: CommandResult, intent: Intent): string {
    return this.composeWithMetadata(user, result, intent).text;
  }

  static composeWithMetadata(user: UserContext, result: CommandResult, intent: Intent): ResponseMetadata {
    if (!result.success) {
      return { text: `❌ *Erro no processamento*\n\n${result.message}` };
    }

    const data = result.data || {};
    const finalIntent = data.intent || intent;

    // PRIORITY: If the result contains a specific message (like "Qual o novo nome?"), 
    // we should use the default composer logic unless it's a primary transaction success.
    const isExplicitMessage = !!result.message && !data.transaction;
    
    if (isExplicitMessage) {
      return { 
        text: result.message,
        stateToSet: data.stateToSet
      };
    }

    switch (finalIntent) {
      case "registrar_gasto":
      case "registrar_receita":
        return {
          text: this.formatTransaction(data.transaction),
          buttons: [
            { id: "confirmar_registro", title: "✅ Tudo certo" },
            { id: "editar_registro", title: "✏️ Editar Registro" }
          ],
          stateToSet: {
            status: "awaiting_edit",
            pendingIntent: "registrar_gasto",
            pendingEntities: { ...data.transaction }
          }
        };
      
      case "consultar_gastos_periodo":
      case "consultar_receitas_periodo":
        return { text: this.formatReport(data) };

      case "listar_contas_pendentes":
      case "listar_contas_hoje":
      case "listar_contas_semana":
      case "listar_contas_atrasadas":
        return { text: this.formatBillList(data.bills || [], data.bills?.length || 0, data.filter) };

      case "marcar_conta_paga":
        if (data.candidate) {
           return { text: this.formatBillConfirmation(data.candidate) };
        }
        return { text: `✅ *Pagamento registrado*\n\nConta marcada como paga com sucesso!` };

      case "registrar_evento":
        return { text: this.formatEvent(data.event) };

      case "consultar_resumo_semana":
        return { text: this.formatWeeklySummary(data.summary, data.bills) };

      case "ajuda":
        return { text: this.formatHelp() };

      default:
        return { 
          text: result.message || "✅ *Ação concluída*\n\nProcessado com sucesso.",
          stateToSet: data.stateToSet
        };
    }
  }

  private static formatTransaction(t: any): string {
    if (!t) return "✅ *Registro concluído*";
    const emoji = t.type === "income" ? "💰" : "💸";
    const label = t.type === "income" ? "Receita registrada" : "Gasto registrado";
    const receiptInfo = t.receipt_url ? "\n📸 *Comprovante:* Anexado com sucesso" : "";
    
    return `${emoji} *${label}*${receiptInfo}\n\n` +
           `💵 *Valor:* R$ ${t.amount.toFixed(2)}\n` +
           `📝 *Descrição:* ${t.description}\n` +
           `🏷️ *Categoria:* ${t.category}\n` +
           `📅 *Data:* ${t.date === "hoje" ? "Hoje" : t.date}\n\n` +
           `📊 Para visualizar mais detalhes e relatórios, acesse a plataforma em zlai.vercel.app. Se precisar de algo a mais é só me chamar!`;
  }

  private static formatReport(data: any): string {
    const emoji = data.type === "income" ? "📈" : "📉";
    const label = data.type === "income" ? "Total de Receitas" : "Total de Gastos";
    
    return `${emoji} *Relatório de ${data.type === 'income' ? 'Entradas' : 'Saídas'}*\n\n` +
           `💰 *${label}:* R$ ${data.total.toFixed(2)}\n` +
           `🗓️ *Período:* ${data.period}\n\n` +
           `📊 Para visualizar mais detalhes e relatórios, acesse a plataforma em zlai.vercel.app. Se precisar de algo a mais é só me chamar!`;
  }

  static formatBillList(bills: any[], total: number, filter: any): string {
    if (bills.length === 0) {
      return "✅ *Contas em dia*\n\nVocê não tem contas pendentes para este período! 🎉";
    }

    const title = "📋 *Contas Pendentes*";
    const list = bills.map(b => {
      const date = new Date(b.due_date).toLocaleDateString('pt-BR');
      return `• *R$ ${b.amount.toFixed(2)}* — ${b.description} (${date})`;
    }).join('\n');

    return `${title}\n\n${list}\n\n*Total:* ${total} conta(s) encontrada(s).\n\n` +
           `📊 Para visualizar mais detalhes e relatórios, acesse a plataforma em zlai.vercel.app. Se precisar de algo a mais é só me chamar!`;
  }

  private static formatBillConfirmation(bill: any): string {
    const date = new Date(bill.due_date).toLocaleDateString('pt-BR');
    return `💵 *Confirmar Pagamento?*\n\n` +
           `Encontrei: *${bill.description}*\n` +
           `Valor: *R$ ${bill.amount.toFixed(2)}*\n` +
           `Vencimento: *${date}*\n\n` +
           `Deseja marcar como paga? (Sim/Não)`;
  }

  private static formatEvent(e: any): string {
    if (!e) return "✅ *Evento agendado*";
    return `📅 *Novo Agendamento*\n\n` +
           `📌 *Compromisso:* ${e.title}\n` +
           `🗓️ *Data:* ${e.date}\n` +
           `${e.time ? `⏰ *Horário:* ${e.time}\n` : ""}\n` +
           `📊 Para visualizar mais detalhes e relatórios, acesse a plataforma em zlai.vercel.app. Se precisar de algo a mais é só me chamar!`;
  }

  static formatAmbiguityPrompt(candidates: any[]): string {
    const title = `🤔 *Qual conta você pagou?*\nEncontrei ${candidates.length} similares:`;
    const list = candidates.map((c, i) => {
      const date = new Date(c.due_date).toLocaleDateString('pt-BR');
      return `${i + 1}. *${c.description}* (R$ ${c.amount.toFixed(2)} - ${date})`;
    }).join('\n');

    return `${title}\n\n${list}\n\n_Responda com o número (1, 2...)_`;
  }

  static formatWeeklySummary(summary: any, bills: any): string {
    let msg = "📊 *RESUMO DA SEMANA*\n\n";

    msg += `📈 *Receitas:* R$ ${summary.totalIncome.toFixed(2)}\n`;
    msg += `📉 *Gastos:* R$ ${summary.totalExpense.toFixed(2)}\n`;
    msg += `⚖️ *Saldo:* *R$ ${summary.netBalance.toFixed(2)}*\n\n`;

    if (summary.topCategories.length > 0) {
      msg += "*Maiores categorias:*\n";
      summary.topCategories.slice(0, 3).forEach((cat: any) => {
        msg += `• ${cat.category}: R$ ${cat.amount.toFixed(2)}\n`;
      });
      msg += "\n";
    }

    if (bills.pending.count > 0 || bills.overdue.count > 0) {
      msg += "*Contas no radar:*\n";
      if (bills.overdue.count > 0) msg += `⚠️ ${bills.overdue.count} atrasadas (R$ ${bills.overdue.total.toFixed(2)})\n`;
      if (bills.pending.count > 0) msg += `⏳ ${bills.pending.count} pendentes (R$ ${bills.pending.total.toFixed(2)})\n`;
    } else {
      msg += "💎 *Finanças 100% em dia!*";
    }

    msg += "\n📊 Para visualizar mais detalhes e relatórios, acesse a plataforma em zlai.vercel.app. Se precisar de algo a mais é só me chamar!";
    return msg;
  }

   private static formatHelp(): string {
    return "🤖 *Central de Ajuda ZLAI*\n\n" +
           "🔹 *Finanças:* 'gastei 50 no mercado', 'recebi 200'\n" +
           "📸 *Recibos:* Mande fotos de comprovantes para anotar!\n" +
           "🔹 *Contas:* 'o que vence hoje?', 'paguei luz'\n" +
           "🔹 *Relatórios:* 'resumo da semana', 'balanço'\n" +
           "🔹 *Agenda:* 'marque reunião amanhã às 19h'\n\n" +
           "_Fale naturalmente, eu aprendo com você!_";
  }

  static getErrorMessage(): string {
    return "🧠 *Ops, erro técnico*\n\nDesculpe, tive um problema ao processar. Tente novamente em instantes.";
  }

  static getOnboardingMessage(user: UserContext): string {
    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://zlai.vercel.app';
    const regLink = `${baseUrl}/register?whatsapp=${user.whatsappNumber}`;
    return `👋 *Bem-vindo ao ZLAI!*\n\nVi que você ainda não tem uma conta vinculada.\n\nPara começar agora, cadastre-se aqui:\n🔗 ${regLink}`;
  }
}
