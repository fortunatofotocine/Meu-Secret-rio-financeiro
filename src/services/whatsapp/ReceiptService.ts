import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase } from "../../lib/supabaseServer.js";
import { IntentResult } from "./types.js";
import * as dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "models/gemini-2.5-flash" }, { apiVersion: "v1" });

export class ReceiptService {
  /**
   * Processes a WhatsApp image: download -> OCR -> store.
   */
  static async process(mediaId: string, userId: string): Promise<IntentResult | null> {
    const log = async (stage: string, payload: any = {}) => {
      await supabase.from("system_logs").insert([{
        event_type: "receipt_process_debug",
        payload: { stage, userId, mediaId, ...payload }
      }]);
    };

    try {
      await log("Start", { mediaId });
      
      // 1. Download from WhatsApp
      const media = await this.downloadWhatsAppMedia(mediaId, log);
      if (!media) {
          await log("Download Failed (null)");
          return null;
      }
      await log("Download Success", { mimeType: media.mimeType, size: media.data.length });

      // 2. OCR with Gemini Vision
      const prompt = `
        Analise esta imagem de um comprovante ou recibo de pagamento.
        Extraia os seguintes dados em formato JSON puro:
        {
          "description": "Uma breve descrição do que foi comprado (ex: Lanche, Supermercado, Gasolina)",
          "amount": 0.00,
          "category": "A categoria mais provável (ex: Alimentação, Transporte, Lazer, Saúde)",
          "date": "A data no formato YYYY-MM-DD (se não encontrar, ignore)"
        }
        
        REGRAS:
        - O valor (amount) deve ser um número positivo.
        - Se não tiver certeza da categoria, use 'Outros'.
        - Retorne APENAS o JSON, sem markdown ou explicações.
      `;

      await log("AI Start", { model: "gemini-1.5-flash" });
      const result = await model.generateContent([
        {
          inlineData: {
            data: media.data,
            mimeType: media.mimeType
          }
        },
        prompt
      ]);

      const responseText = result.response.text().trim();
      await log("AI Complete", { responseText });

      // Robust JSON extraction
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
          await log("JSON Extraction Failed", { responseText });
          throw new Error("Não foi possível encontrar um JSON válido na resposta da IA.");
      }

      const extraction = JSON.parse(jsonMatch[0]);
      await log("JSON Success", { extraction });

      // 3. Upload to Supabase Storage
      await log("Upload Start");
      const fileName = `${userId}/${Date.now()}.${media.mimeType.split('/')[1]}`;
      const buffer = Buffer.from(media.data, 'base64');
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(fileName, buffer, {
          contentType: media.mimeType,
          upsert: true
        });

      if (uploadError) {
        await log("Upload Error", { error: uploadError });
      }

      const { data: { publicUrl } } = supabase.storage
        .from('receipts')
        .getPublicUrl(fileName);

      const receiptUrl = publicUrl;
      await log("Process Complete", { receiptUrl });

      // 4. Transform to IntentResult
      return {
        intent: "registrar_gasto",
        entities: {
          description: extraction.description || "Gasto via comprovante",
          amount: parseFloat(extraction.amount),
          category: extraction.category || "Outros",
          date: extraction.date,
          receipt_url: receiptUrl
        },
        confidence: 0.95
      };
    } catch (err: any) {
      console.error("[Receipt] Extraction error:", err);
      await log("General Error", { error: err.message || String(err) });
      return null;
    }
  }

  private static async downloadWhatsAppMedia(mediaId: string, log: Function): Promise<{ data: string, mimeType: string } | undefined> {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    if (!token) {
        await log("Download Error", { detail: "Missing token" });
        return undefined;
    }

    try {
      await log("Fetch Meta URL Start");
      const urlResponse = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const mediaInfo = await urlResponse.json();
      
      if (!mediaInfo.url) {
          await log("Fetch Meta URL Failed", { mediaInfo });
          return undefined;
      }
      await log("Fetch Meta URL Success", { url: "HIDDEN_FOR_SECURITY" });

      await log("Fetch Binary Start");
      const mediaResponse = await fetch(mediaInfo.url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const arrayBuffer = await mediaResponse.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      await log("Fetch Binary Success", { length: buffer.length });

      return {
        data: buffer.toString("base64"),
        mimeType: mediaInfo.mime_type || "image/jpeg"
      };
    } catch (err: any) {
      await log("Download Error", { error: err.message || String(err) });
      return undefined;
    }
  }
}
