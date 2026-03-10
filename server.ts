import express from "express";
import * as dotenv from "dotenv";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Supabase Client
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseKey) {
  console.error("CRITICAL: Supabase environment variables are missing!");
}

const supabase = createClient(supabaseUrl || "https://placeholder.supabase.co", supabaseKey || "placeholder");

// Gemini AI Setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// --- API Routes ---

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Secretário Financeiro API is running" });
});

app.get("/api/debug-env", async (req, res) => {
  let dbTest = "not tested";
  try {
    const { data, error } = await supabase.from("system_logs").select("id").limit(1);
    dbTest = error ? `Error: ${error.message}` : "Success";
  } catch (err: any) {
    dbTest = `Exception: ${err.message}`;
  }

  res.json({
    hasUrl: !!(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL),
    hasKey: !!(process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY),
    hasGemini: !!process.env.GEMINI_API_KEY,
    hasToken: !!process.env.WHATSAPP_VERIFY_TOKEN,
    dbTest,
    nodeEnv: process.env.NODE_ENV
  });
});

app.get("/api/debug-logs", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("system_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/test-parser", async (req, res) => {
  const testPhrases = [
    "gastei 5 reais hoje na padaria",
    "paguei 20 ontem no posto",
    "gastei 12 com estacionamento hoje",
    "agendar reunião amanhã às 21h",
    "recebi 300 hoje de cliente",
    "comprei pão 15 reais ontem"
  ];

  const currentDateTime = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const results = [];

  for (const phrase of testPhrases) {
    const extraction = extractStructuredData(phrase, currentDateTime);
    results.push({ phrase, extraction });
  }

  res.json({ currentDateTime, results });
});

// WhatsApp Webhook Verification (GET)
app.get("/api/webhook/whatsapp", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const verifyToken = (process.env.WHATSAPP_VERIFY_TOKEN || "meu_whatsapp_secretario_token").trim();

  console.log("--- WhatsApp Webhook Verification (GET) ---");
  console.log("Mode:", mode);
  console.log("Received Token:", token);
  console.log("Expected Token:", verifyToken);
  console.log("Challenge:", challenge);

  if (mode === "subscribe" && token && token.toString().trim() === verifyToken) {
    console.log("WEBHOOK_VERIFIED_SUCCESSFULLY");
    res.set("Content-Type", "text/plain");
    return res.status(200).send(challenge);
  } else {
    console.error("VERIFICATION_FAILED: Token mismatch or missing parameters.");
    return res.status(403).send("Verification failed: Token mismatch");
  }
});

// WhatsApp Webhook Receiver (POST)
app.post("/api/webhook/whatsapp", async (req, res) => {
  console.log("--- WhatsApp Webhook Received (POST) ---");
  const body = req.body;

  // Log raw payload to system_logs for debugging
  try {
    await supabase.from("system_logs").insert([
      {
        event_type: "whatsapp_webhook_received",
        payload: body
      }
    ]);
  } catch (logErr) {
    console.error("Error logging to system_logs:", logErr);
  }

  if (body.object === "whatsapp_business_account") {
    try {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const message = value?.messages?.[0];

      if (message) {
        const from = message.from;
        let msgBody = message.text?.body || "";
        const msgId = message.id;

        // --- NEW: Audio/Voice Support ---
        if (message.type === 'audio' || message.type === 'voice') {
          console.log(`[Audio] Recebido de ${from}. Processando transcodificação...`);
          // We indicate to the user we are "listening"
          await sendWhatsAppMessage(from, "🎧 *Ouvindo seu áudio...*", value?.metadata?.phone_number_id);

          const audioData = message.audio || message.voice;
          if (audioData?.id) {
            // We'll try to get the transcription via AI fallback later by passing a flag
            msgBody = `[AUDIO_MESSAGE_ID:${audioData.id}]`;
          }
        }

        console.log(`Processing message from ${from}: ${msgBody}`);

        // Await processing to ensure Vercel doesn't terminate the function early
        const phone_number_id = value?.metadata?.phone_number_id;
        await processWhatsAppMessage(from, msgBody, msgId, body, phone_number_id);
      }

      return res.status(200).json({ status: "success" });
    } catch (err: any) {
      console.error("Error parsing webhook body:", err);
      await supabase.from("system_logs").insert([
        {
          event_type: "whatsapp_parse_error",
          payload: body,
          error_message: err.message
        }
      ]);
      return res.status(200).json({ status: "success" }); // Still return 200 to WhatsApp
    }
  }

  res.status(200).json({ status: "success" });
});

