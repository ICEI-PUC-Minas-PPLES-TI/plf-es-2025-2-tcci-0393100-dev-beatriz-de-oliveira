import { describe, expect, it } from "vitest";
import { parseTelegramUpdate } from "./telegram-update-parser.js";

describe("parseTelegramUpdate", () => {
  it("normaliza mensagem de texto", () => {
    const parsed = parseTelegramUpdate({
      message: { message_id: 10, date: 1_779_000_000, text: "Oi", chat: { id: 123 }, from: { first_name: "Bia" } },
    });

    expect(parsed.kind).toBe("message");
    if (parsed.kind === "message") {
      expect(parsed.message.from).toBe("123");
      expect(parsed.message.channel).toBe("telegram");
      expect(parsed.message.text).toBe("Oi");
    }
  });

  it("converte callback_query em texto de produto", () => {
    const parsed = parseTelegramUpdate({
      callback_query: {
        id: "cb1",
        data: "PRODUCT:PHOTOS:TV 43 LG SMART",
        message: { message_id: 99, chat: { id: 123 } },
      },
    });

    expect(parsed.kind).toBe("message");
    if (parsed.kind === "message") {
      expect(parsed.callbackQueryId).toBe("cb1");
      expect(parsed.message.text).toBe("ver mais fotos TV 43 LG SMART");
    }
  });

  it("converte callback de Ver mais da categoria em paginacao", () => {
    const parsed = parseTelegramUpdate({
      callback_query: {
        id: "cb2",
        data: "CATEGORY_MORE:Brinquedos:3",
        message: { message_id: 99, chat: { id: 123 } },
      },
    });

    expect(parsed.kind).toBe("message");
    if (parsed.kind === "message") {
      expect(parsed.callbackQueryId).toBe("cb2");
      expect(parsed.message.text).toBe("categoria Brinquedos pagina 3");
    }
  });

  it("converte callback curto de produto em selecao por indice", () => {
    const parsed = parseTelegramUpdate({
      callback_query: {
        id: "cb3",
        data: "PRODUCT_VIEW:2",
        message: { message_id: 99, chat: { id: 123 } },
      },
    });

    expect(parsed.kind).toBe("message");
    if (parsed.kind === "message") {
      expect(parsed.callbackQueryId).toBe("cb3");
      expect(parsed.message.text).toBe("ver mais 2");
    }
  });

  it("converte callback curto de Ver mais da categoria em paginacao", () => {
    const parsed = parseTelegramUpdate({
      callback_query: {
        id: "cb4",
        data: "CAT_MORE:esporte-lazer:3",
        message: { message_id: 99, chat: { id: 123 } },
      },
    });

    expect(parsed.kind).toBe("message");
    if (parsed.kind === "message") {
      expect(parsed.callbackQueryId).toBe("cb4");
      expect(parsed.message.text).toBe("categoria esporte lazer pagina 3");
    }
  });

  it("ignora fotos recebidas", () => {
    expect(parseTelegramUpdate({ message: { message_id: 1, chat: { id: 123 }, photo: [{}] } })).toEqual({
      kind: "ignored",
      reason: "photo",
    });
  });
});
