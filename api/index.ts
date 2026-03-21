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
  res.json({ status: "ok", version: "2.2.0 - Phase 4 Robustness", timestamp: new Date().toISOString() });
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

function normalizeMessage(text: string): string {
  // 1. Trim, Lowercase, Remove extra spaces
  let normalized = text.trim().toLowerCase().replace(/\s+/g, " ");

  // 2. Remove Wake Words only at the start
  const wakeWords = ["oi zlai", "olá zlai", "ei zlai", "zlai", "z lai", "zlay"];
  for (const word of wakeWords) {
    if (normalized.startsWith(word)) {
      normalized = normalized.substring(word.length).trim();
      break;
    }
  }

  // 3. Normalize common abbreviations
  normalized = normalized.replace(/\bqto\b/g, "quanto")
    .replace(/\bessa semana\b/g, "esta semana")
    .replace(/\bessa\b/g, "esta")
    .replace(/\besse\b/g, "este");

  // 4. Remove unwanted punctuation but keep decimals, time, and 'h'
  // Keep: 0-9, a-z, Portuguese chars, ',', '.', ':', 'h'
  normalized = normalized.replace(/[^a-z0-9àáâãéêíóôõúç\.,:h\s]/g, " ").replace(/\s+/g, " ").trim();

  return normalized;
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

async function downloadWAMedia(mediaId: string): Promise<{ buffer?: Buffer, mime?: string, error?: string }> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) return { error: "Missing WHATSAPP_ACCESS_TOKEN" };
  try {
    const metaRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const mediaData = await metaRes.json() as any;
    if (!metaRes.ok) return { error: `Meta API Metadata Error: ${JSON.stringify(mediaData)}` };
    
    const { url, mime_type } = mediaData;
    if (!url) return { error: "No media URL returned from Meta" };

    const mediaRes = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!mediaRes.ok) return { error: `Meta Media Download Error: ${mediaRes.status} ${mediaRes.statusText}` };

    const buffer = Buffer.from(await mediaRes.arrayBuffer());
    return { buffer, mime: mime_type };
  } catch (e: any) {
    console.error("[Media Error]", e);
    return { error: `Download Exception: ${e.message || String(e)}` };
  }
}

async function transcribeAudio(buffer: Buffer, mime: string): Promise<{ text: string | null, error?: string }> {
  const modelName = "gemini-1.5-pro"; 
  const cleanMime = mime.split(";")[0].trim();
  console.log(`[Transcription] Model: ${modelName}, CleanMime: ${cleanMime}`);
  
  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    const res = await model.generateContent([
      { inlineData: { data: buffer.toString("base64"), mimeType: cleanMime } },
      "Transcreva exatamente o que foi dito neste áudio em português brasileiro. Se não houver fala clara, retorne apenas [silêncio]."
    ]);
    const text = res.response.text().trim();
    if (text === "[silêncio]") return { text: null };
    return { text };
  } catch (e: any) {
    console.error("[Transcription Error Detailed]", e);
    return { text: null, error: `Gemini Error: ${e.message || String(e)}` };
  }
}

