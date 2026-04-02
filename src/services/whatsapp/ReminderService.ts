import { supabase } from "../../lib/supabaseServer.js";
import { UserContext, CommandResult, IntentEntities } from "./types.js";
import { addMinutes, addHours, addDays, isPast } from "date-fns";
import { TimeService } from "./TimeService.js";

export class ReminderService {
  /**
   * Main entry point to register a reminder.
   * Handles robust hybrid parsing (Regex + LLM entities) + Timezone.
   */
  static async register(user: UserContext, entities: IntentEntities, rawText: string): Promise<CommandResult> {
    const now = new Date(); // UTC on server
    const nowLocal = TimeService.toLocal(now);
    
    let scheduledForUTC: Date | null = null;
    let message = entities.description || entities.event_title || "";
    const cleanText = rawText.toLowerCase();

    // 1. ROBUST REGEX PARSING (Priority for relative time)
    
    // Pattern: "daqui 30 minutos", "em 10 min", "daqui a 10 minutos"
    const relativeMinMatch = cleanText.match(/daqui\s+(?:a\s+)?(\d+)\s+min(?:uto)?s?/i) || cleanText.match(/em\s+(\d+)\s+min(?:uto)?s?/i);
    if (relativeMinMatch) {
      const mins = parseInt(relativeMinMatch[1]);
      scheduledForUTC = addMinutes(now, mins); // Offset is irrelevant for relative addition
    } 
    // Pattern: "daqui 2 horas", "daqui a 1 hora", "em 3h"
    else if (cleanText.match(/daqui\s+(?:a\s+)?(\d+)\s+h(?:ora)?s?/i) || cleanText.match(/em\s+(\d+)\s+h(?:ora)?s?/i)) {
      const hoursMatch = cleanText.match(/daqui\s+(?:a\s+)?(\d+)\s+h(?:ora)?s?/i) || cleanText.match(/em\s+(\d+)\s+h(?:ora)?s?/i);
      const hours = parseInt(hoursMatch![1]);
      scheduledForUTC = addHours(now, hours);
    }
    // Pattern: "amanhã às 19:30", "amanhã as 19h"
    else if (cleanText.includes("amanha")) {
      const timeMatch = cleanText.match(/as\s+(\d{1,2})[:h](\d{2})?(?!\d)/i) || cleanText.match(/às\s+(\d{1,2})[:h](\d{2})?(?!\d)/i);
      if (timeMatch) {
        const hours = parseInt(timeMatch[1]);
        const mins = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
        
        const targetLocal = addDays(new Date(nowLocal), 1);
        targetLocal.setHours(hours, mins, 0, 0);
        scheduledForUTC = TimeService.toUTC(targetLocal);
      }
    }
    // Pattern: "hoje às 22:00"
    else if (cleanText.includes("hoje")) {
        const timeMatch = cleanText.match(/as\s+(\d{1,2})[:h](\d{2})?(?!\d)/i) || cleanText.match(/às\s+(\d{1,2})[:h](\d{2})?(?!\d)/i);
        if (timeMatch) {
          const hours = parseInt(timeMatch[1]);
          const mins = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
          
          const targetLocal = new Date(nowLocal);
          targetLocal.setHours(hours, mins, 0, 0);
          scheduledForUTC = TimeService.toUTC(targetLocal);
        }
    }

    // 2. LLM FALLBACK (if regex didn't catch or we need more precision)
    if (!scheduledForUTC && entities.date_reference && entities.time) {
        try {
            // Entities should be treated as LOCAL (BRT) from LLM
            const localDateStr = `${entities.date_reference}T${entities.time}:00`;
            const localDate = new Date(localDateStr);
            scheduledForUTC = TimeService.toUTC(localDate);
        } catch (e) {
            console.error("[ReminderService] Date parsing error:", e);
        }
    }

    // 3. VALIDATIONS
    if (!scheduledForUTC) {
      return { 
        success: false, 
        message: "Não consegui entender o horário do lembrete. Pode repetir dizendo algo como 'daqui 30 minutos' ou 'amanhã às 10h'?" 
      };
    }

    if (isPast(scheduledForUTC)) {
      return { 
        success: false, 
        message: `Ops! O horário ${TimeService.formatLocalTime(scheduledForUTC)} de ${TimeService.formatLocalDate(scheduledForUTC)} já passou no fuso de Brasília.` 
      };
    }

    // Clean message
    if (!message || message.length < 2) {
        message = rawText.replace(/zlai|zelai|zela|zelá/gi, "")
                        .replace(/me\s+lembra\s+(?:de\s+)?/i, "")
                        .replace(/me\s+avisa\s+(?:de\s+)?/i, "")
                        .replace(/daqui\s+(?:a\s+)?\d+\s+min(?:uto)?s?/i, "")
                        .replace(/daqui\s+(?:a\s+)?\d+\s+h(?:ora)?s?/i, "")
                        .replace(/amanhã\s+às\s+\d{1,2}[:h]\d{0,2}/i, "")
                        .replace(/hoje\s+às\s+\d{1,2}[:h]\d{0,2}/i, "")
                        .trim();
        if (message) message = message.charAt(0).toUpperCase() + message.slice(1);
    }

    // 4. PERSIST
    const { error } = await supabase.from("reminders").insert({
      user_id: user.userId,
      message: message || "Lembrete",
      original_text: rawText,
      scheduled_for: scheduledForUTC.toISOString(),
      status: 'pending'
    });

    if (error) {
      console.error("[ReminderService] Insert error:", error);
      return { success: false, message: "Erro ao salvar lembrete." };
    }

    return { 
      success: true, 
      message: `✅ Perfeito! Vou te lembrar ${TimeService.formatLocalDate(scheduledForUTC) === TimeService.formatLocalDate(now) ? 'hoje' : 'amanhã'} às ${TimeService.formatLocalTime(scheduledForUTC)} de: ${message || "isso"}.` 
    };
  }

  /**
   * Cancel the most recent pending reminder for a user.
   */
  static async cancelLast(userId: string): Promise<CommandResult> {
    const { data: last, error: fetchError } = await supabase
      .from("reminders")
      .select("id, message")
      .eq("user_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !last) {
      return { success: false, message: "Não encontrei nada pendente para cancelar." };
    }

    const { error: updateError } = await supabase
      .from("reminders")
      .update({ status: 'canceled', canceled_at: new Date().toISOString() })
      .eq("id", last.id);

    return updateError 
      ? { success: false, message: "Erro ao cancelar." } 
      : { success: true, message: `✅ Lembrete cancelado: "${last.message}"` };
  }

  /**
   * List the next pending reminders.
   */
  static async listUpcoming(userId: string): Promise<CommandResult> {
    const { data: reminders, error } = await supabase
      .from("reminders")
      .select("message, scheduled_for")
      .eq("user_id", userId)
      .eq("status", "pending")
      .order("scheduled_for", { ascending: true })
      .limit(5);

    if (error) return { success: false, message: "Erro ao buscar lembretes." };
    if (!reminders || reminders.length === 0) {
      return { success: true, message: "Você não tem nenhum lembrete agendado." };
    }

    const list = reminders.map(r => {
      return `• ${TimeService.formatLocalTime(r.scheduled_for)} (${TimeService.formatLocalDate(r.scheduled_for)}): ${r.message}`;
    }).join("\n");

    return { success: true, message: `⏰ *Seus próximos lembretes:*\n\n${list}` };
  }
}
