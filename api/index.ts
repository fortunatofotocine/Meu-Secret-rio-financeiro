import express from "express";
import { WhatsAppWebhookService } from "../src/services/whatsapp/WhatsAppWebhookService.js";

const app = express();
app.use(express.json());

// Health Check
app.get(["/api/health", "/health", "/api"], (req, res) => {
  res.json({ 
    status: "ok", 
    version: "2.8.9 - Final Handshake", 
    timestamp: new Date().toISOString() 
  });
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
    // Correct call: use the static handle method
    await WhatsAppWebhookService.handle(req.body);
    res.status(200).send("EVENT_RECEIVED");
  } catch (error) {
    console.error("[Webhook Error]", error);
    res.status(500).send("INTERNAL_SERVER_ERROR");
  }
});

// Endpoint for manual notifications (API)
app.post("/api/notifications/send", async (req, res) => {
  try {
    const { userId, message } = req.body;
    if (!userId || !message) {
      return res.status(400).json({ success: false, error: "Missing parameters" });
    }
    
    // Simple notification logic
    console.log(`[Notification] Sending to ${userId}: ${message}`);
    
    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("[API Notifications Error]", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default app;
// v2.8.9 - Final Handshake Fix