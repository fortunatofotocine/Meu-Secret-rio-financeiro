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
  res.json({ status: "ok", version: "1.2.0 - Structured Intelligence", timestamp: new Date().toISOString() });
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
  console.log("--- WhatsApp Webhook Received ---");
  
  if (body.object === 'whatsapp_business_account') {
    const value = body.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];

    if (message && message.type === 'text') {
      const from = message.from;
      const msgBody = (message.text?.body || "").trim();
      const phone_number_id = value?.metadata?.phone_number_id;

      console.log(`[Input] From: ${from}, Text: "${msgBody}"`);

      let finalResponse = "Pode me explicar melhor? Ex: 'gastei 30 no mercado'";
      let detectedIntent = "unknown";
      let extractedData = {};

      // 1. Greeting Pre-processor
      const greetings = /^(oi|olá|ola|bom dia|boa tarde|boa noite)$/i;
      if (greetings.test(msgBody)) {
        detectedIntent = "greeting";
        finalResponse = "Olá! Posso te ajudar a registrar gastos, consultar seus gastos ou organizar compromissos.";
      } else {
        // 2. AI Intelligence Layer (Classification)
        try {
          const model = genAI.getGenerativeModel({ 
            model: "gemini-2.0-flash-lite",
            generationConfig: { responseMimeType: "application/json" }
          });
          
          const prompt = `Analyze user input for a financial assistant. Return JSON only.
          Intents: "create_expense", "query_summary", "create_event", "unknown".
          Include fields: amount (number), category (string), description (string), date (string).
          Input: "${msgBody}"`;

          const result = await model.generateContent(prompt);
          const aiJson = JSON.parse(result.response.text());
          detectedIntent = aiJson.intent;
          extractedData = aiJson;

          // 3. Response Orchestrator (Deterministic)
          if (detectedIntent === "create_expense" && aiJson.amount) {
            finalResponse = `Entendi um gasto de R$ ${aiJson.amount}${aiJson.category ? ` no ${aiJson.category}` : ""}. Posso registrar assim?`;
          } else if (detectedIntent === "query_summary") {
            finalResponse = `Entendi que você quer consultar seus gastos${aiJson.date ? ` de ${aiJson.date}` : " de hoje"}.`;
          } else if (detectedIntent === "create_event" && aiJson.description) {
            finalResponse = `Entendi um compromisso: ${aiJson.description}${aiJson.date ? ` ${aiJson.date}` : ""}.`;
          } else if (detectedIntent === "greeting") {
            finalResponse = "Olá! Posso te ajudar a registrar gastos, consultar seus gastos ou organizar compromissos.";
          }
        } catch (e) {
          console.error("[AI Classification Error]", e);
        }
      }

      console.log(`[Output] Intent: ${detectedIntent}, Data: ${JSON.stringify(extractedData)}, Final: "${finalResponse}"`);

      // 4. Send Response
      if (phone_number_id && process.env.WHATSAPP_ACCESS_TOKEN) {
        await fetch(`https://graph.facebook.com/v18.0/${phone_number_id}/messages`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: from,
            type: "text",
            text: { body: finalResponse },
          }),
        });
      }
    }
  }
  res.status(200).send('OK');
});

export default app;
