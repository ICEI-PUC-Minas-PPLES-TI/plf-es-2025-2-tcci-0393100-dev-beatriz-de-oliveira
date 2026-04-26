import type { LeadsService } from "../../../services/leads.service.js";
import type { ChatbotContext, ChatbotResponse, IntentHandler, LeadUpsertInput } from "../types.js";
import { pickVariant } from "../response-variants.js";

export class HumanHandoffHandler implements IntentHandler {
  intent = "human_handoff" as const;

  constructor(private readonly leadsService: LeadsService) {}

  async handle(context: ChatbotContext): Promise<ChatbotResponse> {
    const leadUpdate: LeadUpsertInput = {
      phone: context.message.from,
      name: context.message.profileName,
      interest: context.selectedProductName ? `Interesse no produto: ${context.selectedProductName}` : undefined,
      status: "ENCAMINHADO_HUMANO",
      channel: context.message.channel,
    };

    await this.leadsService.upsertByPhone(leadUpdate);

    const confirmation = pickVariant(context, "human_handoff", [
      "Perfeito. Vou te conectar com um vendedor agora.",
      "Tudo certo. Já vou chamar um vendedor para você.",
      "Ótimo. Seu atendimento vai seguir com a equipe.",
    ]);

    return {
      intent: this.intent,
      handler: "HumanHandoffHandler",
      replyText: `${confirmation}\nEle continua com você por aqui.`,
      replyMessages: [`${confirmation}\nEle continua com você por aqui.`],
      actions: ["human_handoff_requested", "lead_upserted", "pause_chatbot"],
      handoffRequested: true,
      leadUpdate,
      stateTransition: {
        stage: "ENCAMINHADO_HUMANO",
        handoffRequested: true,
        awaitingHumanHandoffDecision: false,
        lastShownProducts: [],
        lastSuggestedCategories: [],
        selectedCategoryName: undefined,
      },
    };
  }
}
