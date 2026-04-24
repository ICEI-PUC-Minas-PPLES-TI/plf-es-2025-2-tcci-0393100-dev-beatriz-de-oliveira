// Mock data centralized for easy maintenance
import type {
  Atendimento,
  BillingRule,
  DashboardAtendimentoRecente,
  DashboardTopProduto,
  Lead,
  Mensagem,
  Metricas,
  Pedido,
  Produto,
  Promocao,
} from "../types/domain";

export const PRODUTOS: Produto[] = [
  {
    id: 1,
    nome: "Sof� Retr�til Premium",
    categoria: "Sof�s",
    descricao: "Sof� moderno com retr�til e reclin�vel, tecido premium.",
    preco: "2499.00",
    quantidade: 12,
    disponivel: true,
    imagem: "https://images.unsplash.com/photo-1768946052273-0a2dd7f3e365?w=400",
  },
  {
    id: 2,
    nome: "Geladeira Frost Free 450L",
    categoria: "Eletrodom�sticos",
    descricao: "Geladeira moderna com tecnologia frost free.",
    preco: "3299.00",
    quantidade: 8,
    disponivel: true,
    imagem: "https://images.unsplash.com/photo-1758488438758-5e2eedf769ce?w=400",
  },
  {
    id: 3,
    nome: "Smart TV 55 Polegadas",
    categoria: "Eletronicos",
    descricao: "Smart TV 4K com sistema Android integrado.",
    preco: "2199.00",
    quantidade: 0,
    disponivel: false,
    imagem: "https://images.unsplash.com/photo-1763132646264-4123ae7cf4a6?w=400",
  },
  {
    id: 4,
    nome: "Mesa de Jantar 6 Lugares",
    categoria: "Mesas",
    descricao: "Mesa de jantar em madeira maci�a.",
    preco: "1899.00",
    quantidade: 5,
    disponivel: true,
    imagem: "https://images.unsplash.com/photo-1539624831128-04618668ce81?w=400",
  },
  {
    id: 5,
    nome: "Guarda-Roupa Casal",
    categoria: "Guarda-Roupas",
    descricao: "Guarda-roupa espa�oso com espelho.",
    preco: "1599.00",
    quantidade: 3,
    disponivel: true,
    imagem: "https://images.unsplash.com/photo-1631048499455-4f9e26f23b9f?w=400",
  },
];

export const PROMOCOES: Promocao[] = [
  {
    id: 1,
    produto: "Sof� Retr�til Premium",
    produto_id: 1,
    tipo: "PROMOCAO" as const,
    ativa: true,
    inicio_em: "2026-02-01",
    fim_em: "2026-02-28",
    imagem: "https://images.unsplash.com/photo-1768946052273-0a2dd7f3e365?w=200",
  },
  {
    id: 2,
    produto: "Geladeira Frost Free 450L",
    produto_id: 2,
    tipo: "DESTAQUE" as const,
    ativa: true,
    inicio_em: "2026-02-05",
    fim_em: "2026-03-05",
    imagem: "https://images.unsplash.com/photo-1758488438758-5e2eedf769ce?w=200",
  },
  {
    id: 3,
    produto: "Smart TV 55 Polegadas",
    produto_id: 3,
    tipo: "PROMOCAO" as const,
    ativa: false,
    inicio_em: "2026-01-15",
    fim_em: "2026-01-31",
    imagem: "https://images.unsplash.com/photo-1763132646264-4123ae7cf4a6?w=200",
  },
];

