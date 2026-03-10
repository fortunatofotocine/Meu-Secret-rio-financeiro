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
      const currentDateTime = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

      try {
        // High-level Intent hint for the AI
        if (lowerMsg.includes("gastei") || lowerMsg.includes("paguei") || lowerMsg.includes("comprei") || lowerMsg.includes("recebi")) {
          intentDetected = "finance";
        } else if (lowerMsg.includes("agendar") || lowerMsg.includes("agenda") || lowerMsg.includes("marcar") || lowerMsg.includes("reunião") || lowerMsg.includes("lembrete")) {
          intentDetected = "event";
        }

        const interpretation = await interpretMessage(msgBody, intentDetected, currentDateTime);

        await supabase.from("system_logs").insert([{
          event_type: "ai_interpretation",
          payload: { interpretation, msgId, currentDateTime }
        }]);

        if (interpretation.confidence > 0.45) { // Lowered slightly to trust the improved AI prompt
          if (interpretation.type === "finance") {
            const { error: transError } = await supabase.from("transactions").insert([
              {
                description: interpretation.data.description,
                amount: interpretation.data.amount,
                type: interpretation.data.type,
                category: interpretation.data.category || "Outros",
                date: interpretation.data.date || new Date().toISOString(),
                whatsapp_message_id: internalMessageId
              }
            ]);

            if (transError) {
              await supabase.from("system_logs").insert([{ event_type: "db_error_transaction", payload: { error: transError, msgId } }]);
              await supabase.from("whatsapp_messages").update({ status: "error" }).eq("id", internalMessageId);
              responseText = "❌ Erro ao salvar o registro financeiro.";
            } else {
              await supabase.from("whatsapp_messages").update({ status: "processed" }).eq("id", internalMessageId);
              responseText = `✅ *Lançamento salvo!* \n💰 R$ ${interpretation.data.amount} - ${interpretation.data.description}`;
            }
          } else if (interpretation.type === "event") {
            const { error: eventError } = await supabase.from("events").insert([
              {
                title: interpretation.data.title,
                description: interpretation.data.description || msgBody,
                start_time: interpretation.data.start_time,
                end_time: interpretation.data.end_time || new Date(new Date(interpretation.data.start_time).getTime() + 60 * 60 * 1000).toISOString(),
                whatsapp_message_id: internalMessageId
              }
            ]);

            if (eventError) {
              await supabase.from("system_logs").insert([{ event_type: "db_error_event", payload: { error: eventError, msgId } }]);
              await supabase.from("whatsapp_messages").update({ status: "error" }).eq("id", internalMessageId);
              responseText = "❌ Erro ao agendar seu compromisso.";
            } else {
              await supabase.from("whatsapp_messages").update({ status: "processed" }).eq("id", internalMessageId);
              const dataFormatada = new Date(interpretation.data.start_time).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
              responseText = `📅 *Agenda: ${interpretation.data.title} às ${dataFormatada}*`;
            }
          } else {
            // interpretation type is unknown
            await supabase.from("whatsapp_messages").update({ status: "pending_confirmation", interpretation }).eq("id", internalMessageId);
            responseText = interpretation.reply || "🤔 Não entendi se isso é um gasto ou compromisso. Pode detalhar?";
          }
        } else {
          await supabase.from("whatsapp_messages").update({ status: "pending_confirmation", interpretation }).eq("id", internalMessageId);
          responseText = interpretation.reply || "🤔 Fiquei na dúvida. Foi um gasto ou algo na agenda?";
        }
      } catch (procErr: any) {
        console.error("Erro no processamento:", procErr);
        await supabase.from("whatsapp_messages").update({ status: "error" }).eq("id", internalMessageId);
        responseText = "❌ Tive um problema técnico. Pode tentar de novo?";
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
async function interpretMessage(text: string, suggestedIntent: string = "unknown", currentDateTime: string) {
  const modelName = "gemini-2.0-flash-lite";
  console.log(`[Unlimited AI] Interpretando: ${text} | Sugestão: ${suggestedIntent} | Agora: ${currentDateTime}`);

  // 1. FAST REGEX - (Now with better Brazilian Portugeuse support)
  const financeMatch = text.match(/(?:gastei|paguei|recebi|comprei)\s+(?:r\$\s*)?(\d+(?:[.,]\d+)?)\s*(?:reais)?(?:\s+(?:hoje|agora|já))?\s*(?:com|de|em|no|na|pelo|pela|num|numa)\s+(.+)/i);
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
