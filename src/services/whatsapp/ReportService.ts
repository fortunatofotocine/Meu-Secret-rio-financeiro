import { supabase } from '../../lib/supabaseServer';
import { UserContext, IntentEntities, CommandResult } from './types';

export class ReportService {
  static async getSummary(user: UserContext, entities: IntentEntities, type: "income" | "expense"): Promise<CommandResult> {
    const { date_reference } = entities;
    const dateRange = this.getDateRange(date_reference || "hoje");

    const { data, error } = await supabase
      .from("transactions")
      .select("amount")
      .eq("user_id", user.userId)
      .eq("type", type)
      .gte("date", dateRange.start)
      .lte("date", dateRange.end)
      .eq("is_deleted", false);

    if (error) {
      console.error("Erro ao consultar gastos:", error);
      return { success: false, message: "Erro ao consultar o banco de dados." };
    }

    const total = data.reduce((acc, curr) => acc + Number(curr.amount), 0);
    const periodText = this.getPeriodText(date_reference || "hoje");

    return {
      success: true,
      message: `${type === "income" ? "Receitas" : "Gastos"} em ${periodText}: R$ ${total.toFixed(2)}.`,
      data: { total, period: periodText }
    };
  }

  private static getDateRange(ref: string): { start: string, end: string } {
    const now = new Date();
    const brOffset = -3 * 60 * 60 * 1000;
    const brNow = new Date(now.getTime() + brOffset);
    const start = new Date(brNow);
    const end = new Date(brNow);

    if (ref === "hoje") {
      start.setUTCHours(0, 0, 0, 0);
      end.setUTCHours(23, 59, 59, 999);
    } else if (ref === "ontem") {
      start.setUTCDate(brNow.getUTCDate() - 1);
      start.setUTCHours(0, 0, 0, 0);
      end.setUTCDate(brNow.getUTCDate() - 1);
      end.setUTCHours(23, 59, 59, 999);
    } else if (ref.includes("semana")) {
      const day = brNow.getUTCDay() || 7;
      start.setUTCDate(brNow.getUTCDate() - (day - 1));
      start.setUTCHours(0, 0, 0, 0);
      end.setUTCHours(23, 59, 59, 999);
    } else if (ref.includes("mês")) {
      start.setUTCDate(1);
      start.setUTCHours(0, 0, 0, 0);
      end.setUTCHours(23, 59, 59, 999);
    }

    return {
      start: new Date(start.getTime() - brOffset).toISOString(),
      end: new Date(end.getTime() - brOffset).toISOString()
    };
  }

  private static getPeriodText(ref: string): string {
    if (ref === "hoje") return "hoje";
    if (ref === "ontem") return "ontem";
    if (ref.includes("semana")) return "esta semana";
    if (ref.includes("mês")) return "este mês";
    return ref;
  }
}
