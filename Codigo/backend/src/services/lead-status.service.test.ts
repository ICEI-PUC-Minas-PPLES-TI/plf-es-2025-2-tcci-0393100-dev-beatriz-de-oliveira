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

describe("LeadStatusService", () => {
  beforeEach(() => {
    query.mockReset();
  });

  it("human_handoff nao sobrescreve interesse existente", async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [conversationRow()] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await new LeadStatusService().updateLeadStatusFromConversation(1);

    const updateParams = query.mock.calls[2]?.[1];
    expect(updateParams?.[3]).toBeNull();
    expect(updateParams?.[4]).toBe("ENCAMINHADO_HUMANO");
  });

  it("preserva interesse e adiciona consulta de produtos sem duplicar", async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [conversationRow({ ultima_intencao: "products", encaminhado_humano: false, status: "ATIVO", estado_conversa: "MENU_PRINCIPAL" })] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await new LeadStatusService().updateLeadStatusFromConversation(1);

    const updateParams = query.mock.calls[2]?.[1];
    expect(updateParams?.[3]).toBe("Consultou produtos");
    expect(updateParams?.[4]).toBe("NOVO");
  });

  it("marca CONVERTIDO somente quando ha pedido concluido", async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [conversationRow({ has_completed_order: true, ultima_intencao: "products" })] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await new LeadStatusService().updateLeadStatusFromConversation(1);

    const updateParams = query.mock.calls[2]?.[1];
    expect(updateParams?.[4]).toBe("CONVERTIDO");
  });
});
