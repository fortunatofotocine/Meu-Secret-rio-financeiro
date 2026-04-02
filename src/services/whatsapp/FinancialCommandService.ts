import { supabase } from '../../lib/supabaseServer.js';
import { UserContext, IntentResult, CommandResult, IntentEntities, ConversationStatus } from './types.js';
import { ReportService } from './ReportService.js';
import { NotificationService } from './NotificationService.js';
import { ConversationStateService } from './ConversationStateService.js';
import { FixedExpenseService } from './FixedExpenseService.js';
import { ResponseComposerService } from './ResponseComposerService.js';
import { NormalizationService } from './NormalizationService.js';
import { ReminderService } from './ReminderService.js';
import { TimeService } from './TimeService.js';

export class FinancialCommandService {
  /**
   * Executes the system logic based on the intent and the user's conversational state.
   */
  static async execute(user: UserContext, classification: IntentResult, button_reply?: { id: string, title: string }, rawText?: string): Promise<CommandResult> {
    const { intent, entities } = classification;
    const state = user.state || { status: 'idle' };

    // 0. Handle Button Replies (High Priority)
    if (button_reply) {
      if (button_reply.id === "confirmar_registro") {
        await ConversationStateService.clear(user.userId);
        return { success: true, message: "✅ Perfeito! Já deixei tudo anotado." };
      }
      if (button_reply.id === "editar_registro") {
        // Prepare the state change
        const stateToSet = {
          ...state,
          status: "awaiting_edit" as ConversationStatus
        };
        
        // Return it so the composer can pass it back to the webhook service
        return { 
          success: true, 
          message: "Qual o novo nome ou descrição para esse registro?",
          data: { stateToSet }
        };
      }
    }

    // 0.5 Handle text-based edit if in awaiting_edit state
    // PRIORITY: If we are waiting for an edit, any text that isn't a button click 
    // should be treated as the new description, regardless of its classified intent.
    if (state.status === "awaiting_edit" && !button_reply) {
      // Use the extracted description, or any event title, or the raw text as a last resort
      const newDesc = entities?.description || entities?.event_title || entities?.category || rawText || "";
      if (newDesc) {
        return await this.updateLastTransaction(user, newDesc);
      }
    }

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
      case "registrar_transacao":
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
      
      case "consultar_resumo_semana":
        return await this.handleManualSummary(user);

      // --- Info ---
        return { 
          success: true, 
          message: "Eu sou o ZLAI! 🤖\n\n🔹 *Finanças:* 'gastei 50 no mercado', 'recebi 200 do freela'\n🔹 *Contas:* 'o que vence hoje?', 'paguei a internet'\n🔹 *Relatórios:* 'resumo da semana', 'balanço'\n🔹 *Agenda:* 'marque reunião amanhã às 19h'\n\nComo posso te ajudar agora?" 
        };
      
      case "registrar_evento":
        return await this.handleEventRegistry(user, entities);

      case "registrar_lembrete":
        return await ReminderService.register(user, entities, rawText || "");

      case "cancelar_lembrete":
        return await ReminderService.cancelLast(user.userId);

      case "listar_lembretes":
        return await ReminderService.listUpcoming(user.userId);

      case "confirmar":
        if (state.status === "awaiting_confirmation" && state.pendingIntent) {
           const result = await this.handleConfirmedIntent(user, state);
           await ConversationStateService.clear(user.userId);
           return result;
        }
        return { success: false, message: "Não tenho nenhuma ação pendente para confirmar." };
      
      case "cancelar":
        await ConversationStateService.clear(user.userId);
        return { success: true, message: "Ok, ação cancelada." };

      case "ativar_conta":
        return await this.handleActivation(user, entities);

      default:
        return { success: false, message: "Ainda não sei como processar este pedido." };
    }
  }

  private static async handleActivation(user: UserContext, entities: IntentEntities): Promise<CommandResult> {
    console.log(`[Activation] Attempting to activate user ${user.userId} with number ${user.whatsappNumber}. isPending: ${user.isPending}`);
    
    // Safety link: link to system_logs too
    await supabase.from('system_logs').insert([{
      event_type: 'whatsapp_activation_attempt',
      payload: { userId: user.userId, whatsapp: user.whatsappNumber, isPending: user.isPending }
    }]);

    if (!user.isPending) {
      if (user.isRegistered) return { success: true, message: "Sua conta já está ativa! Como posso ajudar?" };
      return { success: false, message: "Não encontrei um cadastro pendente com este número. Verifique se o número no cadastro está correto." };
    }

    // Link User
    const { error: linkError } = await supabase
      .from('profiles')
      .update({ 
        whatsapp_number: user.whatsappNumber,
        pending_whatsapp: null 
      })
      .eq('id', user.userId);

    if (linkError) {
      console.error("[Activation] Error linking user:", linkError);
      return { success: false, message: "Erro ao vincular seu WhatsApp. Tente novamente mais tarde." };
    }

    return { 
      success: true, 
      message: `✅ *CONTA ATIVADA!* 🚀\n\nBem-vindo(a) à ZLAI! Reconheci seu número automaticamente.\n\nJá liberei seu acesso de 30 dias grátis! Pode começar anotando seus gastos agora mesmo.\n\nEx: "Gastei 50 no mercado hoje"` 
    };
  }

  private static async handlePayBill(user: UserContext, entities: IntentEntities): Promise<CommandResult> {
    const search = entities.description;
    if (!search) return { success: false, message: "Qual conta você pagou? (Ex: internet, aluguel)" };

    const candidates = await FixedExpenseService.findCandidates(user, search);
    
    if (candidates.length === 0) {
      return { success: false, message: `Não encontrei nenhuma conta pendente com "${search}".` };
    }

    if (candidates.length === 1) {
      return { 
        success: true, 
        message: "",
        data: { candidate: candidates[0], intent: "marcar_conta_paga" } 
      };
    }

    const message = ResponseComposerService.formatAmbiguityPrompt(candidates);
    return { success: true, message };
  }

  private static async listBills(user: UserContext, filter: any): Promise<CommandResult> {
    const bills = await FixedExpenseService.listPending(user, filter);
    return { success: true, message: "", data: { bills, filter } };
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
      return await this.handlePayBill(user, state.pendingEntities);
    }
    if (state.pendingIntent === "registrar_evento") {
      return await this.handleEventRegistry(user, state.pendingEntities);
    }
    return { success: false, message: "Não consegui concluir a ação pendente." };
  }

  private static async handleEventRegistry(user: UserContext, entities: IntentEntities): Promise<CommandResult> {
    const { event_title, date_reference, time, description } = entities;
    
    // Safety check for date/time (ValidationService already blocks, but defense in depth)
    if (!event_title && !description) return { success: false, message: "Qual o compromisso?" };

    const date = date_reference || new Date().toISOString().split('T')[0];
    const startTimeStr = `${date}T${time || "00:00"}:00`;
    
    // Assume users are in BRT (-3). LLM time strings are now interpreted as BRT and converted to UTC.
    const startTimeUTC = TimeService.toUTC(startTimeStr);

    const { error } = await supabase
      .from('events')
      .insert([{
        user_id: user.userId,
        title: event_title || description,
        description: description,
        start_time: startTimeUTC.toISOString(),
        source: 'whatsapp'
      }]);

    if (error) {
      console.error("[Command] Erro ao registrar evento:", error);
      return { success: false, message: "Desculpe, tive um problema ao salvar na agenda." };
    }

    const formattedDate = TimeService.formatLocalDate(startTimeUTC);
    const formattedTime = time ? ` às ${time}` : "";

    return { 
      success: true, 
      message: "",
      data: { event: { title: event_title || description, date: formattedDate, time: formattedTime || undefined } }
    };
  }

  private static async recordTransaction(user: UserContext, type: "income" | "expense", entities: IntentEntities | undefined): Promise<CommandResult> {
    if (!entities || !entities.amount) return { success: false, message: "Falta o valor." };
    const { amount, category, description, date_reference, receipt_url, date } = entities;
    
    const rawDate = date || date_reference;
    const finalDate = rawDate 
      ? (rawDate.includes('T') ? rawDate : `${rawDate}T12:00:00Z`) 
      : new Date().toISOString();

    const cleanDescription = NormalizationService.cleanDescription(description || `Registro via WhatsApp`);
    const { error } = await supabase.from("transactions").insert({
      user_id: user.userId,
      amount, type,
      category: category || (type === "income" ? "Receita" : "Geral"),
      description: cleanDescription,
      date: finalDate,
      source: "whatsapp",
      receipt_url
    });

    return error ? { success: false, message: "Erro ao salvar." } : { 
      success: true, 
      message: "", 
      data: { 
        transaction: { 
          type, 
          amount, 
          category: category || (type === "income" ? "Receita" : "Geral"), 
          description: cleanDescription, 
          date: date || date_reference || "hoje", 
          receipt_url 
        } 
      } 
    };
  }

  private static async handleManualSummary(userContext: UserContext): Promise<CommandResult> {
    const now = new Date();
    const brOffset = -3 * 60 * 60 * 1000;
    const todayBRT = new Date(now.getTime() + brOffset);
    const todayStr = todayBRT.toISOString().split("T")[0];

    // Inclui hoje no resumo dos últimos 7 dias (totalizando 7 dias)
    const startDate = new Date(todayBRT.getTime() - 6 * 24 * 60 * 60 * 1000);
    const startStr = startDate.toISOString().split("T")[0];
    const nextDay = new Date(todayBRT.getTime() + 1 * 24 * 60 * 60 * 1000);
    const endStr = nextDay.toISOString().split("T")[0];

    try {
      const { FinancialSummaryService } = await import('./FinancialSummaryService.js');
      const summary = await FinancialSummaryService.getWeeklyData(userContext.userId, startStr, endStr);
      const bills = await FinancialSummaryService.getBillsStatus(userContext.userId);

      return { success: true, message: "", data: { summary, bills, intent: "consultar_resumo_semana" } };
    } catch (error: any) {
      console.error("[FinancialCommandService] Error generating manual summary:", error);
      return { success: false, message: "Não consegui gerar seu resumo agora. Tente novamente em instantes." };
    }
  }

  private static async updateLastTransaction(user: UserContext, input: string): Promise<CommandResult> {
    if (!input) return { success: false, message: "Não entendi a alteração. Pode repetir?" };

    // 1. Find last transaction
    const { data: lastTx, error: findError } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (findError || !lastTx) {
      return { success: false, message: "Não encontrei o registro para editar." };
    }

    // 2. Extract potential new amount and description
    let newAmount = lastTx.amount;
    let newDescription = lastTx.description;

    // Regex to match a number (supports 50, 50.00, 50,00)
    const amountMatch = input.match(/(\d+([.,]\d{2})?)/);
    
    if (amountMatch) {
      newAmount = parseFloat(amountMatch[0].replace(',', '.'));
      // Remove the amount from the text to get the remaining as description
      const remainingText = input.replace(amountMatch[0], "").trim();
      if (remainingText) {
        newDescription = NormalizationService.cleanDescription(remainingText);
      }
    } else {
      // If no number is found, treat entire input as description
      newDescription = NormalizationService.cleanDescription(input);
    }

    // 3. Update the registry
    const { error: updateError } = await supabase
      .from("transactions")
      .update({ 
        description: newDescription,
        amount: newAmount
      })
      .eq("id", lastTx.id);

    if (updateError) return { success: false, message: "Erro ao atualizar o registro." };

    await ConversationStateService.clear(user.userId);
    
    const amountStr = newAmount.toFixed(2);
    return { 
      success: true, 
      message: `✅ *Registro Atualizado!*\n\n💰 *Valor:* R$ ${amountStr}\n📝 *Descrição:* ${newDescription}`,
      data: { intent: "fallback" }
    };
  }
}
