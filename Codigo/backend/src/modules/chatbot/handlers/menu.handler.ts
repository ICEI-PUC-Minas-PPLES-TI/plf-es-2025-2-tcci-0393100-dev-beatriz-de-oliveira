import type { ChatbotContext, ChatbotResponse, IntentHandler } from "../types.js";
import { pickVariant } from "../response-variants.js";
import { buildMainMenuKeyboard, buildMainMenuText } from "./shared.js";

export class MenuHandler implements IntentHandler {
  intent = "menu" as const;

  async handle(context: ChatbotContext): Promise<ChatbotResponse> {
    const intro = pickVariant(context, "menu", [
      "Vamos seguir por aqui.",
      "Separei as opções principais para você.",
      "Tudo certo. Escolha como quer continuar.",
    ]);

    return {
      intent: this.intent,
      handler: "MenuHandler",
      replyText: `${intro}\n${buildMainMenuText()}`,
      replyMessages: [`${intro}\n${buildMainMenuText()}`],
      actions: ["show_menu"],
      handoffRequested: false,
      telegram: {
        inlineKeyboard: buildMainMenuKeyboard(),
      },
      stateTransition: {
        stage: "MENU_PRINCIPAL",
        awaitingHumanHandoffDecision: false,
        lastShownProducts: [],
        lastSuggestedCategories: [],
        selectedCategoryName: undefined,
      },
    };
  }
}
