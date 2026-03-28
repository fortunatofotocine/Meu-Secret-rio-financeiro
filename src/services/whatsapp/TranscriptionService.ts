import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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
        `Sua tarefa é transcrever este áudio do WhatsApp para um sistema financeiro.
         REGRAS CRÍTICAS:
         1. Transcreva números e valores monetários como números (Ex: "cinquenta e dois reais" -> "52 reais").
         2. Transcreva datas e períodos claramente (Ex: "ontem", "semana passada", "dia dez").
         3. Mantenha a fidelidade total às palavras ditas, mas normalize os números.
         4. Retorne apenas o texto transcrito, sem introduções ou explicações.`
      ]);

      const text = result.response.text().trim();
      return text;
    } catch (err) {
      console.error("Erro na transcrição via Gemini:", err);
      throw new Error("Erro ao transcrever áudio.");
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
