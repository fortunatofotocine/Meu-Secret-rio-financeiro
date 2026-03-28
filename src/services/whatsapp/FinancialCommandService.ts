import { supabase } from '../../lib/supabaseServer';
import { UserContext, IntentResult, CommandResult, IntentEntities } from './types';
import { ReportService } from './ReportService';
import { ConversationStateService } from './ConversationStateService';
import { FixedExpenseService } from './FixedExpenseService';
import { ResponseComposerService } from './ResponseComposerService';
import { NotificationService } from './NotificationService';

export class FinancialCommandService {
  /**
   * Executes the system logic based on the intent and the user's conversational state.
   */
  static async execute(user: UserContext, classification: IntentResult): Promise<CommandResult> {
    const { intent, entities } = classification;
    const { state } = user;

    // 1. Handle selection from pending candidates (Multiple results case)
    if (state.status === "awaiting_confirmation" && state.pendingCandidates && state.pendingCandidates.length > 0) {
      if (intent === "cancelar") {
        await ConversationStateService.clear(user.userId);
        return { success: true, message: "Ação de pagamento cancelada." };
      }

      // Try to find which candidate was chosen
      const choice = this.resolveCandidateSelection(user, classification);
      if (choice) {
        const result = await FixedExpenseService.markAsPaid(user, choice.id);
        await ConversationStateService.clear(user.userId);
        return result;
      }

      // If they sent "sim" but there are multiple candidates, we MUST stay in this state.
      if (intent === "confirmar") {
        return { success: false, message: "Encontrei mais de uma conta similar. Qual delas você pagou? Responda com o número (1, 2...) ou a data." };
      }
    }

    // 2. Handle simple confirmation for single pending intent
    if (state.status === "awaiting_confirmation" && state.pendingIntent && !state.pendingCandidates) {
      if (intent === "confirmar") {
        const result = await this.handleConfirmedIntent(user, state);
        await ConversationStateService.clear(user.userId);
        return result;
      }
      if (intent === "cancelar") {
        await ConversationStateService.clear(user.userId);
        return { success: true, message: "Ação cancelada." };
      }
    }

    // 3. Base Command Execution
    switch (intent) {
      // --- Standard Registry ---
      case "registrar_gasto":
        return await this.recordTransaction(user, "expense", entities);
      case "registrar_receita":
        return await this.recordTransaction(user, "income", entities);
      
      // --- Reports ---
      case "consultar_gastos_periodo":
      case "consultar_receitas_periodo":
        return await ReportService.getSummary(user, entities, intent === "consultar_receitas_periodo" ? "income" : "expense");

      // --- Fixed Expenses (Bills) ---
      case "listar_contas_pendentes":
        return await this.listBills(user, "all");
      case "listar_contas_hoje":
        return await this.listBills(user, "today");
      case "listar_contas_semana":
        return await this.listBills(user, "week");
      case "listar_contas_atrasadas":
        return await this.listBills(user, "overdue");
      
      case "marcar_conta_paga":
        return await this.handlePayBill(user, entities);
      
      case "solicitar_resumo_financeiro":
        return await this.handleManualSummary(user);

      // --- Info ---
      case "ajuda":
      case "onboarding":
        return { 
          success: true, 
          message: "Eu sou o ZLAI! 🤖\n\n🔹 *Finanças:* 'gastei 50 no mercado', 'recebi 200 do freela'\n🔹 *Contas:* 'o que vence hoje?', 'paguei a internet'\n🔹 *Relatórios:* 'resumo da semana', 'balanço'\n\nComo posso te ajudar agora?" 
        };
      
      default:
        return { success: false, message: "Ainda não sei como processar este pedido." };
    }
  }

  private static async handlePayBill(user: UserContext, entities: IntentEntities): Promise<CommandResult> {
    const search = entities.description;
    if (!search) return { success: false, message: "Qual conta você pagou? (Ex: internet, aluguel)" };

    const candidates = await FixedExpenseService.findCandidates(user, search);
    
    if (candidates.length === 0) {
      return { success: false, message: `Não encontrei nenhuma conta pendente com "${search}".` };
    }

    if (candidates.length === 1) {
      // If only one, we return it so the caller (WebhookService) can decide to Confirm or Execute
      return { 
        success: true, 
        message: `Encontrei a conta: ${candidates[0].description} - R$ ${candidates[0].amount.toFixed(2)}.`,
        data: { candidate: candidates[0] } 
      };
    }

    const message = ResponseComposerService.formatAmbiguityPrompt(candidates);
    return { success: true, message };
  }

  private static async listBills(user: UserContext, filter: any): Promise<CommandResult> {
    const bills = await FixedExpenseService.listPending(user, filter);
    const message = ResponseComposerService.formatBillList(bills, bills.length);
    return { success: true, message };
  }

  private static resolveCandidateSelection(user: UserContext, classification: IntentResult): any | null {
    const candidates = user.state.pendingCandidates || [];
    const text = classification.entities.description?.toLowerCase() || "";
    const intent = classification.intent;

    // 1. By Index (1, 2, 3...)
    if (text.match(/^[1-3]$/)) {
      return candidates[parseInt(text) - 1];
    }
    if (text.includes("primeira") || text.includes("opção 1")) return candidates[0];
    if (text.includes("segunda") || text.includes("opção 2")) return candidates[1];

    // 2. By Date match
    if (text.match(/\d{2}\/\d{2}/) || text.match(/\d{4}-\d{2}-\d{2}/)) {
      return candidates.find(c => c.due_date.includes(text.replace('/', '-')));
    }

    return null;
  }

  private static async handleConfirmedIntent(user: UserContext, state: any): Promise<CommandResult> {
    if (state.pendingIntent === "registrar_gasto" || state.pendingIntent === "registrar_receita") {
      return await this.recordTransaction(user, state.pendingIntent === "registrar_receita" ? "income" : "expense", state.pendingEntities);
    }
    if (state.pendingIntent === "marcar_conta_paga" && state.pendingEntities?.description) {
      // Re-trigger the bill payment logic (should find the unique candidate now or handle re-search)
      return await this.handlePayBill(user, state.pendingEntities);
    }
    return { success: false, message: "Não consegui concluir a ação pendente." };
  }

  private static async recordTransaction(user: UserContext, type: "income" | "expense", entities: IntentEntities | undefined): Promise<CommandResult> {
    if (!entities || !entities.amount) return { success: false, message: "Falta o valor." };
    const { amount, category, description, date_reference } = entities;

    const { error } = await supabase.from("transactions").insert({
      user_id: user.userId,
      amount, type,
      category: category || (type === "income" ? "Receita" : "Geral"),
      description: description || `Registro via WhatsApp`,
      date: date_reference || new Date().toISOString(),
      source: "whatsapp"
    });

    return error ? { success: false, message: "Erro ao salvar." } : { success: true, message: `${type === 'income' ? 'Receita' : 'Gasto'} registrado: R$ ${amount.toFixed(2)}.` };
  }

  private static async handleManualSummary(userContext: UserContext): Promise<CommandResult> {
    const todayStr = new Date().toISOString().split("T")[0];
    try {
      const message = await NotificationService.getWeeklyFinancialSummaryMessage(userContext.userId, todayStr);
      return { success: true, message };
    } catch (error: any) {
      console.error("[FinancialCommandService] Error generating manual summary:", error);
      return { success: false, message: "Não consegui gerar seu resumo agora. Tente novamente em instantes." };
    }
  }
}
