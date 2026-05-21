import { describe, expect, it } from "vitest";
import { ProductsHandler } from "./products.handler.js";
import { chatbotContext, product, state } from "../../../test/factories.js";

describe("ProductsHandler", () => {
  it("lista produtos em texto compacto sem imagem", async () => {
    const handler = new ProductsHandler({
      list: async () => [
        product({ id: 1, nome: "TV 50 SMART MULTILASER", categoria: "Eletronicos" }),
        product({ id: 2, nome: "TV 43 LG SMART", categoria: "Eletronicos" }),
      ],
    } as never);

    const response = await handler.handle(chatbotContext("categoria Eletronicos geral"));

    expect(response.actions).toContain("list_products_by_category");
    expect(response.replyText).toContain("1) TV 50 SMART MULTILASER");
    expect(response.replyText).not.toContain("http");
  });

  it("usa fallback global quando categoria selecionada nao tem o termo", async () => {
    const handler = new ProductsHandler({
      list: async () => [
        product({ id: 1, nome: "TV 50 SMART MULTILASER", categoria: "Eletronicos" }),
        product({ id: 2, nome: "FOGAO 4 BOCAS", categoria: "Eletrodomesticos" }),
      ],
    } as never);

    const response = await handler.handle(chatbotContext("fogao", {
      state: state({ stage: "AGUARDANDO_CATEGORIA", selectedCategoryName: "Eletronicos" }),
    }));

    expect(response.replyText).toContain("catalogo");
    expect(response.stateTransition?.lastShownProducts).toEqual(["FOGAO 4 BOCAS"]);
  });

  it("responde detalhe com apenas o produto escolhido", async () => {
    const handler = new ProductsHandler({
      list: async () => [
        product({
          nome: "TV 43 LG SMART",
          images: [{ imageUrl: "https://example.com/tv.jpg", ordem: 0, principal: true }],
          primaryImage: "https://example.com/tv.jpg",
        }),
      ],
    } as never);

    const response = await handler.handle(chatbotContext("ver mais TV 43 LG SMART", {
      selectedProductName: "TV 43 LG SMART",
      state: state({
        stage: "AGUARDANDO_ESCOLHA_PRODUTO",
        selectedProductName: "TV 43 LG SMART",
        lastShownProducts: ["TV 43 LG SMART"],
      }),
    }));

    expect(response.actions).toContain("product_details");
    expect(response.stateTransition?.lastShownProducts).toEqual(["TV 43 LG SMART"]);
    expect(response.telegram?.inlineKeyboard?.flat().map((button) => button.text)).toContain("Falar com vendedor");
  });

  it("pagina produtos quando cliente clica em Ver mais", async () => {
    const handler = new ProductsHandler({
      list: async () => [
        product({ id: 1, nome: "PATINETE INFANTIL", categoria: "Brinquedos" }),
        product({ id: 2, nome: "BICICLETA CICLO BRASIL", categoria: "Brinquedos" }),
        product({ id: 3, nome: "TRICICLO INFANTIL", categoria: "Brinquedos" }),
        product({ id: 4, nome: "BONECA LUNA", categoria: "Brinquedos" }),
        product({ id: 5, nome: "CARRINHO CONTROLE REMOTO", categoria: "Brinquedos" }),
      ],
    } as never);

    const response = await handler.handle(chatbotContext("categoria Brinquedos pagina 3", {
      state: state({
        stage: "AGUARDANDO_ESCOLHA_PRODUTO",
        selectedCategoryName: "Brinquedos",
        lastShownProducts: ["PATINETE INFANTIL", "BICICLETA CICLO BRASIL", "TRICICLO INFANTIL"],
      }),
    }));

    expect(response.actions).toContain("list_products_by_category");
    expect(response.replyText).toContain("1) BONECA LUNA");
    expect(response.replyText).toContain("2) CARRINHO CONTROLE REMOTO");
    expect(response.replyText).not.toContain("PATINETE INFANTIL");
    expect(response.stateTransition?.lastShownProducts).toEqual([
      "BONECA LUNA",
      "CARRINHO CONTROLE REMOTO",
    ]);
  });
});
