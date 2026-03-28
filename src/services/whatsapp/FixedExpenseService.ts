import { supabase } from '../../lib/supabaseServer.js';
import { UserContext, CommandResult } from './types.js';

export class FixedExpenseService {
  /**
   * Lists pending or overdue bills for the user with optional filters.
   */
  static async listPending(user: UserContext, filter: "all" | "today" | "week" | "overdue" = "all") {
    let query = supabase
      .from("fixed_expense_instances")
      .select(`
        id,
        amount,
        due_date,
        status,
        installment_label,
        fixed_expenses (
          description,
          category
        )
      `)
      .eq("user_id", user.userId)
      .in("status", ["pending", "overdue"])
      .order("due_date", { ascending: true });

    const now = new Date();
    const brOffset = -3 * 60 * 60 * 1000;
    const todayStr = new Date(now.getTime() + brOffset).toISOString().split('T')[0];

    if (filter === "today") {
      query = query.eq("due_date", todayStr);
    } else if (filter === "overdue") {
      query = query.lt("due_date", todayStr);
    } else if (filter === "week") {
      const nextWeek = new Date(now.getTime() + brOffset + (7 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
      query = query.gte("due_date", todayStr).lte("due_date", nextWeek);
    }

    const { data, error } = await query;
    if (error) throw error;

    return data.map(item => ({
      id: item.id,
      description: (item.fixed_expenses as any)?.description || "Sem descrição",
      amount: item.amount,
      due_date: item.due_date,
      status: item.status,
      label: item.installment_label
    }));
  }

  /**
   * Finds candidate bills based on user text (e.g. "internet").
   */
  static async findCandidates(user: UserContext, text: string) {
    const allPending = await this.listPending(user, "all");
    const searchTerms = text.toLowerCase().split(' ').filter(t => t.length > 2);

    if (searchTerms.length === 0) return [];

    const candidates = allPending.filter(item => {
      const desc = item.description.toLowerCase();
      const label = (item.label || "").toLowerCase();
      return searchTerms.some(term => desc.includes(term) || label.includes(term));
    });

    // Priority: Overdue first, then nearest due date
    return candidates.sort((a, b) => {
      if (a.status === "overdue" && b.status !== "overdue") return -1;
      if (a.status !== "overdue" && b.status === "overdue") return 1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    }).slice(0, 3); // Limit to top 3
  }

  /**
   * Atomic payment via RPC.
   */
  static async markAsPaid(user: UserContext, instanceId: string): Promise<CommandResult> {
    const { data, error } = await supabase.rpc('pay_fixed_expense_instance_rpc', {
      p_instance_id: instanceId,
      p_user_id: user.userId
    });

    if (error) {
      console.error("[FixedExpenseService] RPC Error:", error);
      return { success: false, message: "Erro técnico ao processar pagamento." };
    }

    const result = data as { success: boolean, message: string, transaction_id?: string };

    if (!result.success) {
      const messages: Record<string, string> = {
        'not_found': "Conta não encontrada.",
        'forbidden': "Você não tem permissão para pagar esta conta.",
        'already_paid': "Esta conta já foi marcada como paga.",
        'error': "Erro ao processar o banco de dados."
      };
      return { success: false, message: messages[result.message] || "Ocorreu um erro inesperado." };
    }

    return { 
      success: true, 
      message: "Conta marcada como paga e transação registrada!",
      data: result.transaction_id
    };
  }
}
