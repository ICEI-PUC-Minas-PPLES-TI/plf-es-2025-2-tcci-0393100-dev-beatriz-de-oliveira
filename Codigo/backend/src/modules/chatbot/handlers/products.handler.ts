import type { ProductsService } from "../../../services/products.service.js";
import type { Produto } from "../../../types/domain.js";
import { extractCategoryFromMessage, listAvailableCategories } from "../category-resolver.js";
import { normalizeMessageText } from "../message-normalizer.js";
import type { ChatbotContext, ChatbotResponse, IntentHandler } from "../types.js";
import {
  buildCategoryKeyboard,
  buildCategoryPromptText,
  buildCategoryRefinementKeyboard,
  buildCommercialHandoffText,
  buildMainMenuKeyboard,
  buildProductActionsKeyboard,
  buildProductListKeyboard,
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
    .map((product, index) => `${index + 1}) ${product.nome}\nR$ ${toCurrency(product.preco).replace(/^R\$\s*/, "")}`)
    .join("\n\n");
}

function buildProductDetailsReply(product: Produto): string {
  const description = product.descricao?.trim() ? product.descricao.trim().slice(0, 140) : "Sem descricao no momento.";
  return `${product.nome}\n${toCurrency(product.preco)}\n${description}`;
}

function extractCategoryOffset(messageText: string): number {
  const match = messageText.match(/\spagina\s+(\d+)$/i);
  const offset = match?.[1] ? Number.parseInt(match[1], 10) : 0;
  return Number.isFinite(offset) && offset > 0 ? offset : 0;
}

function extractCategoryRefinement(messageText: string): { term?: string; general: boolean } {
  const trimmed = messageText.trim();
  const refineMatch = trimmed.match(/\s+busca\s+(.+)$/i);
  if (refineMatch?.[1]?.trim()) {
    return { term: refineMatch[1].trim(), general: false };
  }

  return { general: /\s+geral$/i.test(trimmed) || /\s+pagina\s+\d+$/i.test(trimmed) };
}

function getCategoryRefinementOptions(categoryName: string): string[] {
  const normalized = normalizeMessageText(categoryName);

  if (normalized.includes("eletronico")) {
    return ["TVs", "Celulares", "Caixa de som", "Carregadores"];
  }

  if (normalized.includes("eletrodomestico")) {
    return ["Geladeiras", "Fogoes", "Micro-ondas", "Lavadoras"];
  }

  if (normalized.includes("brinquedo")) {
    return ["Bonecas", "Carrinhos", "Educativos", "Jogos"];
  }

  return [];
}

function productMatchesTerm(product: Produto, term: string): boolean {
  const normalizedTermTokens = normalizeMessageText(term)
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
  const searchable = normalizeMessageText(`${product.nome} ${product.categoria ?? ""} ${product.descricao ?? ""}`);

  return normalizedTermTokens.length > 0 && normalizedTermTokens.some((token) => {
    const variants = new Set([token]);
    if (token === "tvs") variants.add("tv");
    if (token.endsWith("s") && token.length > 3) variants.add(token.slice(0, -1));
    if (token.endsWith("es") && token.length > 4) variants.add(token.slice(0, -2));
    return Array.from(variants).some((variant) => searchable.includes(variant));
  });
}

export class ProductsHandler implements IntentHandler {
  intent = "products" as const;

  constructor(private readonly productsService: ProductsService) {}

