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
      interest: "Solicitou atendimento humano no WhatsApp",
      status: "ENCAMINHADO_HUMANO",
    };

    await this.leadsService.upsertByPhone(leadUpdate);

    const confirmation = pickVariant(context, "human_handoff", [
      "Entendi, vou encaminhar voce para um vendedor.",
      "Perfeito, seu atendimento humano foi solicitado.",
      "Certo, ja estou direcionando sua conversa para um atendente.",
    ]);

    return {
      intent: this.intent,
      handler: "HumanHandoffHandler",
      replyText: [
        confirmation,
        "Em breve alguem da equipe vai falar com voce por aqui.",
        "Proximo passo: aguarde a resposta do vendedor. Se quiser, envie o nome do produto de interesse.",
      ].join("\n"),
      actions: ["human_handoff_requested", "lead_upserted"],
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
