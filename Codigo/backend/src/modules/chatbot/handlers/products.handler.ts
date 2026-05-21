import type { ProductsService } from "../../../services/products.service.js";
import type { Produto } from "../../../types/domain.js";
import { extractCategoryFromMessage, listAvailableCategories, resolveCategoryName } from "../category-resolver.js";
import { parseProductChoice } from "../intent-detector.js";
import { normalizeMessageText } from "../message-normalizer.js";
import type { ChatbotContext, ChatbotResponse, IntentHandler } from "../types.js";
import {
  buildCategoryKeyboard,
  buildCategoryPromptText,
  buildCategoryBrowseKeyboard,
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

function wantsMoreProductPhotos(normalizedText: string): boolean {
  return normalizedText.includes("ver mais fotos") || normalizedText.includes("mais fotos") || normalizedText.includes("galeria");
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

function resolveCategoryFromIndexSelection(messageText: string, categories: string[]): string | undefined {
  const match = messageText.trim().match(/^categoria\s+item\s+(\d+)$/i);
  const categoryIndex = match?.[1] ? Number.parseInt(match[1], 10) - 1 : -1;
  if (!Number.isInteger(categoryIndex) || categoryIndex < 0) {
    return undefined;
  }

  return categories[categoryIndex];
}

function extractCategoryRefinement(messageText: string): { term?: string; general: boolean } {
  const trimmed = messageText.trim();
  const refineMatch = trimmed.match(/\s+busca\s+(.+)$/i);
  if (refineMatch?.[1]?.trim()) {
    return { term: refineMatch[1].trim(), general: false };
  }

  return { general: /\s+geral$/i.test(trimmed) || /\s+pagina\s+\d+$/i.test(trimmed) };
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

function resolveSelectedProductName(context: ChatbotContext): string | undefined {
  if (context.selectedProductName) {
    return context.selectedProductName;
  }

  const choiceIndex = parseProductChoice(context.message.normalizedText, context.state.lastShownProducts.length);
  if (choiceIndex === null) {
    return undefined;
  }

  return context.state.lastShownProducts[choiceIndex];
}

export class ProductsHandler implements IntentHandler {
  intent = "products" as const;

  constructor(private readonly productsService: ProductsService) {}

  async handle(context: ChatbotContext): Promise<ChatbotResponse> {
    const products = await this.productsService.list();
    const available = products.filter((product) => product.disponivel);
    const categories = listAvailableCategories(available);
    const categoryFromIndexSelection = resolveCategoryFromIndexSelection(
      context.message.originalText,
      context.state.lastSuggestedCategories,
    );
    const categoryMatch = categoryFromIndexSelection
      ? resolveCategoryName(categoryFromIndexSelection, categories)
      : extractCategoryFromMessage(context.message.originalText, categories);
    const isCategorySelection = /^(?:categoria|cat)\s+/i.test(context.message.originalText.trim());
    const categoryFromState =
      context.state.stage === "AGUARDANDO_CATEGORIA" && !isCategorySelection
        ? context.state.selectedCategoryName
        : undefined;
    const matchedCategory = categoryMatch.matchedCategory ?? categoryFromState;
    const selectedProductNameFromContext = resolveSelectedProductName(context);

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

    if (context.state.stage === "AGUARDANDO_ESCOLHA_PRODUTO" && selectedProductNameFromContext) {
      const selectedProduct = available.find((product) => product.nome === selectedProductNameFromContext);
      if (selectedProduct && wantsMoreProductPhotos(context.message.normalizedText)) {
        const replyText = `Separei mais fotos de ${selectedProduct.nome}.`;
        return {
          intent: this.intent,
          handler: "ProductsHandler",
          replyText,
          replyMessages: [replyText],
          actions: ["product_gallery"],
          handoffRequested: false,
          telegram: {
            inlineKeyboard: buildProductActionsKeyboard(selectedProduct.nome, {
              hasMoreImages: (selectedProduct.images?.length ?? 0) > 1,
              backCategoryName: context.state.selectedCategoryName,
            }),
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
            inlineKeyboard: buildProductActionsKeyboard(selectedProduct.nome, {
              hasMoreImages: (selectedProduct.images?.length ?? 0) > 1,
              backCategoryName: context.state.selectedCategoryName,
            }),
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

    if (!matchedCategory && context.state.stage !== "AGUARDANDO_CATEGORIA" && !isCategorySelection) {
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
      foundCategory: matchedCategory ?? null,
      categoryFromState: categoryFromState ?? null,
      stateStage: context.state.stage,
      isCategorySelection,
    });

    if (!matchedCategory) {
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

    const refinement =
      categoryFromState && !categoryMatch.matchedCategory
        ? { term: context.message.originalText.trim(), general: false }
        : extractCategoryRefinement(context.message.originalText);

    if (isCategorySelection && !refinement.term && !refinement.general) {
      const replyText = `Dentro de ${matchedCategory}, digite o nome do produto que voce procura ou veja opcoes gerais.`;
      return {
        intent: this.intent,
        handler: "ProductsHandlerCategoryPrompt",
        replyText,
        replyMessages: [replyText],
        actions: ["ask_product_name_in_category"],
        handoffRequested: false,
        telegram: {
          inlineKeyboard: buildCategoryBrowseKeyboard(matchedCategory),
        },
        stateTransition: {
          stage: "AGUARDANDO_CATEGORIA",
          awaitingProductSelectionForInterest: false,
          lastShownProducts: [],
          lastSuggestedCategories: categories,
          selectedCategoryName: matchedCategory,
          selectedProductName: undefined,
        },
      };
    }

    const categoryProducts = available.filter(
      (product) => normalizeMessageText(product.categoria) === normalizeMessageText(matchedCategory),
    );
    const filteredProducts = refinement.term
      ? categoryProducts.filter((product) => productMatchesTerm(product, refinement.term as string))
      : categoryProducts;
    const globalFallbackProducts = refinement.term
      ? available.filter((product) => productMatchesTerm(product, refinement.term as string))
      : [];
    const finalProducts = filteredProducts.length > 0 ? filteredProducts : globalFallbackProducts;
    const usedGlobalFallback = filteredProducts.length === 0 && globalFallbackProducts.length > 0;

    console.info("[ProductSearch] termo_original", context.message.originalText);
    console.info("[ProductSearch] termo_normalizado", normalizeMessageText(refinement.term ?? context.message.originalText));
    console.info("[ProductSearch] categoria_contexto", matchedCategory);
    console.info("[ProductSearch] resultados_categoria", filteredProducts.map((product) => product.nome));
    console.info("[ProductSearch] resultados_global", globalFallbackProducts.map((product) => product.nome));
    console.info("[ProductSearch] produtos_descartados", categoryProducts
      .filter((product) => refinement.term && !productMatchesTerm(product, refinement.term))
      .slice(0, 10)
      .map((product) => ({ produto: product.nome, motivo_descarte: "termo_nao_encontrado" })));
    console.info("[ProductSearch] resultado_final", {
      fallback_global: usedGlobalFallback,
      produtos: finalProducts.slice(0, 5).map((product) => product.nome),
    });

    console.info("[ProductsHandler] produtos_encontrados", {
      receivedCategory: categoryMatch.receivedCategory,
      normalizedCategory: categoryMatch.normalizedCategory,
      foundCategory: matchedCategory,
      refinement: refinement.term ?? null,
      productCount: finalProducts.length,
      products: finalProducts.slice(0, 5).map((product) => product.nome),
    });

    if (finalProducts.length === 0) {
      return {
        intent: this.intent,
        handler: "ProductsHandler",
        replyText: `Nao encontrei uma opcao boa para ${refinement.term ?? matchedCategory}.\nPosso te conectar com um vendedor.`,
        replyMessages: [`Nao encontrei uma opcao boa para ${refinement.term ?? matchedCategory}.\nPosso te conectar com um vendedor.`],
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
          selectedCategoryName: matchedCategory,
          selectedProductName: undefined,
        },
      };
    }

    const offset = extractCategoryOffset(context.message.originalText);
    const displayedProducts = finalProducts.slice(offset, offset + 3);
    const selectedProductName = displayedProducts.length === 1 ? displayedProducts[0]!.nome : undefined;
    const hasMoreProducts = offset + displayedProducts.length < finalProducts.length;
    const replyText = `${usedGlobalFallback ? "Nao achei dentro da categoria, mas encontrei no catalogo" : `Encontrei boas opcoes em ${matchedCategory}`}\n\n${buildProductListLines(displayedProducts)}`;

    return {
      intent: this.intent,
      handler: "ProductsHandler",
      replyText,
      replyMessages: [replyText],
      actions: ["list_products_by_category", "await_product_choice"],
      handoffRequested: false,
      telegram: {
        inlineKeyboard: buildProductListKeyboard(displayedProducts.map((item) => item.nome), {
          categoryName: matchedCategory,
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
        selectedCategoryName: matchedCategory,
        selectedProductName,
      },
    };
  }
}
