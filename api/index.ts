import express from "express";
import * as dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
app.use(express.json());

// Supabase Client - USE SERVICE ROLE FOR BACKEND OPERATIONS
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl || "https://placeholder.supabase.co", supabaseKey || "placeholder");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

app.get(["/api/health", "/health", "/api"], (req, res) => {
  res.json({ status: "ok", version: "1.8.4 - Webhook Debug Isolation", timestamp: new Date().toISOString() });
});

app.get(["/api/whatsapp/webhook", "/whatsapp/webhook"], (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === "zlai_webhook_token") return res.status(200).send(challenge);
  return res.sendStatus(403);
});

function normalizePhone(phone: string) {
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("55") && cleaned.length > 10) {
    cleaned = cleaned.substring(2);
  }
  return cleaned;
}

function getDateRange(period: string) {
  const now = new Date();
  const brOffset = -3 * 60 * 60 * 1000;
  const brNow = new Date(now.getTime() + brOffset);
  const start = new Date(brNow);
  
  if (period === "hoje") {
    start.setUTCHours(0, 0, 0, 0);
  } else if (period.includes("semana")) {
    const day = brNow.getUTCDay() || 7;
    if (day !== 1) start.setUTCDate(brNow.getUTCDate() - (day - 1));
    start.setUTCHours(0, 0, 0, 0);
  } else if (period.includes("mês")) {
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);
  }
  
  const resultDate = new Date(start.getTime() - brOffset);
  return resultDate.toISOString();
}

app.post(["/api/whatsapp/webhook", "/whatsapp/webhook"], async (req, res) => {
  const body = req.body;
  if (body.object === 'whatsapp_business_account' && body.entry) {
    for (const entry of body.entry) {
      for (const change of entry.changes) {
        const value = change.value;
        const message = value.messages?.[0];
        
        if (message && message.type === 'text') {
          const from = message.from;
          const rawText = (message.text?.body || "").trim();
          
          console.log(`[Isolation v1.8.4] From: ${from}, Text: "${rawText}"`);

          // 1. Fixed Response
          const finalResponse = "Teste ZLAI funcionando";

          // 2. Save to DB for history
          await supabase.from("whatsapp_messages").insert({
            whatsapp_id: message.id, 
            sender_number: from, 
            message_text: rawText,
            status: "processed",
            interpretation: { intent: "test_isolation", parserUsed: "debug_isolation" }, 
            raw_data: body
          });

          // 3. Send WhatsApp Response with Verbose Logging
          if (process.env.WHATSAPP_ACCESS_TOKEN) {
            const received_id = value?.metadata?.phone_number_id;
            const sending_from_id = process.env.PHONE_NUMBER_ID || received_id;

            if (sending_from_id) {
              try {
                console.log(`[WhatsApp API Trace] Using ID: ${sending_from_id}, TokenExists: ${!!process.env.WHATSAPP_ACCESS_TOKEN}`);
                const waResponse = await fetch(`https://graph.facebook.com/v18.0/${sending_from_id}/messages`, {
                  method: "POST",
                  headers: {
                    "Authorization": `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
                    "Content-Type": "application/json"
                  },
                  body: JSON.stringify({
                    messaging_product: "whatsapp",
                    to: from,
                    type: "text",
                    text: { body: finalResponse }
                  }),
                });
                const waResult: any = await waResponse.json();
                console.log(`[WhatsApp API Response] Status: ${waResponse.status}, Body: ${JSON.stringify(waResult)}`);
              } catch (err) {
                console.error("[WhatsApp API Network Error]", err);
              }
            } else {
              console.error("[WhatsApp Config Error] No PHONE_NUMBER_ID available (metadata or env).");
            }
          } else {
            console.error("[WhatsApp Config Error] WHATSAPP_ACCESS_TOKEN is missing.");
          }
        }
      }
    }
  }
  res.status(200).send('OK');
});

export default app;
