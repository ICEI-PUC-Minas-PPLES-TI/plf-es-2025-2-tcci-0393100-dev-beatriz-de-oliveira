import type { ChatbotContext, ChatbotResponse, IntentHandler } from "../types.js";
import { pickVariant } from "../response-variants.js";

export class UnknownHandler implements IntentHandler {
  intent = "unknown" as const;

  async handle(context: ChatbotContext): Promise<ChatbotResponse> {
    const fallbackLead = pickVariant(context, "unknown", [
      "Desculpe, nao entendi sua mensagem.",
      "Nao consegui identificar sua solicitacao.",
      "Entendi que voce precisa de ajuda, mas essa mensagem ficou ambigua para mim.",
    ]);

    return {
      intent: this.intent,
      handler: "UnknownHandler",
      replyText: [
        fallbackLead,
        "Posso ajudar com:",
        "1️⃣ Ver produtos",
        "2️⃣ Promocoes",
        "3️⃣ Falar com vendedor",
        "",
        "Proximo passo: voce pode responder com produtos, promocoes ou vendedor.",
      ].join("\n"),
      actions: ["unknown_fallback", "show_menu"],
      handoffRequested: false,
      stateTransition: {
        stage: "MENU_PRINCIPAL",
        awaitingHumanHandoffDecision: false,
      },
    };
  }
}
