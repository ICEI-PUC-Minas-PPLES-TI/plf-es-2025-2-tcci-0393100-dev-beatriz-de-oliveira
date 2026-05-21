import { describe, expect, it } from "vitest";
import {
  TELEGRAM_CALLBACK_DATA_MAX_BYTES,
  getTelegramCallbackDataByteLength,
} from "../telegram-callback-data.js";
import { buildProductListKeyboard } from "./shared.js";

describe("telegram callback data helpers", () => {
  it("mantem callback antigo para produto curto quando cabe no limite", () => {
    const keyboard = buildProductListKeyboard(["TV 43 LG SMART"]);
    const callbackData = keyboard[0]?.[0]?.callbackData;

    expect(callbackData).toBe("PRODUCT:MORE:TV 43 LG SMART");
    expect(getTelegramCallbackDataByteLength(callbackData ?? "")).toBeLessThanOrEqual(
      TELEGRAM_CALLBACK_DATA_MAX_BYTES,
    );
  });

  it("usa fallback curto para produto com nome longo", () => {
    const keyboard = buildProductListKeyboard([
      "Bicicleta ergometrica profissional reforcada com monitor digital multifuncional para treino em casa",
    ]);
    const callbackData = keyboard[0]?.[0]?.callbackData;

    expect(callbackData).toBe("PRODUCT_VIEW:1");
    expect(getTelegramCallbackDataByteLength(callbackData ?? "")).toBeLessThanOrEqual(
      TELEGRAM_CALLBACK_DATA_MAX_BYTES,
    );
  });

  it("mantem todos os callback_data de produtos dentro de 64 bytes", () => {
    const keyboard = buildProductListKeyboard([
      "Bicicleta ergometrica profissional reforcada com monitor digital multifuncional para treino em casa",
      "Kit halteres ajustaveis emborrachados com barra extensora e suporte organizador premium",
      "Esteira eletrica dobravel com painel digital e programas automaticos para corrida",
    ]);

    const callbackDataList = keyboard.flat().map((button) => button.callbackData);

    expect(callbackDataList).toContain("PRODUCT_VIEW:1");
    expect(callbackDataList).toContain("PRODUCT_VIEW:2");
    expect(callbackDataList).toContain("PRODUCT_VIEW:3");
    expect(callbackDataList.every((callbackData) =>
      getTelegramCallbackDataByteLength(callbackData) <= TELEGRAM_CALLBACK_DATA_MAX_BYTES,
    )).toBe(true);
  });
});
