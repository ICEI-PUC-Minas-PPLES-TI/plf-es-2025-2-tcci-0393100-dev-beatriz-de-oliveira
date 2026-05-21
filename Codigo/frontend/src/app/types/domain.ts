export type LeadStatus = "NOVO" | "EM_CONTATO" | "ENCAMINHADO" | "CONVERTIDO" | "PERDIDO";
export type LeadTimelineEventType = "produto" | "promocao" | "conversa" | "status" | "handoff";
export type PromocaoTipo = "PROMOCAO" | "DESTAQUE";
export type PedidoStatus = "PAGO" | "ATRASADO" | "PENDENTE" | "CANCELADO";
export type AtendimentoStatus = "ATIVO" | "PENDENTE" | "ENCERRADO";
export type MensagemTipo = "recebida" | "enviada";
export type ConversationChannel = "telegram";
export type BillingSendStatus = "ENVIADO" | "FALHA";
export type BillingSendType = "AUTOMATICO" | "MANUAL";
export type BillingChargeKind = "LEMBRETE" | "VENCE_HOJE" | "EM_ATRASO";
export type DisponibilidadeStatus = "disponivel" | "indisponivel";

export interface ProductImage {
  id?: number;
  productId?: number;
  imageUrl: string;
  ordem: number;
  principal: boolean;
  criadoEm?: string;
}

export interface Produto {
  id: number;
  nome: string;
  categoria: string;
  descricao: string;
  preco: string;
  quantidade: number;
  disponivel: boolean;
  imagem: string;
  images: ProductImage[];
  primaryImage?: string;
}

export interface Promocao {
  id: number;
  produto: string;
  produto_id: number;
  tipo: PromocaoTipo;
  desconto: string;
  ativa: boolean;
  inicio_em: string;
  fim_em: string;
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
  canal?: ConversationChannel;
  contato?: string;
  contatoExibicao?: string;
  origem?: string;
  intencao?: string;
  ultima_interacao?: string;
  atendimento_id?: number;
  encaminhado_humano?: boolean;
  timeline?: LeadTimelineEvent[];
}

export interface LeadTimelineEvent {
  id: string;
  type: LeadTimelineEventType;
  title: string;
  description: string;
  occurredAt: string;
  status?: LeadStatus;
  reason?: string;
}

export interface Pedido {
  id: number;
  numero_pedido: string;
  produto_id?: number;
  produto_nome?: string;
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
