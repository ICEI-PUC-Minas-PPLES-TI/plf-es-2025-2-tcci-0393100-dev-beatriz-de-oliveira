import type { PromotionsService } from "../../../services/promotions.service.js";
import type { ChatbotContext, ChatbotResponse, IntentHandler } from "../types.js";
import { buildCommercialHandoffText } from "./shared.js";

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString("pt-BR");
}

export class PromotionsHandler implements IntentHandler {
  intent = "promotions" as const;

  constructor(private readonly promotionsService: PromotionsService) {}

  async handle(_context: ChatbotContext): Promise<ChatbotResponse> {
    const promotions = await this.promotionsService.listActive();

    if (promotions.length === 0) {
      return {
        intent: this.intent,
        handler: "PromotionsHandler",
        replyText: "No momento, não encontrei promoções ativas.\nEscolha como quer continuar 👇",
        replyMessages: ["No momento, não encontrei promoções ativas.\nEscolha como quer continuar 👇"],
        actions: ["promotions_empty"],
        handoffRequested: false,
        telegram: {
          inlineKeyboard: [
            [{ text: "Produtos", callbackData: "MENU:PRODUCTS" }],
            [{ text: "Falar com vendedor", callbackData: "MENU:HUMAN_HANDOFF" }],
          ],
        },
        stateTransition: {
          stage: "MENU_PRINCIPAL",
          awaitingHumanHandoffDecision: false,
        },
      };
    }

    const summary = promotions
      .slice(0, 2)
      .map((promotion, index) => `${index + 1}) ${promotion.produto} - até ${formatDate(promotion.fim_em)}`)
      .join("\n");

    return {
      intent: this.intent,
      handler: "PromotionsHandler",
      replyText: `Estas promoções merecem atenção 👇\n\n${summary}`,
      replyMessages: [`Estas promoções merecem atenção 👇\n\n${summary}`, buildCommercialHandoffText()],
      actions: ["promotions_listed"],
      handoffRequested: false,
      telegram: {
        inlineKeyboard: [[{ text: "Falar com vendedor", callbackData: "MENU:HUMAN_HANDOFF" }]],
      },
      stateTransition: {
        stage: "MENU_PRINCIPAL",
        awaitingHumanHandoffDecision: false,
      },
    };
  }
}
