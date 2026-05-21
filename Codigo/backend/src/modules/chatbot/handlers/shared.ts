import {
  TELEGRAM_CALLBACK_DATA_MAX_BYTES,
  buildShortCallbackSlug,
  buildTelegramCallbackData,
} from "../telegram-callback-data.js";

type InlineKeyboardButton = { text: string; callbackData: string };
type InlineKeyboard = InlineKeyboardButton[][];

function productCallbackData(action: "MORE" | "PHOTOS" | "SELLER" | "INTEREST", productName: string, productIndex: number): string {
  const fallbackPrefixByAction = {
    MORE: "PRODUCT_VIEW",
    PHOTOS: "PRODUCT_PHOTOS",
    SELLER: "PRODUCT_SELLER",
    INTEREST: "PRODUCT_INTEREST",
  } as const;

  return buildTelegramCallbackData({
    action: `PRODUCT:${action}`,
    candidate: `PRODUCT:${action}:${productName}`,
    fallback: `${fallbackPrefixByAction[action]}:${productIndex + 1}`,
    metadata: {
      productIndex: productIndex + 1,
      productName,
    },
  });
}

function categoryCallbackData(categoryName: string, categoryIndex: number): string {
  return buildTelegramCallbackData({
    action: "CATEGORY",
    candidate: `CATEGORY:${categoryName}`,
    fallback: `CATEGORY_IDX:${categoryIndex + 1}`,
    metadata: {
      categoryIndex: categoryIndex + 1,
      categoryName,
    },
  });
}

function categoryGeneralCallbackData(categoryName: string): string {
  return buildTelegramCallbackData({
    action: "CATEGORY_GENERAL",
    candidate: `CATEGORY_GENERAL:${categoryName}`,
    fallback: `CAT_GENERAL:${buildShortCallbackSlug(categoryName)}`,
    metadata: { categoryName },
  });
}

function pairedSlugFallback(prefix: string, leftValue: string, rightValue: string): string {
  const separatorBytes = Buffer.byteLength(":", "utf8");
  const availableBytes = TELEGRAM_CALLBACK_DATA_MAX_BYTES - Buffer.byteLength(prefix, "utf8") - separatorBytes;
  const leftMaxBytes = Math.max(1, Math.floor(availableBytes / 2));
  const leftSlug = buildShortCallbackSlug(leftValue, leftMaxBytes);
  const rightMaxBytes = Math.max(1, availableBytes - Buffer.byteLength(leftSlug, "utf8") - separatorBytes);
  return `${prefix}${leftSlug}:${buildShortCallbackSlug(rightValue, rightMaxBytes)}`;
}

function categoryRefineCallbackData(categoryName: string, option: string): string {
  return buildTelegramCallbackData({
    action: "CATEGORY_REFINE",
    candidate: `CATEGORY_REFINE:${categoryName}:${option}`,
    fallback: pairedSlugFallback("CAT_REFINE:", categoryName, option),
    metadata: { categoryName, option },
  });
}

function categoryMoreCallbackData(categoryName: string, nextOffset: number): string {
  const fallbackPrefix = "CAT_MORE:";
  const fallbackSuffix = `:${nextOffset}`;
  const maxSlugBytes = Math.max(
    1,
    TELEGRAM_CALLBACK_DATA_MAX_BYTES - Buffer.byteLength(fallbackPrefix + fallbackSuffix, "utf8"),
  );

  return buildTelegramCallbackData({
    action: "CATEGORY_MORE",
    candidate: `CATEGORY_MORE:${categoryName}:${nextOffset}`,
    fallback: `${fallbackPrefix}${buildShortCallbackSlug(categoryName, maxSlugBytes)}${fallbackSuffix}`,
    metadata: {
      categoryName,
      nextOffset,
    },
  });
}

function searchRefineCallbackData(baseTerm: string, option: string): string {
  return buildTelegramCallbackData({
    action: "SEARCH_REFINE",
    candidate: `SEARCH_REFINE:${baseTerm}:${option}`,
    fallback: pairedSlugFallback("SEARCH_REFINE:", baseTerm, option),
    metadata: { baseTerm, option },
  });
}

function searchGeneralCallbackData(baseTerm: string): string {
  return buildTelegramCallbackData({
    action: "SEARCH_GENERAL",
    candidate: `SEARCH_GENERAL:${baseTerm}`,
    fallback: `SEARCH_GENERAL:${buildShortCallbackSlug(baseTerm)}`,
    metadata: { baseTerm },
  });
}

export function buildMainMenuText(): string {
  return "Como posso te ajudar hoje?\nEscolha uma opção abaixo 👇";
}

export function buildCategoryPromptText(): string {
  return "Qual categoria você quer ver?\nEscolha abaixo ou digite.";
}

