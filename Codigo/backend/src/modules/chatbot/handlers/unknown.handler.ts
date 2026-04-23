import type { ChatbotContext, ChatbotResponse, IntentHandler } from "../types.js";
import { pickVariant } from "../response-variants.js";
import { buildMainMenuKeyboard } from "./shared.js";

export class UnknownHandler implements IntentHandler {
  intent = "unknown" as const;

  async handle(context: ChatbotContext): Promise<ChatbotResponse> {
    const fallbackLead = pickVariant(context, "unknown", [
      "Não entendi muito bem.",
      "Ainda não consegui identificar o que você quer.",
      "Preciso de um pouco mais de contexto para seguir.",
    ]);

    return {
      intent: this.intent,
      handler: "UnknownHandler",
      replyText: `${fallbackLead}\nEscolha uma opção abaixo para eu te ajudar melhor 👇`,
      replyMessages: [`${fallbackLead}\nEscolha uma opção abaixo para eu te ajudar melhor 👇`],
      actions: ["unknown_fallback", "show_menu"],
      handoffRequested: false,
      telegram: {
        inlineKeyboard: buildMainMenuKeyboard(),
      },
      stateTransition: {
        stage: "MENU_PRINCIPAL",
        awaitingHumanHandoffDecision: false,
      },
    };
  }
}
