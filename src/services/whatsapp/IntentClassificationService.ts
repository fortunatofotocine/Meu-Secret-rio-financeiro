import { GoogleGenerativeAI } from "@google/generative-ai";
import { IntentResult, Intent } from "./types.js";
import { supabase } from "../../lib/supabaseServer.js";
import * as dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }, { apiVersion: "v1" });

export class IntentClassificationService {
  /**
   * Classifies the intent and entities with a strict JSON contract.
   */
  static async classify(text: string): Promise<IntentResult> {
    const rawText = text.toLowerCase();
    
    // Normalize accents for smart checks (e.g., "está" -> "esta")
    const cleanText = rawText.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // 1. Smart Fallbacks (High Confidence / Quota Resilience)
    
    // --- LEMBRETES DIRETOS (Forçar intenção correta) ---
    const reminderTriggers = ["me lembra", "me avisa", "lembra eu", "avisa eu", "anota lembrete", "criar lembrete"];
    if (reminderTriggers.some(t => cleanText.includes(t)) || (cleanText.startsWith("lembra") && cleanText.length < 60)) {
      return { 
        intent: "registrar_lembrete", 
        confidence: 0.99, 
        entities: { description: rawText.replace(/zlai|zelai|zela|zelá/gi, "").trim() } 
      };
    }
    
    // --- RESUMO SEMANAL ---
    if (cleanText.includes("resumo") || 
       (cleanText.includes("como foi") && cleanText.includes("semana")) ||
       (cleanText.includes("quanto") && (cleanText.includes("gastei") || cleanText.includes("recebi")) && cleanText.includes("semana"))) {
      return { intent: "consultar_resumo_semana", confidence: 0.95, entities: {} };
    }

    // --- CONTAS PENDENTES ---
    if (cleanText.includes("conta") || cleanText.includes("pendente") || cleanText.includes("pagar") || cleanText.includes("vence")) {
      if (cleanText.includes("quais") || cleanText.includes("lista") || cleanText.includes("qual") || cleanText.includes("o que")) {
        if (!cleanText.includes("hoje") && !cleanText.includes("amanha") && !cleanText.includes("agora")) {
          return { intent: "listar_contas_pendentes", confidence: 0.95, entities: {} };
        }
      }
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
    // Matches: 50 | 50,00 | 50.00 | 1.500,00 | 1,500.00 | R$ 15,70
    console.log(`[parser-v4] raw_text: "${text}"`);
    const amountMatch = cleanText.match(/(?:gastei|recebi|paguei|vendi|ganhei|foi|gastamos)\s*(?:r\$?\s?)?\s*(\d+(?:[.,]\d+)*)/i);
    
    if (amountMatch) {
        console.log(`[parser-v4] extracted_amount: "${amountMatch[1]}"`);
        const intent = (cleanText.includes("recebi") || cleanText.includes("ganhei") || cleanText.includes("vendi")) ? "registrar_receita" : "registrar_gasto";
        
        let amountRaw = amountMatch[1];
        
        // ROBUST BR PARSING LOGIC [parser-v4]
        // 1. Remove any thousand separators (dots followed by 3 digits BEFORE a comma)
        // 2. Identify if it's BR format (comma as decimal) or US (dot as decimal)
        
        if (amountRaw.includes(',') && amountRaw.includes('.')) {
          if (amountRaw.lastIndexOf(',') > amountRaw.lastIndexOf('.')) {
            // BR Format: 1.500,00 -> 1500.00
            amountRaw = amountRaw.replace(/\./g, '').replace(',', '.');
          } else {
            // US Format: 1,500.00 -> 1500.00
            amountRaw = amountRaw.replace(/,/g, '');
          }
        } else if (amountRaw.includes(',')) {
          // Pure BR Format: 15,70 -> 15.70
          amountRaw = amountRaw.replace(',', '.');
        }

        const amount = parseFloat(amountRaw);
        console.log(`[parser-v4] normalized_amount: ${amount}`);

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

    // --- ATIVAÇÃO DE CONTA (SIMPLIFICADA) ---
    if (cleanText.includes("quero ativar minha conta")) {
      return { 
        intent: "ativar_conta", 
        confidence: 1.0, 
        entities: {} 
      };
    }

    // --- CONFIRMAÇÃO / CANCELAMENTO ---
    if (cleanText === "sim" || cleanText === "confirmar" || cleanText === "pode marcar" || cleanText === "isso" || cleanText === "ok" || cleanText === "pode" || cleanText === "claro") {
      return { intent: "confirmar", confidence: 1.0, entities: {} };
    }
    if (cleanText === "nao" || cleanText === "cancelar" || cleanText === "para" || cleanText === "esquece" || cleanText === "nao anota") {
      return { intent: "cancelar", confidence: 1.0, entities: {} };
    }

    // 2. LLM Intent Classification (Semantic Families)
    try {
      const now = new Date();
      // Only provide DATE context. DON'T provide time + timezone to avoid LLM "helping" with calculations.
      const dateContext = `Hoje é dia ${now.toLocaleDateString('pt-BR')}.`;

      const prompt = `
Você é o motor de classificação do assistente financeiro ZLAI.
Sua tarefa é classificar a intenção do usuário e extrair entidades financeiras ou de agenda.

${dateContext}

### FAMÍLIAS DE INTENÇÃO:
- registrar_gasto (FAMÍLIA: SAÍDAS): Qualquer registro de dinheiro que saiu ou vai sair.
  Ex: "gastei 50 no mercado", "paguei 30 na padaria", "comprei um boticário", "foi 20 de remédio".
- registrar_receita (FAMÍLIA: ENTRADAS): Qualquer registro de dinheiro que entrou.
  Ex: "recebi 100 da cliente", "entrou 300 do joão", "ganhei 80 hoje".
- registrar_evento (FAMÍLIA: AGENDA): Marcar compromissos fixos, reuniões ou tarefas em calendário.
  Ex: "marque reunião dia 29 às 19h", "agenda treino hoje as 18".
- registrar_lembrete: Criar lembretes rápidos ou avisos pontuais.
  Ex: "me lembra amanhã às 19h de comprar pão", "me lembra daqui 30 minutos de tirar o feijão", "me lembra hoje às 22h de pagar a conta".
- cancelar_lembrete: Interromper um lembrete agendado. Ex: "cancela meu último lembrete", "esquece o lembrete".
- listar_lembretes: Ver o que está programado. Ex: "quais meus lembretes?", "meus lembretes".
- ajuda: "como funciona", "o que você faz".
- ativar_conta: Quando o usuário manda o código de ativação. Ex: "meu código é ZL84K2".
- fallback: Mensagens fora do escopo financeiro/agenda.

### REGRAS DE ENTIDADES:
- amount: Apenas o número puro (ex: 50.0). Se não houver valor claro, deixe null.
- description: Descrição curta e LIMPA do item. REMOVA ABSOLUTAMENTE qualquer menção a "Zlai", "Zelá", "Zé", "Aí", "Oi" ou saudações. Se o usuário disse "Zlai, gastei 10 na padaria", a descrição deve ser apenas "Padaria".
- event_title: Título do evento LIMPO. REMOVA o nome do assistente.
- date_reference: DATA mencionada em formato YYYY-MM-DD.
- time: HORÁRIO mencionado em formato HH:mm.
- category: Categoria sugerida (ex: "Alimentação", "Saúde", "Trabalho").

### RESPOSTA:
Retorne APENAS um JSON puro no formato:
{
  "intent": string,
  "confidence": number,
  "entities": {
    "amount": number | null,
    "description": string | null,
    "event_title": string | null,
    "date_reference": string | null,
    "time": string | null,
    "category": string | null
  }
}

Texto do usuário: "${text}"
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
          category: parsed.entities?.category || undefined,
          description: parsed.entities?.description || parsed.entities?.event_title || undefined,
          date_reference: parsed.entities?.date_reference || undefined,
          time: parsed.entities?.time || undefined,
          event_title: parsed.entities?.event_title || undefined
        }
      };

      // Log results to Supabase for debugging
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
