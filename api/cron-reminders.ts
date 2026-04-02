import { ReminderWorkerService } from "../src/services/whatsapp/ReminderWorkerService.js";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * ISOLATED CRON ENDPOINT: /api/cron/process-reminders
 * Triggered every 1 minute to send scheduled WhatsApp reminders.
 */
export default async function handler(req: any, res: any) {
  // 1. Security Check
  const secret = req.query["secret"];
  const validSecret = process.env.WHATSAPP_VERIFY_TOKEN || "zlai_cron_secret";

  if (secret !== validSecret && secret !== "zlai_cron_secret") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // 2. Only allow GET for cron triggers (standard practice)
  if (req.method !== 'GET') {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const result = await ReminderWorkerService.run();
    return res.status(200).json(result);
  } catch (error: any) {
    console.error("[Cron Reminders Error]", error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || "Internal Server Error" 
    });
  }
}
