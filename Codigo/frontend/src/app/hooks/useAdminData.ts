import { useCallback } from "react";
import type { DateRange } from "react-day-picker";
import { adminDataService } from "../services/adminDataService";
import { useAsyncData } from "./useAsyncData";
import type {
  Atendimento,
  BillingRule,
  ConversationChannel,
  DashboardSummary,
  Lead,
  Mensagem,
  Metricas,
  Pedido,
  Produto,
  Promocao,
} from "../types/domain";

export function useProdutosData() {
  const loader = useCallback(() => adminDataService.listProdutos(), []);
  return useAsyncData<Produto[]>(loader, []);
}

export function useProdutosLookup(searchTerm: string, enabled = true) {
  const loader = useCallback(() => adminDataService.searchProdutos({ search: searchTerm, limit: 50 }), [searchTerm]);
  return useAsyncData<Produto[]>(loader, [], { enabled });
}

export function usePromocoesData() {
  const loader = useCallback(() => adminDataService.listPromocoes(), []);
  return useAsyncData<Promocao[]>(loader, []);
}

export function useLeadsData() {
  const loader = useCallback(() => adminDataService.listLeads(), []);
  return useAsyncData<Lead[]>(loader, []);
}

export function usePedidosData() {
  const loader = useCallback(() => adminDataService.listPedidos(), []);
  return useAsyncData<Pedido[]>(loader, []);
}

export function useAtendimentosData() {
  const loader = useCallback(() => adminDataService.listAtendimentos(), []);
  return useAsyncData<Atendimento[]>(loader, []);
}

export function useMensagensData(atendimentoId: number | null) {
  const loader = useCallback(() => {
    if (atendimentoId === null) {
      return Promise.resolve([] as Mensagem[]);
    }
    return adminDataService.listMensagens(atendimentoId);
  }, [atendimentoId]);

  return useAsyncData<Mensagem[]>(loader, [], { enabled: atendimentoId !== null });
}

export function useConversationsData(channel: ConversationChannel | "todos") {
  const loader = useCallback(() => adminDataService.listConversations(channel), [channel]);
  return useAsyncData<Atendimento[]>(loader, []);
}

export function useConversationMessagesData(conversationId: number | null) {
  const loader = useCallback(() => {
    if (conversationId === null) {
      return Promise.resolve([] as Mensagem[]);
    }
    return adminDataService.listConversationMessages(conversationId);
  }, [conversationId]);

  return useAsyncData<Mensagem[]>(loader, [], { enabled: conversationId !== null });
}

export function useMetricasData(periodo?: DateRange, enabled = true) {
  const loader = useCallback(() => adminDataService.getMetricas(periodo), [periodo]);
  return useAsyncData<Metricas>(loader, { vendasPorDia: [], topProdutos: [], novosClientes: 0 }, { enabled });
}

export function useDashboardSummaryData(periodo?: DateRange) {
  const loader = useCallback(() => adminDataService.getDashboardSummary(periodo), [periodo]);
  return useAsyncData<DashboardSummary>(loader, {
    pedidosPendentes: 0,
    atendimentosAtivos: 0,
    produtosDisponiveis: 0,
    pedidosMes: 0,
    topProdutos: [],
    atendimentosRecentes: [],
  });
}

export function useBillingRuleData() {
  const loader = useCallback(() => adminDataService.getBillingRule(), []);
  return useAsyncData<BillingRule>(loader, {
    ativa: true,
    mensagem_template: "",
    limite_envio_por_dia: "",
    hora_envio: "",
    dias_atraso_min: "",
    dias_atraso_max: "",
  });
}
