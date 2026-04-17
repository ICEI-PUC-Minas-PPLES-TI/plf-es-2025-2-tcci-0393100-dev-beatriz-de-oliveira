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
      interest: context.selectedProductName
        ? `Solicitou atendimento humano para o produto: ${context.selectedProductName}`
        : "Solicitou atendimento humano no WhatsApp",
      status: "ENCAMINHADO_HUMANO",
    };

    await this.leadsService.upsertByPhone(leadUpdate);

    const confirmation = pickVariant(context, "human_handoff", [
      "Perfeito! Já estou encaminhando você para um vendedor.",
      "Tudo certo! Vou direcionar seu atendimento para um vendedor agora.",
      "Combinado! Já acionei a equipe para continuar com você.",
    ]);

    return {
      intent: this.intent,
      handler: "HumanHandoffHandler",
      replyText: [
        confirmation,
        "Em instantes, alguém da equipe vai seguir com o atendimento por aqui.",
        "Enquanto isso, o bot vai pausar as respostas automáticas para não atrapalhar a conversa.",
        "Próximo passo: aguarde a resposta do vendedor nesta mesma conversa.",
      ].join("\n"),
      actions: ["human_handoff_requested", "lead_upserted", "pause_chatbot"],
      handoffRequested: true,
      leadUpdate,
      stateTransition: {
        stage: "ENCAMINHADO_HUMANO",
        handoffRequested: true,
        awaitingHumanHandoffDecision: false,
        lastShownProducts: [],
      },
    };
  }
}
