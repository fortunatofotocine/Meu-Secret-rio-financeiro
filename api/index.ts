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
  res.json({ status: "ok", version: "1.5.1 - Execution Flow", timestamp: new Date().toISOString() });
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
      let parserUsed = "none";

      // 1. DETERMINISTIC PARSERS (STRICT REGEX)
      const expenseRegex = /^(?:gastei|paguei)\s+(\d+(?:[.,]\d+)?)(?:\s+reais)?\s+(?:no|na|em|de)\s+(.*)/i;
      const incomeRegex = /^recebi\s+(\d+(?:[.,]\d+)?)(?:\s+reais)?\s+(?:do|da|de|dos|das)\s+(.*)/i;
      const greetingRegex = /^(oi|olá|ola|bom dia|boa tarde|boa noite|opa|hey)$/i;
      const affirmationRegex = /^(sim|s|ok|pode|confirmar|confirmado|vambora|bora)$/i;

      const expenseMatch = msgBody.match(expenseRegex);
      const incomeMatch = msgBody.match(incomeRegex);

      // --- USER IDENTIFICATION ---
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("whatsapp_number", from)
        .single();

      if (expenseMatch) {
        parserUsed = "regex_expense";
        detectedIntent = "create_expense";
        const amount = parseFloat(expenseMatch[1].replace(',', '.'));
        const category = expenseMatch[2].trim();
        
        if (!profile) {
          finalResponse = "Não encontrei seu cadastro. Por favor, registre seu número no site ZLAI.";
        } else {
          // SAVE TO DATABASE IMMEDIATELY
          const { error: insError } = await supabase.from("transactions").insert({
            user_id: profile.id,
            amount: amount,
            category: category,
            description: `WhatsApp: ${msgBody}`,
            type: 'expense',
            occurred_at: new Date().toISOString(),
            source: 'whatsapp'
          });
          
          if (!insError) {
            finalResponse = `Registrei um gasto de R$ ${amount} em ${category}. ✅`;
            extractedData = { intent: "create_expense", amount, category, status: "saved" };
          } else {
            console.error("[Insert Error]", insError);
            finalResponse = "Houve um erro ao salvar seu gasto. Tente novamente em instantes.";
          }
        }
      } else if (incomeMatch) {
        parserUsed = "regex_income";
        detectedIntent = "create_income";
        const amount = parseFloat(incomeMatch[1].replace(',', '.'));
        const source = incomeMatch[2].trim();

        if (!profile) {
          finalResponse = "Não encontrei seu cadastro. Por favor, registre seu número no site ZLAI.";
        } else {
          // SAVE TO DATABASE IMMEDIATELY
          const { error: insError } = await supabase.from("transactions").insert({
            user_id: profile.id,
            amount: amount,
            category: source,
            description: `WhatsApp: ${msgBody}`,
            type: 'income',
            occurred_at: new Date().toISOString(),
            source: 'whatsapp'
          });

          if (!insError) {
            finalResponse = `Registrei uma entrada de R$ ${amount} de ${source}. ✅`;
            extractedData = { intent: "create_income", amount, source, status: "saved" };
          } else {
            console.error("[Insert Error]", insError);
            finalResponse = "Houve um erro ao salvar sua entrada. Tente novamente em instantes.";
          }
        }
      } else if (greetingRegex.test(msgBody)) {
        parserUsed = "regex_greeting";
        detectedIntent = "greeting";
        finalResponse = "Olá! Posso te ajudar a registrar gastos, consultar seus gastos ou organizar compromissos.";
      } else if (affirmationRegex.test(msgBody)) {
        parserUsed = "regex_affirmation";
        // LOOKUP PREVIOUS STATE (for AI confirming flow)
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
          // IN THIS PHASE, WE ONLY CONFIRM VERBALLY FOR AI FALLBACK
          finalResponse = `Feito! Ação "${interp.intent}" confirmada com sucesso. ✅`;
          await supabase.from("whatsapp_messages").update({ status: "processed" }).eq("sender_number", from).eq("status", "pending_confirmation");
        } else {
          finalResponse = "Não encontrei nenhuma ação pendente. O que deseja fazer?";
        }
      } else {
        // 2. AI FALLBACK (CONFIRMATION ONLY)
        parserUsed = "ai_fallback";
        try {
          const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
          const prompt = `Classify this financial input as JSON. Intents: create_expense, create_income, query_summary, unknown. User: "${msgBody}"`;
          const result = await model.generateContent(prompt);
          const raw = result.response.text().replace(/```json|```/gi, "").trim();
          const start = raw.indexOf("{");
          const end = raw.lastIndexOf("}");
          if (start !== -1 && end !== -1) {
            const aiJson = JSON.parse(raw.substring(start, end + 1));
            detectedIntent = aiJson.intent;
            extractedData = aiJson;

            if (detectedIntent === "create_expense" && aiJson.amount) {
              finalResponse = `Entendi um gasto de R$ ${aiJson.amount}${aiJson.category ? ` em ${aiJson.category}` : ""}. Posso registrar assim?`;
            } else if (detectedIntent === "create_income" && aiJson.amount) {
              finalResponse = `Entendi uma entrada de R$ ${aiJson.amount}. Posso registrar assim?`;
            }
          }
        } catch (e) {
          console.error("[AI Logic Error]", e);
        }
      }

      console.log(`[Execution Log] Parser: ${parserUsed}, Intent: ${detectedIntent}, Payload: ${JSON.stringify(extractedData)}, Status: ${finalResponse.includes('✅') ? 'Success' : 'Pending/Fail'}`);

      // SAVE WEBHOOK TO LOG TABLE
      const isPending = finalResponse.includes("Posso registrar");
      await supabase.from("whatsapp_messages").insert({
        whatsapp_id: message.id,
        sender_number: from,
        message_text: msgBody,
        status: isPending ? "pending_confirmation" : "processed",
        interpretation: { ...extractedData, parserUsed, detectedIntent },
        raw_data: body
      });

      // SEND RESPONSE
      if (phone_number_id && process.env.WHATSAPP_ACCESS_TOKEN) {
        await fetch(`https://graph.facebook.com/v18.0/${phone_number_id}/messages`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify({ messaging_product: "whatsapp", to: from, type: "text", text: { body: finalResponse } }),
        });
      }
    }
  }
  res.status(200).send('OK');
});

export default app;
