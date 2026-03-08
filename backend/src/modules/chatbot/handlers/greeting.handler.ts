import type { ChatbotContext, ChatbotResponse, IntentHandler } from "../types.js";
import { buildMainMenuText } from "./shared.js";
import { pickVariant } from "../response-variants.js";

export class GreetingHandler implements IntentHandler {
  intent = "greeting" as const;

  async handle(_context: ChatbotContext): Promise<ChatbotResponse> {
    const opening = pickVariant(_context, "greeting", [
      "Ola! Seja bem-vindo ao atendimento da loja.",
      "Perfeito, recebi sua mensagem. Bem-vindo!",
      "Oi! Estou aqui para te ajudar com rapidez.",
    ]);

    return {
      intent: this.intent,
      handler: "GreetingHandler",
      replyText: [opening, "", buildMainMenuText(), "", "Proximo passo: escolha uma opcao do menu acima."].join("\n"),
      actions: ["show_menu"],
      handoffRequested: false,
      stateTransition: {
        stage: "MENU_PRINCIPAL",
        awaitingHumanHandoffDecision: false,
        lastShownProducts: [],
      },
    };
  }
}
