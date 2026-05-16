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

export function buildMainMenuKeyboard() {
  return [
    [{ text: "Produtos", callbackData: "MENU:PRODUCTS" }],
    [{ text: "Promoções", callbackData: "MENU:PROMOTIONS" }],
    [{ text: "Falar com vendedor", callbackData: "MENU:HUMAN_HANDOFF" }],
  ];
}

export function buildCategoryKeyboard(categories: string[]) {
  const limited = categories.slice(0, 8);
  const rows: Array<Array<{ text: string; callbackData: string }>> = [];

  for (let index = 0; index < limited.length; index += 2) {
    rows.push(
      limited.slice(index, index + 2).map((category) => ({
        text: category,
        callbackData: `CATEGORY:${category}`,
      })),
    );
  }

  rows.push([{ text: "Falar com vendedor", callbackData: "MENU:HUMAN_HANDOFF" }]);
  return rows;
}

export function buildProductActionsKeyboard(productName: string, options: { hasMoreImages?: boolean } = {}) {
  const rows: Array<Array<{ text: string; callbackData: string }>> = [];

  if (options.hasMoreImages) {
    rows.push([{ text: "Ver mais fotos", callbackData: `PRODUCT:PHOTOS:${productName}` }]);
  }

  rows.push([{ text: "Falar com vendedor", callbackData: `PRODUCT:SELLER:${productName}` }]);
  rows.push([{ text: "Voltar para categorias", callbackData: "MENU:PRODUCTS" }]);
  return rows;
}

export function buildProductListKeyboard(
  productNames: string[],
  options?: { categoryName?: string; nextOffset?: number },
) {
  const rows: Array<Array<{ text: string; callbackData: string }>> = [];

  productNames.slice(0, 3).forEach((productName, index) => {
    rows.push([{ text: `Ver item ${index + 1}`, callbackData: `PRODUCT:MORE:${productName}` }]);
  });

  if (options?.categoryName && options.nextOffset !== undefined) {
    rows.push([{ text: "Ver mais", callbackData: `CATEGORY_MORE:${options.categoryName}:${options.nextOffset}` }]);
  }

  rows.push([{ text: "Falar com vendedor", callbackData: "MENU:HUMAN_HANDOFF" }]);
  return rows;
}

export function buildCategoryRefinementKeyboard(categoryName: string, options: string[]) {
  const rows = options.slice(0, 4).map((option) => [
    { text: option, callbackData: `CATEGORY_REFINE:${categoryName}:${option}` },
  ]);

  rows.push([{ text: "Ver opcoes gerais", callbackData: `CATEGORY_GENERAL:${categoryName}` }]);
  rows.push([{ text: "Falar com vendedor", callbackData: "MENU:HUMAN_HANDOFF" }]);
  return rows;
}

export function buildSearchRefinementKeyboard(baseTerm: string, options: string[]) {
  const rows = options.slice(0, 4).map((option) => [
    { text: option, callbackData: `SEARCH_REFINE:${baseTerm}:${option}` },
  ]);

  rows.push([{ text: "Ver opcoes gerais", callbackData: `SEARCH_GENERAL:${baseTerm}` }]);
  rows.push([{ text: "Falar com vendedor", callbackData: "MENU:HUMAN_HANDOFF" }]);
  return rows;
}

export function buildInterestSelectionKeyboard(productNames: string[]) {
  const rows = productNames.slice(0, 3).map((productName, index) => [
    {
      text: `Tenho interesse no item ${index + 1}`,
      callbackData: `PRODUCT:INTEREST:${productName}`,
    },
  ]);

  rows.push([{ text: "Falar com vendedor", callbackData: "MENU:HUMAN_HANDOFF" }]);
  return rows;
}

export function buildHandoffKeyboard() {
  return [
    [
      { text: "Sim", callbackData: "HANDOFF:YES" },
      { text: "Não", callbackData: "HANDOFF:NO" },
    ],
  ];
}
