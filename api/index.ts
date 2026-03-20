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
  res.json({ status: "ok", version: "2.0.0 - Phase 2 Agenda", timestamp: new Date().toISOString() });
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

function parseDateTimeBR(dateStr: string, timeStr: string) {
  const now = new Date();
  const brOffset = -3 * 60 * 60 * 1000;
  const brNow = new Date(now.getTime() + brOffset);
  const target = new Date(brNow);

  // Date Logic
  const lowDate = dateStr.toLowerCase();
  if (lowDate.includes("amanhã") || lowDate.includes("amanha")) {
    target.setUTCDate(brNow.getUTCDate() + 1);
  } else if (!lowDate.includes("hoje")) {
    const days: { [key: string]: number } = { "domingo": 0, "segunda": 1, "terça": 2, "quarta": 3, "quinta": 4, "sexta": 5, "sábado": 6, "sabado": 6 };
    for (const d in days) {
      if (lowDate.includes(d)) {
        let diff = days[d] - brNow.getUTCDay();
        if (diff <= 0) diff += 7;
        target.setUTCDate(brNow.getUTCDate() + diff);
        break;
      }
    }
  }

  // Time Logic: "18", "18h", "18:30", "18:30h"
  const timeMatch = timeStr.match(/(\d{1,2})(?::(\d{2}))?/);
  if (timeMatch) {
    const hours = parseInt(timeMatch[1]);
    const mins = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    target.setUTCHours(hours, mins, 0, 0);
  }

  return new Date(target.getTime() - brOffset);
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
          } else if (lowText.match(/^(?:agende|marque|crie|agenda)\s+(?:compromisso\s+)?(?:para\s+)?(hoje|amanhã|segunda|terça|quarta|quinta|sexta|sábado|domingo|sabado)\s+às\s+(\d{1,2}(?::\d{2})?\s*(?:h|horas)?)\s+(.*)/i)) {
            parserUsed = "regex";
            detectedIntent = "create_event";
            const m = lowText.match(/^(?:agende|marque|crie|agenda)\s+(?:compromisso\s+)?(?:para\s+)?(hoje|amanhã|segunda|terça|quarta|quinta|sexta|sábado|domingo|sabado)\s+às\s+(\d{1,2}(?::\d{2})?\s*(?:h|horas)?)\s+(.*)/i);
            if (m) {
              const startAt = parseDateTimeBR(m[1], m[2]);
              const title = m[3].trim();
              const { error } = await supabase.from("events").insert({
                user_id: profile.id, title, start_time: startAt.toISOString(), source: 'whatsapp'
              });
              if (!error) finalResponse = `Compromisso criado para ${m[1]} às ${startAt.getUTCHours()}:${startAt.getUTCMinutes().toString().padStart(2, '0')}: ${title}. ✅`;
              else finalResponse = "Erro ao criar compromisso.";
            }
          } else if (lowText.match(/(?:quais\s+meus\s+compromissos\s+de\s+|tenho\s+compromisso\s+|agenda\s+de\s+)(hoje|amanhã)/i)) {
            parserUsed = "regex";
            detectedIntent = "query_events";
            const m = lowText.match(/(?:quais\s+meus\s+compromissos\s+de\s+|tenho\s+compromisso\s+|agenda\s+de\s+)(hoje|amanhã)/i);
            const period = m?.[1] || "hoje";
            const dayStart = getDateRange(period);
            const nextDay = new Date(new Date(dayStart).getTime() + 24 * 60 * 60 * 1000).toISOString();
            
            const { data: events, error } = await supabase.from("events")
              .select("title, start_time").eq("user_id", profile.id)
              .gte("start_time", dayStart).lt("start_time", nextDay).order("start_time");

            if (!error) {
              if (events.length === 0) finalResponse = `Você não tem compromissos para ${period}.`;
              else {
                const list = events.map(e => {
                  const d = new Date(e.start_time);
                  const h = d.getUTCHours().toString().padStart(2, '0');
                  const min = d.getUTCMinutes().toString().padStart(2, '0');
                  return `${e.title} às ${h}:${min}`;
                }).join(", ");
                finalResponse = `${period === 'hoje' ? 'Hoje' : 'Amanhã'} você tem ${events.length} compromisso(s): ${list}.`;
              }
            } else finalResponse = "Erro ao carregar sua agenda.";
          } else if (/^(sim|s|ok|pode|confirmar|confirmado|vambora|bora)[\s!.]*$/i.test(rawText)) {
            parserUsed = "affirmation";
            const { data: lastMsg } = await supabase.from("whatsapp_messages")
              .select("interpretation, id").eq("user_id", profile.id).eq("status", "pending_confirmation")
              .order("created_at", { ascending: false }).limit(1).single();

            if (lastMsg?.interpretation) {
              const interp = lastMsg.interpretation as any;
              if (interp.intent === "create_expense" || interp.intent === "create_income") {
                const type = interp.intent === "create_expense" ? "expense" : "income";
                const { error } = await supabase.from("transactions").insert({
                  user_id: profile.id, type, amount: interp.amount, category: interp.category || "Geral",
                  description: `WhatsApp Confirmed: ${interp.category}`, is_fixed: interp.is_fixed || false, source: 'whatsapp'
                });
                if (!error) {
                  finalResponse = "Confirmado e registrado! ✅";
                  await supabase.from("whatsapp_messages").update({ status: "processed" }).eq("id", lastMsg.id);
                } else finalResponse = "Erro ao registrar.";
              } else if (interp.intent === "create_event") {
                const { error } = await supabase.from("events").insert({
                  user_id: profile.id, title: interp.title, start_time: interp.start_time, source: 'whatsapp'
                });
                if (!error) {
                  finalResponse = "Compromisso confirmado e agendado! ✅";
                  await supabase.from("whatsapp_messages").update({ status: "processed" }).eq("id", lastMsg.id);
                } else finalResponse = "Erro ao agendar compromisso.";
              } else finalResponse = "Não entendi o que era para confirmar.";
            } else finalResponse = "Não encontrei nenhuma ação pendente.";
          } else {
            // IA FALLBACK
            parserUsed = "ai_fallback";
            try {
              const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
              const prompt = `Classify this input as JSON. 
Intents: create_expense, create_income, create_event, unknown.
- For financial: Extract amount (numeric), category (string), is_fixed (boolean).
- For agenda: Extract title (string), date (YYYY-MM-DD), time (HH:mm). 
Current Time: ${new Date().toISOString()} (UTC-3 is -3h).
Ex: "marque dentista amanha 14h": {"intent": "create_event", "title": "dentista", "start_time": "2024-03-21T14:00:00.000Z"}
User: "${rawText}"
Format: {"intent": "...", ...fields...}`;
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
                } else if (detectedIntent === "create_event") {
                  if (!aiJson.title) finalResponse = "Qual o nome do compromisso?";
                  else if (!aiJson.start_time) finalResponse = "Qual horário desse compromisso?";
                  else {
                    finalResponse = `Entendi um compromisso: ${aiJson.title} para ${aiJson.start_time.split('T')[0]} às ${aiJson.start_time.split('T')[1].substring(0,5)}. Posso agendar?`;
                    extractedData = aiJson;
                  }
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
