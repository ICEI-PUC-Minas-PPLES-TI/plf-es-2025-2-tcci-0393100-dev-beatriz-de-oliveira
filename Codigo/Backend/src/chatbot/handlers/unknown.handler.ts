import type { ChatbotContext, ChatbotResponse, IntentHandler } from "../types.js";
import { pickVariant } from "../response-variants.js";

export class UnknownHandler implements IntentHandler {
  intent = "unknown" as const;

  async handle(context: ChatbotContext): Promise<ChatbotResponse> {
    const fallbackLead = pickVariant(context, "unknown", [
      "Recebi sua mensagem, mas preciso de um pouco mais de contexto para conseguir te ajudar melhor.",
      "Quero te orientar da forma certa, mas ainda não consegui identificar exatamente o que você precisa.",
      "Entendi sua mensagem, mas preciso que você escolha o próximo passo para eu seguir com você.",
    ]);

    return {
      intent: this.intent,
      handler: "UnknownHandler",
      replyText: [
        fallbackLead,
        "Posso ajudar com estas opções:",
        "1) Ver produtos",
        "2) Ver promoções",
        "3) Falar com vendedor",
        "",
        "Próximo passo: responda com produtos, promoções ou vendedor.",
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
