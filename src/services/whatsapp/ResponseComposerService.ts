import { CommandResult, UserContext } from "./types.js";

export class ResponseComposerService {
  /**
   * Composes a user-friendly response based on the execution result.
   */
  static compose(user: UserContext, result: CommandResult): string {
    if (!result.success) {
      return `❌ ${result.message}`;
    }

    // Success responses are already formatted in the Command results for clarity.
    return result.message;
  }

  /**
   * Standardized bill listing format.
   */
  static formatBillList(bills: any[], total: number): string {
    if (bills.length === 0) {
      return "Você não tem contas pendentes no momento! 🎉";
    }

    const title = "📋 *Suas contas pendentes:*";
    const list = bills.map(b => {
      const date = new Date(b.due_date).toLocaleDateString('pt-BR');
      return `• *${b.description}*: R$ ${b.amount.toFixed(2)} (venc: ${date})`;
    }).join('\n');

    let footer = `\n\nTotal: ${total} conta${total > 1 ? 's' : ''}.`;
    if (total > bills.length) {
      footer = `\n\nExibindo ${bills.length} de ${total} contas.`;
    }

    return `${title}\n${list}${footer}`;
  }

  /**
   * Formats the ambiguous bill selection prompt.
   */
  static formatAmbiguityPrompt(candidates: any[]): string {
    const title = `🤔 Encontrei ${candidates.length} contas similares.\nQual delas você pagou?`;
    const list = candidates.map((c, i) => {
      const date = new Date(c.due_date).toLocaleDateString('pt-BR');
      return `${i + 1}. *${c.description}* - R$ ${c.amount.toFixed(2)} (venc: ${date})`;
    }).join('\n');

    return `${title}\n\n${list}\n\nResponda com o *número* ou a *data*.`;
  }

  static getOnboardingMessage(user: UserContext): string {
    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://zlai.vercel.app';
    const regLink = `${baseUrl}/register?whatsapp=${user.whatsappNumber}`;
    return `👋 Olá! Vi que você ainda não tem uma conta vinculada ao ZLAI.\n\nPara começar a organizar sua vida financeira, cadastre-se aqui: ${regLink}`;
  }

  static formatWeeklySummary(summary: any, bills: any): string {
    let msg = "📊 *Resumo da sua semana na ZLAI*\n\n";

    if (summary.totalIncome > 0 || summary.totalExpense > 0) {
      msg += `• Você recebeu: R$ ${summary.totalIncome.toFixed(2)}\n`;
      msg += `• Você gastou: R$ ${summary.totalExpense.toFixed(2)}\n`;
      msg += `• Saldo da semana: R$ ${summary.netBalance.toFixed(2)}\n\n`;
    } else {
      msg += "Você não teve movimentações registradas na última semana.\n\n";
    }

    if (summary.topCategories.length > 0) {
      msg += "*Maiores gastos:*\n";
      summary.topCategories.forEach((cat: any, i: number) => {
        msg += `${i + 1}. ${cat.category} — R$ ${cat.amount.toFixed(2)}\n`;
      });
      msg += "\n";
    }

    if (bills.pending.count > 0 || bills.overdue.count > 0) {
      if (bills.pending.count > 0) {
        msg += `Você tem ${bills.pending.count} conta(s) pendente(s), total de R$ ${bills.pending.total.toFixed(2)}.\n`;
      }
      if (bills.overdue.count > 0) {
        msg += `⚠️ *Atenção:* Você tem ${bills.overdue.count} conta(s) atrasada(s), total de R$ ${bills.overdue.total.toFixed(2)}.`;
      }
    } else {
      msg += "Lindo! Você está 100% em dia com suas contas! 🎉";
    }

    return msg.trim();
  }

  static getErrorMessage(): string {
    return "🧠 Desculpe, tive um problema técnico. Tente novamente em alguns instantes.";
  }
}
