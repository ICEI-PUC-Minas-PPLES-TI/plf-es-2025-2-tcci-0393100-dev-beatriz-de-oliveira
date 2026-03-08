import type { ChatbotContext, ChatbotResponse, IntentHandler } from "../types.js";
import { buildMainMenuText } from "./shared.js";
import { pickVariant } from "../response-variants.js";

export class MenuHandler implements IntentHandler {
  intent = "menu" as const;

  async handle(context: ChatbotContext): Promise<ChatbotResponse> {
    const intro = pickVariant(context, "menu", [
      "Claro. Aqui esta o menu principal.",
      "Entendido. Vou te mostrar as opcoes disponiveis.",
      "Perfeito. Estas sao as opcoes de atendimento:",
    ]);

    return {
      intent: this.intent,
      handler: "MenuHandler",
      replyText: [intro, "", buildMainMenuText(), "", "Proximo passo: responda com 1, 2 ou 3."].join("\n"),
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
