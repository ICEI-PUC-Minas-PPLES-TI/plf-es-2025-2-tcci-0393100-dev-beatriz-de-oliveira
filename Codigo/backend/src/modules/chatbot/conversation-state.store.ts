import type { ChatbotConversationState, ChatbotIntent } from "./types.js";

function nowIso(): string {
  return new Date().toISOString();
}

export class ConversationStateStore {
  private readonly states = new Map<string, ChatbotConversationState>();

  getOrCreate(phoneNumber: string): ChatbotConversationState {
    const existing = this.states.get(phoneNumber);
    if (existing) {
      return existing;
    }

    const initial: ChatbotConversationState = {
      phoneNumber,
      stage: "IDLE",
      lastIntent: "unknown",
      lastMessageAt: nowIso(),
      handoffRequested: false,
      awaitingHumanHandoffDecision: false,
      lastShownProducts: [],
      productBrowseOffset: 0,
      productBrowsePromotionOnly: false,
    };
    this.states.set(phoneNumber, initial);
    return initial;
  }

  update(
    phoneNumber: string,
    input: {
      intent: ChatbotIntent;
      now: string;
      patch?: Partial<
        Pick<
          ChatbotConversationState,
          | "stage"
          | "handoffRequested"
          | "awaitingHumanHandoffDecision"
          | "lastShownProducts"
          | "selectedProductName"
          | "selectedProductCategory"
          | "productBrowseOffset"
          | "productBrowseSearchTerm"
          | "productBrowsePromotionOnly"
          | "productBrowseMinPrice"
          | "productBrowseMaxPrice"
          | "pendingIntentAfterName"
          | "pendingInterestSummary"
        >
      >;
    },
  ): ChatbotConversationState {
    const current = this.getOrCreate(phoneNumber);
    const next: ChatbotConversationState = {
      ...current,
      ...input.patch,
      lastIntent: input.intent,
      lastMessageAt: input.now,
    };
    this.states.set(phoneNumber, next);
    return next;
  }

  pauseForHuman(phoneNumber: string, now = nowIso()): ChatbotConversationState {
    const current = this.getOrCreate(phoneNumber);
    const next: ChatbotConversationState = {
      ...current,
      stage: "ENCAMINHADO_HUMANO",
      handoffRequested: true,
      awaitingHumanHandoffDecision: false,
      lastShownProducts: [],
      selectedProductCategory: undefined,
      productBrowseOffset: 0,
      productBrowseSearchTerm: undefined,
      productBrowsePromotionOnly: false,
      productBrowseMinPrice: undefined,
      productBrowseMaxPrice: undefined,
      pendingIntentAfterName: undefined,
      pendingInterestSummary: undefined,
      lastMessageAt: now,
    };
    this.states.set(phoneNumber, next);
    return next;
  }

  resumeBot(phoneNumber: string, now = nowIso()): ChatbotConversationState {
    const current = this.getOrCreate(phoneNumber);
    const next: ChatbotConversationState = {
      ...current,
      stage: "IDLE",
      handoffRequested: false,
      awaitingHumanHandoffDecision: false,
      lastShownProducts: [],
      selectedProductName: undefined,
      selectedProductCategory: undefined,
      productBrowseOffset: 0,
      productBrowseSearchTerm: undefined,
      productBrowsePromotionOnly: false,
      productBrowseMinPrice: undefined,
      productBrowseMaxPrice: undefined,
      pendingIntentAfterName: undefined,
      pendingInterestSummary: undefined,
      lastMessageAt: now,
    };
    this.states.set(phoneNumber, next);
    return next;
  }
}
