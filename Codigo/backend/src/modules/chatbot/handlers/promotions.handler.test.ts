import { describe, expect, it, vi } from "vitest";
import { PromotionsHandler } from "./promotions.handler.js";
import { chatbotContext, product, promotion, state } from "../../../test/factories.js";

describe("PromotionsHandler", () => {
  it("lista promocoes e guarda contexto recente", async () => {
    const handler = new PromotionsHandler(
      { listActive: async () => [promotion()] } as never,
      { list: async () => [] } as never,
      { upsertByPhone: vi.fn() } as never,
    );

    const response = await handler.handle(chatbotContext("promocoes"));
    expect(response.actions).toContain("promotions_listed");
    expect(response.stateTransition?.recentPromotions).toEqual(["COPO TERMICO 420ML COM CAIXA DE SOM"]);
  });

  it("calcula desconto percentual sem converter lead", async () => {
    const upsertByPhone = vi.fn();
    const handler = new PromotionsHandler(
      { listActive: async () => [promotion({ desconto: "10%" })] } as never,
      { list: async () => [product({ id: 10, nome: "COPO TERMICO 420ML COM CAIXA DE SOM", preco: "85.00" })] } as never,
      { upsertByPhone } as never,
    );

    const response = await handler.handle(chatbotContext("qual o preco do copo?", {
      state: state({ recentPromotions: ["COPO TERMICO 420ML COM CAIXA DE SOM"] }),
    }));

    expect(response.replyText).toMatch(/De: R\$\s*85,00/);
    expect(response.replyText).toMatch(/Por: R\$\s*76,50/);
    expect(upsertByPhone).toHaveBeenCalledWith(expect.objectContaining({ status: "EM_CONTATO" }));
  });

  it("calcula desconto fixo", async () => {
    const handler = new PromotionsHandler(
      { listActive: async () => [promotion({ desconto: "R$ 15,00" })] } as never,
      { list: async () => [product({ id: 10, nome: "COPO TERMICO 420ML COM CAIXA DE SOM", preco: "85.00" })] } as never,
      { upsertByPhone: vi.fn() } as never,
    );

    const response = await handler.handle(chatbotContext("qual valor do copo na promocao?", {
      state: state({ recentPromotions: ["COPO TERMICO 420ML COM CAIXA DE SOM"] }),
    }));

    expect(response.replyText).toMatch(/Por: R\$\s*70,00/);
    expect(response.replyText).toMatch(/Desconto: R\$\s*15,00/);
  });
});
