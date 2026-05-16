import type { LeadsService } from "../../../services/leads.service.js";
import type { ProductsService } from "../../../services/products.service.js";
import type { PromotionsService } from "../../../services/promotions.service.js";
import type { Produto, Promocao } from "../../../types/domain.js";
import { normalizeMessageText } from "../message-normalizer.js";
import type { ChatbotContext, ChatbotResponse, IntentHandler } from "../types.js";
import { buildCommercialHandoffText } from "./shared.js";

const PROMOTION_PRICE_KEYWORDS = [
  "qual valor",
  "quanto custa",
  "preco",
  "valor do",
  "valor da",
  "valor de",
  "na promocao",
  "promocao do",
  "promocao da",
];

const PROMOTION_PRODUCT_STOPWORDS = new Set([
  "qual",
  "valor",
  "preco",
  "quanto",
  "custa",
  "custo",
  "produto",
  "promocao",
  "promocoes",
  "oferta",
  "ofertas",
  "desconto",
  "descontos",
  "do",
  "da",
  "de",
  "na",
  "no",
  "em",
  "a",
  "o",
  "um",
  "uma",
]);

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString("pt-BR");
}

function parseMoney(value: string): number {
  const cleaned = value
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function isPromotionPriceQuestion(normalizedText: string): boolean {
  const hasPriceTerm = PROMOTION_PRICE_KEYWORDS.some((keyword) => normalizedText.includes(keyword));
  const hasPromotionTerm = normalizedText.includes("promocao") || normalizedText.includes("oferta") || normalizedText.includes("desconto");
  return hasPriceTerm && hasPromotionTerm;
}

function productTokensFromMessage(normalizedText: string): string[] {
  return normalizedText
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length > 1)
    .filter((token) => !PROMOTION_PRODUCT_STOPWORDS.has(token));
}

function scorePromotionMatch(promotion: Promocao, product: Produto | undefined, tokens: string[]): number {
  if (tokens.length === 0) {
    return 0;
  }

  const searchable = normalizeMessageText(`${promotion.produto} ${product?.nome ?? ""} ${product?.categoria ?? ""} ${product?.descricao ?? ""}`);
  const matchedTokens = tokens.filter((token) => searchable.includes(token));
  const name = normalizeMessageText(`${promotion.produto} ${product?.nome ?? ""}`);
  const matchedNameTokens = tokens.filter((token) => name.includes(token));

  if (matchedTokens.length === 0) {
    return 0;
  }

  return matchedTokens.length * 10 + matchedNameTokens.length * 20 + (matchedNameTokens.length === tokens.length ? 50 : 0);
}

