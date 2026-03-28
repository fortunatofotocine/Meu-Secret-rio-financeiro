import { supabase } from "../../lib/supabaseServer";
import { WhatsAppMessagingService } from "./WhatsAppMessagingService";
import { FinancialSummaryService } from "./FinancialSummaryService";

export class NotificationService {
  /**
   * Main entry point to be triggered by a daily job.
   */
  static async processAllNotifications() {
    const now = new Date();
    const brOffset = -3 * 60 * 60 * 1000;
    const todayBRT = new Date(now.getTime() + brOffset);
    const todayStr = todayBRT.toISOString().split("T")[0];

    console.log(`[NotificationService] Processing jobs for ${todayStr}`);

    await this.sendDailyReminders(todayStr);
    await this.sendOverdueReminders(todayStr);

    // Monday (1) summary checks
    if (todayBRT.getDay() === 1) {
      await this.sendWeeklySummary(todayStr); // Bill reminders
      await this.sendWeeklyFinancialSummary(todayStr); // NEW: Full financial report
    }
  }

  /**
   * Sends 1-time alerts for bills due Today and Tomorrow.
   */
  private static async sendDailyReminders(todayStr: string) {
    const tomorrow = new Date(new Date(todayStr).getTime() + 24 * 60 * 60 * 1000);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    // 1. Fetch Candidates (Today and Tomorrow)
    const { data: instances, error } = await supabase
      .from("fixed_expense_instances")
      .select(`
        id, user_id, amount, due_date,
        profiles!inner ( whatsapp_number ),
        fixed_expenses!inner ( description )
      `)
      .in("due_date", [todayStr, tomorrowStr])
      .eq("status", "pending");

    if (error) throw error;

    for (const inst of instances) {
      const type = inst.due_date === todayStr ? "due_today" : "due_tomorrow";
      const whatsapp = (inst.profiles as any)?.whatsapp_number;
      const description = (inst.fixed_expenses as any)?.description;

      if (!whatsapp) continue;

      try {
        const { error: logErr } = await supabase.from("whatsapp_notifications").insert({
          user_id: inst.user_id,
          fixed_expense_instance_id: inst.id,
          notification_type: type,
          scheduled_for: todayStr,
          status: "pending",
        });

        if (logErr) {
          if (logErr.code === "23505") continue;
          throw logErr;
        }

        const msg = type === "due_today" 
          ? `🚀 *Vence hoje:* ${description} — R$ ${inst.amount.toFixed(2)}. Já pagou? Só me avisar!`
          : `⏰ *Lembrete ZLAI:* Amanhã vence ${description} — R$ ${inst.amount.toFixed(2)}.`;

        const response = await WhatsAppMessagingService.sendMessage(whatsapp, msg);

        await supabase.from("whatsapp_notifications")
          .update({ status: "sent", sent_at: new Date().toISOString(), provider_response: response })
          .eq("fixed_expense_instance_id", inst.id)
          .eq("notification_type", type)
          .eq("scheduled_for", todayStr);

      } catch (err: any) {
        console.error(`[NotificationService] Failed for instance ${inst.id}:`, err);
        await supabase.from("whatsapp_notifications")
          .update({ status: "failed", error_message: err.message })
          .eq("fixed_expense_instance_id", inst.id)
          .eq("notification_type", type)
          .eq("scheduled_for", todayStr);
      }
    }
  }

  /**
   * Sends Overdue alerts with 3-day backoff.
   */
  private static async sendOverdueReminders(todayStr: string) {
    const { data: instances, error } = await supabase
      .from("fixed_expense_instances")
      .select(`
        id, user_id, amount, due_date,
        profiles!inner ( whatsapp_number ),
        fixed_expenses!inner ( description )
      `)
      .lt("due_date", todayStr)
      .eq("status", "pending");

    if (error) throw error;

    for (const inst of instances) {
      const whatsapp = (inst.profiles as any)?.whatsapp_number;
      const description = (inst.fixed_expenses as any)?.description;

      if (!whatsapp) continue;

      const { data: lastLogs } = await supabase.from("whatsapp_notifications")
        .select("sent_at")
        .eq("fixed_expense_instance_id", inst.id)
        .eq("notification_type", "overdue")
        .order("sent_at", { ascending: false })
        .limit(1);

      if (lastLogs && lastLogs.length > 0) {
        const lastSent = new Date(lastLogs[0].sent_at).getTime();
        const diffDays = (new Date().getTime() - lastSent) / (1000 * 60 * 60 * 24);
        if (diffDays < 3) continue;
      }

      try {
        const { error: logErr } = await supabase.from("whatsapp_notifications").insert({
          user_id: inst.user_id,
          fixed_expense_instance_id: inst.id,
          notification_type: "overdue",
          scheduled_for: todayStr,
          status: "pending",
        });

        if (logErr) continue;

        const msg = `⚠️ *Conta Atrasada:* ${description} — R$ ${inst.amount.toFixed(2)} venceu em ${new Date(inst.due_date).toLocaleDateString("pt-BR")}. Vamos regularizar?`;
        const response = await WhatsAppMessagingService.sendMessage(whatsapp, msg);

        await supabase.from("whatsapp_notifications")
          .update({ status: "sent", sent_at: new Date().toISOString(), provider_response: response })
          .eq("fixed_expense_instance_id", inst.id)
          .eq("notification_type", "overdue")
          .eq("scheduled_for", todayStr);

      } catch (err: any) {
        await supabase.from("whatsapp_notifications")
          .update({ status: "failed", error_message: err.message })
          .eq("fixed_expense_instance_id", inst.id)
          .eq("notification_type", "overdue")
          .eq("scheduled_for", todayStr);
      }
    }
  }

