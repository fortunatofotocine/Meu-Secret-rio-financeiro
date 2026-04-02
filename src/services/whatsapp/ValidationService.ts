import { IntentResult, ValidationResult, ValidationStatus, Intent, IntentEntities } from "./types.js";

export class ValidationService {
  /**
   * Validates the classification against confidence thresholds and mandatory fields.
   */
  static validate(classification: IntentResult): ValidationResult {
    const { intent, confidence, entities } = classification;

    // 1. Confidence Thresholds
    if (confidence < 0.6) {
      return {
        status: "FALLBACK",
        missingFields: [],
        message: "Desculpe, não entendi bem o que você quis dizer. Pode repetir?"
      };
    }

    if (confidence <= 0.85) {
      return {
        status: "NEEDS_CONFIRMATION",
        missingFields: [],
        message: this.getConfirmationMessage(intent, entities)
      };
    }

    // 2. Intent-Specific Mandatory Fields
    const missingFields: string[] = [];

    if (intent === "registrar_gasto" || intent === "registrar_receita") {
      if (!entities.amount) missingFields.push("o valor");
      if (!entities.description) missingFields.push("a descrição");
    }

    if (intent === "registrar_evento") {
      if (!entities.event_title) missingFields.push("o que é o compromisso");
      if (!entities.date_reference) missingFields.push("o dia (data)");
      if (!entities.time) missingFields.push("o horário");
    }

    if (missingFields.length > 0) {
      return {
        status: "INCOMPLETE",
        missingFields,
        message: `🤔 *Falta informação*\n\nEntendi que você quer registrar isso, mas falta me dizer: *${missingFields.join(" e ")}*.\n\nPode completar por favor?`
      };
    }

    return { status: "READY", missingFields: [] };
  }

  private static getConfirmationMessage(intent: Intent, entities: IntentEntities): string {
    const dateStr = entities.date_reference || "hoje";
    const timeStr = entities.time || "";

    let details = "";
    if (intent === "registrar_gasto" || intent === "registrar_receita") {
      details = `💰 *Valor:* R$ ${entities.amount?.toFixed(2) || "?"}\n` +
                `📝 *Descrição:* ${entities.description || "?"}`;
    } else if (intent === "registrar_evento") {
      details = `📅 *Evento:* ${entities.event_title || "?"}\n` +
                `🗓️ *Data:* ${dateStr}${timeStr ? ` às ${timeStr}` : ""}`;
    }

    return `🤔 *Confirmar Registro?*\n\n` +
           `Parece que você quer registrar:\n${details}\n\n` +
           `*Deseja confirmar?* (Sim/Não)`;
  }
}