function resolvePromotionProduct(
  promotions: Promocao[],
  products: Produto[],
  normalizedText: string,
): { promotion: Promocao; product?: Produto } | null {
  const tokens = productTokensFromMessage(normalizedText);
  if (tokens.length === 0) {
    return null;
  }

  const productsById = new Map(products.map((product) => [product.id, product]));
  const ranked = promotions
    .map((promotion) => {
      const product = productsById.get(promotion.produto_id);
      return {
        promotion,
        product,
        score: scorePromotionMatch(promotion, product, tokens),
      };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score);

  return ranked[0] ? { promotion: ranked[0].promotion, product: ranked[0].product } : null;
}

function calculatePromotionalPrice(product: Produto, promotion: Promocao) {
  const originalPrice = parseMoney(product.preco);
  const rawDiscount = promotion.desconto.trim();
  const discountValue = parseMoney(rawDiscount);
  const isFixedDiscount = /r\$|real|reais|fixo/i.test(rawDiscount);
  const finalPrice = isFixedDiscount
    ? Math.max(0, originalPrice - discountValue)
    : Math.max(0, originalPrice * (1 - discountValue / 100));

  return {
    originalPrice,
    finalPrice,
    discountLabel: isFixedDiscount ? formatMoney(discountValue) : `${discountValue.toLocaleString("pt-BR")}%`,
  };
}

export class PromotionsHandler implements IntentHandler {
  intent = "promotions" as const;

  constructor(
    private readonly promotionsService: PromotionsService,
    private readonly productsService: ProductsService,
    private readonly leadsService: LeadsService,
  ) {}

  async handle(context: ChatbotContext): Promise<ChatbotResponse> {
    const promotions = await this.promotionsService.listActive();

    if (promotions.length === 0) {
      return {
        intent: this.intent,
        handler: "PromotionsHandler",
        replyText: "No momento, nao encontrei promocoes ativas.\nEscolha como quer continuar",
        replyMessages: ["No momento, nao encontrei promocoes ativas.\nEscolha como quer continuar"],
        actions: ["promotions_empty"],
        handoffRequested: false,
        telegram: {
          inlineKeyboard: [
            [{ text: "Produtos", callbackData: "MENU:PRODUCTS" }],
            [{ text: "Falar com vendedor", callbackData: "MENU:HUMAN_HANDOFF" }],
          ],
        },
        stateTransition: {
          stage: "MENU_PRINCIPAL",
          awaitingHumanHandoffDecision: false,
        },
      };
    }

    if (isPromotionPriceQuestion(context.message.normalizedText)) {
      const products = await this.productsService.list();
      const match = resolvePromotionProduct(promotions, products, context.message.normalizedText);

      if (!match?.product) {
        return {
          intent: this.intent,
          handler: "PromotionPriceHandler",
          replyText: "Qual produto da promocao voce quer consultar?",
          replyMessages: ["Qual produto da promocao voce quer consultar?"],
          actions: ["promotion_price_product_missing"],
          handoffRequested: false,
          telegram: {
            inlineKeyboard: [[{ text: "Ver promocoes", callbackData: "MENU:PROMOTIONS" }]],
          },
          stateTransition: {
            stage: "MENU_PRINCIPAL",
            awaitingHumanHandoffDecision: false,
          },
        };
      }

      const { originalPrice, finalPrice, discountLabel } = calculatePromotionalPrice(match.product, match.promotion);
      const replyText = [
        `${match.product.nome} esta em promocao.`,
        `De: ${formatMoney(originalPrice)}`,
        `Por: ${formatMoney(finalPrice)}`,
        `Desconto: ${discountLabel}`,
        `Promocao valida ate: ${formatDate(match.promotion.fim_em)}`,
        "",
        "Posso te conectar com um vendedor se quiser finalizar.",
      ].join("\n");

      await this.leadsService.upsertByPhone({
        phone: context.message.from,
        name: context.message.currentCustomerName ?? context.message.profileName,
        interest: `Promocao consultada: ${match.product.nome}`,
        status: "EM_CONTATO",
        channel: context.message.channel,
      });

      return {
        intent: this.intent,
        handler: "PromotionPriceHandler",
        replyText,
        replyMessages: [replyText],
        actions: ["promotion_price_calculated", "lead_upserted"],
        handoffRequested: false,
        telegram: {
          inlineKeyboard: [[{ text: "Falar com vendedor", callbackData: "MENU:HUMAN_HANDOFF" }]],
        },
        stateTransition: {
          stage: "MENU_PRINCIPAL",
          awaitingHumanHandoffDecision: false,
          selectedProductName: match.product.nome,
        },
      };
    }

    const summary = promotions
      .slice(0, 2)
      .map((promotion, index) => `${index + 1}) ${promotion.produto} - ate ${formatDate(promotion.fim_em)}`)
      .join("\n");

    return {
      intent: this.intent,
      handler: "PromotionsHandler",
      replyText: `Estas promocoes merecem atencao\n\n${summary}`,
      replyMessages: [`Estas promocoes merecem atencao\n\n${summary}`, buildCommercialHandoffText()],
      actions: ["promotions_listed"],
      handoffRequested: false,
      telegram: {
        inlineKeyboard: [[{ text: "Falar com vendedor", callbackData: "MENU:HUMAN_HANDOFF" }]],
      },
      stateTransition: {
        stage: "MENU_PRINCIPAL",
        awaitingHumanHandoffDecision: false,
      },
    };
  }
}
