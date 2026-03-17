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

// Gemini AI Setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// --- Diagnostic Middleware ---
app.use((req, res, next) => {
  console.log(`[Request] ${req.method} ${req.url} | Path: ${req.path}`);
  next();
});

// --- API Routes ---

app.get(["/api/health", "/health", "/api"], (req, res) => {
  res.json({ 
    status: "ok", 
    message: "ZLAI API v1.1.0 - Clean & Monolithic", 
    timestamp: new Date().toISOString() 
  });
});

// WhatsApp Webhook Verification (GET)
app.get(["/api/whatsapp/webhook", "/whatsapp/webhook"], (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === "zlai_webhook_token") {
    return res.status(200).send(challenge);
  } else {
    return res.sendStatus(403);
  }
});

// WhatsApp Webhook (POST) - Principal Message Handler
app.post(["/api/whatsapp/webhook", "/whatsapp/webhook"], async (req, res) => {
  const body = req.body;
  
  // 1. Log body as requested
  console.log("--- WhatsApp Webhook POST Received ---");
  console.log("Full Body:", JSON.stringify(body, null, 2));

  if (body.object !== 'whatsapp_business_account') {
    return res.status(200).send('OK');
  }

  try {
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    
    // Ignore status updates
    if (value?.statuses) {
      console.log("[Webhook] Status update received. Ignoring.");
      return res.status(200).send('OK');
    }

    const message = value?.messages?.[0];
    if (!message || message.type !== 'text') {
      console.log("[Webhook] No text message found. Ignoring.");
      return res.status(200).send('OK');
    }

    const from = message.from;
    const msgId = message.id;
    const msgBody = message.text?.body;
    const phone_number_id = value?.metadata?.phone_number_id;

    console.log(`[Extraction] From: ${from} | Text: "${msgBody}" | PhoneID: ${phone_number_id}`);

    // Call Gemini with short/clear instructions
    console.log("[Gemini] Requesting response...");
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
    let aiResponse;
    const currentDateTime = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    try {
      const prompt = `Você é um assistente financeiro curto e claro. O usuário disse: "${msgBody}". Responda de forma curta e amigável. Se não entender, peça para repetir. Agora é ${currentDateTime}.`;
      const result = await model.generateContent(prompt);
      aiResponse = result.response.text();
      console.log("[Gemini] AI Result:", aiResponse);
    } catch (aiErr) {
      console.error("[Gemini] Error:", aiErr);
      aiResponse = "Não consegui entender sua mensagem. Pode tentar novamente?";
    }

    // Reply via WhatsApp Cloud API
    if (phone_number_id && process.env.WHATSAPP_ACCESS_TOKEN) {
        console.log("[WhatsApp] Sending reply...");
        const response = await fetch(`https://graph.facebook.com/v18.0/${phone_number_id}/messages`, {
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
        const whatsappResult = await response.json();
        console.log("[WhatsApp] API Status Code:", response.status);
        console.log("[WhatsApp] API Result:", JSON.stringify(whatsappResult));

        // Log to Supabase for audit
        await supabase.from("system_logs").insert([{
          event_type: "whatsapp_message_processed",
          payload: { from, text: msgBody, reply: aiResponse, whatsapp_api_status: response.status }
        }]);
    } else {
        console.error("[WhatsApp] Missing configuration (Token or PhoneID)");
    }

    res.status(200).send('OK');
  } catch (err: any) {
    console.error("[Webhook] Global Error:", err.message);
    res.status(200).send('OK');
  }
});

// Export for Vercel
export default app;
