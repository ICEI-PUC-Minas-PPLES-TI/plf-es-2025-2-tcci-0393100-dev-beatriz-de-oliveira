import type { LeadStatus } from "../../types/domain.js";

export type ChatbotIntent =
  | "greeting"
  | "menu"
  | "products"
  | "promotions"
  | "lead_interest"
  | "human_handoff"
  | "unknown";

export type ConversationStage =
  | "IDLE"
  | "MENU_PRINCIPAL"
  | "AGUARDANDO_CATEGORIA"
  | "CONSULTANDO_PRODUTOS"
  | "AGUARDANDO_ESCOLHA_PRODUTO"
  | "AGUARDANDO_NOME_CLIENTE"
  | "ENCAMINHADO_HUMANO";

export interface WhatsAppIncomingMessage {
  from: string;
  messageId: string;
  hasStableMessageId: boolean;
  timestamp?: string;
  text: string;
  profileName?: string;
  currentCustomerName?: string;
  raw: Record<string, unknown>;
}

export interface NormalizedIncomingMessage {
  from: string;
  messageId: string;
  timestamp?: string;
  originalText: string;
  normalizedText: string;
  profileName?: string;
  currentCustomerName?: string;
}

export interface ChatbotConversationState {
  phoneNumber: string;
  stage: ConversationStage;
  lastIntent: ChatbotIntent;
  lastMessageAt: string;
  handoffRequested: boolean;
  awaitingHumanHandoffDecision: boolean;
  lastShownProducts: string[];
  lastSuggestedCategories: string[];
  selectedProductName?: string;
  selectedCategoryName?: string;
  pendingIntentAfterName?: Extract<ChatbotIntent, "lead_interest" | "human_handoff">;
  pendingInterestSummary?: string;
}

export interface ChatbotContext {
  message: NormalizedIncomingMessage;
  state: ChatbotConversationState;
  nowIso: string;
  rawEvent: Record<string, unknown>;
  selectedProductName?: string;
}

export interface LeadUpsertInput {
  phone: string;
  name?: string;
  interest: string;
  status: LeadStatus;
}

export interface ChatbotResponse {
  intent: ChatbotIntent;
  handler: string;
  replyText: string;
  replyMessages?: string[];
  actions: string[];
  handoffRequested: boolean;
  leadUpdate?: LeadUpsertInput;
  capturedCustomerName?: string;
  telegram?: {
    inlineKeyboard?: Array<Array<{ text: string; callbackData: string }>>;
    keyboardPrompt?: string;
  };
  stateTransition?: Partial<
    Pick<
      ChatbotConversationState,
      | "stage"
      | "handoffRequested"
      | "awaitingHumanHandoffDecision"
      | "lastShownProducts"
      | "lastSuggestedCategories"
      | "selectedProductName"
      | "selectedCategoryName"
      | "pendingIntentAfterName"
      | "pendingInterestSummary"
    >
  >;
}

export interface ChatbotProcessedMessage {
  phone: string;
  messageId: string;
  originalText: string;
  profileName?: string;
  status: "processed" | "duplicate" | "error" | "suppressed";
  response?: ChatbotResponse;
}

export interface ChatbotProcessResult {
  consumed: boolean;
  extractedMessages: number;
  responses: ChatbotResponse[];
  messageResults?: ChatbotProcessedMessage[];
  ignoredDuplicates?: number;
  failedMessages?: number;
  reason?: string;
}

export interface IntentHandler {
  intent: ChatbotIntent;
  handle(context: ChatbotContext): Promise<ChatbotResponse>;
}
