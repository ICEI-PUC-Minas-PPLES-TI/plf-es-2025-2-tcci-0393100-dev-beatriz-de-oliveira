import type { DateRange } from "react-day-picker";
import { API_ENDPOINTS } from "../api/endpoints";
import { httpClient } from "../api/httpClient";
import { isMockDataSource } from "./dataSource";
import { buildDateRangeQuery } from "../utils/dateRange";
import {
  ATENDIMENTOS,
  BILLING_RULE,
  DASHBOARD_ATENDIMENTOS_RECENTES,
  DASHBOARD_TOP_PRODUTOS,
  LEADS,
  MENSAGENS,
  METRICAS,
  PEDIDOS,
  PRODUTOS,
  PROMOCOES,
} from "../mocks/mockData";
import type {
  Atendimento,
  AtendimentoHistorico,
  BillingRule,
  ConversationChannel,
  DashboardSummary,
  Lead,
  LeadStatus,
  Mensagem,
  Metricas,
  Pedido,
  Produto,
  Promocao,
} from "../types/domain";
import type { ApiItemResponse, ApiListResponse } from "../types/api";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
type ProductPayload = Omit<Produto, "id">;
type PromotionPayload = Omit<Promocao, "id">;
type OrderPayload = Omit<Pedido, "id">;
let mockBillingRule: BillingRule = clone(BILLING_RULE);

function normalizeConversationChannel(channel?: string): ConversationChannel {
  return channel?.toUpperCase() === "TELEGRAM" || channel?.toLowerCase() === "telegram" ? "telegram" : "whatsapp";
}

function normalizeConversation(conversation: Atendimento): Atendimento {
  return {
    ...conversation,
    channel: normalizeConversationChannel(conversation.channel),
  };
}

const MOCK_DASHBOARD_SUMMARY: DashboardSummary = {
  pedidosPendentes: PEDIDOS.filter((pedido) => pedido.status === "PENDENTE").length,
  atendimentosAtivos: ATENDIMENTOS.filter((atendimento) => atendimento.status !== "ENCERRADO").length,
  produtosDisponiveis: PRODUTOS.filter((produto) => produto.disponivel).length,
  pedidosMes: PEDIDOS.length,
  topProdutos: DASHBOARD_TOP_PRODUTOS,
  atendimentosRecentes: DASHBOARD_ATENDIMENTOS_RECENTES,
};

const getMockOrApiData = async <T>(mockFactory: () => T, apiFactory: () => Promise<T>): Promise<T> => {
  if (isMockDataSource) {
    return clone(mockFactory());
  }
  return apiFactory();
};

