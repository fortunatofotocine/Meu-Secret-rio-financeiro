import { GoogleGenerativeAI } from "@google/generative-ai";
import { IntentResult, Intent } from "./types";
import * as dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export class IntentClassificationService {
  /**
   * Classifies the intent and entities with a strict JSON contract.
   */
  static async classify(text: string): Promise<IntentResult> {
    const prompt = `
Sua missão é extrair a intenção e entidades de uma mensagem para o sistema financeiro ZLAI.
Analise a mensagem e retorne APENAS um JSON válido.

### CONTRATO DE RETORNO (OBRIGATÓRIO):
{
  "intent": "string",
  "confidence": number,
  "entities": {
    "amount": number | null,
    "category": "string" | null,
    "description": "string" | null,
    "date_reference": "string" | null
  }
}

### LISTA DE INTENÇÕES:
- registrar_gasto: Despesas, pagamentos, saídas.
- registrar_receita: Ganhos, salários, entradas.
- consultar_gastos_periodo: Perguntas sobre quanto gastou.
- consultar_receitas_periodo: Perguntas sobre quanto recebeu.
- confirmar: Quando o usuário diz "sim", "pode", "está certo", "confirmado", "ok".
- cancelar: Quando o usuário diz "não", "para", "cancela", "errado".
- [x] solicitar_resumo_financeiro: Quando o usuário pede o "resumo da semana", "balanço semanal", "como foi minha semana", "relatório", "balanço".
- [x] listar_contas_hoje: "o que eu preciso pagar hoje?", "contas de hoje", "o que vence hoje".
- [x] ajuda: Pedido de instruções ou "como funciona".
- onboarding: Pergunta sobre "quem é você" ou "como funciona".
- fallback: Mensagens sem sentido financeiro ou fora do escopo.

### REGRAS DE ENTIDADES:
- amount: Apenas o número puro (Ex: "50 reais" -> 50).
- category: Uma palavra curta que defina o gasto/receita.
- date_reference: "hoje", "ontem", "amanhã", "semana passada" ou data YYYY-MM-DD.
- description: O que foi o gasto/receita.

### MENSAGEM DO USUÁRIO:
"${text}"
`;

    try {
      const result = await model.generateContent(prompt);
      let responseText = result.response.text().trim();
      
      // Limpeza de Markdown se necessário
      if (responseText.includes("```")) {
        responseText = responseText.replace(/```json|```/g, "").trim();
      }
      
      const parsed = JSON.parse(responseText);
      
      // Garantia de tipos
      return {
        intent: (parsed.intent || "fallback") as Intent,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
        entities: {
          amount: typeof parsed.entities?.amount === 'number' ? parsed.entities.amount : undefined,
          category: parsed.entities?.category || undefined,
          description: parsed.entities?.description || undefined,
          date_reference: parsed.entities?.date_reference || undefined
        }
      };
    } catch (err) {
      console.error("[IntentClassification] Erro ao parsear JSON do Gemini:", err);
      return {
        intent: "fallback",
        confidence: 0,
        entities: {}
      };
    }
  }
}
