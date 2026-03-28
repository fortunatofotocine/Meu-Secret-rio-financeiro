export type WhatsAppMessageType = "text" | "audio";

export interface WhatsAppMessage {
  id: string;
  from: string;
  type: WhatsAppMessageType;
  text?: string;
  mediaId?: string;
  timestamp: string;
  phone_number_id: string;
}

export type ConversationStatus = "idle" | "awaiting_confirmation" | "incomplete_data";

export interface ConversationState {
  userId: string;
  status: ConversationStatus;
  pendingIntent?: Intent;
  pendingEntities?: IntentEntities;
  pendingCandidates?: any[]; // For ambiguous bill matches
  lastInteraction: string;
}

export interface UserContext {
  userId: string;
  profileName: string;
  whatsappNumber: string;
  isRegistered: boolean;
  state: ConversationState;
}

export type Intent =
  | "registrar_gasto"
  | "registrar_receita"
  | "consultar_gastos_periodo"
  | "consultar_receitas_periodo"
  | "listar_contas_pendentes"
  | "listar_contas_hoje"
  | "listar_contas_semana"
  | "listar_contas_atrasadas"
  | "marcar_conta_paga"
  | "solicitar_resumo_financeiro"
  | "confirmar"
  | "cancelar"
  | "ajuda"
  | "onboarding"
  | "fallback";

export interface IntentEntities {
  amount?: number;
  category?: string;
  description?: string;
  date_reference?: string;
  start_date?: string;
  end_date?: string;
}

export interface IntentResult {
  intent: Intent;
  confidence: number;
  entities: IntentEntities;
}

export type ValidationStatus = "READY" | "NEEDS_CONFIRMATION" | "INCOMPLETE" | "FALLBACK";

export interface ValidationResult {
  status: ValidationStatus;
  missingFields: string[];
  message?: string;
}

export interface CommandResult {
  success: boolean;
  message: string;
  data?: any;
}
