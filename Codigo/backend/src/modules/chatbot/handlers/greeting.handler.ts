import type { ChatbotContext, ChatbotResponse, IntentHandler } from "../types.js";
import { buildMainMenuKeyboard, buildMainMenuText } from "./shared.js";

export class GreetingHandler implements IntentHandler {
  intent = "greeting" as const;

  async handle(_context: ChatbotContext): Promise<ChatbotResponse> {
    return {
      intent: this.intent,
      handler: "GreetingHandler",
      replyText: buildMainMenuText(),
      replyMessages: [buildMainMenuText()],
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
