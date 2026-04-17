import type { BillingRule, BillingRoutineRun, Lead, Metricas, Pedido, Produto } from "../types/domain.js";

export const seedProdutos: Produto[] = [
  {
    id: 1,
    nome: "Sofa Retratil Premium",
    categoria: "Sofas",
    descricao: "Sofa moderno com retratil e reclinavel, tecido premium.",
    preco: "2499.00",
    quantidade: 10,
    disponivel: true,
    imagem: "https://images.unsplash.com/photo-1768946052273-0a2dd7f3e365?w=400",
  },
  {
    id: 2,
    nome: "Geladeira Frost Free 450L",
    categoria: "Eletrodomesticos",
    descricao: "Geladeira moderna com tecnologia frost free.",
    preco: "3299.00",
    quantidade: 6,
    disponivel: true,
    imagem: "https://images.unsplash.com/photo-1758488438758-5e2eedf769ce?w=400",
  },
];

export const seedLeads: Lead[] = [
  {
    id: 1,
    nome: "Maria Silva",
    telefone: "(11) 98765-4321",
    email: "maria.silva@email.com",
    interesse: "Sofa Retratil Premium",
    status: "NOVO",
    data_criacao: "2026-02-06T10:30:00",
  },
  {
    id: 2,
    nome: "Joao Santos",
    telefone: "(11) 97654-3210",
    email: "joao.santos@email.com",
    interesse: "Geladeira Frost Free",
    status: "EM_CONTATO",
    data_criacao: "2026-02-05T14:20:00",
  },
];

export const seedMetricas: Metricas = {
  vendasPorDia: [
    { dia: "01/02", vendas: 12, receita: 28450 },
    { dia: "02/02", vendas: 8, receita: 19200 },
    { dia: "03/02", vendas: 15, receita: 35700 },
  ],
  novosClientes: 12,
  topProdutos: [
    { produto: "Sofa Retratil Premium", vendas: 24, receita: "R$ 59.976,00" },
    { produto: "Geladeira Frost Free 450L", vendas: 18, receita: "R$ 59.382,00" },
  ],
};

export const seedBillingRule: BillingRule = {
  ativa: true,
  mensagem_template: "Ola {nome}, seu pedido no valor de {valor} venceu em {data}.",
  limite_envio_por_dia: "10",
  hora_envio: "09:00",
  dias_atraso_min: "1",
  dias_atraso_max: "30",
};

export const seedPedidos: Pedido[] = [
  {
    id: 1,
    numero_pedido: "PED-0001",
    cliente: "Maria Silva",
    telefone_cliente: "(11) 98765-4321",
    valor_total: "2499.00",
    forma_pagamento: "PIX",
    status: "PENDENTE",
    data_vencimento: "2026-03-18",
  },
  {
    id: 2,
    numero_pedido: "PED-0002",
    cliente: "Joao Santos",
    telefone_cliente: "(11) 97654-3210",
    valor_total: "3299.00",
    forma_pagamento: "Boleto",
    status: "PENDENTE",
    data_vencimento: "2026-03-10",
  },
  {
    id: 3,
    numero_pedido: "PED-0003",
    cliente: "Ana Costa",
    telefone_cliente: "(11) 96543-2109",
    valor_total: "899.00",
    forma_pagamento: "Cartao",
    status: "PENDENTE",
    data_vencimento: "2026-02-01",
  },
  {
    id: 4,
    numero_pedido: "PED-0004",
    cliente: "Pedro Oliveira",
    telefone_cliente: "(11) 95432-1098",
    valor_total: "499.00",
    forma_pagamento: "PIX",
    status: "PAGO",
    data_vencimento: "2026-03-15",
  },
];

export const seedBillingRoutineRuns: BillingRoutineRun[] = [];


