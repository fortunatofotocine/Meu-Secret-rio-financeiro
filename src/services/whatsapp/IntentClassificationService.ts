import { GoogleGenerativeAI } from "@google/generative-ai";
import { IntentResult, Intent } from "./types.js";
import { supabase } from "../../lib/supabaseServer.js";
import * as dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }, { apiVersion: "v1" });

export class IntentClassificationService {
  /**
   * Unified logic for BR/US decimal parsing [parser-v4.1]
   */
  static parseBrazilianValue(amountRaw: string): number {
    console.log(`[parser-v4.1] parseBrazilianValue input: "${amountRaw}"`);
    let clean = amountRaw;
    
    // 1. Handle mixed separators (1.500,00 or 1,500.00)
    if (clean.includes(',') && clean.includes('.')) {
      if (clean.lastIndexOf(',') > clean.lastIndexOf('.')) {
        // BR Format: 1.500,00 -> 1500.00
        clean = clean.replace(/\./g, '').replace(',', '.');
      } else {
        // US Format: 1,500.00 -> 1500.00
        clean = clean.replace(/,/g, '');
      }
    } else if (clean.includes(',')) {
      // Pure BR Format: 15,70 -> 15.70
      clean = clean.replace(',', '.');
    }
    
    const finalValue = parseFloat(clean);
    console.log(`[parser-v4.1] parseBrazilianValue output: ${finalValue}`);
    return finalValue;
  }

  /**
   * Classifies the intent and entities with a strict JSON contract.
   */
  static async classify(text: string): Promise<IntentResult> {
    const rawText = text.toLowerCase();
    const cleanText = rawText.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    console.log(`[parser-v4.1] raw_classification_input: "${text}"`);

    // 1. Smart Fallbacks (High Confidence / Quota Resilience)
    
    // --- LEMBRETES DIRETOS ---
    const reminderTriggers = ["me lembra", "me avisa", "lembra eu", "avisa eu", "anota lembrete", "criar lembrete"];
    if (reminderTriggers.some(t => cleanText.includes(t)) || (cleanText.startsWith("lembra") && cleanText.length < 60)) {
      return { 
        intent: "registrar_lembrete", 
        confidence: 0.99, 
        entities: { description: rawText.replace(/zlai|zelai|zela|zelá/gi, "").trim() } 
      };
    }
    
    // --- RESUMO SEMANAL ---
    if (cleanText.includes("resumo") || (cleanText.includes("como foi") && cleanText.includes("semana"))) {
      return { intent: "consultar_resumo_semana", confidence: 0.95, entities: {} };
    }

    // --- PAGAMENTOS DIRETOS ---
    if (cleanText.includes("paguei") || cleanText.includes("marcar como pago") || cleanText.includes("conta paga")) {
      const desc = rawText.replace(/\b(zlai|zelai|zela|zelá|zlâ|zé lá|ze la|zila|zelly|zeli|zé|ze|ai|oi|ola|olá|anota|registra|por\s+favor|reais|paguei|a|o|conta|como|pago|marcar|esta|ja|eu|me|meu|minha)\b/gi, "").replace(/[,.-]/g, "").trim();
      if (desc.length > 2) {
        return { 
          intent: "marcar_conta_paga", 
          confidence: 0.95, 
          entities: { description: desc } 
        };
      }
    }
 
    // --- TRANSAÇÕES RÁPIDAS (EX: "GASTEI 50...") ---
    const amountMatch = cleanText.match(/(?:gastei|recebi|paguei|vendi|ganhei|foi|gastamos)\s*(?:r\$?\s?)?\s*(\d+(?:[.,]\d+)*)/i);
    if (amountMatch) {
        console.log(`[parser-v4.1] extracted_amount: "${amountMatch[1]}"`);
        const intent = (cleanText.includes("recebi") || cleanText.includes("ganhei") || cleanText.includes("vendi")) ? "registrar_receita" : "registrar_gasto";
        const amount = this.parseBrazilianValue(amountMatch[1]);

        const description = rawText.replace(amountMatch[0], "")
            .replace(/\b(zlai|zelai|zela|zelá|zlâ|zé lá|ze la|zila|zelly|zeli|zé|ze|no|na|com|de|da|do|um|uma|reais|ai|oi|ola|olá|anota|registra|por\s+favor|eu|me|meu|minha)\b/gi, "")
            .replace(/[,.-]/g, "")
            .trim();
        
        if (!isNaN(amount) && description.length > 2) {
            return {
                intent,
                confidence: 0.9,
                entities: { amount, description: description.charAt(0).toUpperCase() + description.slice(1) }
            };
        }
    }

    // --- ATIVAÇÃO DE CONTA ---
    if (cleanText.includes("quero ativar minha conta")) {
      return { intent: "ativar_conta", confidence: 1.0, entities: {} };
    }

    // --- CONFIRMAÇÃO / CANCELAMENTO ---
    if (cleanText === "sim" || cleanText === "confirmar" || cleanText === "pode marcar" || cleanText === "isso" || cleanText === "ok" || cleanText === "pode") {
      return { intent: "confirmar", confidence: 1.0, entities: {} };
    }
    if (cleanText === "nao" || cleanText === "cancelar" || cleanText === "para" || cleanText === "esquece") {
      return { intent: "cancelar", confidence: 1.0, entities: {} };
    }

    // 2. LLM Intent Classification
    try {
      const now = new Date();
      const dateContext = `Hoje é dia ${now.toLocaleDateString('pt-BR')}.`;

      const prompt = `
Você é o motor de classificação do assistente financeiro ZLAI. Retorne JSON puro.
${dateContext}
Intenções: registrar_gasto, registrar_receita, registrar_evento, ajuda, fallback.
Texto: "${text}"
`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      let responseText = response.text().trim();
      
      if (responseText.includes("```")) {
        responseText = responseText.replace(/```json|```/g, "").trim();
      }
      
      const parsed = JSON.parse(responseText);
      
      const intentResult: IntentResult = {
        intent: (parsed.intent || "fallback") as Intent,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
        entities: {
          amount: typeof parsed.entities?.amount === 'number' ? parsed.entities.amount : undefined,
          description: parsed.entities?.description || parsed.entities?.event_title || undefined
        }
      };

      await supabase.from("system_logs").insert([{
        event_type: "whatsapp_intent_classification",
        payload: { text, intent: intentResult.intent, confidence: intentResult.confidence, entities: intentResult.entities }
      }]);

      return intentResult;
    } catch (err) {
      console.error("[IntentClassification] Error:", err);
      return { intent: "fallback", confidence: 0, entities: {} };
    }
  }
}