export function buildUnknownCategoryText(): string {
  return "Não achei essa categoria.\nEscolha uma opção abaixo para continuar.";
}

export function buildCommercialHandoffText(): string {
  return "Posso te conectar com um vendedor agora 👇";
}

export function buildMainMenuKeyboard(): InlineKeyboard {
  return [
    [{ text: "Produtos", callbackData: "MENU:PRODUCTS" }],
    [{ text: "Promoções", callbackData: "MENU:PROMOTIONS" }],
    [{ text: "Falar com vendedor", callbackData: "MENU:HUMAN_HANDOFF" }],
  ];
}

export function buildCategoryKeyboard(categories: string[]): InlineKeyboard {
  const limited = categories.slice(0, 8);
  const rows: InlineKeyboard = [];

  for (let index = 0; index < limited.length; index += 2) {
    rows.push(
      limited.slice(index, index + 2).map((category, columnIndex) => ({
        text: category,
        callbackData: categoryCallbackData(category, index + columnIndex),
      })),
    );
  }

  rows.push([{ text: "Falar com vendedor", callbackData: "MENU:HUMAN_HANDOFF" }]);
  return rows;
}

export function buildProductActionsKeyboard(
  productName: string,
  options: { hasMoreImages?: boolean; backCategoryName?: string } = {},
): InlineKeyboard {
  const rows: InlineKeyboard = [];

  if (options.hasMoreImages) {
    rows.push([{ text: "Ver mais fotos", callbackData: productCallbackData("PHOTOS", productName, 0) }]);
  }

  rows.push([{ text: "Falar com vendedor", callbackData: productCallbackData("SELLER", productName, 0) }]);
  rows.push([
    options.backCategoryName
      ? { text: "Voltar para lista", callbackData: categoryGeneralCallbackData(options.backCategoryName) }
      : { text: "Voltar", callbackData: "MENU:PRODUCTS" },
  ]);
  return rows;
}

export function buildProductListKeyboard(
  productNames: string[],
  options?: { categoryName?: string; nextOffset?: number },
): InlineKeyboard {
  const rows: InlineKeyboard = [];

  productNames.slice(0, 3).forEach((productName, index) => {
    rows.push([{ text: `Ver item ${index + 1}`, callbackData: productCallbackData("MORE", productName, index) }]);
  });

  if (options?.categoryName && options.nextOffset !== undefined) {
    rows.push([{ text: "Ver mais", callbackData: categoryMoreCallbackData(options.categoryName, options.nextOffset) }]);
  }

  rows.push([{ text: "Falar com vendedor", callbackData: "MENU:HUMAN_HANDOFF" }]);
  return rows;
}

export function buildCategoryRefinementKeyboard(categoryName: string, options: string[]): InlineKeyboard {
  const rows = options.slice(0, 4).map((option) => [
    { text: option, callbackData: categoryRefineCallbackData(categoryName, option) },
  ]);

  rows.push([{ text: "Ver opcoes gerais", callbackData: categoryGeneralCallbackData(categoryName) }]);
  rows.push([{ text: "Falar com vendedor", callbackData: "MENU:HUMAN_HANDOFF" }]);
  return rows;
}

export function buildCategoryBrowseKeyboard(categoryName: string): InlineKeyboard {
  return [
    [{ text: "Ver opcoes gerais", callbackData: categoryGeneralCallbackData(categoryName) }],
    [{ text: "Falar com vendedor", callbackData: "MENU:HUMAN_HANDOFF" }],
  ];
}

export function buildSearchRefinementKeyboard(baseTerm: string, options: string[]): InlineKeyboard {
  const rows = options.slice(0, 4).map((option) => [
    { text: option, callbackData: searchRefineCallbackData(baseTerm, option) },
  ]);

  rows.push([{ text: "Ver opcoes gerais", callbackData: searchGeneralCallbackData(baseTerm) }]);
  rows.push([{ text: "Falar com vendedor", callbackData: "MENU:HUMAN_HANDOFF" }]);
  return rows;
}

export function buildInterestSelectionKeyboard(productNames: string[]): InlineKeyboard {
  const rows = productNames.slice(0, 3).map((productName, index) => [
    {
      text: `Tenho interesse no item ${index + 1}`,
      callbackData: productCallbackData("INTEREST", productName, index),
    },
  ]);

  rows.push([{ text: "Falar com vendedor", callbackData: "MENU:HUMAN_HANDOFF" }]);
  return rows;
}

export function buildHandoffKeyboard(): InlineKeyboard {
  return [
    [
      { text: "Sim", callbackData: "HANDOFF:YES" },
      { text: "Não", callbackData: "HANDOFF:NO" },
    ],
  ];
}
