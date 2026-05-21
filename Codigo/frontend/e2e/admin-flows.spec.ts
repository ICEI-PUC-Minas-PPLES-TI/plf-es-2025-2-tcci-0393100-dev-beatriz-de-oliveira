import { expect, test } from "@playwright/test";

test("fluxos principais do painel Telegram-only", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("token", "e2e-token");
    localStorage.setItem("auth_user", JSON.stringify({ id: 1, nome: "Admin", login: "admin@teste.com", role: "PROPRIETARIO" }));
  });

  await page.route("http://localhost:3333/**", async (route) => {
    const url = new URL(route.request().url());
    const json = (payload: unknown) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) });

    if (url.pathname === "/conversations") {
      return json({ data: [{ id: 1, cliente: "Beatriz", telefone: "1439821696", contactId: "1439821696", status: "ATIVO", ultima_mensagem: "Oi", horario: "2026-05-17T12:00:00.000Z", channel: "telegram" }] });
    }
    if (url.pathname === "/conversations/1/full-history") {
      return json({ data: [{ id: 1, tipo: "recebida", conteudo: "Oi", horario: "2026-05-17T12:00:00.000Z", remetente: "CLIENTE", conversationId: 1 }] });
    }
    if (url.pathname === "/conversations/1/messages" && route.request().method() === "POST") {
      return json({ data: { id: 2, tipo: "enviada", conteudo: "Mensagem manual de teste", horario: "2026-05-17T12:00:00.000Z", remetente: "ATENDENTE", conversationId: 1 } });
    }
    if (url.pathname === "/leads") {
      return json({ data: [{
        id: 1,
        nome: "Beatriz",
        telefone: "1439821696",
        email: "",
        interesse: "Consultou produtos",
        status: "EM_CONTATO",
        data_criacao: "2026-05-17T12:00:00.000Z",
        canal: "telegram",
        contatoExibicao: "ID Telegram: 1439821696",
        origem: "TELEGRAM",
        intencao: "products",
        timeline: [
          { id: "1", type: "status", title: "Lead convertido", description: "Venda concluida para este relacionamento comercial.", occurredAt: "2026-05-18T12:00:00.000Z", status: "CONVERTIDO", reason: "sale_completed" },
          { id: "2", type: "status", title: "Lead reaberto automaticamente", description: "Cliente voltou a interagir apos conversao ou perda.", occurredAt: "2026-05-20T12:00:00.000Z", status: "EM_CONTATO", reason: "automatic_reopen" },
          { id: "3", type: "produto", title: "Interesse no produto: TV 43 LG SMART", description: "Cliente demonstrou interesse comercial neste item.", occurredAt: "2026-05-20T12:05:00.000Z" },
        ],
      }] });
    }
    if (url.pathname === "/billing-rules") {
      return json({ data: { ativa: true, limite_envio_por_dia: "10", hora_envio: "09:00", lembrete_antes_ativo: true, dias_antes_vencimento: "0", template_antes_vencimento: "Oi {nome}", vencimento_hoje_ativo: true, template_vencimento_hoje: "Oi {nome}", apos_vencimento_ativo: true, dias_apos_vencimento: "1", template_apos_vencimento: "Oi {nome}", dias_atraso_max: "30" } });
    }
    if (url.pathname === "/billing-rules/orders") {
      return json({ data: [{ id: 1, numero_pedido: "PED-1", produto_nome: "TV 43 LG SMART", cliente: "Beatriz", telefone_cliente: "1439821696", valor_total: "R$ 100,00", forma_pagamento: "PIX", status: "PENDENTE", data_vencimento: new Date().toISOString().slice(0, 10), cobrancaCanal: "telegram", cobrancaCanalDisponivel: true, contatoExibicao: "ID Telegram: 1439821696" }] });
    }
    if (url.pathname === "/products") {
      return json({ data: [{ id: 1, nome: "TV 43 LG SMART", categoria: "Eletronicos", descricao: "Smart TV", preco: "2399.00", quantidade: 3, disponivel: true, imagem: "https://example.com/tv.jpg", images: [{ imageUrl: "https://example.com/tv.jpg", ordem: 0, principal: true }] }] });
    }
    return json({ data: [] });
  });

  await page.goto("/conversas");
  await expect(page.getByText("Beatriz").first()).toBeVisible();
  await page.getByPlaceholder("Digite sua mensagem...").fill("Mensagem manual de teste");
  await page.getByRole("button").filter({ hasText: /^$/ }).last().click();

  await page.getByText("Leads").click();
  await expect(page.getByText("Gestão de Leads")).toBeVisible();
  await expect(page.getByText("Telegram").first()).toBeVisible();
  await page.getByRole("button", { name: /3 eventos/i }).click();
  await expect(page.getByText("Lead reaberto automaticamente")).toBeVisible();
  await expect(page.getByText("Interesse no produto: TV 43 LG SMART")).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByText("Cobranças").click();
  await expect(page.getByText("Gestão de Cobranças")).toBeVisible();
  await expect(page.getByText("Configuração de Cobrança Automática")).toBeVisible();

  await page.getByText("Produtos").click();
  await expect(page.getByText("Catálogo de Produtos")).toBeVisible();
  await page.getByRole("link", { name: /Novo Produto/i }).click();
  await expect(page.getByText("Imagens do Produto")).toBeVisible();
  await page.getByPlaceholder("https://exemplo.com/produto.jpg").fill("https://example.com/produto.jpg");
  await page.getByRole("button", { name: /Adicionar URL/i }).click();
  await expect(page.getByText("Imagem 1")).toBeVisible();
});
