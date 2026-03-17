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
  res.json({ status: "ok", version: "1.5.0 - Strict Regex Intelligence", timestamp: new Date().toISOString() });
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
      let extractedData: any = {};

      // 1. Strict Regex Pre-processor (USER REQUESTED EXACT MATCH)
      // gastei\s+(\d+)\s+(no|na)\s+(.*)
      const strictExpenseRegex = /gastei\s+(\d+)\s+(no|na)\s+(.*)/i;
      const strictMatch = msgBody.match(strictExpenseRegex);

      // 2. Greeting Pre-processor
      const greetingRegex = /^(oi|olá|ola|bom dia|boa tarde|boa noite|opa|hey)$/i;
      // 3. Affirmation Pre-processor
      const affirmationRegex = /^(sim|s|ok|pode|confirmar|confirmado|vambora|bora)$/i;

      if (strictMatch) {
        // BYPASS AI IF STRICT REGEX MATCHES
        detectedIntent = "create_expense";
        extractedData = {
          intent: "create_expense",
          amount: parseFloat(strictMatch[1]),
          category: strictMatch[3].trim()
        };
        finalResponse = `Entendi um gasto de R$ ${extractedData.amount} no ${extractedData.category}. Posso registrar assim?`;
        console.log(`[Strict Regex Match] Amount: ${extractedData.amount}, Category: ${extractedData.category}`);
      } else if (greetingRegex.test(msgBody)) {
        detectedIntent = "greeting";
        finalResponse = "Olá! Posso te ajudar a registrar gastos, consultar seus gastos ou organizar compromissos.";
      } else if (affirmationRegex.test(msgBody)) {
        // LOOKUP PREVIOUS STATE
        const { data: lastMsg } = await supabase
          .from("whatsapp_messages")
          .select("interpretation")
          .eq("sender_number", from)
          .eq("status", "pending_confirmation")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (lastMsg?.interpretation) {
          const interp = lastMsg.interpretation as any;
          detectedIntent = "confirm";
          if (interp.intent === "create_expense") {
            finalResponse = `Feito! Gasto de R$ ${interp.amount}${interp.category ? ` no ${interp.category}` : ""} registrado com sucesso. ✅`;
          } else if (interp.intent === "create_event") {
            finalResponse = `Feito! Compromisso "${interp.description || "Agendado"}" registrado com sucesso. ✅`;
          } else {
            finalResponse = "Confirmado! Ação realizada com sucesso. ✅";
          }
          await supabase
            .from("whatsapp_messages")
            .update({ status: "processed" })
            .eq("sender_number", from)
            .eq("status", "pending_confirmation");
        } else {
          finalResponse = "Não encontrei nenhuma ação pendente para confirmar. Como posso te ajudar?";
        }
      } else {
        // AI Fallback
        try {
          const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
          const prompt = `Classify this financial input and return ONLY JSON. Intents: create_expense, query_summary, create_event, greeting, unknown. Input: "${msgBody}"`;
          const result = await model.generateContent(prompt);
          const raw = result.response.text().replace(/```json|```/gi, "").trim();
          const start = raw.indexOf("{");
          const end = raw.lastIndexOf("}");
          if (start !== -1 && end !== -1) {
            const aiJson = JSON.parse(raw.substring(start, end + 1));
            detectedIntent = aiJson.intent;
            extractedData = aiJson;

            if (detectedIntent === "create_expense" && aiJson.amount) {
              finalResponse = `Entendi um gasto de R$ ${aiJson.amount}${aiJson.category ? ` no ${aiJson.category}` : ""}. Posso registrar assim?`;
            } else if (detectedIntent === "query_summary") {
              finalResponse = `Entendi que você quer consultar seus gastos${aiJson.date ? ` de ${aiJson.date}` : " de hoje"}.`;
            } else if (detectedIntent === "create_event") {
              finalResponse = `Entendi um compromisso: ${aiJson.description || msgBody}. Posso agendar?`;
            }
          }
        } catch (e) {
          console.error("[AI Error]", e);
        }
      }

      console.log(`[Output] Intent: ${detectedIntent}, Data: ${JSON.stringify(extractedData)}, Final: "${finalResponse}"`);

      // SAVE STATE IF PENDING
      const isPending = finalResponse.includes("Posso registrar") || finalResponse.includes("Posso agendar");
      await supabase.from("whatsapp_messages").insert({
        whatsapp_id: message.id,
        sender_number: from,
        message_text: msgBody,
        status: isPending ? "pending_confirmation" : "processed",
        interpretation: extractedData || { intent: detectedIntent },
        raw_data: body
      });

      // SEND WHATSAPP
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
