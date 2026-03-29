import type { PromotionsService } from "../../../services/promotions.service.js";
import type { ChatbotContext, ChatbotResponse, IntentHandler } from "../types.js";

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
        replyText: [
          "Entendi, você quer verificar as promoções ativas.",
          "No momento, não temos ofertas publicadas, mas posso te mostrar os produtos disponíveis ou encaminhar você para um vendedor.",
          "Próximo passo: responda 'produtos' para ver o catálogo ou 'vendedor' para falar com a equipe.",
        ].join("\n"),
        actions: ["promotions_empty"],
        handoffRequested: false,
        stateTransition: {
          stage: "MENU_PRINCIPAL",
          awaitingHumanHandoffDecision: false,
        },
      };
    }

    const summary = promotions
      .slice(0, 3)
      .map((promotion, index) => `${index + 1}) ${promotion.produto} - ${promotion.tipo.toLowerCase()} até ${formatDate(promotion.fim_em)}`)
      .join("\n");

    return {
      intent: this.intent,
      handler: "PromotionsHandler",
      replyText: [
        "Perfeito, encontrei estas promoções ativas para você.",
        summary,
        "",
        "Próximo passo: responda com o nome do produto que chamou sua atenção ou diga 'vendedor' para continuar com atendimento humano.",
      ].join("\n"),
      actions: ["promotions_listed"],
      handoffRequested: false,
      stateTransition: {
        stage: "MENU_PRINCIPAL",
        awaitingHumanHandoffDecision: false,
      },
    };
  }
}