  /**
   * Sends weekly summary (Mondays).
   */
  private static async sendWeeklySummary(todayStr: string) {
    const { data: users, error: userError } = await supabase.from("profiles").select("id, whatsapp_number").not("whatsapp_number", "is", null);
    if (userError) throw userError;

    for (const user of users) {
      const { data: pending, error } = await supabase
        .from("fixed_expense_instances")
        .select(`
          amount, due_date,
          fixed_expenses!inner ( description )
        `)
        .eq("user_id", user.id)
        .eq("status", "pending")
        .order("due_date", { ascending: true });

      if (error || !pending || pending.length === 0) continue;

      const totalAmount = pending.reduce((acc, curr) => acc + curr.amount, 0);
      const top3 = pending.slice(0, 3);

      try {
        const { error: logErr } = await supabase.from("whatsapp_notifications").insert({
          user_id: user.id,
          notification_type: "weekly_summary",
          scheduled_for: todayStr,
          status: "pending",
        });

        if (logErr) continue;

        let listMsg = top3.map(p => {
          const desc = (p.fixed_expenses as any)?.description || "Conta";
          return `• ${desc} (${new Date(p.due_date).toLocaleDateString("pt-BR")})`;
        }).join("\n");
        const msg = `📈 *Resumo da Semana:* Você tem ${pending.length} conta${pending.length > 1 ? 's' : ''} pendente${pending.length > 1 ? 's' : ''}, totalizando R$ ${totalAmount.toFixed(2)}.\n\nAs mais próximas:\n${listMsg}\n\nBoa semana!`;

        const response = await WhatsAppMessagingService.sendMessage(user.whatsapp_number, msg);

        await supabase.from("whatsapp_notifications")
          .update({ status: "sent", sent_at: new Date().toISOString(), provider_response: response })
          .eq("user_id", user.id)
          .eq("notification_type", "weekly_summary")
          .eq("scheduled_for", todayStr);

      } catch (err: any) {
        await supabase.from("whatsapp_notifications")
          .update({ status: "failed", error_message: err.message })
          .eq("user_id", user.id)
          .eq("notification_type", "weekly_summary")
          .eq("scheduled_for", todayStr);
      }
    }
  }

  /**
   * Automate the weekly financial summary (Mondays).
   */
  private static async sendWeeklyFinancialSummary(todayStr: string) {
    const { data: users, error: userError } = await supabase.from("profiles").select("id, whatsapp_number").not("whatsapp_number", "is", null);
    if (userError) throw userError;

    for (const user of users) {
      if (!user.whatsapp_number) continue;

      try {
        const { error: logErr } = await supabase.from("whatsapp_notifications").insert({
          user_id: user.id,
          notification_type: "weekly_financial_summary",
          scheduled_for: todayStr,
          status: "pending",
        });

        if (logErr) continue;

        const message = await this.getWeeklyFinancialSummaryMessage(user.id, todayStr);
        const response = await WhatsAppMessagingService.sendMessage(user.whatsapp_number, message);

        await supabase.from("whatsapp_notifications")
          .update({ status: "sent", sent_at: new Date().toISOString(), provider_response: response })
          .eq("user_id", user.id)
          .eq("notification_type", "weekly_financial_summary")
          .eq("scheduled_for", todayStr);

      } catch (err: any) {
        console.error(`[NotificationService] Financial summary failed for ${user.id}:`, err);
        await supabase.from("whatsapp_notifications")
          .update({ status: "failed", error_message: err.message })
          .eq("user_id", user.id)
          .eq("notification_type", "weekly_financial_summary")
          .eq("scheduled_for", todayStr);
      }
    }
  }

  /**
   * Generates the weekly financial summary message for a specific user.
   */
  public static async getWeeklyFinancialSummaryMessage(userId: string, referenceDate: string): Promise<string> {
    const now = new Date(referenceDate);
    const lastMon = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastSun = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
    
    const startStr = lastMon.toISOString().split("T")[0];
    const endStr = lastSun.toISOString().split("T")[0];

    const summary = await FinancialSummaryService.getWeeklyData(userId, startStr, endStr);
    const bills = await FinancialSummaryService.getBillsStatus(userId);

    return this.composeWeeklySummaryMessage(summary, bills);
  }

  private static composeWeeklySummaryMessage(data: any, bills: any): string {
    let msg = "📊 *Resumo da sua semana na ZLAI*\n\n";

    if (data.totalIncome > 0 || data.totalExpense > 0) {
      msg += `• Você recebeu: R$ ${data.totalIncome.toFixed(2)}\n`;
      msg += `• Você gastou: R$ ${data.totalExpense.toFixed(2)}\n`;
      msg += `• Saldo da semana: R$ ${data.netBalance.toFixed(2)}\n\n`;
    } else {
      msg += "Você não teve movimentações registradas na última semana.\n\n";
    }

    if (data.topCategories.length > 0) {
      msg += "*Maiores gastos:*\n";
      data.topCategories.forEach((cat: any, i: number) => {
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
}
