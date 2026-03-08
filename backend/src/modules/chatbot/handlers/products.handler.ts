import type { ProductsService } from "../../../services/products.service.js";
import { normalizeMessageText } from "../message-normalizer.js";
import type { ChatbotContext, ChatbotResponse, IntentHandler } from "../types.js";

function toCurrency(value: string): string {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }
  return parsed.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function findRequestedTerm(normalizedText: string): string | null {
  const match = normalizedText.match(/(?:tem|possui|tem ai|tem aí)\s+(.+)/);
  const value = match?.[1]?.trim();
  return value && value.length >= 3 ? value : null;
}

export class ProductsHandler implements IntentHandler {
  intent = "products" as const;

  constructor(private readonly productsService: ProductsService) {}

  async handle(context: ChatbotContext): Promise<ChatbotResponse> {
    const products = await this.productsService.list();
    const available = products.filter((product) => product.disponivel);
    const requestedTerm = findRequestedTerm(context.message.normalizedText);

    let list = available;
    if (requestedTerm) {
      const filtered = available.filter((product) =>
        normalizeMessageText(`${product.nome} ${product.categoria}`).includes(requestedTerm),
      );
      list = filtered.length > 0 ? filtered : available;
    }

    const topList = list.slice(0, 5);
    if (topList.length === 0) {
      return {
        intent: this.intent,
        handler: "ProductsHandler",
        replyText: "No momento nao temos produtos disponiveis. Quer falar com um vendedor?",
        actions: ["list_products_empty"],
        handoffRequested: false,
        stateTransition: {
          stage: "MENU_PRINCIPAL",
          lastShownProducts: [],
        },
      };
    }

    const header = requestedTerm
      ? `Sobre "${requestedTerm}", encontrei estas opcoes:`
      : "Temos estes produtos disponiveis no momento:";

    const replyText = [
      header,
      ...topList.map((product, index) => `${index + 1}) ${product.nome} (${toCurrency(product.preco)})`),
      "",
      "Se tiver interesse, responda com o numero (ex: 1) ou diga 'quero o primeiro'.",
    ].join("\n");

    return {
      intent: this.intent,
      handler: "ProductsHandler",
      replyText,
      actions: ["list_products", "await_product_choice"],
      handoffRequested: false,
      stateTransition: {
        stage: "AGUARDANDO_ESCOLHA_PRODUTO",
        awaitingHumanHandoffDecision: false,
        lastShownProducts: topList.map((item) => item.nome),
      },
    };
  }
}

