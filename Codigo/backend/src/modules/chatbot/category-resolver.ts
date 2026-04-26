import type { Produto } from "../../types/domain.js";
import { normalizeMessageText } from "./message-normalizer.js";

const CATEGORY_SYNONYMS: Record<string, string[]> = {
  TVs: ["tv", "tvs", "televisao", "televisoes", "televisor", "televisores"],
  Celulares: ["celular", "celulares", "smartphone", "smartphones"],
  "Eletrônicos": ["eletronico", "eletronicos", "eletrônica", "eletronica"],
};

const CATEGORY_CONNECTOR_WORDS = new Set(["e", "de", "da", "do", "das", "dos", "para", "com"]);

function toSingular(value: string): string {
  if (value.endsWith("oes")) return `${value.slice(0, -3)}ao`;
  if (value.endsWith("aes")) return `${value.slice(0, -3)}ao`;
  if (value.endsWith("res")) return value.slice(0, -1);
  if (value.endsWith("es") && value.length > 4) return value.slice(0, -2);
  if (value.endsWith("s") && value.length > 3) return value.slice(0, -1);
  return value;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function tokenizeCategory(value: string): string[] {
  return unique(
    normalizeMessageText(value)
      .split(/[^a-z0-9]+/i)
      .map((token) => toSingular(token.trim()))
      .filter((token) => token.length > 1 && !CATEGORY_CONNECTOR_WORDS.has(token)),
  );
}

function countTokenMatches(left: string[], right: string[]): number {
  return left.filter((token) => right.includes(token)).length;
}

function buildCategoryAliases(categoryName: string): string[] {
  const normalized = normalizeMessageText(categoryName);
  const aliases = [normalized, toSingular(normalized)];

  for (const [canonicalName, synonymList] of Object.entries(CATEGORY_SYNONYMS)) {
    if (normalizeMessageText(canonicalName) === normalized) {
      aliases.push(...synonymList.map((item) => normalizeMessageText(item)));
    }
  }

  return unique(aliases.filter(Boolean));
}

function findCanonicalCategoryName(categoryName: string, availableCategories: string[]): string {
  const normalizedCategory = normalizeMessageText(categoryName);
  return (
    availableCategories.find((item) => normalizeMessageText(item) === normalizedCategory)
    ?? availableCategories.find((item) => buildCategoryAliases(item).includes(normalizedCategory))
    ?? categoryName
  );
}

export function listAvailableCategories(products: Produto[]): string[] {
  return unique(
    products
      .filter((product) => product.disponivel)
      .map((product) => product.categoria?.trim())
      .filter((category): category is string => Boolean(category)),
  ).sort((left, right) => left.localeCompare(right, "pt-BR"));
}

export function resolveCategoryName(input: string, availableCategories: string[]): {
  receivedCategory: string;
  normalizedCategory: string;
  matchedCategory?: string;
} {
  const receivedCategory = input.trim();
  const normalizedCategory = toSingular(normalizeMessageText(receivedCategory));
  const receivedTokens = tokenizeCategory(receivedCategory);

  if (!normalizedCategory) {
    return { receivedCategory, normalizedCategory };
  }

  const directMatch = availableCategories.find((category) => {
    const aliases = buildCategoryAliases(category);
    return (
      aliases.includes(normalizedCategory)
      || normalizedCategory.includes(normalizeMessageText(category))
      || normalizeMessageText(category).includes(normalizedCategory)
    );
  });

  if (directMatch) {
    return {
      receivedCategory,
      normalizedCategory,
      matchedCategory: directMatch,
    };
  }

  for (const [canonicalName, synonymList] of Object.entries(CATEGORY_SYNONYMS)) {
    if (!synonymList.map((item) => toSingular(normalizeMessageText(item))).includes(normalizedCategory)) {
      continue;
    }

    const matchedCategory = findCanonicalCategoryName(canonicalName, availableCategories);
    return {
      receivedCategory,
      normalizedCategory,
      matchedCategory,
    };
  }

  const tokenMatch = availableCategories
    .map((category) => {
      const categoryTokens = tokenizeCategory(category);
      const matches = countTokenMatches(receivedTokens, categoryTokens);
      return { category, matches };
    })
    .filter((item) => item.matches > 0)
    .sort((left, right) => right.matches - left.matches || left.category.localeCompare(right.category, "pt-BR"))[0];

  if (tokenMatch) {
    return {
      receivedCategory,
      normalizedCategory,
      matchedCategory: tokenMatch.category,
    };
  }

  return {
    receivedCategory,
    normalizedCategory,
  };
}

export function extractCategoryFromMessage(messageText: string, availableCategories: string[]): {
  receivedCategory: string;
  normalizedCategory: string;
  matchedCategory?: string;
} {
  const trimmed = messageText.trim();
  const prefixedMatch = trimmed.match(/^(?:categoria|cat)\s+(.+)$/i);
  const candidate = prefixedMatch?.[1]?.trim() ?? trimmed;
  return resolveCategoryName(candidate, availableCategories);
}
