import type { ProductsService } from "../../../services/products.service.js";
import type { PromotionsService } from "../../../services/promotions.service.js";
import type { Promocao, Produto } from "../../../types/domain.js";
import { normalizeMessageText } from "../message-normalizer.js";
import type { ChatbotContext, ChatbotResponse, IntentHandler } from "../types.js";

const PAGE_SIZE = 5;
const GENERIC_PRODUCT_PATTERNS = [
  /\bver produtos\b/,
  /\bmostrar produtos\b/,
  /\bquero ver tudo\b/,
  /\bver tudo\b/,
  /\bquero ver produtos\b/,
  /\bme mostra\b/,
  /\bcatalogo\b/,
  /\bproduto\b/,
  /\bprodutos\b/,
];
const SHOW_MORE_PATTERNS = [/\bmais\b/, /\bver mais\b/, /\bmostrar mais\b/, /\bmais itens\b/, /\bmais produtos\b/];

type ProductFilters = {
  category?: string;
  searchTerm?: string;
  promotionOnly: boolean;
  minPrice?: number;
  maxPrice?: number;
};

function toCurrency(value: string): string {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }
  return parsed.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function parsePriceNumber(raw: string): number | null {
  const digits = raw.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number.parseFloat(digits);
  return Number.isFinite(parsed) ? parsed : null;
}

function isGenericProductRequest(normalizedText: string): boolean {
  return GENERIC_PRODUCT_PATTERNS.some((pattern) => pattern.test(normalizedText));
}

function isShowMoreRequest(normalizedText: string): boolean {
  return SHOW_MORE_PATTERNS.some((pattern) => pattern.test(normalizedText));
}

function extractRequestedTerm(normalizedText: string): string | undefined {
  const patterns = [
    /(?:nome|produto|buscar|procuro|quero)\s+(?:do|da|de)?\s*(.+)/,
    /(?:tem|possui|tem ai|tem aí)\s+(.+)/,
  ];

  for (const pattern of patterns) {
    const value = pattern.exec(normalizedText)?.[1]?.trim();
    if (value && value.length >= 3) {
      return value;
    }
  }

  return undefined;
}

function normalizeSearchTerm(
  normalizedText: string,
  requestedTerm: string | undefined,
  requestedCategory: string | undefined,
): string | undefined {
  if (!requestedTerm) {
    return undefined;
  }

  const normalizedTerm = normalizeMessageText(requestedTerm)
    .replace(/\b(ver|mostrar|quero|produtos?|itens?|categoria)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalizedTerm) {
    return undefined;
  }

  if (isGenericProductRequest(normalizedText)) {
    return undefined;
  }

  if (requestedCategory && normalizedTerm.includes(normalizeMessageText(requestedCategory))) {
    return undefined;
  }

  return normalizedTerm;
}

function extractPriceRange(normalizedText: string): Pick<ProductFilters, "minPrice" | "maxPrice"> {
  const betweenMatch = normalizedText.match(/(?:entre|de)\s+([\d.,]+)\s+(?:e|ate)\s+([\d.,]+)/);
  if (betweenMatch) {
    const minPrice = parsePriceNumber(betweenMatch[1] ?? "");
    const maxPrice = parsePriceNumber(betweenMatch[2] ?? "");
    if (minPrice !== null || maxPrice !== null) {
      return { minPrice: minPrice ?? undefined, maxPrice: maxPrice ?? undefined };
    }
  }

  const maxMatch = normalizedText.match(/(?:ate|no maximo|maximo de)\s+([\d.,]+)/);
  if (maxMatch) {
    return { maxPrice: parsePriceNumber(maxMatch[1] ?? "") ?? undefined };
  }

  const minMatch = normalizedText.match(/(?:acima de|a partir de|mais de)\s+([\d.,]+)/);
  if (minMatch) {
    return { minPrice: parsePriceNumber(minMatch[1] ?? "") ?? undefined };
  }

  return {};
}

function sortCategoriesByPriority(categories: string[]): string[] {
  const priority = ["sala", "quarto", "cozinha", "eletrodomesticos", "eletrodomésticos"];

  return [...categories].sort((left, right) => {
    const leftIndex = priority.indexOf(normalizeMessageText(left));
    const rightIndex = priority.indexOf(normalizeMessageText(right));
    if (leftIndex !== -1 || rightIndex !== -1) {
      if (leftIndex === -1) return 1;
      if (rightIndex === -1) return -1;
      return leftIndex - rightIndex;
    }
    return left.localeCompare(right, "pt-BR");
  });
}

function buildCategoryPrompt(categories: string[]): string {
  const suggested = sortCategoriesByPriority(categories).slice(0, 6).join(", ");
  return [
    "Temos muitos produtos cadastrados, então para te atender mais rápido, nossos itens são organizados por categoria.",
    `Me diga qual categoria você quer ver, por exemplo: ${suggested}.`,
  ].join("\n");
}

