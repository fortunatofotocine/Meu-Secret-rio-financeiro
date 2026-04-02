import { supabase } from "../../lib/supabaseServer.js";
import { WhatsAppMessagingService } from "./WhatsAppMessagingService.js";

export class ReminderWorkerService {
  /**
   * Main entry point for the 1-minute cron job.
   * Processes pending reminders that are due.
   */
  static async run() {
    const now = new Date();
    console.log(`[ReminderWorker] Starting run at ${now.toISOString()}`);

    // 1. Fetch pending reminders including user phone number
    const { data: reminders, error } = await supabase
      .from("reminders")
      .select(`
        id, 
        message, 
        user_id,
        profiles!inner ( whatsapp_number )
      `)
      .eq("status", "pending")
      .lte("scheduled_for", now.toISOString())
      .limit(10); // Batch of 10 per minute

    if (error) {
      console.error("[ReminderWorker] Fetch error:", error);
      return { success: false, error: error.message };
    }

    if (!reminders || reminders.length === 0) {
      return { success: true, processed: 0 };
    }

    let processedCount = 0;

    for (const reminder of reminders) {
      // 2. ATOMIC LOCK: Try to update status from 'pending' to 'processing'
      const { data: locked, error: lockError } = await supabase
        .from("reminders")
        .update({ status: 'processing' })
        .eq("id", reminder.id)
        .eq("status", "pending")
        .select()
        .single();

      if (lockError || !locked) {
        console.log(`[ReminderWorker] Could not lock reminder ${reminder.id}, skipping.`);
        continue;
      }

      // 3. EXECUTION: Send the WhatsApp message
      const whatsapp = (reminder.profiles as any)?.whatsapp_number;
      if (!whatsapp) {
        await this.markAsFailed(reminder.id, "User has no WhatsApp number");
        continue;
      }

      try {
        const msg = `⏰ *Ei, você pediu pra te lembrar:*\n\n${reminder.message}`;
        const response = await WhatsAppMessagingService.sendMessage(whatsapp, msg);

        // 4. FINALIZE: Update to 'sent'
        await supabase
          .from("reminders")
          .update({ 
            status: 'sent', 
            sent_at: new Date().toISOString(),
            metadata: { provider_response: response } 
          })
          .eq("id", reminder.id);
        
        processedCount++;
        console.log(`[ReminderWorker] Sent reminder ${reminder.id} to ${whatsapp}`);

      } catch (err: any) {
        console.error(`[ReminderWorker] Failed to send reminder ${reminder.id}:`, err);
        await this.markAsFailed(reminder.id, err.message || "Unknown error");
      }
    }

    return { success: true, processed: processedCount };
  }

  private static async markAsFailed(id: string, error: string) {
    // Basic retry logic: get current retry count
    const { data } = await supabase.from("reminders").select("retry_count").eq("id", id).single();
    const newCount = (data?.retry_count || 0) + 1;

    const newStatus = newCount >= 3 ? 'failed' : 'pending';

    await supabase
      .from("reminders")
      .update({ 
        status: newStatus,
        retry_count: newCount,
        last_error: error 
      })
      .eq("id", id);
  }
}
