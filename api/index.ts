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
  
  // RAW DEBUG LOG: Record every hit to the endpoint in the DB
  try {
    const rawSender = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from || "system_debug";
    await supabase.from("whatsapp_messages").insert({
      whatsapp_id: `raw_${Date.now()}`,
      sender_number: rawSender,
      message_text: `RAW_DEBUG: ${JSON.stringify(body).substring(0, 100)}...`,
      status: "received",
      raw_data: body
    });
  } catch (e) {
    console.error("[Raw Log Error]", e);
  }

  if (body.object === 'whatsapp_business_account') {
    const value = body.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];

    if (message && message.type === 'text') {
      const from = message.from;
      const normalizedFrom = normalizePhone(from);
      const rawText = (message.text?.body || "").trim();
      const phone_number_id = value?.metadata?.phone_number_id;

      const greetingStripper = /^(?:oi|olá|ola|bom dia|boa tarde|boa noite|opa|hey)[\s!,./-]*/i;
      const msgBody = rawText.replace(greetingStripper, "").trim() || rawText;

      console.log(`[Input] From: ${from}, Text: "${rawText}" (Actionable: "${msgBody}")`);

      let finalResponse = "Pode me explicar melhor? Ex: 'gastei 30 no mercado'";
      let detectedIntent = "unknown";
      let extractedData: any = {};
      let parserUsed = "none";

      // DETERMINISTIC REGEX
      const expenseRegex = /^(?:gastei|paguei)\s+(\d+(?:[.,]\d+)?)(?:\s+reais)?\s+(?:no|na|em|de)\s+(.*)/i;
      const incomeRegex = /^recebi\s+(\d+(?:[.,]\d+)?)(?:\s+reais)?\s+(?:do|da|de|dos|das)\s+(.*)/i;
      const queryRegex = /^quanto\s+(gastei|recebi)\s+(hoje|essa\s+semana|esta\s+semana|este\s+mês|esse\s+mês)[\s?]*$/i;
      const correctRegex = /^(?:corrige|corriga|corrigir)\s+(?:o\s+)?[uú]ltimo\s+(?:gasto|lançamento)?\s+(?:para\s+)?(\d+(?:[.,]\d+)?)(?:\s+reais)?[\s?]*$/i;
      const altCorrectRegex = /^(?:errei|o)\s+(?:no\s+)?[uú]ltimo\s+(?:gasto|lançamento)?\s+(?:era|foi)\s+(\d+(?:[.,]\d+)?)(?:\s+reais)?.*$/i;
      const deleteRegex = /^(?:apaga|exclui|deleta|remover)\s+(?:o\s+)?[uú]ltimo\s+(?:gasto|lançamento)?$|^(?:apaga|exclui|deleta|remover)\s+[uú]ltimo$/i;
      const greetingRegex = /^(oi|olá|ola|bom dia|boa tarde|boa noite|opa|hey)[\s!]*$/i;
      const affirmationRegex = /^(sim|s|ok|pode|confirmar|confirmado|vambora|bora)[\s!.]*$/i;

      // Helpers
      const performQueryAggregation = async (userId: string, type: string, periodLabel: string) => {
        const startDate = getDateRange(periodLabel);
        const { data: results, error } = await supabase.from("transactions").select("amount")
          .eq("user_id", userId).eq("type", type).eq("is_deleted", false).gte("occurred_at", startDate);
        if (error) return { message: "Erro ao consultar dados.", count: 0, total: 0, startDate };
        const count = results.length;
        const total = results.reduce((sum, item) => sum + Number(item.amount), 0);
        const totalFmt = total.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        const periodText = periodLabel.includes("mês") ? "neste mês" : periodLabel.includes("semana") ? "nesta semana" : "hoje";
        if (count === 0) return { message: `Você ainda não tem ${type === 'expense' ? 'gastos' : 'receitas'} registrados ${periodText}.`, count: 0, total: 0, startDate };
        const msg = periodLabel === "hoje" ? `Hoje você ${type === 'expense' ? 'gastou' : 'recebeu'} R$ ${totalFmt} em ${count} lançamentos.` : `${periodText.charAt(0).toUpperCase() + periodText.slice(1)} você ${type === 'expense' ? 'gastou' : 'recebeu'} R$ ${totalFmt}.`;
        return { message: msg, count, total, startDate };
      };

      const getLastTransaction = async (userId: string) => {
        const { data, error } = await supabase.from("transactions").select("*")
          .eq("user_id", userId).eq("is_deleted", false).order("created_at", { ascending: false }).limit(1).single();
        return { data, error };
      };

      // --- USER IDENTIFICATION ---
      // Robust identification: match by the last 8-10 digits to ignore 55 and '9' prefix variations
      const lastDigits = normalizedFrom.slice(-8); 
      const { data: profile } = await supabase.from("profiles").select("id")
        .ilike("whatsapp_number", `%${lastDigits}`).limit(1).single();

      // --- ISOLATION MODE (v1.8.4) ---
      // Distable all IA and logic for debugging
      finalResponse = "Teste ZLAI funcionando";
      detectedIntent = "test_isolation";
      parserUsed = "debug_isolation";
      
      /*
      const queryMatch = msgBody.match(queryRegex);

      if (queryMatch) {
        parserUsed = "regex_query";
        detectedIntent = "query_summary";
        const type = queryMatch[1].toLowerCase() === "gastei" ? "expense" : "income";
        if (profile) {
          const result = await performQueryAggregation(profile.id, type, queryMatch[2].toLowerCase());
          finalResponse = result.message;
          extractedData = { intent: "query_summary", type, period: queryMatch[2], ...result };
        } else finalResponse = "Não encontrei seu cadastro.";
      } else if (correctMatch) {
        parserUsed = "regex_correct";
        detectedIntent = "correct_last";
        const newAmount = parseFloat(correctMatch[1].replace(',', '.'));
        if (profile) {
          const { data: lastTx } = await getLastTransaction(profile.id);
          if (lastTx) {
            const { error: updErr } = await supabase.from("transactions").update({ amount: newAmount }).eq("id", lastTx.id);
            if (!updErr) {
              finalResponse = `Corrigi o último lançamento para R$ ${newAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. ✅`;
              extractedData = { intent: "correct_last", oldAmount: lastTx.amount, newAmount, transactionId: lastTx.id };
            } else finalResponse = "Erro ao corrigir. Tente novamente.";
          } else finalResponse = "Não encontrei lançamentos para corrigir.";
        } else finalResponse = "Não encontrei seu cadastro.";
      } else if (deleteMatch) {
        parserUsed = "regex_delete";
        detectedIntent = "delete_last";
        if (profile) {
          const { data: lastTx } = await getLastTransaction(profile.id);
          if (lastTx) {
            const { error: delErr } = await supabase.from("transactions").update({ is_deleted: true }).eq("id", lastTx.id);
            if (!delErr) {
              finalResponse = "Apaguei o último lançamento. ✅";
              extractedData = { intent: "delete_last", transactionId: lastTx.id, description: lastTx.description };
            } else finalResponse = "Erro ao apagar. Tente novamente.";
          } else finalResponse = "Não encontrei lançamentos para apagar.";
        } else finalResponse = "Não encontrei seu cadastro.";
      } else if (expenseMatch) {
        parserUsed = "regex_expense";
        detectedIntent = "create_expense";
        const amount = parseFloat(expenseMatch[1].replace(',', '.'));
        if (profile) {
          const { error: insError } = await supabase.from("transactions").insert({
            user_id: profile.id, amount, category: expenseMatch[2].trim(), description: `WhatsApp: ${msgBody}`, type: 'expense',
            date: new Date().toISOString(), occurred_at: new Date().toISOString(), source: 'whatsapp', is_deleted: false
          });
          if (!insError) {
            finalResponse = `Registrei um gasto de R$ ${amount} em ${expenseMatch[2].trim()}. ✅`;
            extractedData = { intent: "create_expense", amount, category: expenseMatch[2].trim(), status: "saved" };
          }
        } else finalResponse = "Não encontrei seu cadastro.";
      } else if (incomeMatch) {
        parserUsed = "regex_income";
        detectedIntent = "create_income";
        const amount = parseFloat(incomeMatch[1].replace(',', '.'));
        if (profile) {
          const { error: insError } = await supabase.from("transactions").insert({
            user_id: profile.id, amount, category: incomeMatch[2].trim(), description: `WhatsApp: ${msgBody}`, type: 'income',
            date: new Date().toISOString(), occurred_at: new Date().toISOString(), source: 'whatsapp', is_deleted: false
          });
          if (!insError) {
            finalResponse = `Registrei uma entrada de R$ ${amount} de ${incomeMatch[2].trim()}. ✅`;
            extractedData = { intent: "create_income", amount, source: incomeMatch[2].trim(), status: "saved" };
          }
        } else finalResponse = "Não encontrei seu cadastro.";
      } else if (greetingRegex.test(msgBody)) {
        parserUsed = "regex_greeting";
        detectedIntent = "greeting";
        finalResponse = "Olá! Posso te ajudar a registrar gastos, consultar seus gastos ou organizar compromissos.";
      } else if (affirmationRegex.test(rawText)) {
        parserUsed = "regex_affirmation";
        const { data: lastMsg } = await supabase.from("whatsapp_messages").select("interpretation")
          .eq("sender_number", from).eq("status", "pending_confirmation").order("created_at", { ascending: false }).limit(1).single();
        if (lastMsg?.interpretation) {
          const interp = lastMsg.interpretation as any;
          if (interp.intent === "correct_last" && interp.newAmount && interp.transactionId) {
            await supabase.from("transactions").update({ amount: interp.newAmount }).eq("id", interp.transactionId);
            finalResponse = `Corrigi o último lançamento para R$ ${interp.newAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. ✅`;
          } else if (interp.intent === "delete_last" && interp.transactionId) {
            await supabase.from("transactions").update({ is_deleted: true }).eq("id", interp.transactionId);
            finalResponse = "Apaguei o último lançamento. ✅";
          } else finalResponse = "Ação confirmada! ✅"; // Fallback for other confirms
          await supabase.from("whatsapp_messages").update({ status: "processed" }).eq("sender_number", from).eq("status", "pending_confirmation");
        } else finalResponse = "Não encontrei nenhuma ação pendente.";
      } else {
        parserUsed = "ai_fallback";
        try {
          const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
          const prompt = `Classify this input as JSON. 
Intents: create_expense, create_income, query_summary, correct_last, delete_last, greeting, unknown.
For correct_last, extract newAmount (numeric). 
For query_summary, extract type (expense|income) and period (today|week|month).
Examples:
- "errei o ultimo era 50": {"intent": "correct_last", "newAmount": 50}
- "apaga o ultimo gasto": {"intent": "delete_last"}
- "quanto gastei hoje": {"intent": "query_summary", "type": "expense", "period": "today"}
Format: {"intent": "...", "newAmount": ..., "type": "...", "period": "..."}
User: "${rawText}"`;
          const result = await model.generateContent(prompt);
          const raw = result.response.text().replace(/```json|```/gi, "").trim();
          const start = raw.indexOf("{");
          const end = raw.lastIndexOf("}");
          if (start !== -1 && end !== -1) {
            const aiJson = JSON.parse(raw.substring(start, end + 1));
            detectedIntent = aiJson.intent;
            extractedData = aiJson;
            if (detectedIntent === "query_summary" && aiJson.type && aiJson.period && profile) {
              const result = await performQueryAggregation(profile.id, aiJson.type, aiJson.period === "today" ? "hoje" : aiJson.period === "week" ? "semana" : "mês");
              finalResponse = result.message;
              extractedData = { ...extractedData, ...result };
            } else if (detectedIntent === "correct_last") {
              if (profile) {
                const { data: lastTx } = await getLastTransaction(profile.id);
                if (lastTx) {
                  finalResponse = `Entendi que você quer corrigir o último lançamento de R$ ${lastTx.amount} (${lastTx.description.split(': ')[1] || lastTx.category}) para R$ ${aiJson.newAmount}. Confirma?`;
                  extractedData = { ...extractedData, transactionId: lastTx.id, oldAmount: lastTx.amount };
                } else finalResponse = "Não encontrei lançamentos para corrigir.";
              }
            } else if (detectedIntent === "delete_last") {
              if (profile) {
                const { data: lastTx } = await getLastTransaction(profile.id);
                if (lastTx) {
                  finalResponse = `Entendi que você quer apagar o último lançamento de R$ ${lastTx.amount} em ${lastTx.category}. Confirma?`;
                  extractedData = { ...extractedData, transactionId: lastTx.id };
                } else finalResponse = "Não encontrei lançamentos para apagar.";
              }
            } else if ((detectedIntent === "create_expense" || detectedIntent === "create_income") && aiJson.amount) {
              finalResponse = `Entendi um(a) ${detectedIntent === "create_expense" ? 'gasto' : 'entrada'} de R$ ${aiJson.amount}. Posso registrar?`;
            }
          }
      */
        } catch (e) { console.error("[AI Error]", e); }
      }

      console.log(`[Summary Log] Intent: ${detectedIntent}, Parser: ${parserUsed}, Payload: ${JSON.stringify(extractedData)}`);

      const isPending = finalResponse.includes("Confirma?") || finalResponse.includes("Posso registrar?");
      await supabase.from("whatsapp_messages").insert({
        whatsapp_id: message.id, sender_number: from, message_text: rawText,
        status: isPending ? "pending_confirmation" : "processed",
        interpretation: { ...extractedData, parserUsed, detectedIntent }, raw_data: body
      });

      if (process.env.WHATSAPP_ACCESS_TOKEN) {
        // WhatsApp ID Logic: Env Fallback is Primary to avoid Meta Test ID: 123456123
        const received_id = value?.metadata?.phone_number_id;
        const sending_from_id = process.env.PHONE_NUMBER_ID || received_id;

        if (sending_from_id) {
          try {
            console.log(`[WhatsApp API Trace] ID: ${sending_from_id}, TokenExists: ${!!process.env.WHATSAPP_ACCESS_TOKEN}`);
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
          console.error("[WhatsApp Config Error] No PHONE_NUMBER_ID available.");
        }
      }
    }
  }
  res.status(200).send('OK');
});

export default app;
