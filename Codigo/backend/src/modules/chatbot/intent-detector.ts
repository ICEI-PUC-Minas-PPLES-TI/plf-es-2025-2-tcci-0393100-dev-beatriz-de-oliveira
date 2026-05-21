import { normalizeMessageText } from "./message-normalizer.js";
import type { ChatbotConversationState, ChatbotIntent } from "./types.js";

function hasAnyKeyword(value: string, keywords: string[]): boolean {
  return keywords.some((keyword) => value.includes(keyword));
}

const GREETING_KEYWORDS = ["oi", "ola", "bom dia", "boa tarde", "boa noite", "e ai", "opa"];
const MENU_KEYWORDS = ["menu", "opcoes", "opcao", "ajuda", "inicio", "comecar"];
const PRODUCTS_KEYWORDS = [
  "produto",
  "produtos",
  "categoria",
  "tv",
  "tvs",
  "televisao",
  "televisoes",
  "celular",
  "celulares",
  "eletronico",
  "eletronicos",
  "catalogo",
  "catalog",
  "mostrar produtos",
  "ver produtos",
  "ver mais",
  "detalhes",
  "me mostra",
  "o que voces tem",
  "o que voces possuem",
  "tem ",
];
const PROMOTIONS_KEYWORDS = ["promocao", "promocoes", "oferta", "ofertas", "desconto", "descontos"];
const PRICE_QUERY_KEYWORDS = ["qual preco", "qual o preco", "qual valor", "qual o valor", "quanto custa", "valor do", "valor da", "preco do", "preco da"];
const LEAD_INTEREST_KEYWORDS = [
  "tenho interesse",
  "gostei",
  "quero comprar",
  "quero esse",
  "quero este",
  "tenho interesse nesse",
  "orcamento",
  "quero cotacao",
];
const HUMAN_HANDOFF_KEYWORDS = [
  "quero falar com vendedor",
  "falar com vendedor",
  "tem atendente",
  "quero atendimento",
  "atendimento humano",
  "falar com humano",
  "falar com atendente",
  "atendente",
  "vendedor",
  "humano",
];
const AFFIRMATIVE_PATTERNS = [
  /\bsim\b/,
  /\bquero\b/,
  /\bclaro\b/,
  /\bpode ser\b/,
  /\bisso\b/,
  /\besse\b/,
  /\beste\b/,
  /\bok\b/,
  /\bo primeiro\b/,
  /\bprimeiro\b/,
];
const NEGATIVE_PATTERNS = [/\bnao\b/, /\bagora nao\b/, /\bdepois\b/, /\bnao precisa\b/, /\bdispenso\b/];

export function isAffirmativeMessage(normalizedText: string): boolean {
  return AFFIRMATIVE_PATTERNS.some((pattern) => pattern.test(normalizedText));
}

export function isNegativeMessage(normalizedText: string): boolean {
  return NEGATIVE_PATTERNS.some((pattern) => pattern.test(normalizedText));
}

export function parseProductChoice(normalizedText: string, totalProducts: number): number | null {
  if (totalProducts <= 0) {
    return null;
  }

  const digitMatch = normalizedText.match(/\b([1-9])\b/);
  if (digitMatch?.[1]) {
    const number = Number.parseInt(digitMatch[1], 10);
    if (number >= 1 && number <= totalProducts) {
      return number - 1;
    }
  }

  if (normalizedText.includes("primeiro") || normalizedText.includes("o primeiro")) return 0;
  if (normalizedText.includes("segundo")) return totalProducts >= 2 ? 1 : null;
  if (normalizedText.includes("terceiro")) return totalProducts >= 3 ? 2 : null;
  if (normalizedText.includes("esse") || normalizedText.includes("este")) return 0;

  return null;
}

export function detectIntent(normalizedText: string, state: ChatbotConversationState): ChatbotIntent {
  if (!normalizedText) {
    return "unknown";
  }

  if (state.awaitingHumanHandoffDecision) {
    if (isAffirmativeMessage(normalizedText)) return "human_handoff";
    if (isNegativeMessage(normalizedText)) return "menu";
  }

  const isPriceQuery = hasAnyKeyword(normalizedText, PRICE_QUERY_KEYWORDS);
  if (state.awaitingPromotionPriceQuery) {
    return "promotions";
  }

  if ((state.awaitingPromotionPriceQuery || state.recentPromotions.length > 0) && isPriceQuery) {
    return "promotions";
  }

  if (state.stage === "AGUARDANDO_ESCOLHA_PRODUTO") {
    if (/^categoria\s+.+\s+pagina\s+\d+$/i.test(normalizedText)) return "products";
    if (/^categoria\s+.+\s+geral$/i.test(normalizedText)) return "products";

    const choiceIndex = parseProductChoice(normalizedText, state.lastShownProducts.length);
    if (choiceIndex !== null) return state.awaitingProductSelectionForInterest ? "lead_interest" : "products";

    const mentionsKnownProduct = state.lastShownProducts.some((productName) =>
      normalizedText.includes(normalizeMessageText(productName)),
    );
    if (mentionsKnownProduct) {
      if (hasAnyKeyword(normalizedText, HUMAN_HANDOFF_KEYWORDS)) return "human_handoff";
      if (hasAnyKeyword(normalizedText, LEAD_INTEREST_KEYWORDS) || isAffirmativeMessage(normalizedText)) return "lead_interest";
      if (hasAnyKeyword(normalizedText, PRODUCTS_KEYWORDS)) return "products";
      return state.awaitingProductSelectionForInterest ? "lead_interest" : "products";
    }

    if (isAffirmativeMessage(normalizedText)) return "lead_interest";
    if (isNegativeMessage(normalizedText)) return "menu";
  }

  if (state.stage === "AGUARDANDO_CATEGORIA") {
    if (hasAnyKeyword(normalizedText, HUMAN_HANDOFF_KEYWORDS)) return "human_handoff";
    if (hasAnyKeyword(normalizedText, PROMOTIONS_KEYWORDS)) return "promotions";
    if (hasAnyKeyword(normalizedText, MENU_KEYWORDS)) return "menu";
    return "products";
  }

  if (state.stage === "MENU_PRINCIPAL") {
    if (normalizedText === "1") return "products";
    if (normalizedText === "2") return "promotions";
    if (normalizedText === "3") return "human_handoff";
  }

  if (hasAnyKeyword(normalizedText, HUMAN_HANDOFF_KEYWORDS)) return "human_handoff";
  if (hasAnyKeyword(normalizedText, LEAD_INTEREST_KEYWORDS)) return "lead_interest";
  if (hasAnyKeyword(normalizedText, PROMOTIONS_KEYWORDS)) return "promotions";
  if (hasAnyKeyword(normalizedText, PRODUCTS_KEYWORDS)) return "products";
  if (hasAnyKeyword(normalizedText, MENU_KEYWORDS)) return "menu";
  if (hasAnyKeyword(normalizedText, GREETING_KEYWORDS)) return "greeting";

  return "unknown";
}
