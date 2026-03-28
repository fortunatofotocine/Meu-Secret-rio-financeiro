import { supabase } from "../../lib/supabaseServer.js";

export interface WeeklyFinancialData {
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  topCategories: { category: string; amount: number }[];
}

export interface BillsStatus {
  pending: { count: number; total: number };
  overdue: { count: number; total: number };
}

export class FinancialSummaryService {
  /**
   * Aggregates income, expenses and top categories for a date range.
   */
  static async getWeeklyData(userId: string, start: string, end: string): Promise<WeeklyFinancialData> {
    const { data: transactions, error } = await supabase
      .from("transactions")
      .select("amount, type, category")
      .eq("user_id", userId)
      .gte("date", start)
      .lte("date", end);

    if (error) throw error;

    let totalIncome = 0;
    let totalExpense = 0;
    const categoryMap: Record<string, number> = {};

    transactions.forEach(tx => {
      if (tx.type === "income") {
        totalIncome += tx.amount;
      } else {
        totalExpense += tx.amount;
        const cat = tx.category || "Geral";
        categoryMap[cat] = (categoryMap[cat] || 0) + tx.amount;
      }
    });

    const topCategories = Object.entries(categoryMap)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);

    return {
      totalIncome,
      totalExpense,
      netBalance: totalIncome - totalExpense,
      topCategories
    };
  }

  /**
   * Returns current pending and overdue bills count and total amount.
   */
  static async getBillsStatus(userId: string): Promise<BillsStatus> {
    const { data: instances, error } = await supabase
      .from("fixed_expense_instances")
      .select("amount, due_date")
      .eq("user_id", userId)
      .eq("status", "pending");

    if (error) throw error;

    const now = new Date();
    const brOffset = -3 * 60 * 60 * 1000;
    const todayStr = new Date(now.getTime() + brOffset).toISOString().split("T")[0];

    const stats = {
      pending: { count: 0, total: 0 },
      overdue: { count: 0, total: 0 }
    };

    instances.forEach(inst => {
      if (inst.due_date < todayStr) {
        stats.overdue.count++;
        stats.overdue.total += inst.amount;
      } else {
        stats.pending.count++;
        stats.pending.total += inst.amount;
      }
    });

    return stats;
  }
}
