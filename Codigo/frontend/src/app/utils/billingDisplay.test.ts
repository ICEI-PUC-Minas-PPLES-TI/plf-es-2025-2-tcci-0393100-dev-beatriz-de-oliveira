import { describe, expect, it } from "vitest";
import { formatChargeChannelLabel } from "./billingDisplay";

describe("billingDisplay", () => {
  it("mostra canal Telegram para cobrancas disponiveis", () => {
    expect(formatChargeChannelLabel("telegram")).toBe("Telegram");
  });

  it("mostra sem canal disponivel quando nao existe Telegram", () => {
    expect(formatChargeChannelLabel(undefined)).toBe("Sem canal disponível");
  });
});
