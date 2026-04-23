import type { LeadsService } from "../../../services/leads.service.js";
import type { ChatbotContext, ChatbotResponse, IntentHandler, LeadUpsertInput } from "../types.js";
import { buildCommercialHandoffText, buildHandoffKeyboard, buildInterestSelectionKeyboard } from "./shared.js";

function buildInterestSummary(messageText: string): string {
  return messageText.slice(0, 140) || "Interesse informado no WhatsApp";
}

export class LeadHandler implements IntentHandler {
  intent = "lead_interest" as const;

  constructor(private readonly leadsService: LeadsService) {}

  async handle(context: ChatbotContext): Promise<ChatbotResponse> {
    const contextProducts = context.state.lastShownProducts;
    const selectedProductName =
      context.selectedProductName ?? (contextProducts.length === 1 ? contextProducts[0] : undefined);

    console.info("[ChatbotLead] interest_action", {
      phone: context.message.from,
      action: "tenho_interesse",
      productsInContext: contextProducts,
      selectedProduct: selectedProductName ?? null,
      awaitingSelection: context.state.awaitingProductSelectionForInterest,
    });

    if (!selectedProductName && contextProducts.length > 1) {
      console.info("[ChatbotLead] ambiguous_product_selection", {
        phone: context.message.from,
        productsInContext: contextProducts,
        originalText: context.message.originalText,
      });

      return {
        intent: this.intent,
        handler: "LeadHandlerProductSelection",
        replyText: "Qual produto te interessou?\nResponda com o número ou nome do item.",
        replyMessages: ["Qual produto te interessou?\nResponda com o número ou nome do item."],
        actions: ["ask_product_selection_for_interest"],
        handoffRequested: false,
        telegram: {
          inlineKeyboard: buildInterestSelectionKeyboard(contextProducts),
        },
        stateTransition: {
          stage: "AGUARDANDO_ESCOLHA_PRODUTO",
          awaitingProductSelectionForInterest: true,
          lastShownProducts: contextProducts,
          selectedProductName: undefined,
          selectedCategoryName: context.state.selectedCategoryName,
        },
      };
    }

    const interestText =
      selectedProductName !== undefined
        ? `Interesse no produto: ${selectedProductName}`
        : buildInterestSummary(context.message.originalText);

    const leadUpdate: LeadUpsertInput = {
      phone: context.message.from,
      name: context.message.profileName,
      interest: interestText,
      status: "EM_CONTATO",
    };

    await this.leadsService.upsertByPhone(leadUpdate);

    console.info("[ChatbotLead] product_selected", {
      phone: context.message.from,
      productChosen: selectedProductName ?? null,
      productsInContext: contextProducts,
    });

    const confirmation = selectedProductName
      ? `Interesse registrado em ${selectedProductName}.`
      : "Interesse registrado com sucesso.";

    return {
      intent: this.intent,
      handler: "LeadHandler",
      replyText: `${confirmation}\n${buildCommercialHandoffText()}`,
      replyMessages: [confirmation, buildCommercialHandoffText()],
      actions: ["lead_upserted", "ask_human_handoff_confirmation"],
      handoffRequested: false,
      leadUpdate,
      telegram: {
        inlineKeyboard: buildHandoffKeyboard(),
      },
      stateTransition: {
        stage: "CONSULTANDO_PRODUTOS",
        awaitingHumanHandoffDecision: true,
        awaitingProductSelectionForInterest: false,
        selectedProductName,
        selectedCategoryName: context.state.selectedCategoryName,
      },
    };
  }
}
