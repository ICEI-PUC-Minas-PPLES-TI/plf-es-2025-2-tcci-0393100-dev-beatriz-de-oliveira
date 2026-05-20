import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Conversas } from "./Conversas";
import { renderWithRouter } from "../../test/render";

const mocks = vi.hoisted(() => ({
  sendConversationMessage: vi.fn().mockResolvedValue({}),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../services/adminDataService", () => ({ adminDataService: { sendConversationMessage: mocks.sendConversationMessage } }));
vi.mock("../hooks/useAdminData", () => ({
  useConversationsData: vi.fn(() => ({
    data: [
      {
        id: 1,
        cliente: "Beatriz",
        telefone: "1439821696",
        contactId: "1439821696",
        status: "ATIVO",
        ultima_mensagem: "Oi",
        horario: "2026-05-17T12:00:00.000Z",
        channel: "telegram",
      },
    ],
    reload: vi.fn(),
    isLoading: false,
    error: null,
  })),
  useConversationFullHistoryData: vi.fn(() => ({
    data: [{ id: 1, tipo: "recebida", conteudo: "Oi", horario: "2026-05-17T12:00:00.000Z", remetente: "CLIENTE", conversationId: 1 }],
    reload: vi.fn(),
    isLoading: false,
    error: null,
  })),
  useProdutosLookup: vi.fn(() => ({ data: [] })),
}));

describe("Conversas", () => {
  it("lista somente Telegram e remove filtro de canal", () => {
    renderWithRouter(<Conversas />);

    expect(screen.getAllByText("Beatriz").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Telegram").length).toBeGreaterThan(0);
    expect(screen.queryByText(/WhatsApp/i)).not.toBeInTheDocument();
  });

  it("envia mensagem manual pelo atendimento selecionado", async () => {
    renderWithRouter(<Conversas />);

    await userEvent.type(screen.getByPlaceholderText("Digite sua mensagem..."), "Mensagem manual");
    await userEvent.click(screen.getByRole("button", { name: "" }));

    await waitFor(() => expect(mocks.sendConversationMessage).toHaveBeenCalledWith({ conversationId: 1, content: "Mensagem manual" }));
  });
});
