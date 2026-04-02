import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "models/gemini-2.5-flash" }, { apiVersion: "v1" });

export class TranscriptionService {
  /**
   * Transcribes WhatsApp audio with high precision for numeric data.
   */
  static async transcribe(mediaId: string): Promise<string> {
    const media = await this.downloadWhatsAppMedia(mediaId);
    if (!media) {
      throw new Error("Falha ao baixar áudio do WhatsApp.");
    }

    try {
      const result = await model.generateContent([
        {
          inlineData: {
            data: media.data,
            mimeType: media.mimeType
          }
        },
        `Sua tarefa é transcrever este áudio do WhatsApp com absoluta fidelidade.
         REGRAS:
         1. Transcreva EXATAMENTE o que foi dito, palavra por palavra.
         2. Não tente normalizar números ou datas; mantenha a forma falada (Ex: "cinquenta reais" se foi o que a pessoa disse).
         3. Não adicione pontuação extra que não seja inferida pelo tom de voz.
         4. Retorne apenas o texto transcrito, puro, sem comentários.`
      ]);

      const text = result.response.text().trim();
      return text;
    } catch (error: any) {
      console.error("[Transcription] Error:", error);
      throw new Error(`Erro ao transcrever áudio: ${error.message || String(error)}`);
    }
  }

  private static async downloadWhatsAppMedia(mediaId: string): Promise<{ data: string, mimeType: string } | undefined> {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    if (!token) {
      console.error("WHATSAPP_ACCESS_TOKEN missing for media download");
      return undefined;
    }

    try {
      const urlResponse = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const mediaInfo = await urlResponse.json();
      if (!mediaInfo.url) return undefined;

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
}
