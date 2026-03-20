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
  res.json({ status: "ok", version: "1.9.0 - Phase 1 Financial Assistant", timestamp: new Date().toISOString() });
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
          const normalizedFrom = normalizePhone(from);
          const rawText = (message.text?.body || "").trim();
          
          console.log(`[Phase 1] From: ${from}, Text: "${rawText}"`);

          // --- USER IDENTIFICATION ---
          const lastDigits = normalizedFrom.slice(-8); 
          const { data: profile } = await supabase.from("profiles").select("id, full_name")
            .ilike("whatsapp_number", `%${lastDigits}`).limit(1).single();

          if (!profile) {
            await sendWA(from, "Não encontrei seu cadastro. Por favor, registre seu número no site ZLAI.");
            continue;
          }

          let finalResponse = "Pode me explicar melhor? Ex: 'gastei 30 no mercado'";
          let detectedIntent = "unknown";
          let parserUsed = "none";
          let extractedData: any = {};

          const lowText = rawText.toLowerCase();
          const isFixed = lowText.includes("fixo");
          const cleanText = rawText.replace(/fixo|variável|variavel/gi, "").trim();

          // DETERMINISTIC REGEX
          const expenseRegex = /^(?:gastei|paguei)\s+(\d+(?:[.,]\d+)?)(?:\s+reais)?\s+(?:no|na|em|de)\s+(.*)/i;
          const incomeRegex = /^recebi\s+(\d+(?:[.,]\d+)?)(?:\s+reais)?\s+(?:do|da|de|dos|das)\s+(.*)/i;
          const summaryRegex = /^quanto\s+(gastei|recebi)\s+(?:de\s+(fixo|variável)\s+)?(hoje|essa\s+semana|esta\s+semana|este\s+mês|esse\s+mês)[\s?]*$/i;

          const expenseMatch = cleanText.match(expenseRegex);
          const incomeMatch = cleanText.match(incomeRegex);
          const summaryMatch = cleanText.match(summaryRegex);

          if (expenseMatch) {
            parserUsed = "regex";
            detectedIntent = "create_expense";
            const amount = parseFloat(expenseMatch[1].replace(',', '.'));
            const category = expenseMatch[2].trim();
            const { error } = await supabase.from("transactions").insert({
              user_id: profile.id, type: 'expense', amount, category, 
              description: `WhatsApp: ${cleanText}`, is_fixed: isFixed, source: 'whatsapp'
            });
            if (!error) finalResponse = `Registrei um gasto ${isFixed ? 'fixo ' : ''}de R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em ${category}. ✅`;
            else finalResponse = "Erro ao registrar. Tente novamente.";
          } else if (incomeMatch) {
            parserUsed = "regex";
            detectedIntent = "create_income";
            const amount = parseFloat(incomeMatch[1].replace(',', '.'));
            const sourceName = incomeMatch[2].trim();
            const { error } = await supabase.from("transactions").insert({
              user_id: profile.id, type: 'income', amount, category: sourceName, 
              description: `WhatsApp: ${cleanText}`, is_fixed: isFixed, source: 'whatsapp'
            });
            if (!error) finalResponse = `Registrei uma entrada ${isFixed ? 'fixo ' : ''}de R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} de ${sourceName}. ✅`;
            else finalResponse = "Erro ao registrar. Tente novamente.";
          } else if (summaryMatch) {
            parserUsed = "regex";
            detectedIntent = "query_summary";
            const type = summaryMatch[1].toLowerCase() === "gastei" ? "expense" : "income";
            const filter = summaryMatch[2]?.toLowerCase();
            const period = summaryMatch[3].toLowerCase();
            
            const startDate = getDateRange(period);
            let query = supabase.from("transactions").select("amount")
              .eq("user_id", profile.id).eq("type", type).eq("is_deleted", false).gte("occurred_at", startDate);
            
            if (filter === "fixo") query = query.eq("is_fixed", true);
            else if (filter === "variável") query = query.eq("is_fixed", false);

            const { data: results, error } = await query;
            if (!error) {
              const count = results.length;
              const total = results.reduce((sum, item) => sum + Number(item.amount), 0);
              const totalFmt = total.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
              const periodText = period.includes("mês") ? "neste mês" : period.includes("semana") ? "nesta semana" : "hoje";
              const filterText = filter ? ` em despesas ${filter}s` : "";
              
              if (count === 0) finalResponse = `Você ainda não tem ${type === 'expense' ? 'gastos' : 'receitas'}${filterText} registrados ${periodText}.`;
              else if (period === "hoje") finalResponse = `Hoje você ${type === 'expense' ? 'gastou' : 'recebeu'} R$ ${totalFmt} em ${count} lançamentos.`;
              else finalResponse = `${periodText.charAt(0).toUpperCase() + periodText.slice(1)} você ${type === 'expense' ? 'gastou' : 'recebeu'} R$ ${totalFmt}${filterText}.`;
            } else finalResponse = "Erro ao consultar seus dados.";
          } else {
            // IA FALLBACK
            parserUsed = "ai_fallback";
            try {
              const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
              const prompt = `Classify this financial input as JSON. 
Intents: create_expense, create_income, unknown.
Extract amount (numeric), category (string), and is_fixed (boolean).
User: "${rawText}"
Format: {"intent": "...", "amount": ..., "category": "...", "is_fixed": ...}`;
              const resIA = await model.generateContent(prompt);
              const rawIA = resIA.response.text().replace(/```json|```/gi, "").trim();
              const start = rawIA.indexOf("{");
              const end = rawIA.lastIndexOf("}");
              if (start !== -1 && end !== -1) {
                const aiJson = JSON.parse(rawIA.substring(start, end + 1));
                detectedIntent = aiJson.intent;
                if ((detectedIntent === "create_expense" || detectedIntent === "create_income") && aiJson.amount) {
                  finalResponse = `Entendi um(a) ${detectedIntent === "create_expense" ? 'gasto' : 'entrada'} ${aiJson.is_fixed ? 'fixo(a) ' : ''}de R$ ${aiJson.amount} em ${aiJson.category}. Posso registrar?`;
                  extractedData = aiJson;
                }
              }
            } catch (e) { console.error("[AI Error]", e); }
          }

          // Save processing state to DB
          const isPending = finalResponse.includes("Posso registrar?");
          await supabase.from("whatsapp_messages").insert({
            whatsapp_id: message.id, sender_number: from, message_text: rawText,
            status: isPending ? "pending_confirmation" : "processed",
            interpretation: { intent: detectedIntent, parserUsed, ...extractedData }, 
            raw_data: body, user_id: profile.id
          });

          await sendWA(from, finalResponse);
        }
      }
    }
  }
  res.status(200).send('OK');
});

// Helper for sending WhatsApp messages with verbose logging
async function sendWA(to: string, text: string) {
  const sending_from_id = process.env.PHONE_NUMBER_ID;
  if (!sending_from_id || !process.env.WHATSAPP_ACCESS_TOKEN) {
    console.error("[WhatsApp Config Error] Missing ID or Token");
    return;
  }
  try {
    const waResponse = await fetch(`https://graph.facebook.com/v18.0/${sending_from_id}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text }
      }),
    });
    const waResult: any = await waResponse.json();
    console.log(`[WhatsApp API Response] Status: ${waResponse.status}, Body: ${JSON.stringify(waResult)}`);
    return waResult;
  } catch (err) {
    console.error("[WhatsApp Send Error]", err);
  }
}

export default app;