function formatProductLine(product: Produto, index: number): string {
  const lines = [`${index + 1}) ${product.nome} - ${toCurrency(product.preco)}`];
  if (product.imagem) {
    lines.push(`Imagem: ${product.imagem}`);
  }
  return lines.join("\n");
}

function pickDetectedCategory(normalizedText: string, categories: string[]): string | undefined {
  const normalizedCategories = categories.map((category) => ({
    original: category,
    normalized: normalizeMessageText(category),
  }));

  const exact = normalizedCategories.find((category) => normalizedText === category.normalized);
  if (exact) {
    return exact.original;
  }

  const contains = normalizedCategories.find((category) => normalizedText.includes(category.normalized));
  if (contains) {
    return contains.original;
  }

  return undefined;
}

function rankProducts(products: Produto[], promotions: Promocao[]): Produto[] {
  const promotedIds = new Set(promotions.filter((promotion) => promotion.ativa).map((promotion) => promotion.produto_id));
  return [...products].sort((left, right) => {
    const leftPromotionScore = promotedIds.has(left.id) ? 1 : 0;
    const rightPromotionScore = promotedIds.has(right.id) ? 1 : 0;
    if (leftPromotionScore !== rightPromotionScore) {
      return rightPromotionScore - leftPromotionScore;
    }
    return right.id - left.id;
  });
}

function applyFilters(products: Produto[], filters: ProductFilters, promotions: Promocao[]): Produto[] {
  const promotedIds = new Set(promotions.filter((promotion) => promotion.ativa).map((promotion) => promotion.produto_id));
  return products.filter((product) => {
    if (!product.disponivel) {
      return false;
    }

    if (filters.category && normalizeMessageText(product.categoria) !== normalizeMessageText(filters.category)) {
      return false;
    }

    if (filters.searchTerm) {
      const haystack = normalizeMessageText(`${product.nome} ${product.categoria} ${product.descricao}`);
      if (!haystack.includes(filters.searchTerm)) {
        return false;
      }
    }

    const price = Number.parseFloat(product.preco);
    if (filters.minPrice !== undefined && Number.isFinite(price) && price < filters.minPrice) {
      return false;
    }
    if (filters.maxPrice !== undefined && Number.isFinite(price) && price > filters.maxPrice) {
      return false;
    }

    if (filters.promotionOnly && !promotedIds.has(product.id)) {
      return false;
    }

    return true;
  });
}

function summarizeAppliedFilters(filters: ProductFilters): string | undefined {
  const parts: string[] = [];
  if (filters.promotionOnly) parts.push("em promoção");
  if (filters.searchTerm) parts.push(`com "${filters.searchTerm}"`);
  if (filters.minPrice !== undefined && filters.maxPrice !== undefined) {
    parts.push(`entre ${toCurrency(String(filters.minPrice))} e ${toCurrency(String(filters.maxPrice))}`);
  } else if (filters.minPrice !== undefined) {
    parts.push(`a partir de ${toCurrency(String(filters.minPrice))}`);
  } else if (filters.maxPrice !== undefined) {
    parts.push(`até ${toCurrency(String(filters.maxPrice))}`);
  }
  return parts.length > 0 ? parts.join(", ") : undefined;
}

export class ProductsHandler implements IntentHandler {
  intent = "products" as const;

  constructor(
    private readonly productsService: ProductsService,
    private readonly promotionsService: PromotionsService,
  ) {}

