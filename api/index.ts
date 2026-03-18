import express from "express";
import * as dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
app.use(express.json());

// Supabase Client - USE SERVICE ROLE FOR BACKEND OPERATIONS (Bypasses RLS Safely)
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl || "https://placeholder.supabase.co", supabaseKey || "placeholder");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Diagnostic Log for Routing
app.use((req, res, next) => {
  console.log(`[API Debug] ${req.method} ${req.url}`);
  next();
});

app.get(["/api/health", "/health", "/api"], (req, res) => {
  res.json({ status: "ok", version: "1.6.1 - Timezone Fixed", timestamp: new Date().toISOString() });
});

app.get(["/api/whatsapp/webhook", "/whatsapp/webhook"], (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === "zlai_webhook_token") return res.status(200).send(challenge);
  return res.sendStatus(403);
});

// Helper for phone normalization
function normalizePhone(phone: string) {
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("55") && cleaned.length > 10) {
    cleaned = cleaned.substring(2);
  }
  return cleaned;
}

// Helper for date ranges (UTC-3 / Brazilian standard)
function getDateRange(period: string) {
  // Use Brazilian Time (UTC-3)
  const now = new Date();
  
  // Create a date object adjusted to Brazil for range calculation
  // Offset is -3 hours
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
  
  // Convert back to UTC ISO for Supabase comparison
  const resultDate = new Date(start.getTime() - brOffset);
  return resultDate.toISOString();
}