async function processWhatsAppMessage(from: string, msgBody: string, msgId: string, rawPayload: any, phone_number_id?: string) {
  try {
    // 1. Initial Receipt Log
    const { data: logData, error: logInitialError } = await supabase.from("whatsapp_messages").insert([
      {
        whatsapp_id: msgId,
        sender_number: from,
        message_text: msgBody,
        raw_data: rawPayload,
        status: 'pending_confirmation'
      }
    ]).select();

    if (logInitialError) {
      if (logInitialError.code === "23505") { // Unique violation
        console.log(`[WebHook] Meta retry detected for msgId: ${msgId}. Ignoring redundant request.`);
        return;
      }
      await supabase.from("system_logs").insert([{
        event_type: "db_error_messages",
        payload: { error: logInitialError, msgId }
      }]);
      console.error("Erro ao logar mensagem no Supabase:", logInitialError);
      return;
    }

    const internalMessageId = logData?.[0]?.id;

    // --- UNDERSTANDING ENGINE v2 (Layered Architecture) ---
    const currentDateTime = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const resultV2 = await processMessageV2(msgBody, currentDateTime, internalMessageId, from);

    // Update message status with the final result
    await supabase.from("whatsapp_messages").update({
      status: resultV2.status,
      interpretation: resultV2.interpretation
    }).eq("id", internalMessageId);

    // Final user response
    await sendWhatsAppMessage(from, resultV2.reply, phone_number_id);
  } catch (error: any) {
    console.error("Erro geral no processamento:", error);
    await supabase.from("system_logs").insert([{
      event_type: "critical_processing_error",
      payload: { error: error.message, stack: error.stack, msgId }
    }]);
  }
}