  async handle(context: ChatbotContext): Promise<ChatbotResponse> {
    const [products, promotions] = await Promise.all([
      this.productsService.list(),
      this.promotionsService.listActive().catch(() => []),
    ]);

    const categories = Array.from(
      new Set(
        products
          .filter((product) => product.disponivel)
          .map((product) => product.categoria)
          .filter((category) => category && category.trim().length > 0),
      ),
    );

    const normalizedText = context.message.normalizedText;
    const genericRequest = isGenericProductRequest(normalizedText);
    const showMore = isShowMoreRequest(normalizedText);
    const promotionOnly = /\bpromocao\b|\bpromocoes\b|\boferta\b|\bdesconto\b/.test(normalizedText);
    const requestedCategory = pickDetectedCategory(normalizedText, categories) ?? context.state.selectedProductCategory;
    const requestedTerm = extractRequestedTerm(normalizedText);
    const normalizedSearchTerm = normalizeSearchTerm(normalizedText, requestedTerm, requestedCategory);
    const priceRange = extractPriceRange(normalizedText);

    if (!requestedCategory) {
      return {
        intent: this.intent,
        handler: "ProductsHandler",
        replyText: buildCategoryPrompt(categories),
        actions: ["ask_product_category"],
        handoffRequested: false,
        stateTransition: {
          stage: "AGUARDANDO_CATEGORIA_PRODUTO",
          awaitingHumanHandoffDecision: false,
          lastShownProducts: [],
          selectedProductName: undefined,
          selectedProductCategory: undefined,
          productBrowseOffset: 0,
          productBrowseSearchTerm: undefined,
          productBrowsePromotionOnly: false,
          productBrowseMinPrice: undefined,
          productBrowseMaxPrice: undefined,
        },
      };
    }

    const filters: ProductFilters = {
      category: requestedCategory,
      searchTerm: showMore
        ? context.state.productBrowseSearchTerm
        : normalizedSearchTerm
          ? normalizedSearchTerm
          : context.state.selectedProductCategory === requestedCategory
            ? context.state.productBrowseSearchTerm
            : undefined,
      promotionOnly: showMore ? Boolean(context.state.productBrowsePromotionOnly) : promotionOnly,
      minPrice: showMore
        ? context.state.productBrowseMinPrice
        : priceRange.minPrice ?? (context.state.selectedProductCategory === requestedCategory ? context.state.productBrowseMinPrice : undefined),
      maxPrice: showMore
        ? context.state.productBrowseMaxPrice
        : priceRange.maxPrice ?? (context.state.selectedProductCategory === requestedCategory ? context.state.productBrowseMaxPrice : undefined),
    };

    const filteredProducts = rankProducts(applyFilters(products, filters, promotions), promotions);
    if (filteredProducts.length === 0) {
      const filterSummary = summarizeAppliedFilters(filters);
      return {
        intent: this.intent,
        handler: "ProductsHandler",
        replyText: [
          filterSummary
            ? `Não encontrei itens na categoria ${requestedCategory} ${filterSummary}.`
            : `Não encontrei itens disponíveis na categoria ${requestedCategory}.`,
          "Se quiser, posso buscar com outro valor, nome do produto ou somente itens em promoção.",
        ].join("\n"),
        actions: ["list_products_empty_for_category"],
        handoffRequested: false,
        stateTransition: {
          stage: "AGUARDANDO_CATEGORIA_PRODUTO",
          lastShownProducts: [],
          selectedProductName: undefined,
          selectedProductCategory: requestedCategory,
          productBrowseOffset: 0,
          productBrowseSearchTerm: filters.searchTerm,
          productBrowsePromotionOnly: filters.promotionOnly,
          productBrowseMinPrice: filters.minPrice,
          productBrowseMaxPrice: filters.maxPrice,
        },
      };
    }

    const nextOffset = showMore ? context.state.productBrowseOffset ?? 0 : 0;
    const page = filteredProducts.slice(nextOffset, nextOffset + PAGE_SIZE);

    if (page.length === 0) {
      return {
        intent: this.intent,
        handler: "ProductsHandler",
        replyText: [
          `Já te mostrei os itens disponíveis dessa seleção em ${requestedCategory}.`,
          "Se quiser, posso refinar por preço, nome do produto ou promoção.",
        ].join("\n"),
        actions: ["list_products_finished"],
        handoffRequested: false,
        stateTransition: {
          stage: "AGUARDANDO_CATEGORIA_PRODUTO",
          lastShownProducts: [],
          selectedProductName: undefined,
          selectedProductCategory: requestedCategory,
          productBrowseOffset: filteredProducts.length,
          productBrowseSearchTerm: filters.searchTerm,
          productBrowsePromotionOnly: filters.promotionOnly,
          productBrowseMinPrice: filters.minPrice,
          productBrowseMaxPrice: filters.maxPrice,
        },
      };
    }

    const intro =
      genericRequest && context.state.stage !== "AGUARDANDO_ESCOLHA_PRODUTO"
        ? `Separei alguns produtos da categoria ${requestedCategory} para você. Vou te mostrar 5 opções primeiro.`
        : `Separei alguns produtos da categoria ${requestedCategory} para você.`;
    const filterSummary = summarizeAppliedFilters(filters);

    return {
      intent: this.intent,
      handler: "ProductsHandler",
      replyText: [
        filterSummary ? `${intro} Filtro aplicado: ${filterSummary}.` : intro,
        ...page.map((product, index) => formatProductLine(product, index)),
        "",
        "Se quiser, posso te mostrar mais itens dessa categoria, ou refinar por preço, nome do produto ou promoção.",
        "Você também pode responder com o número do item para continuar.",
      ].join("\n"),
      actions: ["list_products_by_category", "await_product_choice"],
      handoffRequested: false,
      stateTransition: {
        stage: "AGUARDANDO_ESCOLHA_PRODUTO",
        awaitingHumanHandoffDecision: false,
        lastShownProducts: page.map((item) => item.nome),
        selectedProductName: undefined,
        selectedProductCategory: requestedCategory,
        productBrowseOffset: nextOffset + page.length,
        productBrowseSearchTerm: filters.searchTerm,
        productBrowsePromotionOnly: filters.promotionOnly,
        productBrowseMinPrice: filters.minPrice,
        productBrowseMaxPrice: filters.maxPrice,
      },
    };
  }
}
