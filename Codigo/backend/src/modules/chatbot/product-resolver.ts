import type { Produto } from "../../types/domain.js";
import { normalizeMessageText } from "./message-normalizer.js";

const PRODUCT_SEARCH_STOPWORDS = new Set([
  "oi",
  "ola",
  "menu",
  "produtos",
  "produto",
  "promocao",
  "promocoes",
  "vendedor",
  "sim",
  "nao",
  "categoria",
]);

function tokenize(value: string): string[] {
  return normalizeMessageText(value)
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
}

function shouldSkipProductLookup(normalizedText: string): boolean {
  if (normalizedText.length < 4) {
    return true;
  }

  if (PRODUCT_SEARCH_STOPWORDS.has(normalizedText)) {
    return true;
  }

  return /^[0-9]+$/.test(normalizedText);
}

function scoreProductMatch(query: string, product: Produto): number {
  const normalizedQuery = normalizeMessageText(query);
  const normalizedName = normalizeMessageText(product.nome);

  if (normalizedName === normalizedQuery) {
    return 100;
  }

  if (normalizedName.startsWith(normalizedQuery)) {
    return 80;
  }

  if (normalizedName.includes(normalizedQuery)) {
    return 60;
  }

  const queryTokens = tokenize(query);
  const productTokens = tokenize(product.nome);
  const tokenHits = queryTokens.filter((token) => productTokens.some((item) => item.includes(token))).length;

  if (tokenHits === 0) {
    return 0;
  }

  return tokenHits * 10;
}

export async function findMatchingProducts(
  originalText: string,
  searchByName: (term: string) => Promise<Produto[]>,
  listProducts: () => Promise<Produto[]>,
): Promise<{ searchedProduct: string; products: Produto[] }> {
  const searchedProduct = originalText.trim();
  const normalizedQuery = normalizeMessageText(searchedProduct);

  if (shouldSkipProductLookup(normalizedQuery)) {
    return { searchedProduct, products: [] };
  }

  const directResults = await searchByName(searchedProduct);
  const sourceProducts = directResults.length > 0 ? directResults : await listProducts();
  const sorted = sourceProducts
    .map((product) => ({ product, score: scoreProductMatch(searchedProduct, product) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .map((item) => item.product);

  return {
    searchedProduct,
    products: sorted.slice(0, 5),
  };
}
