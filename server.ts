import express from "express";
import * as dotenv from "dotenv";
import { WhatsAppWebhookService } from "./src/services/whatsapp/WhatsAppWebhookService.js";
import { NotificationService } from "./src/services/whatsapp/NotificationService.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// --- Health Check ---
app.get(["/api/health", "/health", "/api"], (req, res) => {
  res.json({ 
    status: "ok", 
    version: "2.9.0 - Final Consolidated", 
    active_file: "server.ts",
    timestamp: new Date().toISOString() 
  });
});

// --- WhatsApp Webhook ---
/**
 * Verification (GET)
 */
app.get(["/api/whatsapp/webhook", "/whatsapp/webhook"], (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === "zlai_webhook_token") {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

/**
 * Handler (POST)
 */
app.post(["/api/whatsapp/webhook", "/whatsapp/webhook"], async (req, res) => {
  try {
    await WhatsAppWebhookService.handle(req.body);
    res.status(200).send('OK');
  } catch (err) {
    console.error("[Webhook Error]", err);
    res.status(500).send('Internal Error');
  }
});

// --- Notifications Trigger ---
app.get(["/api/whatsapp/notifications", "/whatsapp/notifications"], async (req, res) => {
  const secret = req.query["secret"];
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

// Standalone execution support
if (process.env.NODE_ENV !== "production") {
  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Server running locally on port ${PORT}`);
  });
}

export default app;
