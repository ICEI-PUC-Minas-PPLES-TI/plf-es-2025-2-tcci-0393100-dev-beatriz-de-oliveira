import { beforeEach, describe, expect, it, vi } from "vitest";
import { TelegramService } from "./telegram.service.js";
import { product } from "../test/factories.js";
import type { ChatbotResponse } from "../modules/chatbot/types.js";

function okFetch() {
  return vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
}

function messageRecord(overrides = {}) {
  return { id: 1, tipo: "enviada", conteudo: "ok", horario: "2026-05-17T12:00:00.000Z", conversationId: 7, ...overrides };
}

function service(response: ChatbotResponse, products = [product()]) {
  const chatbotCore = {
    processIncomingMessages: vi.fn().mockResolvedValue({
      consumed: true,
      extractedMessages: 1,
      responses: [response],
      messageResults: [{ phone: "123", messageId: "123:1", originalText: "tv", status: "processed", response }],
    }),
    pauseConversation: vi.fn(),
    resumeConversation: vi.fn(),
    hydrateConversationState: vi.fn(),
  };
  const repository = {
    getConversationAutomationStateByChatId: vi.fn().mockResolvedValue(null),
    saveIncomingMessage: vi.fn().mockResolvedValue({ atendimentoId: 7, chatId: "123", cliente: "Bia" }),
    saveOutgoingMessage: vi.fn().mockResolvedValue(messageRecord()),
    updateCustomerNameByChatId: vi.fn(),
    findConversationById: vi.fn().mockResolvedValue({ atendimentoId: 7, chatId: "123", cliente: "Bia" }),
    updateConversationStatus: vi.fn(),
  };
  const leadStatusService = { updateLeadStatusFromConversation: vi.fn().mockResolvedValue(undefined) };

  return {
    telegram: new TelegramService(
      chatbotCore as never,
      { list: vi.fn().mockResolvedValue(products) } as never,
      repository as never,
      leadStatusService as never,
    ),
    chatbotCore,
    repository,
  };
}

describe("TelegramService", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", okFetch());
  });

  it("envia mensagem manual e registra handoff", async () => {
    const response = { intent: "menu", handler: "test", replyText: "ok", actions: [], handoffRequested: false } as ChatbotResponse;
    const { telegram, repository } = service(response);

    await telegram.sendManualMessage({ atendimentoId: 7, texto: "Oi, sou atendente" });

    expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining("/sendMessage"), expect.any(Object));
    expect(repository.saveOutgoingMessage).toHaveBeenCalledWith(expect.objectContaining({
      sender: "ATENDENTE",
      stage: "ENCAMINHADO_HUMANO",
    }));
  });

  it("registra FALHA e nao ENVIADA quando Telegram recusa envio", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ description: "Bad Request: BUTTON_DATA_INVALID" }),
    }));
    const response = { intent: "menu", handler: "test", replyText: "ok", actions: [], handoffRequested: false } as ChatbotResponse;
    const { telegram, repository } = service(response);

    await expect(telegram.sendManualMessage({ atendimentoId: 7, texto: "Oi, sou atendente" })).rejects.toThrow(
      "BUTTON_DATA_INVALID",
    );

    expect(repository.saveOutgoingMessage).toHaveBeenCalledWith(expect.objectContaining({
      statusEntrega: "FALHA",
    }));
    expect(repository.saveOutgoingMessage).not.toHaveBeenCalledWith(expect.objectContaining({
      statusEntrega: "ENVIADA",
    }));
  });

  it("na listagem de produtos envia apenas texto, sem foto", async () => {
    const response = {
      intent: "products",
      handler: "ProductsHandler",
      replyText: "Encontrei boas opcoes\n\n1) TV 50 SMART",
      replyMessages: ["Encontrei boas opcoes\n\n1) TV 50 SMART"],
      actions: ["list_products_by_category"],
      handoffRequested: false,
      stateTransition: { lastShownProducts: ["TV 50 SMART MULTILASER"] },
    } as ChatbotResponse;
    const { telegram } = service(response, [product({ nome: "TV 50 SMART MULTILASER", primaryImage: "https://example.com/tv.jpg" })]);

    await telegram.processWebhookEvent({ message: { message_id: 1, chat: { id: 123 }, text: "tv" } });

    const urls = vi.mocked(globalThis.fetch).mock.calls.map((call) => String(call[0]));
    expect(urls.some((url) => url.includes("/sendMessage"))).toBe(true);
    expect(urls.some((url) => url.includes("/sendPhoto"))).toBe(false);
  });

  it("no detalhe do produto usa sendPhoto e nao duplica texto antes", async () => {
    const response = {
      intent: "products",
      handler: "ProductsHandler",
      replyText: "TV 50 SMART MULTILASER\nR$ 2.399,00",
      replyMessages: ["TV 50 SMART MULTILASER\nR$ 2.399,00"],
      actions: ["product_details"],
      handoffRequested: false,
      telegram: { inlineKeyboard: [[{ text: "Falar com vendedor", callbackData: "MENU:HUMAN_HANDOFF" }]] },
      stateTransition: { lastShownProducts: ["TV 50 SMART MULTILASER"] },
    } as ChatbotResponse;
    const { telegram } = service(response, [
      product({
        nome: "TV 50 SMART MULTILASER",
        primaryImage: "https://example.com/tv.jpg",
        images: [{ imageUrl: "https://example.com/tv.jpg", ordem: 0, principal: true }],
      }),
    ]);

    await telegram.processWebhookEvent({ message: { message_id: 1, chat: { id: 123 }, text: "ver mais TV" } });

    const urls = vi.mocked(globalThis.fetch).mock.calls.map((call) => String(call[0]));
    expect(urls.filter((url) => url.includes("/sendPhoto"))).toHaveLength(1);
    expect(urls.filter((url) => url.includes("/sendMessage"))).toHaveLength(0);
  });

  it("pausa chatbot quando conversa esta em handoff humano", async () => {
    const response = { intent: "menu", handler: "test", replyText: "ok", actions: [], handoffRequested: false } as ChatbotResponse;
    const { telegram, chatbotCore, repository } = service(response);
    repository.getConversationAutomationStateByChatId.mockResolvedValueOnce({
      atendimentoId: 7,
      chatId: "123",
      status: "PENDENTE",
      handoffRequested: true,
      stage: "ENCAMINHADO_HUMANO",
    });

    const result = await telegram.processWebhookEvent({ message: { message_id: 1, chat: { id: 123 }, text: "oi" } });

    expect(chatbotCore.pauseConversation).toHaveBeenCalledWith("123");
    expect(result.messageResults?.[0]?.status).toBe("suppressed");
  });

  it("hidrata estado persistido antes de processar nova mensagem", async () => {
    const response = { intent: "products", handler: "test", replyText: "ok", actions: [], handoffRequested: false } as ChatbotResponse;
    const { telegram, chatbotCore, repository } = service(response);
    repository.getConversationAutomationStateByChatId.mockResolvedValueOnce({
      atendimentoId: 7,
      chatId: "123",
      status: "ATIVO",
      handoffRequested: false,
      stage: "AGUARDANDO_CATEGORIA",
      intent: "products",
    });

    await telegram.processWebhookEvent({ message: { message_id: 1, chat: { id: 123 }, text: "Brinquedos" } });

    expect(chatbotCore.hydrateConversationState).toHaveBeenCalledWith("123", expect.objectContaining({
      stage: "AGUARDANDO_CATEGORIA",
      intent: "products",
      handoffRequested: false,
    }));
    expect(chatbotCore.processIncomingMessages).toHaveBeenCalled();
  });
});
