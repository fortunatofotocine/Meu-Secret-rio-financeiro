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
      await supabase.from("system_logs").insert([{
        event_type: "db_error_messages",
        payload: { error: logError, msgId }
      }]);
      console.error("Erro ao logar mensagem no Supabase:", logError);
      return;
    }

    const internalMessageId = logData?.[0]?.id;

    // 3. Interpret message using AI
    if (msgBody) {
      const interpretation = await interpretMessage(msgBody);

      await supabase.from("system_logs").insert([{
        event_type: "ai_interpretation",
        payload: { interpretation, msgId }
      }]);

      let responseText = "Entendido!";

      if (interpretation.confidence > 0.7) {
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
            await supabase.from("system_logs").insert([{
              event_type: "db_error_transaction",
              payload: { error: transError, msgId }
            }]);
          } else {
            responseText = `✅ *Lançamento efetuado!*\n📝 ${interpretation.data.description}\n💰 R$ ${interpretation.data.amount}\n📂 ${interpretation.data.category}`;
          }
        } else if (interpretation.type === "event") {
          const { error: eventError } = await supabase.from("events").insert([
            {
              title: interpretation.data.title,
              description: interpretation.data.description,
              start_time: interpretation.data.start_time,
              end_time: interpretation.data.end_time,
              whatsapp_message_id: internalMessageId
            }
          ]);

          if (eventError) {
            await supabase.from("system_logs").insert([{
              event_type: "db_error_event",
              payload: { error: eventError, msgId }
            }]);
          } else {
            responseText = `📅 *Compromisso agendado!*\n📌 ${interpretation.data.title}\n⏰ ${new Date(interpretation.data.start_time).toLocaleString('pt-BR')}`;
          }
        }
      } else {
        await supabase.from("whatsapp_messages").update({
          status: "pending_confirmation",
          interpretation: interpretation
        }).eq("id", internalMessageId);
        responseText = "🤔 Fiquei na dúvida sobre esse lançamento. Pode conferir no painel?";
      }

      // 4. Send reply back to WhatsApp
      await sendWhatsAppMessage(from, responseText, phone_number_id);
    }
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
async function interpretMessage(text: string) {
  const modelName = "gemini-1.5-flash";
  const model = genAI.getGenerativeModel({ model: modelName });

  const prompt = `Você é um secretário financeiro de alta precisão. Sua tarefa é extrair dados de uma mensagem em português.
  Mensagem: "${text}"
  
  REGRAS:
  1. Identifique se é um lançamento FINANCEIRO (gastos, ganhos) ou um COMPROMISSO (reunião, consulta).
  2. Para FINANCEIRO:
     - tipo: "expense" (saída/gasto) ou "income" (entrada/ganho).
     - valor: extraia apenas o número.
     - categoria: use categorias padrão (Alimentação, Transporte, Lazer, Saúde, Salário, Investimentos, Aluguel, Outros).
     - descrição: breve descrição.
  3. Para COMPROMISSO:
     - título: Nome curto.
     - data_inicio: ISO string (assume hoje se não houver data, ou resolva referências como "amanhã").
  4. Se não tiver certeza, coloque confidence < 0.7.
  
  Retorne no formato JSON com:
  {
    "type": "finance" | "event" | "unknown",
    "confidence": 0.0 a 1.0,
    "data": { ... }
  }`;

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          type: { type: SchemaType.STRING },
          confidence: { type: SchemaType.NUMBER },
          data: { type: SchemaType.OBJECT }
        },
        required: ["type", "confidence", "data"]
      }
    }
  });

  return JSON.parse(result.response.text());
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
