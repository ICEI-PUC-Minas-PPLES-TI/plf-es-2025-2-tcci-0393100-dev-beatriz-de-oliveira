import type { ProductSearchInput } from "../../repositories/products.repository.js";
import type { Produto } from "../../types/domain.js";
import { normalizeMessageText } from "./message-normalizer.js";

const PRODUCT_SEARCH_STOPWORDS = new Set([
  "oi",
  "ola",
  "menu",
  "produtos",
  "produto",
  "opcoes",
  "geral",
  "gerais",
  "promocao",
  "promocoes",
  "vendedor",
  "sim",
  "nao",
  "categoria",
  "gostaria",
  "queria",
  "quero",
  "ver",
  "qual",
  "quais",
  "vocês",
  "voces",
  "teriam",
  "tem",
  "teria",
  "mostrar",
  "me",
  "para",
  "de",
  "da",
  "do",
  "um",
  "uma",
]);

const CATEGORY_EQUIVALENTS: Record<string, string[]> = {
  tv: ["tv", "tvs", "televisao", "televisoes"],
  celular: ["celular", "celulares", "smartphone", "smartphones"],
  "caixa de som": ["caixa de som", "caixa som", "som bluetooth", "speaker", "alto falante"],
  "power bank": ["power bank", "carregador portatil", "bateria portatil"],
};

type ProductMatchDiagnostics = {
  productName: string;
  score: number;
  matchedExactPhrase: boolean;
  matchedAllTokensInName: boolean;
  matchedTokensInCategory: boolean;
  matchedTokensCount: number;
  discardedReason?: string;
};

export type ProductSearchResult = {
  searchedProduct: string;
  extractedTerm: string;
  requiredTokens: string[];
  products: Produto[];
  matchedProducts: ProductMatchDiagnostics[];
  discardedProducts: ProductMatchDiagnostics[];
};

function normalizeFreeText(value: string): string {
  return normalizeMessageText(value).replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

function extractMainTerm(originalText: string): string {
  const lower = originalText.trim();
  const beforeQuestion = lower.split(/[?!]/)[0] ?? lower;
  const beforeComma = beforeQuestion.split(",")[0] ?? beforeQuestion;
  const cleanedPrefix = beforeComma
    .replace(/^(gostaria de ver|gostaria de|queria ver|quero ver|quero|queria|gostaria)\s+/i, "")
    .replace(/^(me mostra|mostrar|procuro|preciso de|tem|teria|voc[eê]s tem)\s+/i, "")
    .trim();

  return cleanedPrefix || beforeQuestion.trim();
}

function tokenizeRelevantTerms(value: string): string[] {
  return normalizeFreeText(value)
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2)
    .filter((item) => !PRODUCT_SEARCH_STOPWORDS.has(item));
}

function expandTokenEquivalents(tokens: string[]): string[] {
  const expanded = new Set(tokens);
  const normalizedPhrase = tokens.join(" ");

  for (const [key, equivalents] of Object.entries(CATEGORY_EQUIVALENTS)) {
    const normalizedKey = normalizeMessageText(key);
    const normalizedEquivalents = equivalents.map((item) => normalizeMessageText(item));
    if (normalizedPhrase.includes(normalizedKey) || normalizedEquivalents.some((item) => normalizedPhrase.includes(item))) {
      for (const item of normalizedEquivalents) {
        expanded.add(item);
      }
    }
  }

  return Array.from(expanded);
}

function buildSearchInput(originalText: string): ProductSearchInput {
  const extractedTerm = extractMainTerm(originalText);
  const requiredTokens = tokenizeRelevantTerms(extractedTerm);

  return {
    originalText: originalText.trim(),
    extractedTerm,
    normalizedExactPhrase: normalizeFreeText(extractedTerm),
    requiredTokens: expandTokenEquivalents(requiredTokens),
  };
}

function shouldSkipProductLookup(searchInput: ProductSearchInput): boolean {
  if (searchInput.normalizedExactPhrase.length < 2) {
    return true;
  }

  if (PRODUCT_SEARCH_STOPWORDS.has(searchInput.normalizedExactPhrase)) {
    return true;
  }

  if (searchInput.normalizedExactPhrase.length < 4 && tokenizeRelevantTerms(searchInput.extractedTerm).length === 0) {
    return true;
  }

  return /^[0-9]+$/.test(searchInput.normalizedExactPhrase);
}

function countMatchedTokens(value: string, tokens: string[]): number {
  const normalizedValue = normalizeFreeText(value);
  return tokens.filter((token) => normalizedValue.includes(token)).length;
}

