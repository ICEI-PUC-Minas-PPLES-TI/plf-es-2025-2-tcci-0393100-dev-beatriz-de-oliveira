import type { LeadsService } from "../../../services/leads.service.js";
import type { ChatbotContext, ChatbotResponse, IntentHandler, LeadUpsertInput } from "../types.js";

function buildInterestSummary(messageText: string): string {
  return messageText.slice(0, 140) || "Interesse informado no WhatsApp";
}

export class LeadHandler implements IntentHandler {
  intent = "lead_interest" as const;

  constructor(private readonly leadsService: LeadsService) {}

  async handle(context: ChatbotContext): Promise<ChatbotResponse> {
    const interestText =
      context.selectedProductName !== undefined
        ? `Interesse no produto: ${context.selectedProductName}`
        : buildInterestSummary(context.message.originalText);

    const leadUpdate: LeadUpsertInput = {
      phone: context.message.from,
      name: context.message.profileName,
      interest: interestText,
      status: "EM_CONTATO",
    };

    await this.leadsService.upsertByPhone(leadUpdate);

    const confirmation = context.selectedProductName
      ? `Perfeito, entendi que você tem interesse no produto ${context.selectedProductName}.`
      : "Perfeito, registrei o seu interesse para continuarmos o atendimento.";

    return {
      intent: this.intent,
      handler: "LeadHandler",
      replyText: [
        confirmation,
        "Já deixei esse interesse registrado para acompanhamento.",
        "Próximo passo: responda 'sim' se quiser falar com um vendedor agora ou 'não' para voltar ao menu.",
      ].join("\n"),
      actions: ["lead_upserted", "ask_human_handoff_confirmation"],
      handoffRequested: false,
      leadUpdate,
      stateTransition: {
        stage: "CONSULTANDO_PRODUTOS",
        awaitingHumanHandoffDecision: true,
        selectedProductName: context.selectedProductName,
        selectedProductCategory: context.state.selectedProductCategory,
        productBrowseOffset: context.state.productBrowseOffset,
        productBrowseSearchTerm: context.state.productBrowseSearchTerm,
        productBrowsePromotionOnly: context.state.productBrowsePromotionOnly,
        productBrowseMinPrice: context.state.productBrowseMinPrice,
        productBrowseMaxPrice: context.state.productBrowseMaxPrice,
      },
    };
  }
}