export const LEADS: Lead[] = [
  {
    id: 1,
    nome: "Maria Silva",
    telefone: "(11) 98765-4321",
    email: "maria.silva@email.com",
    interesse: "Sof� Retr�til Premium",
    status: "NOVO" as const,
    data_criacao: "2026-02-06T10:30:00",
  },
  {
    id: 2,
    nome: "Jo�o Santos",
    telefone: "(11) 97654-3210",
    email: "joao.santos@email.com",
    interesse: "Geladeira Frost Free",
    status: "EM_CONTATO" as const,
    data_criacao: "2026-02-05T14:20:00",
  },
  {
    id: 3,
    nome: "Ana Costa",
    telefone: "(11) 96543-2109",
    email: "ana.costa@email.com",
    interesse: 'Smart TV 55"',
    status: "CONVERTIDO" as const,
    data_criacao: "2026-02-04T09:15:00",
  },
  {
    id: 4,
    nome: "Pedro Oliveira",
    telefone: "(11) 95432-1098",
    email: "pedro.oliveira@email.com",
    interesse: "Mesa de Jantar",
    status: "ENCAMINHADO_HUMANO" as const,
    data_criacao: "2026-02-03T16:45:00",
  },
  {
    id: 5,
    nome: "Carla Mendes",
    telefone: "(11) 94321-0987",
    email: "carla.mendes@email.com",
    interesse: "Guarda-Roupa",
    status: "PERDIDO" as const,
    data_criacao: "2026-02-02T11:00:00",
  },
];

export const PEDIDOS: Pedido[] = [
  {
    id: 1,
    numero_pedido: "PED-0001",
    cliente: "Maria Silva",
    telefone_cliente: "(11) 98765-4321",
    telefone: "5511987654321",
    contatoExibicao: "(11) 98765-4321",
    valor_total: "R$ 2.499,00",
    forma_pagamento: "PIX",
    status: "PAGO" as const,
    data_vencimento: "2026-02-10",
  },
  {
    id: 2,
    numero_pedido: "PED-0002",
    cliente: "Jo�o Santos",
    telefone_cliente: "(11) 97654-3210",
    telefone: "5511976543210",
    contatoExibicao: "(11) 97654-3210",
    valor_total: "R$ 3.299,00",
    forma_pagamento: "Boleto",
    status: "ATRASADO" as const,
    data_vencimento: "2026-02-01",
  },
  {
    id: 3,
    numero_pedido: "PED-0003",
    cliente: "Ana Costa",
    telefone_cliente: "(11) 96543-2109",
    telefone: "5511965432109",
    contatoExibicao: "(11) 96543-2109",
    valor_total: "R$ 1.899,00",
    forma_pagamento: "Cart�o",
    status: "PENDENTE" as const,
    data_vencimento: "2026-02-15",
  },
];

export const ATENDIMENTOS: Atendimento[] = [
  {
    id: 1,
    cliente: "Maria Silva",
    telefone: "(11) 98765-4321",
    status: "ATIVO" as const,
    ultima_mensagem: "Obrigada pela aten��o!",
    horario: "10:30",
  },
  {
    id: 2,
    cliente: "Jo�o Santos",
    telefone: "(11) 97654-3210",
    status: "PENDENTE" as const,
    ultima_mensagem: "Quanto fica o frete?",
    horario: "09:15",
  },
  {
    id: 3,
    cliente: "Ana Costa",
    telefone: "(11) 96543-2109",
    status: "ATIVO" as const,
    ultima_mensagem: "Pode enviar o boleto?",
    horario: "Ontem",
  },
  {
    id: 4,
    cliente: "Pedro Oliveira",
    telefone: "(11) 95432-1098",
    status: "ENCERRADO" as const,
    ultima_mensagem: "Pedido recebido, obrigado!",
    horario: "02/02",
  },
];

export const MENSAGENS: Mensagem[] = [
  {
    id: 1,
    tipo: "recebida" as const,
    conteudo: "Ol�, gostaria de saber sobre o sof� retr�til",
    horario: "10:25",
  },
  {
    id: 2,
    tipo: "enviada" as const,
    conteudo: "Ol� Maria! Tudo bem? O sof� retr�til est� em promo��o por R$ 2.499,00 com frete gr�tis!",
    horario: "10:26",
  },
  {
    id: 3,
    tipo: "recebida" as const,
    conteudo: "Que legal! Qual o prazo de entrega?",
    horario: "10:28",
  },
  {
    id: 4,
    tipo: "enviada" as const,
    conteudo: "A entrega � feita em at� 5 dias �teis para sua regi�o. Posso reservar uma unidade para voc�?",
    horario: "10:29",
  },
  {
    id: 5,
    tipo: "recebida" as const,
    conteudo: "Obrigada pela aten��o!",
    horario: "10:30",
  },
];

