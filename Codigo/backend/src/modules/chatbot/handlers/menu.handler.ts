import type { ChatbotContext, ChatbotResponse, IntentHandler } from "../types.js";
import { buildMainMenuText } from "./shared.js";
import { pickVariant } from "../response-variants.js";

export class MenuHandler implements IntentHandler {
  intent = "menu" as const;

  async handle(context: ChatbotContext): Promise<ChatbotResponse> {
    const intro = pickVariant(context, "menu", [
      "Claro, vou te mostrar as opções novamente.",
      "Perfeito, aqui está o menu principal para continuarmos.",
      "Sem problema. Vou reorganizar as opções para você.",
    ]);

    return {
      intent: this.intent,
      handler: "MenuHandler",
      replyText: [
        intro,
        "",
        buildMainMenuText(),
        "",
        "Próximo passo: responda com 1, 2 ou 3 para eu seguir com você.",
      ].join("\n"),
      actions: ["show_menu"],
      handoffRequested: false,
      stateTransition: {
        stage: "MENU_PRINCIPAL",
        awaitingHumanHandoffDecision: false,
        lastShownProducts: [],
        selectedProductName: undefined,
        selectedProductCategory: undefined,
        productBrowseOffset: 0,
        productBrowseSearchTerm: undefined,
        productBrowsePromotionOnly: false,
        productBrowseMinPrice: undefined,
        productBrowseMaxPrice: undefined,
      },
    };
  }
}
