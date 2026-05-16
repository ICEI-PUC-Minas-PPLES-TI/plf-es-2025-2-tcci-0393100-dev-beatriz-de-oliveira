import type { ChatbotResponse } from "../../modules/chatbot/types.js";
import type { Produto } from "../../types/domain.js";

export type TelegramProductCard = {
  name: string;
  price: string;
  description?: string;
  imageUrl?: string;
  images: string[];
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
      imageUrl: product.primaryImage || product.imagem || product.images?.find((image) => image.principal)?.imageUrl || product.images?.[0]?.imageUrl,
      images: (product.images?.map((image) => image.imageUrl).filter(Boolean) ?? []).length > 0
        ? product.images.map((image) => image.imageUrl).filter(Boolean)
        : [product.primaryImage || product.imagem].filter((image): image is string => Boolean(image)),
    })),
    fallbackText: undefined,
  };
}

export function buildTelegramPhotoCaption(card: TelegramProductCard): string {
  const parts = [`📦 ${card.name}`, `💰 ${card.price}`];
  if (card.description) {
    parts.push(card.description);
  }
  return parts.join("\n\n").slice(0, 1024);
}

export function buildTelegramTextCard(card: TelegramProductCard): string {
  return buildTelegramPhotoCaption({
    ...card,
    imageUrl: undefined,
  });
}
