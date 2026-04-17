import { detectIntent } from "./intent-detector.js";
import type { ChatbotContext, ChatbotIntent, ChatbotResponse, IntentHandler } from "./types.js";

export class MessageRouter {
  private readonly handlersByIntent: Partial<Record<ChatbotIntent, IntentHandler>>;

  constructor(handlers: IntentHandler[]) {
    this.handlersByIntent = handlers.reduce<Partial<Record<ChatbotIntent, IntentHandler>>>((acc, handler) => {
      acc[handler.intent] = handler;
      return acc;
    }, {});
  }

  async route(context: ChatbotContext): Promise<ChatbotResponse> {
    const intent = detectIntent(context.message.normalizedText, context.state);
    const handler = this.handlersByIntent[intent] ?? this.handlersByIntent.unknown;

    if (!handler) {
      throw new Error("Chatbot router is missing unknown handler");
    }

    const response = await handler.handle(context);
    return { ...response, intent };
  }
}
