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
      interesse: "Consultou produtos | Interesse no produto: TV 43 LG SMART",
      status: "EM_CONTATO",
      data_criacao: "2026-05-17T12:00:00.000Z",
      canal: "telegram",
      contatoExibicao: "ID Telegram: 1439821696",
      origem: "TELEGRAM",
      intencao: "products",
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

    await userEvent.click(screen.getByRole("button", { name: /2 interesses/i }));
    expect(screen.getByText("Linha do tempo de interesses")).toBeInTheDocument();
    expect(screen.getByText("Interesse no produto: TV 43 LG SMART")).toBeInTheDocument();
  });
});
