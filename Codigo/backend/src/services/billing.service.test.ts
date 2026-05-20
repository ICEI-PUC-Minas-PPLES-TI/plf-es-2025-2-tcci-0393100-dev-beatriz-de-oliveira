import { describe, expect, it, vi } from "vitest";
import { BillingService } from "./billing.service.js";
import { billingRule, order } from "../test/factories.js";

describe("BillingService", () => {
  it("envia cobranca manual somente por Telegram", async () => {
    const telegram = { sendManualMessage: vi.fn().mockResolvedValue({ id: 1 }) };
    const repository = {
      findOrderById: vi.fn().mockResolvedValue(order()),
      getRule: vi.fn().mockResolvedValue(billingRule()),
      sendManualCharge: vi.fn().mockResolvedValue(order({ cobrancaStatus: "ENVIADO" })),
    };

    const result = await new BillingService(repository as never, telegram as never).sendManualCharge(1);

    expect(telegram.sendManualMessage).toHaveBeenCalledWith(expect.objectContaining({ chatId: "1439821696" }));
    expect(repository.sendManualCharge).toHaveBeenCalledWith(1, expect.stringContaining("Beatriz"));
    expect(result.cobrancaStatus).toBe("ENVIADO");
  });

  it("bloqueia cobranca quando nao ha canal Telegram disponivel", async () => {
    const service = new BillingService({
      findOrderById: vi.fn().mockResolvedValue(order({ cobrancaCanalDisponivel: false, cobrancaCanal: undefined })),
    } as never, { sendManualMessage: vi.fn() } as never);

    await expect(service.sendManualCharge(1)).rejects.toMatchObject({ code: "BILLING_CHARGE_CHANNEL_UNAVAILABLE" });
  });

  it("rotina automatica ignora pedidos sem Telegram e envia elegiveis", async () => {
    const telegram = { sendManualMessage: vi.fn().mockResolvedValue({ id: 1 }) };
    const repository = {
      getRule: vi.fn().mockResolvedValue(billingRule({ vencimento_hoje_ativo: true })),
      findOrders: vi.fn().mockResolvedValue([
        order({ id: 1, telegramChatId: "1439821696" }),
        order({ id: 2, telegramChatId: undefined, cobrancaCanalDisponivel: false }),
      ]),
      sendManualCharge: vi.fn().mockImplementation(async (id: number) => order({ id, cobrancaStatus: "ENVIADO" })),
      saveRoutineRun: vi.fn().mockImplementation(async (run) => ({ id: 1, ...run })),
    };

    const run = await new BillingService(repository as never, telegram as never).runDailyRoutine(new Date("2026-05-17T12:00:00.000Z"));

    expect(telegram.sendManualMessage).toHaveBeenCalledTimes(1);
    expect(run.processados).toBe(1);
    expect(run.ignorados).toBe(1);
  });
});
