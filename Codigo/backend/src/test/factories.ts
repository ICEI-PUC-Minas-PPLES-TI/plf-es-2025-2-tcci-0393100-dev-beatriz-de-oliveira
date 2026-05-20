import type { BillingRule, Pedido, Produto, Promocao } from "../types/domain.js";
import type { ChatbotContext, ChatbotConversationState, NormalizedIncomingMessage } from "../modules/chatbot/types.js";

export function product(overrides: Partial<Produto> = {}): Produto {
  const base: Produto = {
    id: 1,
    nome: "TV 50 SMART MULTILASER",
    categoria: "Eletronicos",
    descricao: "Smart TV 4K com Wi-Fi integrado",
    preco: "2399.00",
    quantidade: 5,
    disponivel: true,
    imagem: "",
    images: [],
  };

  return { ...base, ...overrides };
}

export function promotion(overrides: Partial<Promocao> = {}): Promocao {
  return {
    id: 1,
    produto: "COPO TERMICO 420ML COM CAIXA DE SOM",
    produto_id: 10,
    tipo: "PROMOCAO",
    desconto: "10%",
    ativa: true,
    inicio_em: "2026-01-01",
    fim_em: "2026-05-17",
    imagem: "",
    ...overrides,
  };
}

export function state(overrides: Partial<ChatbotConversationState> = {}): ChatbotConversationState {
  return {
    phoneNumber: "1439821696",
    stage: "MENU_PRINCIPAL",
    lastIntent: "menu",
    lastMessageAt: "2026-05-17T12:00:00.000Z",
    handoffRequested: false,
    awaitingHumanHandoffDecision: false,
    awaitingProductSelectionForInterest: false,
    lastShownProducts: [],
    lastSuggestedCategories: [],
    recentPromotions: [],
    awaitingPromotionPriceQuery: false,
    ...overrides,
  };
}

export function message(text: string): NormalizedIncomingMessage {
  return {
    from: "1439821696",
    channel: "telegram",
    messageId: `test:${text}`,
    originalText: text,
    normalizedText: text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase(),
    profileName: "Beatriz",
  };
}

export function chatbotContext(text: string, overrides: Partial<ChatbotContext> = {}): ChatbotContext {
  return {
    message: message(text),
    state: state(),
    nowIso: "2026-05-17T12:00:00.000Z",
    rawEvent: {},
    ...overrides,
  };
}

export function billingRule(overrides: Partial<BillingRule> = {}): BillingRule {
  return {
    ativa: true,
    limite_envio_por_dia: "10",
    hora_envio: "09:00",
    lembrete_antes_ativo: true,
    dias_antes_vencimento: "2",
    template_antes_vencimento: "Oi {nome}, seu pedido de {valor} vence em {data}.",
    vencimento_hoje_ativo: true,
    template_vencimento_hoje: "Oi {nome}, seu pedido de {valor} vence hoje, {data}.",
    apos_vencimento_ativo: true,
    dias_apos_vencimento: "1",
    template_apos_vencimento: "Oi {nome}, seu pedido de {valor} esta em atraso desde {data}.",
    dias_atraso_max: "30",
    ...overrides,
  };
}

export function order(overrides: Partial<Pedido> = {}): Pedido {
  return {
    id: 1,
    numero_pedido: "PED-1",
    produto_nome: "TV 50 SMART MULTILASER",
    cliente: "Beatriz",
    telefone_cliente: "1439821696",
    telegramChatId: "1439821696",
    contatoExibicao: "ID Telegram: 1439821696",
    valor_total: "R$ 2.399,00",
    forma_pagamento: "PIX",
    status: "PENDENTE",
    data_vencimento: "2026-05-17",
    cobrancaCanal: "telegram",
    cobrancaCanalDisponivel: true,
    ...overrides,
  };
}