export const METRICAS: Metricas = {
  vendasPorDia: [
    { dia: "01/02", vendas: 12, receita: 28450 },
    { dia: "02/02", vendas: 8, receita: 19200 },
    { dia: "03/02", vendas: 15, receita: 35700 },
    { dia: "04/02", vendas: 10, receita: 24300 },
    { dia: "05/02", vendas: 18, receita: 42100 },
    { dia: "06/02", vendas: 14, receita: 33200 },
  ],
  novosClientes: 42,
  topProdutos: [
    { produto: "Sof� Retr�til Premium", vendas: 24, receita: "R$ 59.976,00" },
    { produto: "Geladeira Frost Free 450L", vendas: 18, receita: "R$ 59.382,00" },
    { produto: "Smart TV 55 Polegadas", vendas: 15, receita: "R$ 32.985,00" },
    { produto: "Mesa de Jantar 6 Lugares", vendas: 12, receita: "R$ 22.788,00" },
    { produto: "Guarda-Roupa Casal", vendas: 10, receita: "R$ 15.990,00" },
  ],
};

export const BILLING_RULE: BillingRule = {
  ativa: true,
  limite_envio_por_dia: "10",
  hora_envio: "09:00",
  lembrete_antes_ativo: true,
  dias_antes_vencimento: "2",
  template_antes_vencimento: "Ol� {nome}, seu pedido no valor de {valor} vence em {data}.",
  vencimento_hoje_ativo: true,
  template_vencimento_hoje: "Ol� {nome}, passando para lembrar que seu pedido no valor de {valor} vence hoje.",
  apos_vencimento_ativo: true,
  dias_apos_vencimento: "1",
  template_apos_vencimento: "Ol� {nome}, identificamos que seu pedido no valor de {valor} venceu em {data}. Podemos te ajudar com a regulariza��o?",
  dias_atraso_max: "30",
};

export const DASHBOARD_TOP_PRODUTOS: DashboardTopProduto[] = [
  {
    id: 1,
    nome: "Sofa Retratil Premium",
    preco: "R$ 2.499,00",
    imagem:
      "https://images.unsplash.com/photo-1768946052273-0a2dd7f3e365?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBzb2ZhJTIwZnVybml0dXJlfGVufDF8fHx8MTc3MDQxNjg0NHww&ixlib=rb-4.1.0&q=80&w=1080",
    vendas: 24,
  },
  {
    id: 2,
    nome: "Geladeira Frost Free 450L",
    preco: "R$ 3.299,00",
    imagem:
      "https://images.unsplash.com/photo-1758488438758-5e2eedf769ce?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyZWZyaWdlcmF0b3IlMjBraXRjaGVuJTIwYXBwbGlhbmNlfGVufDF8fHx8MTc3MDMyNDQ1MXww&ixlib=rb-4.1.0&q=80&w=1080",
    vendas: 18,
  },
  {
    id: 3,
    nome: "Smart TV 55 Polegadas",
    preco: "R$ 2.199,00",
    imagem:
      "https://images.unsplash.com/photo-1763132646264-4123ae7cf4a6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0ZWxldmlzaW9uJTIwc2NyZWVufGVufDF8fHx8MTc3MDM5NTMxN3ww&ixlib=rb-4.1.0&q=80&w=1080",
    vendas: 15,
  },
];

export const DASHBOARD_ATENDIMENTOS_RECENTES: DashboardAtendimentoRecente[] = [
  { id: 1, cliente: "Maria Silva", mensagem: "Gostaria de saber sobre o sofa...", hora: "Ha 5 min" },
  { id: 2, cliente: "Joao Santos", mensagem: "Qual o prazo de entrega?", hora: "Ha 12 min" },
  { id: 3, cliente: "Ana Costa", mensagem: "Tem desconto para pagamento a vista?", hora: "Ha 25 min" },
];



