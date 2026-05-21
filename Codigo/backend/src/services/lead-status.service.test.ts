import { beforeEach, describe, expect, it, vi } from "vitest";

const query = vi.fn();

vi.mock("../config/database.js", () => ({
  pool: { query },
}));

const { LeadStatusService } = await import("./lead-status.service.js");

function conversationRow(overrides: Record<string, unknown> = {}) {
  return {
    atendimento_id: "00000000-0000-0000-0000-000000000001",
    lead_id: "00000000-0000-0000-0000-000000000010",
    numeric_id: 1,
    cliente_id: "00000000-0000-0000-0000-000000000020",
    cliente_nome: "Beatriz",
    cliente_telefone: null,
    canal: "TELEGRAM",
    status: "PENDENTE",
    encaminhado_humano: true,
    ultima_intencao: "human_handoff",
    estado_conversa: "ENCAMINHADO_HUMANO",
    contato: "1439821696",
    ultima_interacao_em: "2026-05-17T12:00:00.000Z",
    has_attendant_reply: false,
    has_completed_order: false,
    ...overrides,
  };
}

function existingLead(overrides: Record<string, unknown> = {}) {
  return {
    lead_id: "00000000-0000-0000-0000-000000000010",
    status: "EM_CONTATO",
    atualizado_em: "2026-05-17T12:00:00.000Z",
    ...overrides,
  };
}

function mockSchema() {
  for (let index = 0; index < 5; index += 1) {
    query.mockResolvedValueOnce({ rows: [] });
  }
}

function findUpdateParams() {
  return query.mock.calls.find((call) => String(call[0]).includes("SET nome = COALESCE"))?.[1] as unknown[] | undefined;
}

function historyCalls() {
  return query.mock.calls.filter((call) => String(call[0]).includes("INSERT INTO lead_status_history"));
}

describe("LeadStatusService", () => {
  beforeEach(() => {
    query.mockReset();
    vi.useRealTimers();
  });

  it("human_handoff vira ENCAMINHADO e nao sobrescreve interesse existente", async () => {
    mockSchema();
    query
      .mockResolvedValueOnce({ rows: [conversationRow()] })
      .mockResolvedValueOnce({ rows: [existingLead()] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await new LeadStatusService().updateLeadStatusFromConversation(1);

    const updateParams = findUpdateParams();
    expect(updateParams?.[3]).toBeNull();
    expect(updateParams?.[4]).toBe("ENCAMINHADO");
    expect(historyCalls()[0]?.[1]).toEqual([
      "00000000-0000-0000-0000-000000000010",
      "EM_CONTATO",
      "ENCAMINHADO",
      "seller_handoff",
    ]);
  });

  it("preserva interesse sem adicionar eventos genericos de produtos", async () => {
    mockSchema();
    query
      .mockResolvedValueOnce({ rows: [conversationRow({ ultima_intencao: "products", encaminhado_humano: false, status: "ATIVO", estado_conversa: "MENU_PRINCIPAL" })] })
      .mockResolvedValueOnce({ rows: [existingLead({ status: "NOVO" })] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await new LeadStatusService().updateLeadStatusFromConversation(1);

    const updateParams = findUpdateParams();
    expect(updateParams?.[3]).toBeNull();
    expect(updateParams?.[4]).toBe("EM_CONTATO");
    expect(historyCalls()[0]?.[1]?.[3]).toBe("conversation_activity");
  });

  it("marca CONVERTIDO e registra historico quando ha pedido concluido", async () => {
    mockSchema();
    query
      .mockResolvedValueOnce({ rows: [conversationRow({ has_completed_order: true, ultima_intencao: "products" })] })
      .mockResolvedValueOnce({ rows: [existingLead({ status: "EM_CONTATO" })] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await new LeadStatusService().updateLeadStatusFromConversation(1);

    const updateParams = findUpdateParams();
    expect(updateParams?.[4]).toBe("CONVERTIDO");
    expect(historyCalls()[0]?.[1]?.[3]).toBe("sale_completed");
  });

  it("reabre automaticamente lead convertido apenas depois de 24 horas", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-20T12:00:00.000Z"));
    mockSchema();
    query
      .mockResolvedValueOnce({ rows: [conversationRow({ encaminhado_humano: false, status: "ATIVO", estado_conversa: "MENU_PRINCIPAL", ultima_intencao: "products" })] })
      .mockResolvedValueOnce({ rows: [existingLead({ status: "CONVERTIDO", atualizado_em: "2026-05-18T10:00:00.000Z" })] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await new LeadStatusService().updateLeadStatusFromConversation(1);

    expect(findUpdateParams()?.[4]).toBe("EM_CONTATO");
    expect(historyCalls()[0]?.[1]?.[3]).toBe("automatic_reopen");
  });
});