function scoreProductMatch(searchInput: ProductSearchInput, product: Produto): ProductMatchDiagnostics {
  const normalizedName = normalizeFreeText(product.nome);
  const normalizedCategory = normalizeFreeText(product.categoria ?? "");
  const normalizedDescription = normalizeFreeText(product.descricao ?? "");
  const exactPhrase = searchInput.normalizedExactPhrase;
  const originalExactPhraseTokens = tokenizeRelevantTerms(searchInput.extractedTerm);
  const exactPhraseTokens = expandTokenEquivalents(originalExactPhraseTokens);
  const matchedTokensInName = countMatchedTokens(product.nome, exactPhraseTokens);
  const matchedTokensInCategory = countMatchedTokens(product.categoria ?? "", exactPhraseTokens);
  const matchedTokensInDescription = countMatchedTokens(product.descricao ?? "", exactPhraseTokens);
  const matchedExactPhrase = Boolean(exactPhrase) && normalizedName.includes(exactPhrase);
  const matchedAllTokensInName = exactPhraseTokens.length > 0 && matchedTokensInName >= exactPhraseTokens.length;
  const matchedTokensInCategoryFlag = exactPhraseTokens.length > 0 && matchedTokensInCategory > 0;

  let score = 0;
  let discardedReason: string | undefined;

  if (matchedExactPhrase) {
    score += 120;
  }

  if (matchedAllTokensInName) {
    score += 80;
  } else if (matchedTokensInName > 0) {
    score += matchedTokensInName * 10;
  }

  if (matchedTokensInCategoryFlag) {
    score += matchedTokensInCategory >= exactPhraseTokens.length ? 30 : 10;
  }

  if (matchedTokensInDescription > 0 && score > 0) {
    score += Math.min(matchedTokensInDescription * 2, 6);
  }

  if (matchedExactPhrase || (exactPhraseTokens.length === 1 && matchedTokensInName > 0)) {
    discardedReason = undefined;
  } else if (!matchedExactPhrase && originalExactPhraseTokens.length >= 2 && !matchedAllTokensInName) {
    discardedReason = "missing_required_tokens_in_name";
    score = 0;
  } else if (!matchedExactPhrase && matchedTokensInName === 0 && matchedTokensInCategory === 0) {
    discardedReason = "no_name_or_category_match";
    score = 0;
  } else if (matchedTokensInName === 1 && originalExactPhraseTokens.length >= 2 && matchedTokensInCategory === 0) {
    discardedReason = "single_token_weak_match";
    score = 0;
  } else if (!matchedExactPhrase && matchedTokensInDescription > 0 && matchedTokensInName === 0) {
    discardedReason = "description_only_match";
    score = 0;
  }

  return {
    productName: product.nome,
    score,
    matchedExactPhrase,
    matchedAllTokensInName,
    matchedTokensInCategory: matchedTokensInCategoryFlag,
    matchedTokensCount: matchedTokensInName,
    discardedReason,
  };
}

export async function findMatchingProducts(
  originalText: string,
  searchByName: (input: ProductSearchInput) => Promise<Produto[]>,
  listProducts: () => Promise<Produto[]>,
): Promise<ProductSearchResult> {
  const searchInput = buildSearchInput(originalText);

  if (shouldSkipProductLookup(searchInput)) {
    return {
      searchedProduct: searchInput.originalText,
      extractedTerm: searchInput.extractedTerm,
      requiredTokens: tokenizeRelevantTerms(searchInput.extractedTerm),
      products: [],
      matchedProducts: [],
      discardedProducts: [],
    };
  }

  const directResults = await searchByName(searchInput);
  const sourceProducts = directResults.length > 0 ? directResults : await listProducts();
  const scoredProducts = sourceProducts.map((product) => ({
    product,
    diagnostics: scoreProductMatch(searchInput, product),
  }));

  const matchedProducts = scoredProducts
    .filter((item) => item.diagnostics.score > 0)
    .sort((left, right) => right.diagnostics.score - left.diagnostics.score)
    .slice(0, 5);

  const discardedProducts = scoredProducts
    .filter((item) => item.diagnostics.score <= 0)
    .filter((item) => item.diagnostics.discardedReason)
    .map((item) => item.diagnostics);

  return {
    searchedProduct: searchInput.originalText,
    extractedTerm: searchInput.extractedTerm,
    requiredTokens: tokenizeRelevantTerms(searchInput.extractedTerm),
    products: matchedProducts.map((item) => item.product),
    matchedProducts: matchedProducts.map((item) => item.diagnostics),
    discardedProducts,
  };
}
