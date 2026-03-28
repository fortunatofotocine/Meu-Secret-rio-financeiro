import { IntentResult, ValidationResult, ValidationStatus, Intent, IntentEntities } from "./types.js";

export class ValidationService {
  /**
   * Validates the classification against confidence thresholds and mandatory fields.
   */
  static validate(classification: IntentResult): ValidationResult {
    const { intent, confidence, entities } = classification;

    // 1. Low Confidence Fallback (< 0.5)
    if (confidence < 0.5) {
      return {
        status: "FALLBACK",
        missingFields: [],
        message: "Desculpe, não entendi bem o que você quis dizer. Pode repetir?"
      };
    }

    // 2. Mandatory Field Check
    const mandatoryFields: Record<string, (keyof IntentEntities)[]> = {
      "registrar_gasto": ["amount"],
      "registrar_receita": ["amount"],
    };

    const required = mandatoryFields[intent as string] || [];
    const missing = required.filter(f => !entities[f]);

    if (missing.length > 0) {
      const fieldName = missing[0] === "amount" ? "valor" : "campo";
      return {
        status: "INCOMPLETE",
        missingFields: missing as string[],
        message: `Entendi que você quer ${intent.replace('_', ' ')}, mas faltou dizer o ${fieldName}.`
      };
    }

    // 3. Confidence Thresholds for Direct Execution vs Confirmation
    if (confidence >= 0.8) {
      return {
        status: "READY",
        missingFields: []
      };
    }

    // 4. Manual Confirmation (0.5 - 0.8)
    return {
      status: "NEEDS_CONFIRMATION",
      missingFields: [],
      message: this.getConfirmationMessage(intent, entities)
    };
  }

  private static getConfirmationMessage(intent: Intent, entities: IntentEntities): string {
    const { amount, category, date_reference } = entities;
    
    if (intent === "registrar_gasto") {
      return `Confirmar registro de gasto de R$ ${amount?.toFixed(2)}${category ? ` em ${category}` : ""}? (Diga 'sim' ou 'não')`;
    }
    if (intent === "registrar_receita") {
      return `Confirmar registro de receita de R$ ${amount?.toFixed(2)}? (Diga 'sim' ou 'não')`;
    }

    return "Posso prosseguir com esta ação? (Diga 'sim' ou 'não')";
  }
}
