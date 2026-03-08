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
          "stage" | "handoffRequested" | "awaitingHumanHandoffDecision" | "lastShownProducts" | "selectedProductName"
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
}

