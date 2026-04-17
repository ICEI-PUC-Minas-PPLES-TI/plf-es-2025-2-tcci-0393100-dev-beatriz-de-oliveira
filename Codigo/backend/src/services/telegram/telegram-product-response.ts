import type { ChatbotResponse } from "../../modules/chatbot/types.js";
import type { Produto } from "../../types/domain.js";

export type TelegramProductCard = {
  name: string;
  price: string;
  description?: string;
  imageUrl?: string;
};

export type TelegramPreparedResponse = {
  introText?: string;
  productCards: TelegramProductCard[];
  fallbackText?: string;
};

function toCurrency(value: string): string {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }
  return parsed.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function buildCaption(product: Produto): string {
  const parts = [product.nome, toCurrency(product.preco)];
  if (product.descricao?.trim()) {
    parts.push(product.descricao.trim().slice(0, 120));
  }
  parts.push("Quer mais detalhes ou ver outras opções?");
  return parts.join("\n");
}

function extractResidualText(replyText: string): string | undefined {
  const cleaned = replyText
    .split("\n")
    .filter((line) => !/^\d+\)/.test(line.trim()))
    .filter((line) => !/^Imagem:/i.test(line.trim()))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return cleaned || undefined;
}

export function buildTelegramPreparedResponse(
  response: ChatbotResponse,
  products: Produto[],
): TelegramPreparedResponse {
  if (products.length === 0) {
    return {
      productCards: [],
      fallbackText: response.replyText,
    };
  }

  return {
    introText: extractResidualText(response.replyText),
    productCards: products.map((product) => ({
      name: product.nome,
      price: toCurrency(product.preco),
      description: product.descricao?.trim() ? product.descricao.trim().slice(0, 120) : undefined,
      imageUrl: /^https?:\/\//i.test(product.imagem ?? "") ? product.imagem : undefined,
    })),
    fallbackText: undefined,
  };
}

export function buildTelegramPhotoCaption(card: TelegramProductCard): string {
  const parts = [card.name, card.price];
  if (card.description) {
    parts.push(card.description);
  }
  parts.push("Quer mais detalhes ou ver outras opções?");
  return parts.join("\n");
}

export function buildTelegramTextCard(card: TelegramProductCard): string {
  return buildTelegramPhotoCaption({
    ...card,
    imageUrl: undefined,
  });
}
