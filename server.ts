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

    // 3. Simple Intent Classifier & Parser
    let responseText = "Não entendi sua mensagem. Você pode registrar gastos (ex: 'Gastei 15 reais com lanche') ou marcar compromissos (ex: 'Agendar reunião amanhã às 15h').";
    let intentDetected = "unknown";

    if (msgBody) {
      const lowerMsg = msgBody.toLowerCase();

      // Intent: FINANCE
      if (lowerMsg.includes("gastei") || lowerMsg.includes("paguei") || lowerMsg.includes("comprei") || lowerMsg.includes("recebi")) {
        intentDetected = "finance";
        console.log(`[Intent] FINANCE detectado por palavra-chave para: ${msgBody}`);
      }
      // Intent: AGENDA
      else if (lowerMsg.includes("agendar") || lowerMsg.includes("agenda") || lowerMsg.includes("marcar") || lowerMsg.includes("reunião") || lowerMsg.includes("lembrete")) {
        intentDetected = "event";
        console.log(`[Intent] AGENDA detectado por palavra-chave para: ${msgBody}`);
      }

      try {
        const interpretation = await interpretMessage(msgBody, intentDetected);

        await supabase.from("system_logs").insert([{
          event_type: "ai_interpretation",
          payload: { interpretation, msgId }
        }]);

        if (interpretation.confidence > 0.6) {
          if (interpretation.type === "finance") {
            const { error: transError } = await supabase.from("transactions").insert([
              {
                description: interpretation.data.description,
                amount: interpretation.data.amount,
                type: interpretation.data.type,
                category: interpretation.data.category,
                date: interpretation.data.date || new Date().toISOString(),
                whatsapp_message_id: internalMessageId
              }
            ]);

            if (transError) {
              await supabase.from("system_logs").insert([{ event_type: "db_error_transaction", payload: { error: transError, msgId } }]);
              await supabase.from("whatsapp_messages").update({ status: "error" }).eq("id", internalMessageId);
              responseText = "❌ Erro ao salvar o gasto no banco de dados.";
            } else {
              await supabase.from("whatsapp_messages").update({ status: "processed" }).eq("id", internalMessageId);
              responseText = `✅ *Registro salvo: R$ ${interpretation.data.amount} - ${interpretation.data.description}*`;
            }
          } else if (interpretation.type === "event") {
            const { error: eventError } = await supabase.from("events").insert([
              {
                title: interpretation.data.title,
                description: interpretation.data.description,
                start_time: interpretation.data.start_time,
                end_time: interpretation.data.end_time || new Date(new Date(interpretation.data.start_time).getTime() + 60 * 60 * 1000).toISOString(),
                whatsapp_message_id: internalMessageId
              }
            ]);

            if (eventError) {
              await supabase.from("system_logs").insert([{ event_type: "db_error_event", payload: { error: eventError, msgId } }]);
              await supabase.from("whatsapp_messages").update({ status: "error" }).eq("id", internalMessageId);
              responseText = "❌ Erro ao agendar evento no banco de dados.";
            } else {
              await supabase.from("whatsapp_messages").update({ status: "processed" }).eq("id", internalMessageId);
              const dataFormatada = new Date(interpretation.data.start_time).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
              responseText = `📅 *Evento agendado: ${interpretation.data.title} - ${dataFormatada}*`;
            }
          }
        } else if (intentDetected !== "unknown") {
          responseText = "🤔 Entendi que você quer " + (intentDetected === "finance" ? "registrar um gasto" : "marcar um compromisso") + ", mas não consegui extrair todos os detalhes. Pode repetir de forma simples?";
        }
      } catch (procErr: any) {
        console.error("Erro no processamento:", procErr);
        await supabase.from("whatsapp_messages").update({ status: "error" }).eq("id", internalMessageId);
        responseText = "❌ Ocorreu um erro técnico ao processar sua mensagem. Tente novamente mais tarde.";
      }
    }

    // 4. Send reply back to WhatsApp (ALWAYS called)
    await sendWhatsAppMessage(from, responseText, phone_number_id);
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

// AI Interpretation Logic
async function interpretMessage(text: string, hintedType: string = "unknown") {
  const modelName = "gemini-2.0-flash-lite";
  console.log(`Using model: ${modelName} to interpret: ${text} | Hint: ${hintedType}`);

  // REGEX FALLBACKS FIRST (to save quota and be instant)

  // 1. Finance Regex: "Gastei 10 reais com café"
  const financeMatch = text.match(/(?:gastei|paguei|recebi|comprei)\s+(?:r\$\s*)?(\d+(?:[.,]\d+)?)\s+(?:reais\s+)?(?:com|de|em|no)\s+(.+)/i);
  if (financeMatch) {
    const isExpense = !text.toLowerCase().includes("recebi");
    return {
      type: "finance",
      confidence: 0.95,
      data: {
        description: financeMatch[2].trim(),
        amount: parseFloat(financeMatch[1].replace(',', '.')),
        type: isExpense ? "expense" : "income",
        category: "Outros",
        date: new Date().toISOString()
      }
    };
  }

  // 2. Agenda Regex: "Marcar reunião 10/03 as 15:00" or "Marque na agenda 10/03/2026 visita na roça com o vereador às 7h"
  const agendaMatch = text.match(/(?:agendar|marcar|agenda|lembrete)\s*(?:na agenda)?\s*(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s+(.+?)\s+(?:as|às|nos?)\s+(\d{1,2}(?::\d{2})?\s*(?:h|horas?))/i);
  if (agendaMatch) {
    const rawDate = agendaMatch[1];
    const title = agendaMatch[2];
    const rawTime = agendaMatch[3].replace(/[^\d:]/g, '');

    // Simple date normalization
    let [day, month, year] = rawDate.split('/');
    if (!year) year = new Date().getFullYear().toString();
    if (year.length === 2) year = "20" + year;
    const startTimeStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${rawTime.padStart(2, '0')}:00:00`;

    return {
      type: "event",
      confidence: 0.9,
      data: {
        title: title.trim(),
        description: text,
        start_time: startTimeStr,
      }
    };
  }

  // AI FALLBACK
  const model = genAI.getGenerativeModel({ model: modelName });

  try {
    const prompt = `Você é um secretário financeiro e assistente de agenda de alta precisão.
    Sua tarefa é extrair dados da mensagem em português.
    
    Contexto: O usuário quer ${hintedType === 'finance' ? 'registrar um gasto/ganho' : hintedType === 'event' ? 'marcar um compromisso' : 'fazer algo'}.
    Mensagem: "${text}"
    
    REGRAS:
    1. Retorne APENAS um objeto JSON.
    2. Se for FINANCEIRO: type=finance, data possui {description, amount, type (expense/income), category, date}.
    3. Se for COMPROMISSO: type=event, data possui {title, description, start_time (ISO string), end_time (ISO string)}.
    4. Se for "visita na roça 10/03/2026 as 7h", start_time deve ser "2026-03-10T07:00:00Z".
    
    Responda no formato:
    {
      "type": "finance" | "event" | "unknown",
      "confidence": 0.0 a 1.0,
      "data": { ... }
    }`;

    // Note: Removed v1 and responseSchema due to 400 errors in this specific environment
    const result = await model.generateContent(prompt);
    const content = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(content);
  } catch (error: any) {
    console.error("AI Fallback failed:", error.message);
    return { type: "unknown", confidence: 0, data: {} };
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
