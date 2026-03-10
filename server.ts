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
        const msgBody = message.text?.body || "";
        const msgId = message.id;

        console.log(`Processing message from ${from}: ${msgBody}`);

        // Await processing to ensure Vercel doesn't terminate the function early
        await processWhatsAppMessage(from, msgBody, msgId, body);
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

async function processWhatsAppMessage(from: string, msgBody: string, msgId: string, rawData: any) {
  const phone_number_id = rawData.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;

  try {
    // 1. Log to system_logs that processing started
    await supabase.from("system_logs").insert([{
      event_type: "processing_start",
      payload: { from, msgBody, msgId, phone_number_id }
    }]);

    // 2. Insert into whatsapp_messages
    const { data: logData, error: logError } = await supabase
      .from("whatsapp_messages")
      .insert([
        {
          whatsapp_id: msgId,
          sender_number: from,
          message_text: msgBody,
          raw_data: rawData,
          status: "received",
        },
      ])
      .select();

    if (logError) {
      if (logError.code === "23505") { // Unique violation
        console.log(`[WebHook] Meta retry detected for msgId: ${msgId}. Ignoring redundant request.`);
        return;
      }
      await supabase.from("system_logs").insert([{
        event_type: "db_error_messages",
        payload: { error: logError, msgId }
      }]);
      console.error("Erro ao logar mensagem no Supabase:", logError);
      return;
    }

    const internalMessageId = logData?.[0]?.id;

    // --- UNDERSTANDING ENGINE v2 (Layered Architecture) ---
    const currentDateTime = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const resultV2 = await processMessageV2(msgBody, currentDateTime, internalMessageId);

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

async function processMessageV2(text: string, currentDateTime: string, msgId: string) {
  const lowerText = text.toLowerCase();

  // Layer 1: Intent Classification
  let intent: 'finance' | 'event' | 'unknown' = 'unknown';
  if (/(gastei|paguei|recebi|comprei|valor|reais|r\$)/i.test(text)) intent = 'finance';
  else if (/(agendar|marcar|agenda|reunião|compromisso|lembrete|visita)/i.test(text)) intent = 'event';

  // Layer 2: Structured Parsing (Regex/Logic)
  const extraction = extractStructuredData(text, currentDateTime);

  // Method used tracker
  let method = extraction.full ? 'structured_parser' : 'hybrid';
  let interpretation = { type: intent, data: extraction.data, confidence: extraction.full ? 1.0 : 0.5 };

  // Layer 3: AI Fallback (if structured fails mandatory fields)
  if (!extraction.full) {
    console.log(`[V2] Layer 2 incompleta. Chamando IA Fallback...`);
    const aiResult = await interpretMessage(text, intent, currentDateTime);
    method = 'ai_fallback';
    interpretation = aiResult;
  }

  // Layer 4: Validation & Execution
  let reply = "";
  let status: 'processed' | 'pending_confirmation' | 'error' = 'pending_confirmation';

  try {
    if (interpretation.type === 'finance') {
      const { amount, description, type, date } = interpretation.data;

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
    } else {
      reply = "🤔 Não tenho certeza se é um gasto ou agendamento. Pode ser mais específico?";
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

function extractStructuredData(text: string, currentDateTime: string) {
  const data: any = {};
  const lowerText = text.toLowerCase();

  // 1. Value Extraction (R$ 10, 10 reais, 10.50)
  // Improved to ensure we catch numbers only preceded/followed by currency markers
  const valueMatch = text.match(/(?:r\$\s*|reais\s*)?(\d+(?:[.,]\d+)?)(?:\s*reais|\s*r\$)?/i);
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

  // 4. Description Extraction (Cleaning)
  // We want to be careful not to over-clean
  let cleanDesc = text
    .replace(/(?:gastei|paguei|recebi|comprei|agendar|marcar|agenda|reunião|compromisso|lembrete|visita|anotar)/gi, '')
    .replace(/(?:r\$\s*)?\d+(?:[.,]\d+)?(?:\s*reais)?/gi, '')
    .replace(/(?:hoje|ontem|amanhã|amanha|anteontem|as|às|nos?|agora|já)/gi, '')
    .replace(/\d{1,2}(?::\d{2})?\s*(?:h|horas?|da noite|da manhã|da tarde)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Remove common connector words at start (Brazilian Portuguese)
  cleanDesc = cleanDesc.replace(/^(com|de|em|no|na|pelo|pela|num|numa|do|da)\s+/i, '');

  data.description = cleanDesc || "Sem descrição";
  data.title = cleanDesc || "Compromisso";

  // Reliability Check
  // We have a "full" extraction if we have Amount + Description OR Title + Time
  const hasFinance = !!(data.amount && cleanDesc.length > 2);
  const hasEvent = !!(cleanDesc.length > 2 && hasTime);

  return { data, full: hasFinance || hasEvent };
}

// AI Interpretation Logic
async function interpretMessage(text: string, suggestedIntent: string = "unknown", currentDateTime: string) {
  const modelName = "gemini-2.0-flash-lite";
  console.log(`[Unlimited AI] Interpretando: ${text} | Sugestão: ${suggestedIntent} | Agora: ${currentDateTime}`);

  // 1. FAST REGEX - (Now with better Brazilian Portugeuse support)
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

  // 2. AI POWERED FALLBACK (Unlimited Logic)
  const model = genAI.getGenerativeModel({ model: modelName });

  try {
    const prompt = `Você é um assistente pessoal brasileiro de ALTA INTELIGÊNCIA. 
    Sua missão é extrair dados de uma mensagem do WhatsApp para um sistema de finanças e agenda.

    DADOS ATUAIS (USE ISSO PARA DATAS RELATIVAS):
    Agora é: ${currentDateTime} (Horário de Brasília)

    REGRAS DE OURO:
    1. Se o usuário disser "paguei... na padaria", isso é FINANCEIRO (expense), não agenda.
    2. Se ele disser "Marcar reunião", isso é AGENDA (event).
    3. Se houver dúvida entre gasto e agenda, priorize FINANCEIRO se houver valores monetários.
    4. "reais" ou "$" indica FINANCEIRO.
    5. "hoje", "amanhã", "ontem" devem ser convertidos para a data real baseada em ${currentDateTime}.

    SAÍDA (APENAS JSON):
    {
      "type": "finance" | "event" | "unknown",
      "confidence": 0.0 a 1.0,
      "data": { 
        // Se finance: description, amount (numbers), type (expense/income), category, date (ISO)
        // Se event: title, description, start_time (ISO), end_time (ISO)
      },
      "reply": "Uma resposta curta em português confirmando ou perguntando algo"
    }

    MENSAGEM DO USUÁRIO: "${text}"`;

    const result = await model.generateContent(prompt);
    const rawResponse = result.response.text();

    // Debug log the raw AI response
    await supabase.from("system_logs").insert([{
      event_type: "ai_raw_response",
      payload: { raw: rawResponse, text }
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
    return { type: "unknown", confidence: 0, data: {}, reply: "Tive um lapso de memória! Pode repetir?" };
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
