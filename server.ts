import express from "express";
import * as dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
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
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// --- API Routes ---

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Secretário Financeiro API is running" });
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
  console.log(JSON.stringify(req.body, null, 2));

  // Responder imediatamente com 200 OK e JSON conforme solicitado
  res.status(200).json({ status: "success" });

  const body = req.body;

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

        // Processamento assíncrono
        processWhatsAppMessage(from, msgBody, msgId, body).catch(err => {
          console.error("Error processing message:", err);
        });
      }
    } catch (err) {
      console.error("Error parsing webhook body:", err);
    }
  }
});

async function processWhatsAppMessage(from: string, msgBody: string, msgId: string, rawData: any) {
  // Log message to Supabase
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
    console.error("Erro ao logar mensagem no Supabase:", logError);
    return;
  }

  // Interpret message using AI
  if (msgBody) {
    try {
      const interpretation = await interpretMessage(msgBody);
      console.log("Interpretação da IA:", interpretation);

      if (interpretation.confidence > 0.7) {
        if (interpretation.type === "finance") {
          await supabase.from("transactions").insert([
            {
              description: interpretation.data.description,
              amount: interpretation.data.amount,
              type: interpretation.data.type,
              category: interpretation.data.category,
              date: interpretation.data.date || new Date().toISOString(),
              whatsapp_message_id: logData?.[0]?.id
            }
          ]);
          console.log("Transação salva automaticamente.");
        } else if (interpretation.type === "event") {
          await supabase.from("events").insert([
            {
              title: interpretation.data.title,
              description: interpretation.data.description,
              start_time: interpretation.data.start_time,
              end_time: interpretation.data.end_time,
              whatsapp_message_id: logData?.[0]?.id
            }
          ]);
          console.log("Evento salvo automaticamente.");
        }
      } else {
        // Baixa confiança - marcar para revisão
        await supabase.from("whatsapp_messages").update({
          status: "pending_confirmation",
          interpretation: interpretation
        }).eq("id", logData?.[0]?.id);
        console.log("Mensagem marcada para confirmação (baixa confiança).");
      }
    } catch (error) {
      console.error("Erro na interpretação da IA:", error);
      await supabase.from("whatsapp_messages").update({
        status: "error"
      }).eq("id", logData?.[0]?.id);
    }
  }
}

// Manual Confirmation Endpoint
app.post("/api/messages/confirm", async (req, res) => {
  const { messageId, interpretation } = req.body;

  if (!messageId || !interpretation) {
    return res.status(400).json({ error: "Missing parameters" });
  }

  try {
    if (interpretation.type === "finance") {
      await supabase.from("transactions").insert([
        {
          description: interpretation.data.description,
          amount: interpretation.data.amount,
          type: interpretation.data.type,
          category: interpretation.data.category,
          date: interpretation.data.date || new Date().toISOString(),
          whatsapp_message_id: messageId
        }
      ]);
    } else if (interpretation.type === "event") {
      await supabase.from("events").insert([
        {
          title: interpretation.data.title,
          description: interpretation.data.description,
          start_time: interpretation.data.start_time,
          end_time: interpretation.data.end_time,
          whatsapp_message_id: messageId
        }
      ]);
    }

    await supabase.from("whatsapp_messages").update({
      status: "processed"
    }).eq("id", messageId);

    res.json({ success: true });
  } catch (error) {
    console.error("Error confirming message:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

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
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING },
          confidence: { type: Type.NUMBER },
          data: { type: Type.OBJECT }
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
