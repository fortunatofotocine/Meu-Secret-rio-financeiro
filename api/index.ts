import express from "express";
import * as dotenv from "dotenv";
import { WhatsAppWebhookService } from "../src/services/whatsapp/WhatsAppWebhookService";
import { NotificationService } from "../src/services/whatsapp/NotificationService";

dotenv.config();

const app = express();
app.use(express.json());

// Health Check
app.get(["/api/health", "/health", "/api"], (req, res) => {
  res.json({ 
    status: "ok", 
    version: "2.5.0 - Service Oriented", 
    timestamp: new Date().toISOString() 
  });
});

/**
 * WHATSAPP WEBHOOK VERIFICATION (GET)
 */
app.get(["/api/whatsapp/webhook", "/whatsapp/webhook"], (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  // Use the token defined in Meta App Dashboard
  if (mode === "subscribe" && token === "zlai_webhook_token") {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

/**
 * WHATSAPP WEBHOOK HANDLER (POST)
 */
app.post(["/api/whatsapp/webhook", "/whatsapp/webhook"], async (req, res) => {
  try {
    // Delegate ALL logic to the specialized service
    await WhatsAppWebhookService.handle(req.body);
    res.status(200).send('OK');
  } catch (err) {
    console.error("[Webhook Error]", err);
    res.status(500).send('Internal Error');
  }
});

/**
 * AUTOMATED NOTIFICATIONS TRIGGER (Daily & Weekly)
 * This endpoint should be called by a Cron Job (e.g., Vercel Cron).
 */
app.get(["/api/whatsapp/notifications", "/whatsapp/notifications"], async (req, res) => {
  const secret = req.query["secret"];
  
  // Security check for cron trigger
  if (secret !== process.env.WHATSAPP_VERIFY_TOKEN && secret !== "zlai_cron_secret") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    await NotificationService.processAllNotifications();
    res.json({ success: true, message: "Notifications processed successfully." });
  } catch (error: any) {
    console.error("[API Notifications Error]", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default app;
