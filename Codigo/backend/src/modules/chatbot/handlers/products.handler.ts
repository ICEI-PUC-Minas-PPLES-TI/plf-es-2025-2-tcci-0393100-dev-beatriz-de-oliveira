import type { ProductsService } from "../../../services/products.service.js";
import type { Produto } from "../../../types/domain.js";
import { extractCategoryFromMessage, listAvailableCategories } from "../category-resolver.js";
import { normalizeMessageText } from "../message-normalizer.js";
import type { ChatbotContext, ChatbotResponse, IntentHandler } from "../types.js";
import {
  buildCategoryKeyboard,
  buildCategoryPromptText,
  buildCommercialHandoffText,
  buildMainMenuKeyboard,
  buildProductActionsKeyboard,
  buildUnknownCategoryText,
} from "./shared.js";

function toCurrency(value: string): string {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }
  return parsed.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function wantsProductDetails(normalizedText: string): boolean {
  return normalizedText.includes("ver mais") || normalizedText.includes("detalhes");
}

function buildProductListLines(products: Produto[]): string {
  return products
    .slice(0, 3)
    .map((product, index) => `${index + 1}) 📺 ${product.nome}\n💰 ${toCurrency(product.preco)}`)
    .join("\n\n");
}

function buildProductDetailsReply(product: Produto): string {
  const description = product.descricao?.trim() ? product.descricao.trim().slice(0, 140) : "Sem descrição no momento.";
  return `📺 ${product.nome}\n💰 ${toCurrency(product.preco)}\n${description}`;
}

export class ProductsHandler implements IntentHandler {
  intent = "products" as const;

  constructor(private readonly productsService: ProductsService) {}

  async handle(context: ChatbotContext): Promise<ChatbotResponse> {
    const products = await this.productsService.list();
    const available = products.filter((product) => product.disponivel);
    const categories = listAvailableCategories(available);
    const categoryMatch = extractCategoryFromMessage(context.message.originalText, categories);

    if (available.length === 0) {
      return {
        intent: this.intent,
        handler: "ProductsHandler",
        replyText: "No momento, não encontrei produtos disponíveis.\nEscolha como quer continuar 👇",
        replyMessages: ["No momento, não encontrei produtos disponíveis.", "Escolha como quer continuar 👇"],
        actions: ["list_products_empty"],
        handoffRequested: false,
        telegram: {
          inlineKeyboard: buildMainMenuKeyboard(),
        },
        stateTransition: {
          stage: "MENU_PRINCIPAL",
          lastShownProducts: [],
          lastSuggestedCategories: [],
          selectedCategoryName: undefined,
        },
      };
    }

    if (context.state.stage === "AGUARDANDO_ESCOLHA_PRODUTO" && context.selectedProductName) {
      const selectedProduct = available.find((product) => product.nome === context.selectedProductName);
      if (selectedProduct && wantsProductDetails(context.message.normalizedText)) {
        return {
          intent: this.intent,
          handler: "ProductsHandler",
          replyText: `${buildProductDetailsReply(selectedProduct)}\n\n${buildCommercialHandoffText()}`,
          replyMessages: [buildProductDetailsReply(selectedProduct), buildCommercialHandoffText()],
          actions: ["product_details"],
          handoffRequested: false,
          telegram: {
            inlineKeyboard: buildProductActionsKeyboard(selectedProduct.nome),
          },
          stateTransition: {
            stage: "AGUARDANDO_ESCOLHA_PRODUTO",
            lastShownProducts: [selectedProduct.nome],
            lastSuggestedCategories: context.state.lastSuggestedCategories,
            selectedCategoryName: context.state.selectedCategoryName,
            selectedProductName: selectedProduct.nome,
          },
        };
      }
    }

    if (!categoryMatch.matchedCategory && context.state.stage !== "AGUARDANDO_CATEGORIA") {
      return {
        intent: this.intent,
        handler: "ProductsHandler",
        replyText: buildCategoryPromptText(),
        replyMessages: [buildCategoryPromptText()],
        actions: ["ask_product_category"],
        handoffRequested: false,
        telegram: {
          inlineKeyboard: buildCategoryKeyboard(categories),
        },
        stateTransition: {
          stage: "AGUARDANDO_CATEGORIA",
          lastShownProducts: [],
          lastSuggestedCategories: categories,
          selectedCategoryName: undefined,
          selectedProductName: undefined,
        },
      };
    }

    console.info("[ChatbotCategory] category_resolution", {
      receivedCategory: categoryMatch.receivedCategory,
      normalizedCategory: categoryMatch.normalizedCategory,
      foundCategory: categoryMatch.matchedCategory ?? null,
    });

    if (!categoryMatch.matchedCategory) {
      return {
        intent: this.intent,
        handler: "ProductsHandler",
        replyText: buildUnknownCategoryText(),
        replyMessages: [buildUnknownCategoryText()],
        actions: ["category_not_found"],
        handoffRequested: false,
        telegram: {
          inlineKeyboard: buildCategoryKeyboard(categories),
        },
        stateTransition: {
          stage: "AGUARDANDO_CATEGORIA",
          lastShownProducts: [],
          lastSuggestedCategories: categories,
          selectedCategoryName: undefined,
          selectedProductName: undefined,
        },
      };
    }

    const filteredProducts = available.filter(
      (product) => normalizeMessageText(product.categoria) === normalizeMessageText(categoryMatch.matchedCategory as string),
    );

    console.info("[ChatbotCategory] category_products", {
      receivedCategory: categoryMatch.receivedCategory,
      normalizedCategory: categoryMatch.normalizedCategory,
      foundCategory: categoryMatch.matchedCategory,
      productCount: filteredProducts.length,
    });

    if (filteredProducts.length === 0) {
      return {
        intent: this.intent,
        handler: "ProductsHandler",
        replyText: `Não encontrei produtos em ${categoryMatch.matchedCategory}.\nEscolha outra categoria 👇`,
        replyMessages: [`Não encontrei produtos em ${categoryMatch.matchedCategory}.`, "Escolha outra categoria 👇"],
        actions: ["category_without_products"],
        handoffRequested: false,
        telegram: {
          inlineKeyboard: buildCategoryKeyboard(categories),
        },
        stateTransition: {
          stage: "AGUARDANDO_CATEGORIA",
          lastShownProducts: [],
          lastSuggestedCategories: categories,
          selectedCategoryName: categoryMatch.matchedCategory,
          selectedProductName: undefined,
        },
      };
    }

    const firstProduct = filteredProducts[0]!;

    return {
      intent: this.intent,
      handler: "ProductsHandler",
      replyText: `Encontrei boas opções em ${categoryMatch.matchedCategory} 👇\n\n${buildProductListLines(filteredProducts)}`,
      replyMessages: [
        `Encontrei boas opções em ${categoryMatch.matchedCategory} 👇`,
        buildProductListLines(filteredProducts),
      ],
      actions: ["list_products_by_category", "await_product_choice"],
      handoffRequested: false,
      telegram: {
        inlineKeyboard: buildProductActionsKeyboard(firstProduct.nome),
        keyboardPrompt: "Escolha uma ação abaixo 👇",
      },
      stateTransition: {
        stage: "AGUARDANDO_ESCOLHA_PRODUTO",
        awaitingHumanHandoffDecision: false,
        lastShownProducts: filteredProducts.slice(0, 3).map((item) => item.nome),
        lastSuggestedCategories: categories,
        selectedCategoryName: categoryMatch.matchedCategory,
        selectedProductName: firstProduct.nome,
      },
    };
  }
}