app.post(["/api/whatsapp/webhook", "/whatsapp/webhook"], async (req, res) => {
  const body = req.body;
  console.log("--- WhatsApp Webhook Received ---");
  
  if (body.object === 'whatsapp_business_account') {
    const value = body.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];

    if (message && message.type === 'text') {
      const from = message.from;
      const normalizedFrom = normalizePhone(from);
      const msgBody = (message.text?.body || "").trim();
      const phone_number_id = value?.metadata?.phone_number_id;

      console.log(`[Input] From: ${from} (Norm: ${normalizedFrom}), Text: "${msgBody}"`);

      let finalResponse = "Pode me explicar melhor? Ex: 'gastei 30 no mercado'";
      let detectedIntent = "unknown";
      let extractedData: any = {};
      let parserUsed = "none";

      const expenseRegex = /^(?:gastei|paguei)\s+(\d+(?:[.,]\d+)?)(?:\s+reais)?\s+(?:no|na|em|de)\s+(.*)/i;
      const incomeRegex = /^recebi\s+(\d+(?:[.,]\d+)?)(?:\s+reais)?\s+(?:do|da|de|dos|das)\s+(.*)/i;
      const queryRegex = /^quanto\s+(gastei|recebi)\s+(hoje|essa semana|esta semana|este mês|esse mês)$/i;
      const greetingRegex = /^(oi|olá|ola|bom dia|boa tarde|boa noite|opa|hey)$/i;
      const affirmationRegex = /^(sim|s|ok|pode|confirmar|confirmado|vambora|bora)$/i;

      const expenseMatch = msgBody.match(expenseRegex);
      const incomeMatch = msgBody.match(incomeRegex);
      const queryMatch = msgBody.match(queryRegex);

      // IDENTIFICATION
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .or(`whatsapp_number.eq.${normalizedFrom},whatsapp_number.eq.55${normalizedFrom}`)
        .limit(1)
        .single();

      if (queryMatch) {
        parserUsed = "regex_query";
        detectedIntent = "query_summary";
        const type = queryMatch[1].toLowerCase() === "gastei" ? "expense" : "income";
        const periodLabel = queryMatch[2].toLowerCase();
        const startDate = getDateRange(periodLabel);

        if (!profile) {
          finalResponse = "Não encontrei seu cadastro. Por favor, registre seu número no site ZLAI.";
        } else {
          // AGGREGATION
          const { data: results, error: queryError } = await supabase
            .from("transactions")
            .select("amount")
            .eq("user_id", profile.id)
            .eq("type", type)
            .gte("occurred_at", startDate);

          if (!queryError) {
            const count = results.length;
            const total = results.reduce((sum, item) => sum + Number(item.amount), 0);
            const periodText = periodLabel.includes("mês") ? "neste mês" : periodLabel.includes("semana") ? "nesta semana" : "hoje";

            if (count === 0) {
              finalResponse = `Você ainda não tem ${type === 'expense' ? 'gastos registrados' : 'receitas registradas'} ${periodText}.`;
            } else {
              const totalFmt = total.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
              if (periodLabel === "hoje") {
                finalResponse = `Hoje você ${type === 'expense' ? 'gastou' : 'recebeu'} R$ ${totalFmt} em ${count} ${count === 1 ? 'lançamento' : 'lançamentos'}.`;
              } else {
                finalResponse = `${periodText.charAt(0).toUpperCase() + periodText.slice(1)} você ${type === 'expense' ? 'gastou' : 'recebeu'} R$ ${totalFmt}.`;
              }
            }
            extractedData = { intent: "query_summary", type, period: periodLabel, total, count, startDate };
          } else {
            console.error("[Query Error]", queryError);
            finalResponse = "Houve um erro ao consultar seus dados.";
          }
        }
      } else if (expenseMatch) {
        parserUsed = "regex_expense";
        detectedIntent = "create_expense";
        const amount = parseFloat(expenseMatch[1].replace(',', '.'));
        const category = expenseMatch[2].trim();
        if (profile) {
          const { error: insError } = await supabase.from("transactions").insert({
            user_id: profile.id, amount, category, description: `WhatsApp: ${msgBody}`, type: 'expense',
            date: new Date().toISOString(), occurred_at: new Date().toISOString(), source: 'whatsapp'
          });
          if (!insError) {
            finalResponse = `Registrei um gasto de R$ ${amount} em ${category}. ✅`;
            extractedData = { intent: "create_expense", amount, category, status: "saved" };
          }
        } else {
          finalResponse = "Não encontrei seu cadastro.";
        }
      } else if (incomeMatch) {
        parserUsed = "regex_income";
        detectedIntent = "create_income";
        const amount = parseFloat(incomeMatch[1].replace(',', '.'));
        const sourceName = incomeMatch[2].trim();
        if (profile) {
          const { error: insError } = await supabase.from("transactions").insert({
            user_id: profile.id, amount, category: sourceName, description: `WhatsApp: ${msgBody}`, type: 'income',
            date: new Date().toISOString(), occurred_at: new Date().toISOString(), source: 'whatsapp'
          });
          if (!insError) {
            finalResponse = `Registrei uma entrada de R$ ${amount} de ${sourceName}. ✅`;
            extractedData = { intent: "create_income", amount, source: sourceName, status: "saved" };
          }
        } else {
          finalResponse = "Não encontrei seu cadastro.";
        }
      } else if (greetingRegex.test(msgBody)) {
        parserUsed = "regex_greeting";
        detectedIntent = "greeting";
        finalResponse = "Olá! Posso te ajudar a registrar gastos, consultar seus gastos ou organizar compromissos.";
      } else if (affirmationRegex.test(msgBody)) {
        parserUsed = "regex_affirmation";
        const { data: lastMsg } = await supabase.from("whatsapp_messages").select("interpretation")
          .eq("sender_number", from).eq("status", "pending_confirmation").order("created_at", { ascending: false }).limit(1).single();
        if (lastMsg?.interpretation) {
          const interp = lastMsg.interpretation as any;
          detectedIntent = "confirm";
          finalResponse = `Feito! Ação "${interp.intent}" confirmada com sucesso. ✅`;
          await supabase.from("whatsapp_messages").update({ status: "processed" }).eq("sender_number", from).eq("status", "pending_confirmation");
        } else {
          finalResponse = "Não encontrei nenhuma ação pendente.";
        }
      } else {
        parserUsed = "ai_fallback";
        try {
          const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
          const prompt = `Classify this input as JSON. Intents: create_expense, create_income, query_summary, unknown. User: "${msgBody}"`;
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
        } catch (e) { console.error("[AI Error]", e); }
      }

      console.log(`[Summary Log] Parser: ${parserUsed}, Intent: ${detectedIntent}, Payload: ${JSON.stringify(extractedData)}`);

      const isPending = finalResponse.includes("Posso registrar");
      await supabase.from("whatsapp_messages").insert({
        whatsapp_id: message.id, sender_number: from, message_text: msgBody,
        status: isPending ? "pending_confirmation" : "processed",
        interpretation: { ...extractedData, parserUsed, detectedIntent }, raw_data: body
      });

      if (phone_number_id && process.env.WHATSAPP_ACCESS_TOKEN) {
        await fetch(`https://graph.facebook.com/v18.0/${phone_number_id}/messages`, {
          method: "POST", headers: { "Authorization": `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify({ messaging_product: "whatsapp", to: from, type: "text", text: { body: finalResponse } }),
        });
      }
    }
  }
  res.status(200).send('OK');
});

export default app;