async function sendWhatsAppMessage(to: string, text: string, phone_number_id: string) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token || !phone_number_id) {
    console.error("WHATSAPP_ACCESS_TOKEN or phone_number_id missing");
    return;
  }

  try {
    const response = await fetch(`https://graph.facebook.com/v18.0/${phone_number_id}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to,
        type: "text",
        text: { body: text },
      }),
    });

    const result = await response.json();
    await supabase.from("system_logs").insert([{
      event_type: "whatsapp_reply_sent",
      payload: { to, text, result }
    }]);
  } catch (err: any) {
    console.error("Error sending WhatsApp message:", err);
  }
}

// --- NEW UNDERSTANDING ENGINE v2 ---

async function processMessageV2(text: string, currentDateTime: string, msgId: string, from: string) {
  const lowerText = text.toLowerCase();

  // Layer 1: Intent Classification
  let intent: 'finance' | 'event' | 'note' | 'unknown' = 'unknown';
  if (/(gastei|paguei|recebi|comprei|valor|reais|r\$)/i.test(text)) intent = 'finance';
  else if (/(agendar|marcar|agenda|reunião|compromisso|lembrete|visita)/i.test(text)) intent = 'event';
  else if (/(anotar|anota|observação|obs|lembrar|guardar|escrever)/i.test(text)) intent = 'note';

  // Layer 2: Structured Parsing (Regex/Logic)
  const extraction = extractStructuredData(text, currentDateTime, intent);

  // Intelligence Boost: Even if "full", if description is too short, use AI to beautify
  const needsBeautifying = extraction.full && extraction.data.description?.length < 8;

  // Method used tracker
  let method = extraction.full ? 'structured_parser' : 'hybrid';
  let interpretation = { type: intent, data: extraction.data, confidence: extraction.full ? 1.0 : 0.5 };

  // Layer 3: AI Fallback / Refinement / Audio Transcription
  if (!extraction.full || needsBeautifying || text.includes("[AUDIO_MESSAGE_ID:")) {
    console.log(`[V2] ${needsBeautifying ? 'Beautifying title/desc...' : 'Chamando IA Fallback/Audio...'}`);

    let audioData: { data: string, mimeType: string } | undefined = undefined;
    const audioMatch = text.match(/\[AUDIO_MESSAGE_ID:(.+)\]/);

    if (audioMatch) {
      const mediaId = audioMatch[1];
      console.log(`[Audio] Baixando mídia ID: ${mediaId}`);
      audioData = await downloadWhatsAppMedia(mediaId);
      if (!audioData) {
        console.error(`[Audio] Falha ao baixar mídia ID: ${mediaId}. Token presente: ${!!process.env.WHATSAPP_ACCESS_TOKEN}`);
      } else {
        console.log(`[Audio] Mídia baixada com sucesso. Tamanho: ${audioData.data.length} bytes. Mime: ${audioData.mimeType}`);
      }
    }

    const aiResult = await interpretMessage(text, intent, currentDateTime, audioData);
    method = audioMatch ? 'ai_audio_transcription' : (needsBeautifying ? 'structured+ai_refinement' : 'ai_fallback');

    // Merge: Keep parser's core data (amount, dates) but take AI's descriptions
    interpretation = {
      ...aiResult,
      data: {
        ...aiResult.data,
        amount: extraction.data.amount || aiResult.data.amount,
        type: (extraction.data.type === 'income' ? 'income' : aiResult.data.type) || 'expense',
        date: extraction.data.date || aiResult.data.date,
        start_time: extraction.data.start_time || aiResult.data.start_time,
        isUpdate: extraction.data.isUpdate || aiResult.data.isUpdate,
      }
    };
  }

  // Layer 4: Validation & Execution
  let reply = "";
  let status: 'processed' | 'pending_confirmation' | 'error' = 'pending_confirmation';

  try {
    const { amount, description, type, date, title, start_time, isUpdate } = interpretation.data;

    // --- NEW: UPDATE LOGIC (v2.3) ---
    if (isUpdate) {
      const result = await updateLastRecord(from, interpretation);
      if (result.success) {
        status = 'processed';
        reply = `✅ *Atualizado:* ${result.message}`;
      } else {
        reply = "🤔 Não encontrei o que você quer mudar. Pode mandar o novo comando completo?";
      }
    } else if (interpretation.type === 'finance') {
      if (!amount) {
        reply = "🤔 Entendi que é um gasto, mas não consegui identificar o **valor**. Pode repetir?";
      } else if (!description) {
        reply = "🤔 Entendi o valor, mas com o que você gastou? (Ex: 'na padaria')";
      } else {
        const { error } = await supabase.from("transactions").insert([{
          description,
          amount,
          type: type || 'expense',
          category: interpretation.data.category || "Outros", // FIXED: Added missing required field
          date: date || new Date().toISOString(),
          whatsapp_message_id: msgId
        }]);
        if (!error) {
          status = 'processed';
          reply = `✅ *Registro salvo!*\n💰 R$ ${amount} - ${description}`;
        } else {
          status = 'error';
          console.error("Erro no insert transactions:", error);
          reply = "❌ Erro ao salvar no banco de dados.";

          // Log specific DB error
          await supabase.from("system_logs").insert([{
            event_type: "db_error_v2",
            payload: { error, msgId, amount, description }
          }]);
        }
      }
    } else if (interpretation.type === 'event') {
      const { title, start_time } = interpretation.data;
      if (!title) {
        reply = "📅 Entendi que quer agendar algo, mas o que seria? (Ex: 'reunião')";
      } else if (!start_time) {
        reply = "📅 Entendi o compromisso, mas para **quando**? (Ex: 'amanhã às 10h')";
      } else {
        const { error } = await supabase.from("events").insert([{
          title, start_time, whatsapp_message_id: msgId
        }]);
        if (!error) {
          status = 'processed';
          const dataFmt = new Date(start_time).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
          reply = `✅ *Agendado:* ${title}\n⏰ ${dataFmt}`;
        } else {
          status = 'error';
          reply = "❌ Erro ao salvar na agenda.";
        }
      }
    } else if (interpretation.type === 'note') {
      const content = interpretation.data.description || text;
      const { error } = await supabase.from("notes").insert([{
        content, whatsapp_message_id: msgId
      }]);
      if (!error) {
        status = 'processed';
        reply = `📝 *Anotado:* ${content}`;
      } else {
        status = 'error';
        reply = "❌ Erro ao salvar anotação.";
      }
    } else {
      reply = "🤔 Não tenho certeza se é um gasto, agendamento ou anotação. Pode ser mais específico?";
    }
  } catch (err) {
    status = 'error';
    reply = "❌ Houve um erro no processamento v2.";
  }

  // Log detailed metadata
  await supabase.from("system_logs").insert([{
    event_type: "understanding_v2_result",
    payload: { original: text, intent, method, extraction, finalInterpretation: interpretation, status }
  }]);

  return { status, interpretation, reply };
}

// Layer 2: Deep Structured Parser
function extractStructuredData(text: string, currentDateTime: string, intent: string = "unknown") {
  const data: any = {};

  // IGNORE AUDIO TAGS for extraction
  const cleanTextForParsing = text.replace(/\[AUDIO_MESSAGE_ID:[^\]]+\]/g, '');
  const lowerText = cleanTextForParsing.toLowerCase();

  // 1. Value Extraction (R$ 10, 10 reais, 10.50)
  const valueMatch = cleanTextForParsing.match(/(?:r\$\s*|reais\s*)?(\d+(?:[.,]\d+)?)(?:\s*reais|\s*r\$)/i)
    || cleanTextForParsing.match(/(?:gastei|paguei|recebi|valor)\s+(?:r\$\s*)?(\d+(?:[.,]\d+)?)/i);

  if (valueMatch) data.amount = parseFloat(valueMatch[1].replace(',', '.'));

  // 2. Date Extraction (hoje, ontem, amanhã, anteontem)
  let baseDate = new Date();
  const lower = text.toLowerCase();
  if (lower.includes("ontem")) baseDate.setDate(baseDate.getDate() - 1);
  else if (lower.includes("amanhã") || lower.includes("amanha")) baseDate.setDate(baseDate.getDate() + 1);
  else if (lower.includes("anteontem")) baseDate.setDate(baseDate.getDate() - 2);

  // 3. Time Extraction (21h, 21:00, 9 da noite)
  const timeMatch = text.match(/(\d{1,2})(?::(\d{2}))?\s*(h|horas?|da noite|da manhã|da tarde)/i);
  let hour = 12; // Default
  let min = 0;
  let hasTime = false;
  if (timeMatch) {
    hasTime = true;
    hour = parseInt(timeMatch[1]);
    min = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    if (timeMatch[3].includes("noite") && hour < 12) hour += 12;
    if (timeMatch[3].includes("tarde") && hour < 12) hour += 12;
  }

  // Set date/time
  baseDate.setHours(hour, min, 0, 0);
  data.date = baseDate.toISOString();
  data.start_time = baseDate.toISOString();

  // 4. Description Extraction (Cleaning) - MUCH MORE CONSERVATIVE
  let cleanDesc = text
    .replace(/\[AUDIO_MESSAGE_ID:[^\]]+\]/g, '')
    .replace(/(?:gastei|paguei|recebi|recebimento|comprei|agendar|marcar|agenda|reunião|compromisso|lembrete|visita|anotar|anota|obs|mude|alterar|altere|mudar|trocar|troque)\s+/gi, '')
    .replace(/(?:hoje|ontem|amanhã|amanha|anteontem|agora|já)/gi, '')
    .replace(/\d{1,2}\/\d{1,2}(?:\/\d{2,4})?/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // If the cleaning removed too much or it's an event, we prefer the original (minus commands)
  if (cleanDesc.length < 3) cleanDesc = text.replace(/\[AUDIO_MESSAGE_ID:[^\]]+\]/g, '').trim();

  data.description = cleanDesc;
  data.title = cleanDesc;

  // Reliability Check
  const hasFinance = !!(data.amount && cleanDesc.length > 2);
  const hasEvent = !!(cleanDesc.length > 2 && hasTime);

  // DETECT INCOME (RECEITA)
  const isIncome = lowerText.includes("recebi") || lowerText.includes("entrada") || lowerText.includes("ganhei") || lowerText.includes("recebimento");
  data.type = isIncome ? 'income' : 'expense';

  // DETECT UPDATE (MUDAR)
  const isUpdate = /(mude|alterar|altere|mudar|trocar|troque|corrigir|corrija)/i.test(text);
  (data as any).isUpdate = isUpdate;

  return { data, full: (hasFinance || hasEvent) && !!data.type };
}

// Media Handling Helper
async function downloadWhatsAppMedia(mediaId: string): Promise<{ data: string, mimeType: string } | undefined> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) {
    console.error("WHATSAPP_ACCESS_TOKEN missing for media download");
    return undefined;
  }

  try {
    // 1. Get Media URL from Meta
    const urlResponse = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const mediaInfo = await urlResponse.json();
    if (!mediaInfo.url) return undefined;

    // 2. Download the actual file bytes
    const mediaResponse = await fetch(mediaInfo.url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const arrayBuffer = await mediaResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return {
      data: buffer.toString("base64"),
      mimeType: mediaInfo.mime_type || "audio/ogg"
    };
  } catch (err) {
    console.error("Error downloading media:", err);
    return undefined;
  }
}

// AI Interpretation Logic
// Update Logic Helper (v2.4) - Robust Filtering by Sender
async function updateLastRecord(from: string, interpretation: any) {
  const { type, data } = interpretation;
  const table = interpretation.type === 'finance' ? 'transactions' : (interpretation.type === 'event' ? 'events' : 'notes');

  // 1. Find the last message from this user that wasn't an "unknown" or "error"
  const { data: lastMsgs, error: msgError } = await supabase
    .from("whatsapp_messages")
    .select("id")
    .eq("sender_number", from)
    .neq("status", "error")
    .order("created_at", { ascending: false })
    .limit(10);

  if (msgError || !lastMsgs || lastMsgs.length === 0) return { success: false };

  // 2. Look for the record in the target table associated with any of those messages
  const msgIds = lastMsgs.map((m: any) => m.id);
  const { data: records, error: fetchError } = await supabase
    .from(table)
    .select("*")
    .in("whatsapp_message_id", msgIds)
    .order("created_at", { ascending: false })
    .limit(1);

  if (fetchError || !records || records.length === 0) return { success: false };

  const lastRecord = records[0];
  const updates: any = {};

  if (interpretation.type === 'finance') {
    if (data.amount) updates.amount = data.amount;
    if (data.description && !data.description.includes("Gasto sem nome")) updates.description = data.description;
    if (data.date) updates.date = data.date;
    if (data.type) updates.type = data.type;
  } else if (interpretation.type === 'event') {
    if (data.title && !data.title.includes("Compromisso")) updates.title = data.title;
    if (data.start_time) updates.start_time = data.start_time;
  } else if (interpretation.type === 'note') {
    if (data.description) updates.content = data.description;
  }

  const { error: updateError } = await supabase
    .from(table)
    .update(updates)
    .eq('id', lastRecord.id);

  if (updateError) {
    console.error(`[Update] Falha ao atualizar ${table}:`, updateError);
    return { success: false };
  }

  const resDesc = interpretation.type === 'finance' ? `R$ ${updates.amount || lastRecord.amount} - ${updates.description || lastRecord.description}` : (updates.title || updates.content || lastRecord.title || lastRecord.content);
  return { success: true, message: resDesc };
}

async function interpretMessage(text: string, suggestedIntent: string = "unknown", currentDateTime: string, audioData?: { data: string, mimeType: string }) {
  const modelName = "gemini-2.0-flash-lite";
  console.log(`[Unlimited AI] Interpretando: ${text} | Sugestão: ${suggestedIntent} | Agora: ${currentDateTime} | Audio: ${!!audioData}`);

  // 1. FAST REGEX - (Only for text)
  if (!audioData) {
    const financeMatch = text.match(/(?:gastei|paguei|recebi|comprei)\s+(?:r\$\s*)?(\d+(?:[.,]\d+)?)\s*(?:reais)?(?:\s+(?:hoje|ontem|amanhã|agora|já))?\s*(?:com|de|em|no|na|pelo|pela|num|numa)\s+(.+)/i);
    if (financeMatch) {
      const isExpense = !text.toLowerCase().includes("recebi");
      return {
        type: "finance",
        confidence: 0.98,
        data: {
          description: financeMatch[2].trim().split(/\s+hoje|\s+agora/i)[0], // Clean trailing time words
          amount: parseFloat(financeMatch[1].replace(',', '.')),
          type: isExpense ? "expense" : "income",
          category: "Outros",
          date: new Date().toISOString()
        }
      };
    }
  }

  // 2. AI POWERED FALLBACK (Unlimited Logic)
  const model = genAI.getGenerativeModel({ model: modelName });

  try {
    let prompt = `Você é um assistente pessoal brasileiro de ALTA INTELIGÊNCIA. 
    Sua missão é extrair dados de uma mensagem do WhatsApp para um sistema de finanças e agenda.

    DADOS ATUAIS (USE ISSO PARA DATAS RELATIVAS):
    Agora é: ${currentDateTime} (Horário de Brasília)

    REGRAS DE OURO:
    1. FINANCEIRO: "paguei", "gastei", "reais", "$".
    2. INCOME (RECEITA): Se o usuário disse "recebi", "ganhei" ou "entrada". SEMPRE use "type": "income".
    3. AGENDA: "reunião", "marcar", "agendar", "visita".
    4. ANOTAÇÃO: Se for apenas um lembrete sem data/valor.
    5. ATUALIZAÇÃO: Se o usuário disser "Mude isso para...", "Altere...", "Corrija isso", use "isUpdate": true.
    6. "hoje", "amanhã", "ontem" devem ser convertidos para a data real baseada em ${currentDateTime}.

    SAÍDA (APENAS JSON):
    {
      "type": "finance" | "event" | "note" | "unknown",
      "confidence": 0.0 a 1.0,
      "data": { 
        "isUpdate": boolean,
        // Se finance: description, amount (numbers), type (expense/income), category, date (ISO)
        // Se event: title, description, start_time (ISO), end_time (ISO)
        // Se note: description (o texto da anotação)
      },
      "reply": "Uma resposta curta e amigável confirmando ou perguntando algo"
    }

    MENSAGEM DO USUÁRIO: "${text}"`;

    let rawResponse = "";
    const maxRetries = 2;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        if (audioData) {
          console.log(`[Audio] Enviando para Gemini (2.0-flash)... Tentativa ${attempt + 1}`);
          const audioModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
          const result = await audioModel.generateContent([
            prompt,
            { inlineData: { data: audioData.data, mimeType: audioData.mimeType } }
          ]);
          rawResponse = result.response.text();
        } else {
          const result = await model.generateContent(prompt);
          rawResponse = result.response.text();
        }
        break;
      } catch (err: any) {
        const isQuota = err.message.includes("429") || err.message.includes("quota");
        if (isQuota && attempt < maxRetries) {
          attempt++;
          const delay = Math.pow(2, attempt) * 2000;
          console.log(`[AI] Quota hit. Retrying in ${delay}ms...`);
          await new Promise(res => setTimeout(res, delay));
        } else {
          throw err;
        }
      }
    }

    // Debug log the raw AI response (FOR BOTH TEXT AND AUDIO)
    await supabase.from("system_logs").insert([{
      event_type: "ai_raw_response",
      payload: { raw: rawResponse, text, hasAudio: !!audioData }
    }]);

    const cleanJson = rawResponse.match(/\{[\s\S]*\}/)?.[0] || rawResponse;
    const interpretation = JSON.parse(cleanJson);

    // AI correction: "hoje na padaria" is often misclassified as "event" if it sees "agenda" elsewhere
    if (text.toLowerCase().includes("reais") && interpretation.type === "event") {
      interpretation.type = "finance";
      interpretation.confidence = 0.8;
    }

    return interpretation;
  } catch (error: any) {
    console.error("Unlimited AI failed:", error.message);

    // DETECÇÃO DE QUOTA (429)
    const isQuotaError = error.message.includes("429") || error.message.includes("quota");
    const reply = isQuotaError
      ? "⚠️ O limite diário de áudio/IA do Google foi atingido. Por favor, tente novamente em alguns minutos ou use texto."
      : "Tive um lapso de memória! Pode repetir?";

    await supabase.from("system_logs").insert([{
      event_type: "ai_error",
      payload: { error: error.message, text, hasAudio: !!audioData, isQuotaError }
    }]);

    return { type: "unknown", confidence: 0, data: {}, reply };
  }
}

// Export app for Vercel
export default app;

// Only run standalone server if not on Vercel
if (process.env.NODE_ENV !== "production") {
  async function setupVite() {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
  setupVite();
}