  async handle(context: ChatbotContext): Promise<ChatbotResponse> {
    const products = await this.productsService.list();
    const available = products.filter((product) => product.disponivel);
    const categories = listAvailableCategories(available);
    const categoryMatch = extractCategoryFromMessage(context.message.originalText, categories);
    const isCategorySelection = /^(?:categoria|cat)\s+/i.test(context.message.originalText.trim());

    if (available.length === 0) {
      return {
        intent: this.intent,
        handler: "ProductsHandler",
        replyText: "No momento, nao encontrei produtos disponiveis.\nEscolha como quer continuar",
        replyMessages: ["No momento, nao encontrei produtos disponiveis.\nEscolha como quer continuar"],
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
        const replyText = `${buildProductDetailsReply(selectedProduct)}\n\n${buildCommercialHandoffText()}`;
        return {
          intent: this.intent,
          handler: "ProductsHandler",
          replyText,
          replyMessages: [replyText],
          actions: ["product_details"],
          handoffRequested: false,
          telegram: {
            inlineKeyboard: buildProductActionsKeyboard(selectedProduct.nome),
          },
          stateTransition: {
            stage: "AGUARDANDO_ESCOLHA_PRODUTO",
            awaitingProductSelectionForInterest: false,
            lastShownProducts: [selectedProduct.nome],
            lastSuggestedCategories: context.state.lastSuggestedCategories,
            selectedCategoryName: context.state.selectedCategoryName,
            selectedProductName: selectedProduct.nome,
          },
        };
      }
    }

    if (!categoryMatch.matchedCategory && context.state.stage !== "AGUARDANDO_CATEGORIA" && !isCategorySelection) {
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
          awaitingProductSelectionForInterest: false,
          lastShownProducts: [],
          lastSuggestedCategories: categories,
          selectedCategoryName: undefined,
          selectedProductName: undefined,
        },
      };
    }

    console.info("[ProductsHandler] categoria_resolvida", {
      receivedCategory: categoryMatch.receivedCategory,
      normalizedCategory: categoryMatch.normalizedCategory,
      foundCategory: categoryMatch.matchedCategory ?? null,
      stateStage: context.state.stage,
      isCategorySelection,
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
          awaitingProductSelectionForInterest: false,
          lastShownProducts: [],
          lastSuggestedCategories: categories,
          selectedCategoryName: undefined,
          selectedProductName: undefined,
        },
      };
    }

    const refinement = extractCategoryRefinement(context.message.originalText);
    const refinementOptions = getCategoryRefinementOptions(categoryMatch.matchedCategory);

    if (refinementOptions.length > 0 && !refinement.term && !refinement.general) {
      const replyText = `Dentro de ${categoryMatch.matchedCategory}, o que voce procura?`;
      return {
        intent: this.intent,
        handler: "ProductsHandlerRefinement",
        replyText,
        replyMessages: [replyText],
        actions: ["ask_product_refinement"],
        handoffRequested: false,
        telegram: {
          inlineKeyboard: buildCategoryRefinementKeyboard(categoryMatch.matchedCategory, refinementOptions),
        },
        stateTransition: {
          stage: "AGUARDANDO_CATEGORIA",
          awaitingProductSelectionForInterest: false,
          lastShownProducts: [],
          lastSuggestedCategories: categories,
          selectedCategoryName: categoryMatch.matchedCategory,
          selectedProductName: undefined,
        },
      };
    }

    const categoryProducts = available.filter(
      (product) => normalizeMessageText(product.categoria) === normalizeMessageText(categoryMatch.matchedCategory as string),
    );
    const filteredProducts = refinement.term
      ? categoryProducts.filter((product) => productMatchesTerm(product, refinement.term as string))
      : categoryProducts;

    console.info("[ProductsHandler] produtos_encontrados", {
      receivedCategory: categoryMatch.receivedCategory,
      normalizedCategory: categoryMatch.normalizedCategory,
      foundCategory: categoryMatch.matchedCategory,
      refinement: refinement.term ?? null,
      productCount: filteredProducts.length,
      products: filteredProducts.slice(0, 5).map((product) => product.nome),
    });

    if (filteredProducts.length === 0) {
      return {
        intent: this.intent,
        handler: "ProductsHandler",
        replyText: `Nao encontrei uma opcao boa para ${refinement.term ?? categoryMatch.matchedCategory}.\nPosso te conectar com um vendedor.`,
        replyMessages: [`Nao encontrei uma opcao boa para ${refinement.term ?? categoryMatch.matchedCategory}.\nPosso te conectar com um vendedor.`],
        actions: ["category_without_products"],
        handoffRequested: false,
        telegram: {
          inlineKeyboard: [[{ text: "Falar com vendedor", callbackData: "MENU:HUMAN_HANDOFF" }]],
        },
        stateTransition: {
          stage: "AGUARDANDO_CATEGORIA",
          awaitingProductSelectionForInterest: false,
          lastShownProducts: [],
          lastSuggestedCategories: categories,
          selectedCategoryName: categoryMatch.matchedCategory,
          selectedProductName: undefined,
        },
      };
    }

    const offset = extractCategoryOffset(context.message.originalText);
    const displayedProducts = filteredProducts.slice(offset, offset + 3);
    const selectedProductName = displayedProducts.length === 1 ? displayedProducts[0]!.nome : undefined;
    const hasMoreProducts = offset + displayedProducts.length < filteredProducts.length;
    const replyText = `Encontrei boas opcoes em ${categoryMatch.matchedCategory}\n\n${buildProductListLines(displayedProducts)}`;

    return {
      intent: this.intent,
      handler: "ProductsHandler",
      replyText,
      replyMessages: [replyText],
      actions: ["list_products_by_category", "await_product_choice"],
      handoffRequested: false,
      telegram: {
        inlineKeyboard:
          displayedProducts.length === 1
            ? buildProductActionsKeyboard(displayedProducts[0]!.nome)
            : buildProductListKeyboard(displayedProducts.map((item) => item.nome), {
                categoryName: categoryMatch.matchedCategory,
                nextOffset: hasMoreProducts ? offset + displayedProducts.length : undefined,
              }),
        keyboardPrompt: "Escolha uma acao para continuar.",
      },
      stateTransition: {
        stage: "AGUARDANDO_ESCOLHA_PRODUTO",
        awaitingHumanHandoffDecision: false,
        awaitingProductSelectionForInterest: false,
        lastShownProducts: displayedProducts.map((item) => item.nome),
        lastSuggestedCategories: categories,
        selectedCategoryName: categoryMatch.matchedCategory,
        selectedProductName,
      },
    };
  }
}
