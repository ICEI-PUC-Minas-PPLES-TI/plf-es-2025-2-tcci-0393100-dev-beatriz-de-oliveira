import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Leads } from "./Leads";
import { renderWithRouter } from "../../test/render";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../services/adminDataService", () => ({ adminDataService: { updateLeadStatus: vi.fn(), exportLeadsCsv: vi.fn() } }));
vi.mock("../hooks/useAdminData", () => ({
  useLeadsData: vi.fn(() => ({
    data: [{
      id: 1,
      nome: "Beatriz",
      telefone: "1439821696",
      email: "",
      interesse: "Interesse no produto: TV 43 LG SMART",
      status: "EM_CONTATO",
      data_criacao: "2026-05-17T12:00:00.000Z",
      canal: "telegram",
      contatoExibicao: "ID Telegram: 1439821696",
      origem: "TELEGRAM",
      intencao: "products",
      timeline: [
        {
          id: "status-1",
          type: "status",
          title: "Lead reaberto automaticamente",
          description: "Cliente voltou a interagir após conversão.",
          occurredAt: "2026-05-20T22:47:00.000Z",
          status: "EM_CONTATO",
          reason: "automatic_reopen",
        },
        {
          id: "interest-1",
          type: "produto",
          title: "Interesse no produto: TV 43 LG SMART",
          description: "Cliente demonstrou interesse em TV 43 LG SMART.",
          occurredAt: "2026-05-20T22:45:00.000Z",
        },
      ],
    }],
    isLoading: false,
    error: null,
    reload: vi.fn(),
  })),
}));

describe("Leads", () => {
  it("exibe canal Telegram, status e linha do tempo de interesses", async () => {
    renderWithRouter(<Leads />);

    expect(screen.getByText("Telegram")).toBeInTheDocument();
    expect(screen.getByText("ID Telegram: 1439821696")).toBeInTheDocument();
    expect(screen.getAllByText("Em Contato").length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole("button", { name: /2 eventos/i }));
    expect(screen.getByText("Linha do tempo do lead")).toBeInTheDocument();
    expect(screen.getByText(/Hoje|Ontem|quarta-feira|quinta-feira|sexta-feira|sábado|domingo|segunda-feira|terça-feira/i)).toBeInTheDocument();
    expect(screen.getByText("Lead reaberto automaticamente")).toBeInTheDocument();
    expect(screen.getByText("Interesse no produto: TV 43 LG SMART")).toBeInTheDocument();
    expect(screen.getByText("Produto")).toBeInTheDocument();
    expect(screen.getAllByText("Status").length).toBeGreaterThan(1);
    expect(screen.queryByText("Mensagem recebida")).not.toBeInTheDocument();
    expect(screen.queryByText("Resposta enviada")).not.toBeInTheDocument();
  });
});
