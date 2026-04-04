import express from "express";
import { WhatsAppWebhookService } from "../src/services/whatsapp/WhatsAppWebhookService.js";
import { ReminderWorkerService } from "../src/services/whatsapp/ReminderWorkerService.js";

const app = express();
app.use(express.json());

// Health Check
app.get(["/api/health", "/health", "/api"], (req, res) => {
  res.json({ 
    status: "ok", 
    version: "4.2.0 [parser-v4.1] - SOLUÇÃO CONCRETA", 
    timestamp: new Date().toISOString() 
  });
});

// CRON ENDPOINT: /api/cron-reminders
app.get("/api/cron-reminders", async (req, res) => {
  const secret = req.query["secret"];
  const validSecret = process.env.WHATSAPP_VERIFY_TOKEN || "zlai_cron_secret";
  if (secret !== validSecret && secret !== "zlai_cron_secret") {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const result = await ReminderWorkerService.run();
    return res.status(200).json(result);
  } catch (error: any) {
    console.error("[Integrated Cron Error]", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Meta Webhook Verification (GET)
app.get(["/api/whatsapp/webhook", "/whatsapp/webhook"], (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode && token) {
    if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      console.log("[Webhook] Verified successfully");
      return res.status(200).send(challenge);
    }
  }
  return res.sendStatus(403);
});

// WhatsApp Webhook (POST)
app.post(["/api/whatsapp/webhook", "/whatsapp/webhook"], async (req, res) => {
  try {
    await WhatsAppWebhookService.handle(req.body);
    res.status(200).send("EVENT_RECEIVED");
  } catch (error) {
    console.error("[Webhook Error]", error);
    res.status(500).send("INTERNAL_SERVER_ERROR");
  }
});

export default app;
// v4.2.0 - CONCRETE INFRASTRUCTURE FIX