import { UserResolutionService } from "./UserResolutionService.js";
import { TranscriptionService } from "./TranscriptionService.js";
import { IntentClassificationService } from "./IntentClassificationService.js";
import { FinancialCommandService } from "./FinancialCommandService.js";
import { ResponseComposerService } from "./ResponseComposerService.js";
import { ValidationService } from "./ValidationService.js";
import { ConversationStateService } from "./ConversationStateService.js";
import { WhatsAppMessage, IntentResult } from "./types.js";
import { supabase } from "../../lib/supabaseServer.js";

export class WhatsAppWebhookService {
  /**
   * Orchestrates the ROBUST WhatsApp processing pipeline.
   * Receive -> Resolve User -> (Transcribe) -> Classify -> VALIDATE -> Execute -> LOG -> Reply.
   */
  static async handle(payload: any): Promise<void> {
    const rawMsg = this.parsePayload(payload);
    if (!rawMsg) return;

    console.log(`[WhatsApp] Recebendo mensagem de ${rawMsg.from} (Tipo: ${rawMsg.type})`);

    try {
      // 1. Resolve User & Conversational State
      const user = await UserResolutionService.resolve(rawMsg.from);
      if (!user.isRegistered) {
        await this.sendReply(rawMsg.from, ResponseComposerService.getOnboardingMessage(user), rawMsg.phone_number_id);
        return;
      }
      user.state = await ConversationStateService.get(user.userId);

      // 2. Transcription (if audio)
      let text = rawMsg.text || "";
      if (rawMsg.type === "audio" && rawMsg.mediaId) {
        console.log(`[WhatsApp] Baixando e transcrevendo áudio...`);
        text = await TranscriptionService.transcribe(rawMsg.mediaId);
      }

      if (!text) return;

      // 3. Classification (Strict Intent Contract)
      console.log(`[WhatsApp] Classificando intenção: "${text}"`);
      const classification = await IntentClassificationService.classify(text);

      // 4. Robust Validation Layer
      console.log(`[WhatsApp] Validando classificação (Confidence: ${classification.confidence})...`);
      const validation = ValidationService.validate(classification);

      let finalResponse = "";
      let actionResult = null;

      if (validation.status === "FALLBACK") {
        finalResponse = validation.message || "Desculpe, não entendi.";
      } 
      else if (validation.status === "INCOMPLETE") {
        finalResponse = validation.message || "Faltam informações.";
      } 
      else if (validation.status === "NEEDS_CONFIRMATION") {
        // Handle explicit confirmation intent IF we are already awaiting
        if (classification.intent === "confirmar" || classification.intent === "cancelar") {
          actionResult = await FinancialCommandService.execute(user, classification);
          finalResponse = ResponseComposerService.compose(user, actionResult);
        } else {
          // Save state for future confirmation
          await ConversationStateService.set(user.userId, {
            status: "awaiting_confirmation",
            pendingIntent: classification.intent,
            pendingEntities: classification.entities
          });
          finalResponse = validation.message || "Por favor, confirme a ação.";
        }
      } 
      else if (validation.status === "READY") {
        // Direct Execution
        actionResult = await FinancialCommandService.execute(user, classification);
        finalResponse = ResponseComposerService.compose(user, actionResult);
      }

      // 5. Send Response
      await this.sendReply(rawMsg.from, finalResponse, rawMsg.phone_number_id);

      // 6. Structured Logging
      await supabase.from("whatsapp_messages").insert({
        whatsapp_id: rawMsg.id,
        sender_number: rawMsg.from,
        user_id: user.userId,
        message_text: text,
        interpretation: {
          original_type: rawMsg.type,
          transcript: text,
          classification: classification,
          validation: validation.status,
          action_result: actionResult,
          final_response: finalResponse
        },
        status: 'processed'
      });

      console.log(`[WhatsApp] Ciclo de processamento robusto concluído.`);

    } catch (err) {
      console.error("[WhatsApp] Erro no pipeline robusto:", err);
      await this.sendReply(rawMsg.from, ResponseComposerService.getErrorMessage(), rawMsg.phone_number_id);
    }
  }

  private static parsePayload(payload: any): WhatsAppMessage | null {
    const entry = payload.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];
    if (!message) return null;

    return {
      id: message.id,
      from: message.from,
      type: (message.audio || message.voice) ? "audio" : "text",
      text: message.text?.body,
      mediaId: message.audio?.id || message.voice?.id,
      timestamp: message.timestamp,
      phone_number_id: value?.metadata?.phone_number_id
    };
  }

  private static async sendReply(to: string, text: string, phone_number_id: string): Promise<void> {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    if (!token || !phone_number_id) return;

    try {
      await fetch(`https://graph.facebook.com/v21.0/${phone_number_id}/messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: to,
          type: "text",
          text: { body: text }
        })
      });
    } catch (err) {
      console.error("[WhatsApp Send] Erro de rede:", err);
    }
  }
}
