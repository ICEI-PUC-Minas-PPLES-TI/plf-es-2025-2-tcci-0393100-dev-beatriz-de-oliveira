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

export function buildProductActionsKeyboard(productName: string) {
  return [
    [{ text: "Ver mais", callbackData: `PRODUCT:MORE:${productName}` }],
    [{ text: "Tenho interesse", callbackData: `PRODUCT:INTEREST:${productName}` }],
    [{ text: "Falar com vendedor", callbackData: `PRODUCT:SELLER:${productName}` }],
  ];
}

export function buildHandoffKeyboard() {
  return [
    [
      { text: "Sim", callbackData: "HANDOFF:YES" },
      { text: "Não", callbackData: "HANDOFF:NO" },
    ],
  ];
}
