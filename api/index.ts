import express from "express";
import * as dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
app.use(express.json());

// Supabase Client
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl || "https://placeholder.supabase.co", supabaseKey || "placeholder");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Diagnostic Log for Routing
app.use((req, res, next) => {
  console.log(`[API Debug] ${req.method} ${req.url}`);
  next();
});

app.get(["/api/health", "/health", "/api"], (req, res) => {
  res.json({ status: "ok", version: "1.1.5 - Absolute Clean", timestamp: new Date().toISOString() });
});

app.get(["/api/whatsapp/webhook", "/whatsapp/webhook"], (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === "zlai_webhook_token") return res.status(200).send(challenge);
  return res.sendStatus(403);
});

app.post(["/api/whatsapp/webhook", "/whatsapp/webhook"], async (req, res) => {
  const body = req.body;
  console.log("--- WhatsApp POST Received ---");
  console.log("Body:", JSON.stringify(body, null, 2));

  if (body.object === 'whatsapp_business_account') {
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (message && message.type === 'text') {
      const from = message.from;
      const msgBody = message.text?.body;
      const phone_number_id = value?.metadata?.phone_number_id;

      let aiResponse = "Não consegui entender sua mensagem. Pode tentar novamente?";
      try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
        const result = await model.generateContent(`Usuário: "${msgBody}". Responda de forma curta e amigável.`);
        aiResponse = result.response.text();
      } catch (e) {
        console.error("[AI] Error:", e);
      }

      if (phone_number_id && process.env.WHATSAPP_ACCESS_TOKEN) {
        const resp = await fetch(`https://graph.facebook.com/v18.0/${phone_number_id}/messages`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: from,
            type: "text",
            text: { body: aiResponse },
          }),
        });
        const result = await resp.json();
        console.log("[WhatsApp API Response]", JSON.stringify(result));
        
        await supabase.from("system_logs").insert([{
          event_type: "whatsapp_message_processed",
          payload: { from, text: msgBody, reply: aiResponse, whatsapp_result: result }
        }]);
      }
    }
  }
  res.status(200).send('OK');
});

export default app;
