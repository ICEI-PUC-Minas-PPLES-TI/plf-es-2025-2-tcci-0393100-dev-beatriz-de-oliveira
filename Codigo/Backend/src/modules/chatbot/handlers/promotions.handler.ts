import type { ChatbotContext, ChatbotResponse, IntentHandler } from "../types.js";

export class PromotionsHandler implements IntentHandler {
  intent = "promotions" as const;

  async handle(_context: ChatbotContext): Promise<ChatbotResponse> {
    return {
      intent: this.intent,
      handler: "PromotionsHandler",
      replyText:
        "Ainda estamos preparando o modulo de promocoes no sistema. Enquanto isso, posso te mostrar os produtos disponiveis ou chamar um vendedor.\nProximo passo: responda 'produtos' para ver o catalogo ou 'vendedor' para atendimento humano.",
      actions: ["promotions_fallback"],
      handoffRequested: false,
      stateTransition: {
        stage: "MENU_PRINCIPAL",
        awaitingHumanHandoffDecision: false,
      },
    };
  }
}
