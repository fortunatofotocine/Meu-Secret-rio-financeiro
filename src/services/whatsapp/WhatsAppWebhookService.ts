import { UserResolutionService } from "./UserResolutionService.js";
import { TranscriptionService } from "./TranscriptionService.js";
import { IntentClassificationService } from "./IntentClassificationService.js";
import { FinancialCommandService } from "./FinancialCommandService.js";
import { ResponseComposerService } from "./ResponseComposerService.js";
import { ValidationService } from "./ValidationService.js";
import { ConversationStateService } from "./ConversationStateService.js";
import { NormalizationService } from "./NormalizationService.js";
import { ReceiptService } from "./ReceiptService.js";
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

    try {
      console.log(`[parser-v4.1] WEBHOOK_ENTRY: ${JSON.stringify(payload)}`);
      const user = await UserResolutionService.resolve(rawMsg.from);
      
      let incomingText = rawMsg.text || "";
      const isActivationAttempt = incomingText.toUpperCase().includes("QUERO ATIVAR MINHA CONTA");

      if (!user.isRegistered && !isActivationAttempt) {
        await this.sendReply(rawMsg.from, ResponseComposerService.getOnboardingMessage(user), rawMsg.phone_number_id);
        return;
      }

      // 1.5. Trial / Subscription Check
      const trialEnded = user.trialEndsAt ? new Date(user.trialEndsAt) < new Date() : false;
      const notActive = user.subscriptionStatus !== 'active';
      
      if (trialEnded && notActive) {
        const expiredMsg = "⚠️ *Período de Teste Finalizado*\n\n" +
          "Seus 30 dias de teste grátis da ZLAI chegaram ao fim. Para continuar registrando seus gastos e recebendo relatórios, assine agora por apenas *R$ 11,90/mês*!\n\n" +
          "Acesse: zlai.vercel.app/subscription-expired\n\n" +
          "Seus dados continuam salvos com segurança. Estamos te esperando! 🚀";
        await this.sendReply(rawMsg.from, expiredMsg, rawMsg.phone_number_id);
        return;
      }

      // 2. Transcription (if audio)
      if (rawMsg.type === "audio" && rawMsg.mediaId) {
        await this.logDebug(user.userId, "Stage 2: Transcription", { mediaId: rawMsg.mediaId });
        incomingText = await TranscriptionService.transcribe(rawMsg.mediaId);
      }
      if (!incomingText && rawMsg.type !== "image") return;

      // 3. Normalization (Light & Safe)
      await this.logDebug(user.userId, "Stage 3: Normalization", { rawText: incomingText });
      const normalizedText = NormalizationService.normalize(incomingText);

      // ABORT: If after normalization the message is empty, it means it was just the bot name or a greeting.
      if (!normalizedText && !rawMsg.button_reply) {
        await this.logDebug(user.userId, "Stage 3.5: Aborting (Empty/Greeting only)", { rawText: incomingText });
        return;
      }

      // 4. Get Current state (Mandatory DB Fetch to prevent stale state)
      await this.logDebug(user.userId, "Stage 4: State Retrieval", { currentContext: user.state?.status });
      const dbState = await ConversationStateService.get(user.userId);
      if (dbState) {
        user.state = dbState;
      } else {
        user.state = { userId: user.userId, status: 'idle', lastInteraction: new Date().toISOString() };
      }

      // 5. Short-circuit for Edits/Confirmations (Silencing Logic v9)
      const isEditing = user.state?.status === "awaiting_edit";
      const isButtonClick = !!rawMsg.button_reply;
      
      let classification: IntentResult;

      if (isEditing && !isButtonClick) {
        await this.logDebug(user.userId, "Stage 5: Silencing Logic (Edit Mode)", { text: normalizedText });
        classification = {
          intent: user.state.pendingIntent || "registrar_gasto",
          confidence: 1.0,
          entities: { 
            ...user.state.pendingEntities,
            description: normalizedText // Treat FULL message as the new description
          }
        };
      } else if (rawMsg.type === "image" && rawMsg.mediaId) {
        await this.logDebug(user.userId, "Stage 5: Receipt Processing", { mediaId: rawMsg.mediaId });
        const receiptResult = await ReceiptService.process(rawMsg.mediaId, user.userId);
        if (receiptResult) {
          classification = receiptResult;
          incomingText = `[Recibo] ${receiptResult.entities.description}`;
        } else {
          await this.sendReply(rawMsg.from, "Não consegui ler seu comprovante. Pode tentar mandar uma foto mais nítida?", rawMsg.phone_number_id);
          return;
        }
      } else {
        classification = await IntentClassificationService.classify(normalizedText);
      }

      // 6. State Merging (Context Support)
      if (user.state && user.state.status !== "idle" && user.state.pendingIntent) {
        // If it's a generic fallback or we are in a rapid session, we keep the previous context
        if (classification.intent === "fallback") {
            classification.intent = user.state.pendingIntent;
            classification.entities = { ...user.state.pendingEntities, ...classification.entities };
        }
      }

      // 7. Validation
      await this.logDebug(user.userId, "Stage 5: Validation", { intent: classification.intent });
      
      // Safety Net (120s rule): Even if not strictly in awaiting_edit mode, 
      // if it's a rapid reply without a value, we force it to an edit.
      const lastInt = user.state?.lastInteraction ? new Date(user.state.lastInteraction).getTime() : 0;
      const nowTs = new Date().getTime();
      const isRecent = (nowTs - lastInt) < (120 * 1000); // 120 seconds safety window
      const isQuickEdit = isRecent && classification.intent === "registrar_gasto" && !classification.entities.amount && normalizedText;

      const finalIsEditing = isEditing || isQuickEdit;
      
      const validation = (isButtonClick || finalIsEditing)
        ? { status: "READY", missingFields: [], message: "" } as any
        : ValidationService.validate(classification);

      if (validation.status === "FALLBACK") {
        await this.sendReply(rawMsg.from, validation.message || "Desculpe, não entendi muito bem. Pode reformular?", rawMsg.phone_number_id);
        return;
      }

      if (validation.status === "NEEDS_CONFIRMATION" || validation.status === "INCOMPLETE") {
        await ConversationStateService.set(user.userId, {
          status: validation.status === "NEEDS_CONFIRMATION" ? "awaiting_confirmation" : "incomplete_data",
          pendingIntent: classification.intent,
          pendingEntities: classification.entities
        });
        await this.sendReply(rawMsg.from, validation.message || "Pode me confirmar os dados?", rawMsg.phone_number_id);
        return;
      }

      // 8. Execution
      await this.logDebug(user.userId, "Stage 6: Execution", { intent: classification.intent });
      const result = await FinancialCommandService.execute(user, classification, rawMsg.button_reply, normalizedText);

      // 9. Response
      const responseData = ResponseComposerService.composeWithMetadata(user, result, classification.intent);
      
      if (result.success && !responseData.stateToSet) {
        await ConversationStateService.clear(user.userId);
      }
      
      if (responseData.stateToSet) {
        await ConversationStateService.set(user.userId, responseData.stateToSet);
      }

      await this.sendReply(rawMsg.from, responseData.text, rawMsg.phone_number_id, responseData.buttons);

      // 10. Final Log
      await supabase.from("whatsapp_messages").insert({
        whatsapp_id: rawMsg.id,
        sender_number: rawMsg.from,
        user_id: user.userId,
        message_text: incomingText,
        interpretation: {
          original_type: rawMsg.type,
          normalized: normalizedText,
          classification,
          validation: validation.status,
          action_result: result,
          final_response: responseData.text
        },
        status: 'processed'
      });

    } catch (err: any) {
      console.error("[WhatsApp] Erro no pipeline semântico:", err);
      // Log error to Supabase for debugging
      try {
        await supabase.from("system_logs").insert([{
          event_type: "whatsapp_master_error",
          payload: { 
            error: err.message || String(err),
            stack: err.stack,
            message_text: rawMsg.text || "[audio]"
          }
        }]);
      } catch (logErr) {
        console.error("[WhatsApp] Falha ao logar erro no Supabase:", logErr);
      }
      await this.sendReply(rawMsg.from, ResponseComposerService.getErrorMessage(), rawMsg.phone_number_id);
    }
  }

  private static async logDebug(userId: string, stage: string, payload: any): Promise<void> {
    try {
      await supabase.from("system_logs").insert([{
        event_type: "whatsapp_debug",
        payload: { stage, userId, ...payload }
      }]);
    } catch (e) {
      console.error("[Debug Logger] Error:", e);
    }
  }

  private static parsePayload(payload: any): WhatsAppMessage | null {
    const entry = payload.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];
    if (!message) return null;

    const type = message.type === "text" ? "text" : 
                 (message.audio || message.voice) ? "audio" : 
                 message.image ? "image" : 
                 message.type === "interactive" ? "interactive" : "text";

    return {
      id: message.id,
      from: message.from,
      type,
      text: message.text?.body || message.interactive?.button_reply?.title,
      mediaId: message.audio?.id || message.voice?.id || message.image?.id,
      button_reply: message.interactive?.button_reply,
      timestamp: message.timestamp,
      phone_number_id: value?.metadata?.phone_number_id
    };
  }

  private static async sendReply(to: string, text: string, phone_number_id: string, buttons?: { id: string, title: string }[]): Promise<void> {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    if (!token || !phone_number_id) return;

    try {
      const body: any = {
        messaging_product: "whatsapp",
        to: to,
      };

      if (buttons && buttons.length > 0) {
        body.type = "interactive";
        body.interactive = {
          type: "button",
          body: { text },
          action: {
            buttons: buttons.map(b => ({
              type: "reply",
              reply: { id: b.id, title: b.title }
            }))
          }
        };
      } else {
        body.type = "text";
        body.text = { body: text };
      }

      await fetch(`https://graph.facebook.com/v21.0/${phone_number_id}/messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });
    } catch (err) {
      console.error("[WhatsApp Send] Erro de rede:", err);
    }
  }
}