async function handleMessageLogic(from: string, rawText: string, messageId: string, profile: any, body: any) {
  const normalizedText = normalizeMessage(rawText);
  let finalResponse = `Não entendi o que você quis dizer por "${rawText}".\n\nPosso te ajudar com:\n- Registrar gasto: 'gastei 30 no mercado'\n- Consultar gastos: 'quanto gastei esta semana'\n- Criar compromisso: 'agende treino hoje às 18h'`;
  let detectedIntent = "unknown";
  let parserUsed = "none";
  let extractedData: any = {};

  const lowText = normalizedText;
  const isFixed = lowText.includes("fixo");
  const cleanText = lowText.replace(/fixo|variável|variavel/gi, "").trim();

  // DETERMINISTIC REGEX - Optimized for normalized text
  const expenseRegex = /^(?:gastei|paguei)\s+(\d+(?:[\.,]\d+)?)(?:\s+reais)?\s+(?:no|na|em|de)\s+(.*)/i;
  const incomeRegex = /^recebi\s+(\d+(?:[\.,]\d+)?)(?:\s+reais)?\s+(?:do|da|de|dos|das)\s+(.*)/i;
  const summaryRegex = /^quanto\s+(gastei|recebi)\s+(?:de\s+(fixo|variável)\s+)?(hoje|esta\s+semana|este\s+mes|nesta\s+semana|neste\s+mes|essa\s+semana|esse\s+mes)[\s?]*$/i;

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
      description: `WhatsApp: ${rawText}`, is_fixed: isFixed, source: 'whatsapp'
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
      description: `WhatsApp: ${rawText}`, is_fixed: isFixed, source: 'whatsapp'
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
      const periodText = period.includes("mes") ? "neste mês" : period.includes("semana") ? "nesta semana" : "hoje";
      const filterText = filter ? ` em despesas ${filter}s` : "";
      
      if (count === 0) finalResponse = `Você ainda não tem ${type === 'expense' ? 'gastos' : 'receitas'}${filterText} registrados ${periodText}.`;
      else if (period === "hoje") finalResponse = `Hoje você ${type === 'expense' ? 'gastou' : 'recebeu'} R$ ${totalFmt} em ${count} lançamentos.`;
      else finalResponse = `${periodText.charAt(0).toUpperCase() + periodText.slice(1)} você ${type === 'expense' ? 'gastou' : 'recebeu'} R$ ${totalFmt}${filterText}.`;
    } else finalResponse = "Erro ao consultar seus dados.";
  } else if (lowText.match(/^(?:agende|marque|crie|agenda)\s+(?:compromisso\s+)?(?:para\s+)?(hoje|amanha|segunda|terca|quarta|quinta|sexta|sabado|domingo)\s+as\s+(\d{1,2}(?::\d{2})?\s*(?:h|horas)?)\s+(.*)/i)) {
    parserUsed = "regex";
    detectedIntent = "create_event";
    const m = lowText.match(/^(?:agende|marque|crie|agenda)\s+(?:compromisso\s+)?(?:para\s+)?(hoje|amanha|segunda|terca|quarta|quinta|sexta|sabado|domingo)\s+as\s+(\d{1,2}(?::\d{2})?\s*(?:h|horas)?)\s+(.*)/i);
    if (m) {
      const startAt = parseDateTimeBR(m[1], m[2]);
      const title = m[3].trim();
      const { error } = await supabase.from("events").insert({
        user_id: profile.id, title, start_time: startAt.toISOString(), source: 'whatsapp'
      });
      if (!error) finalResponse = `Compromisso criado para ${m[1]} às ${startAt.getUTCHours()}:${startAt.getUTCMinutes().toString().padStart(2, '0')}: ${title}. ✅`;
      else finalResponse = "Erro ao criar compromisso.";
    }
  } else if (lowText.match(/(?:quais\s+meus\s+compromissos\s+de\s+|tenho\s+compromisso\s+|agenda\s+de\s+)(hoje|amanha)/i)) {
    parserUsed = "regex";
    detectedIntent = "query_events";
    const m = lowText.match(/(?:quais\s+meus\s+compromissos\s+de\s+|tenho\s+compromisso\s+|agenda\s+de\s+)(hoje|amanha)/i);
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
  } else if (/^(sim|s|ok|pode|confirmar|confirmado|vambora|bora)[\s!.]*$/i.test(lowText)) {
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
User input: "${lowText}"
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

  console.log(`[Processing] Parser: ${parserUsed}, Intent: ${detectedIntent}, Raw: "${rawText}", Normalized: "${normalizedText}"`);

  // Save processing state to DB
  const isPending = finalResponse.includes("Posso registrar?") || finalResponse.includes("Posso agendar?");
  await supabase.from("whatsapp_messages").insert({
    whatsapp_id: messageId, sender_number: from, message_text: rawText,
    status: isPending ? "pending_confirmation" : "processed",
    interpretation: { intent: detectedIntent, parserUsed, normalizedText, ...extractedData }, 
    raw_data: body, user_id: profile.id
  });

  await sendWA(from, finalResponse);
}

app.post(["/api/whatsapp/webhook", "/whatsapp/webhook"], async (req, res) => {
  const body = req.body;
  if (body.object === 'whatsapp_business_account' && body.entry) {
    for (const entry of body.entry) {
      for (const change of entry.changes) {
        const value = change.value;
        const message = value.messages?.[0];
        
        if (message) {
          const from = message.from;
          const normalizedFrom = normalizePhone(from);
          const type = message.type;
          console.log(`[Phase 3] Incoming type: ${type}, From: ${from}`);

          const lastDigits = normalizedFrom.slice(-8); 
          const { data: profile } = await supabase.from("profiles").select("id, full_name")
            .ilike("whatsapp_number", `%${lastDigits}`).limit(1).single();

          if (!profile) {
            await sendWA(from, "Não encontrei seu cadastro. Por favor, registre seu número no site ZLAI.");
            continue;
          }

          if (type === 'text') {
            const rawText = (message.text?.body || "").trim();
            await handleMessageLogic(from, rawText, message.id, profile, body);
          } else if (type === 'audio') {
            const mediaId = message.audio?.id;
            console.log(`[Audio] Received media_id: ${mediaId}`);
            
            const mediaResult = await downloadWAMedia(mediaId);
            if (mediaResult.error || !mediaResult.buffer) {
              await supabase.from("whatsapp_messages").insert({
                whatsapp_id: message.id, sender_number: from, message_text: "[DOWNLOAD_FAILED]",
                status: "error", interpretation: { error: mediaResult.error || "No buffer" },
                raw_data: body, user_id: profile.id
              });
              await sendWA(from, "Não consegui processar seu áudio. Pode tentar novamente?");
              continue;
            }

            const transResult = await transcribeAudio(mediaResult.buffer, mediaResult.mime!);
            if (transResult.error || !transResult.text) {
              const errorText = transResult.error || "Transcrição vazia ou silêncio";
              await supabase.from("whatsapp_messages").insert({
                whatsapp_id: message.id, sender_number: from, message_text: "[TRANSCRIPTION_FAILED]",
                status: "error", interpretation: { error: errorText },
                raw_data: body, user_id: profile.id
              });
              await sendWA(from, "Não consegui entender seu áudio. Pode tentar novamente ou mandar em texto?");
              continue;
            }

            console.log(`[Audio Transcription] Result: "${transResult.text}"`);
            await handleMessageLogic(from, transResult.text, message.id, profile, body);
          }
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
    const waResponse = await fetch(`https://graph.facebook.com/v21.0/${sending_from_id}/messages`, {
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
