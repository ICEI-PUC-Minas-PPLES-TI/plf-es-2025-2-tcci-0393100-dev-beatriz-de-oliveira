export type LeadStatus = "NOVO" | "ENCAMINHADO_HUMANO" | "EM_CONTATO" | "CONVERTIDO" | "PERDIDO";
export type PromocaoTipo = "PROMOCAO" | "DESTAQUE";
export type PedidoStatus = "PAGO" | "ATRASADO" | "PENDENTE" | "CANCELADO";
export type AtendimentoStatus = "ATIVO" | "PENDENTE" | "ENCERRADO";
export type MensagemTipo = "recebida" | "enviada";
export type ConversationChannel = "whatsapp" | "telegram";
export type BillingSendStatus = "ENVIADO" | "FALHA";
export type BillingSendType = "AUTOMATICO" | "MANUAL";
export type BillingChargeKind = "LEMBRETE" | "VENCE_HOJE" | "EM_ATRASO";

export interface Produto {
  id: number;
  nome: string;
  categoria: string;
  descricao: string;
  preco: string;
  disponivel: boolean;
  imagem: string;
}

export interface Lead {
  id: number;
  nome: string;
  telefone: string;
  email: string;
  interesse: string;
  status: LeadStatus;
  data_criacao: string;
}

export interface LeadFilters {
  status?: LeadStatus;
  search?: string;
}

export interface Promocao {
  id: number;
  produto: string;
  produto_id: number;
  tipo: PromocaoTipo;
  ativa: boolean;
  inicio_em: string;
  fim_em: string;
  imagem: string;
}

export interface Pedido {
  id: number;
  numero_pedido: string;
  cliente: string;
  telefone_cliente: string;
  telefone?: string;
  telegramChatId?: string;
  contatoExibicao?: string;
  valor_total: string;
  forma_pagamento: string;
  status: PedidoStatus;
  data_vencimento: string;
  cobrancaStatus?: BillingSendStatus;
  cobrancaTipoEnvio?: BillingSendType;
  cobrancaDataEnvio?: string;
  cobrancaMensagem?: string;
  cobrancaCanal?: ConversationChannel;
  cobrancaCanalDisponivel?: boolean;
  cobrancaMotivoIndisponivel?: string;
}

export interface BillingRule {
  ativa: boolean;
  limite_envio_por_dia: string;
  hora_envio: string;
  lembrete_antes_ativo: boolean;
  dias_antes_vencimento: string;
  template_antes_vencimento: string;
  vencimento_hoje_ativo: boolean;
  template_vencimento_hoje: string;
  apos_vencimento_ativo: boolean;
  dias_apos_vencimento: string;
  template_apos_vencimento: string;
  dias_atraso_max: string;
}

export interface BillingRoutineEntry {
  pedido_id: number;
  numero_pedido: string;
  cliente: string;
  telefone_cliente: string;
  valor_total: string;
  data_vencimento: string;
  dias_atraso: number;
  status_original: PedidoStatus;
  status_final: PedidoStatus;
  mensagem: string;
}

export interface BillingRoutineRun {
  id: number;
  executado_em: string;
  referencia_em: string;
  regra_ativa: boolean;
  elegiveis: number;
  processados: number;
  ignorados: number;
  itens: BillingRoutineEntry[];
}

export interface Atendimento {
  id: number;
  cliente: string;
  telefone: string;
  contactId?: string;
  status: AtendimentoStatus;
  ultima_mensagem: string;
  horario: string;
  iniciadoEm?: string;
  encerradoEm?: string | null;
  ultimaInteracaoEm?: string | null;
  channel?: ConversationChannel;
  leadId?: number;
  leadStatus?: LeadStatus;
  leadStatusSuggestion?: Extract<LeadStatus, "CONVERTIDO" | "PERDIDO">;
}

export interface AtendimentoHistorico extends Atendimento {
  messages: Mensagem[];
}

export interface Mensagem {
  id: number;
  tipo: MensagemTipo;
  conteudo: string;
  horario: string;
  remetente?: string;
  conversationId?: number;
  channel?: ConversationChannel;
  type?: string;
  atendimentoIniciadoEm?: string;
  atendimentoEncerradoEm?: string;
}

export interface DashboardTopProduto {
  id: number;
  nome: string;
  preco: string;
  imagem: string;
  vendas: number;
}

export interface DashboardAtendimentoRecente {
  id: number;
  cliente: string;
  mensagem: string;
  hora: string;
}

export interface DashboardSummary {
  pedidosPendentes: number;
  atendimentosAtivos: number;
  produtosDisponiveis: number;
  pedidosMes: number;
  topProdutos: DashboardTopProduto[];
  atendimentosRecentes: DashboardAtendimentoRecente[];
}

export interface MetricaVendaDia {
  dia: string;
  vendas: number;
  receita: number;
}

export interface MetricaTopProduto {
  produto: string;
  vendas: number;
  receita: string;
}

export interface Metricas {
  vendasPorDia: MetricaVendaDia[];
  topProdutos: MetricaTopProduto[];
  novosClientes: number;
}
