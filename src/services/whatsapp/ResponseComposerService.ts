import { CommandResult, UserContext } from "./types";

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

  static getErrorMessage(): string {
    return "🧠 Desculpe, tive um problema técnico. Tente novamente em alguns instantes.";
  }
}