export const adminDataService = {
  listProdutos: () =>
    getMockOrApiData<Produto[]>(
      () => PRODUTOS,
      async () => (await httpClient.get<ApiListResponse<Produto>>(API_ENDPOINTS.produtos)).data,
    ),

  searchProdutos: (params: { search?: string; limit?: number } = {}) =>
    getMockOrApiData<Produto[]>(
      () => {
        const term = params.search?.trim().toLowerCase();
        const filtered = term
          ? PRODUTOS.filter((produto) => produto.nome.toLowerCase().includes(term))
          : PRODUTOS;
        return filtered.slice(0, params.limit ?? 50);
      },
      async () => {
        const query = new URLSearchParams();
        if (params.search?.trim()) query.set("search", params.search.trim());
        if (params.limit) query.set("limit", String(params.limit));
        const suffix = query.toString() ? `?${query.toString()}` : "";
        return (await httpClient.get<ApiListResponse<Produto>>(`${API_ENDPOINTS.produtos}${suffix}`)).data;
      },
    ),
  createProduto: (payload: ProductPayload) =>
    getMockOrApiData<Produto>(
      () => {
        const nextId = Math.max(0, ...PRODUTOS.map((item) => item.id)) + 1;
        const created: Produto = { id: nextId, ...payload };
        PRODUTOS.push(created);
        return created;
      },
      async () => (await httpClient.post<ApiItemResponse<Produto>>(API_ENDPOINTS.produtos, payload)).data,
    ),

  updateProduto: (id: number, payload: Partial<ProductPayload>) =>
    getMockOrApiData<Produto>(
      () => {
        const index = PRODUTOS.findIndex((item) => item.id === id);
        if (index < 0) {
          throw new Error("Produto nao encontrado");
        }
        const updated: Produto = { ...PRODUTOS[index], ...payload };
        PRODUTOS[index] = updated;
        return updated;
      },
      async () => (await httpClient.put<ApiItemResponse<Produto>>(`${API_ENDPOINTS.produtos}/${id}`, payload)).data,
    ),

  deleteProduto: (id: number) =>
    getMockOrApiData<void>(
      () => {
        const index = PRODUTOS.findIndex((item) => item.id === id);
        if (index < 0) {
          throw new Error("Produto nao encontrado");
        }
        PRODUTOS.splice(index, 1);
      },
      async () => {
        await httpClient.delete<void>(`${API_ENDPOINTS.produtos}/${id}`);
      },
    ),

  listPromocoes: () =>
    getMockOrApiData<Promocao[]>(
      () => PROMOCOES,
      async () => (await httpClient.get<ApiListResponse<Promocao>>(API_ENDPOINTS.promotions)).data,
    ),

  createPromocao: (payload: PromotionPayload) =>
    getMockOrApiData<Promocao>(
      () => {
        const nextId = Math.max(0, ...PROMOCOES.map((item) => item.id)) + 1;
        const created: Promocao = { id: nextId, ...payload };
        PROMOCOES.push(created);
        return created;
      },
      async () => (await httpClient.post<ApiItemResponse<Promocao>>(API_ENDPOINTS.promotions, payload)).data,
    ),

  updatePromocao: (id: number, payload: Partial<PromotionPayload>) =>
    getMockOrApiData<Promocao>(
      () => {
        const index = PROMOCOES.findIndex((item) => item.id === id);
        if (index < 0) {
          throw new Error("Promocao nao encontrada");
        }
        const updated: Promocao = { ...PROMOCOES[index], ...payload };
        PROMOCOES[index] = updated;
        return updated;
      },
      async () => (await httpClient.put<ApiItemResponse<Promocao>>(`${API_ENDPOINTS.promotions}/${id}`, payload)).data,
    ),

  deletePromocao: (id: number) =>
    getMockOrApiData<void>(
      () => {
        const index = PROMOCOES.findIndex((item) => item.id === id);
        if (index < 0) {
          throw new Error("Promocao nao encontrada");
        }
        PROMOCOES.splice(index, 1);
      },
      async () => {
        await httpClient.delete<void>(`${API_ENDPOINTS.promotions}/${id}`);
      },
    ),

  listLeads: () =>
    getMockOrApiData<Lead[]>(
      () => LEADS,
      async () => (await httpClient.get<ApiListResponse<Lead>>(API_ENDPOINTS.leads)).data,
    ),

  updateLeadStatus: (id: number, status: LeadStatus) =>
    getMockOrApiData<Lead>(
      () => {
        const index = LEADS.findIndex((item) => item.id === id);
        if (index < 0) {
          throw new Error("Lead nao encontrado");
        }
        const updated: Lead = { ...LEADS[index], status };
        LEADS[index] = updated;
        return updated;
      },
      async () => (await httpClient.patch<ApiItemResponse<Lead>>(`${API_ENDPOINTS.leads}/${id}/status`, { status })).data,
    ),

  exportLeadsCsv: (params?: { status?: string; search?: string }) =>
    getMockOrApiData<string>(
      () => {
        const filtered = LEADS.filter((lead) => {
          const matchesStatus = !params?.status || lead.status === params.status;
          const matchesSearch = !params?.search
            || [lead.nome, lead.telefone, lead.email, lead.interesse].join(" ").toLowerCase().includes(params.search.toLowerCase());
          return matchesStatus && matchesSearch;
        });
        const rows = filtered.map((lead) => [lead.id, lead.nome, lead.telefone, lead.email, lead.interesse, lead.status, lead.data_criacao].join(","));
        return [["id", "nome", "telefone", "email", "interesse", "status", "data_criacao"].join(","), ...rows].join("\n");
      },
      async () => {
        const query = new URLSearchParams();
        if (params?.status) query.set("status", params.status);
        if (params?.search) query.set("search", params.search);
        const suffix = query.toString() ? `?${query.toString()}` : "";
        return await httpClient.get<string>(`${API_ENDPOINTS.leads}/export.csv${suffix}`);
      },
    ),

  listPedidos: () =>
    getMockOrApiData<Pedido[]>(
      () => PEDIDOS,
      async () => (await httpClient.get<ApiListResponse<Pedido>>(API_ENDPOINTS.billingOrders)).data,
    ),

  createPedido: (payload: OrderPayload) =>
    getMockOrApiData<Pedido>(
      () => {
        const nextId = Math.max(0, ...PEDIDOS.map((item) => item.id)) + 1;
        const created: Pedido = {
          id: nextId,
          ...payload,
          numero_pedido: payload.numero_pedido || `PED-${String(nextId).padStart(4, "0")}`,
        };
        PEDIDOS.push(created);
        return created;
      },
      async () => (await httpClient.post<ApiItemResponse<Pedido>>(API_ENDPOINTS.billingOrders, payload)).data,
    ),

  updatePedido: (id: number, payload: Partial<OrderPayload>) =>
    getMockOrApiData<Pedido>(
      () => {
        const index = PEDIDOS.findIndex((item) => item.id === id);
        if (index < 0) {
          throw new Error("Pedido nao encontrado");
        }
        const updated: Pedido = { ...PEDIDOS[index], ...payload };
        PEDIDOS[index] = updated;
        return updated;
      },
      async () => (await httpClient.put<ApiItemResponse<Pedido>>(`${API_ENDPOINTS.billingOrders}/${id}`, payload)).data,
    ),

  listAtendimentos: () =>
    getMockOrApiData<Atendimento[]>(
      () => ATENDIMENTOS,
      async () => (await httpClient.get<ApiListResponse<Atendimento>>(API_ENDPOINTS.whatsappConversations)).data,
    ),

  listMensagens: (atendimentoId: number) =>
    getMockOrApiData<Mensagem[]>(
      () => MENSAGENS,
      async () => (await httpClient.get<ApiListResponse<Mensagem>>(API_ENDPOINTS.whatsappMessages(atendimentoId))).data,
    ),

  listConversations: (channel?: ConversationChannel | "todos") =>
    (async () => {
      const query = new URLSearchParams();
      if (channel && channel !== "todos") {
        query.set("channel", normalizeConversationChannel(channel));
      }
      const suffix = query.toString() ? `?${query.toString()}` : "";
      return (await httpClient.get<ApiListResponse<Atendimento>>(`${API_ENDPOINTS.conversations}${suffix}`)).data.map(normalizeConversation);
    })(),

  listConversationMessages: (conversationId: number) =>
    (async () => (await httpClient.get<ApiListResponse<Mensagem>>(API_ENDPOINTS.conversationMessages(conversationId))).data)(),

  listPreviousConversations: (conversationId: number) =>
    getMockOrApiData<AtendimentoHistorico[]>(
      () => [],
      async () => (await httpClient.get<ApiListResponse<AtendimentoHistorico>>(API_ENDPOINTS.conversationPrevious(conversationId))).data,
    ),

  sendConversationMessage: (payload: { conversationId: number; content: string }) =>
    getMockOrApiData<Mensagem>(
      () => {
        const nextId = Math.max(0, ...MENSAGENS.map((item) => item.id)) + 1;
        const created: Mensagem = {
          id: nextId,
          tipo: "enviada",
          conteudo: payload.content,
          horario: new Date().toISOString(),
          remetente: "ATENDENTE",
          conversationId: payload.conversationId,
        };
        MENSAGENS.push(created);
        return created;
      },
      async () =>
        (
          await httpClient.post<ApiItemResponse<Mensagem>>(API_ENDPOINTS.conversationSendMessage(payload.conversationId), {
            content: payload.content,
          })
        ).data,
    ),

  updateAtendimentoStatus: (atendimentoId: number, status: Atendimento["status"]) =>
    getMockOrApiData<Atendimento>(
      () => {
        const index = ATENDIMENTOS.findIndex((item) => item.id === atendimentoId);
        if (index < 0) {
          throw new Error("Atendimento nao encontrado");
        }
        const updated: Atendimento = { ...ATENDIMENTOS[index], status };
        ATENDIMENTOS[index] = updated;
        return updated;
      },
      async () =>
        (await httpClient.patch<ApiItemResponse<Atendimento>>(API_ENDPOINTS.whatsappConversationStatus(atendimentoId), { status })).data,
    ),

  updateConversationStatus: (conversationId: number, status: Atendimento["status"]) =>
    getMockOrApiData<Atendimento>(
      () => {
        const index = ATENDIMENTOS.findIndex((item) => item.id === conversationId);
        if (index < 0) {
          throw new Error("Atendimento nao encontrado");
        }
        const updated: Atendimento = { ...ATENDIMENTOS[index], status };
        ATENDIMENTOS[index] = updated;
        return updated;
      },
      async () =>
        (await httpClient.patch<ApiItemResponse<Atendimento>>(API_ENDPOINTS.conversationStatus(conversationId), { status })).data,
    ),

  sendWhatsAppMessage: (payload: { atendimentoId?: number; telefone?: string; texto: string }) =>
    getMockOrApiData<Mensagem>(
      () => {
        const nextId = Math.max(0, ...MENSAGENS.map((item) => item.id)) + 1;
        const created: Mensagem = {
          id: nextId,
          tipo: "enviada",
          conteudo: payload.texto,
          horario: new Date().toISOString(),
        };
        MENSAGENS.push(created);
        return created;
      },
      async () => (await httpClient.post<ApiItemResponse<Mensagem>>(API_ENDPOINTS.whatsappSend, payload)).data,
    ),

  getMetricas: (periodo?: DateRange) =>
    getMockOrApiData<Metricas>(
      () => ({ ...METRICAS, novosClientes: 0 }),
      async () => (await httpClient.get<ApiItemResponse<Metricas>>(`${API_ENDPOINTS.metricas}${buildDateRangeQuery(periodo)}`)).data,
    ),

  getDashboardSummary: (periodo?: DateRange) =>
    getMockOrApiData<DashboardSummary>(
      () => MOCK_DASHBOARD_SUMMARY,
      async () => (await httpClient.get<ApiItemResponse<DashboardSummary>>(`${API_ENDPOINTS.dashboardSummary}${buildDateRangeQuery(periodo)}`)).data,
    ),

  getBillingRule: () =>
    getMockOrApiData<BillingRule>(
      () => mockBillingRule,
      async () => (await httpClient.get<ApiItemResponse<BillingRule>>(API_ENDPOINTS.billingRules)).data,
    ),

  saveBillingRule: (rule: BillingRule) =>
    getMockOrApiData<BillingRule>(
      () => {
        mockBillingRule = clone(rule);
        return mockBillingRule;
      },
      async () => (await httpClient.post<ApiItemResponse<BillingRule>>(API_ENDPOINTS.billingRules, rule)).data,
    ),
};
