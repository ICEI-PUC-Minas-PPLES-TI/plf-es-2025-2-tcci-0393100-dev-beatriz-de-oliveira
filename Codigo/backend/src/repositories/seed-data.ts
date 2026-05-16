import type { BillingRule, Lead, Metricas, Produto } from "../types/domain.js";

const productImages = (imageUrl: string) => ({
  primaryImage: imageUrl,
  images: [{ imageUrl, ordem: 0, principal: true }],
});

export const seedProdutos: Produto[] = [
  {
    id: 1,
    nome: "Sofá Retrátil Premium",
    categoria: "Sofás",
    descricao: "Sofá moderno com retrátil e reclinável, tecido premium.",
    preco: "2499.00",
    quantidade: 12,
    disponivel: true,
    imagem: "https://images.unsplash.com/photo-1768946052273-0a2dd7f3e365?w=400",
    ...productImages("https://images.unsplash.com/photo-1768946052273-0a2dd7f3e365?w=400"),
  },
  {
    id: 2,
    nome: "Geladeira Frost Free 450L",
    categoria: "Eletrodomésticos",
    descricao: "Geladeira moderna com tecnologia frost free.",
    preco: "3299.00",
    quantidade: 8,
    disponivel: true,
    imagem: "https://images.unsplash.com/photo-1758488438758-5e2eedf769ce?w=400",
    ...productImages("https://images.unsplash.com/photo-1758488438758-5e2eedf769ce?w=400"),
  },
];

export const seedLeads: Lead[] = [
  {
    id: 1,
    nome: "Maria Silva",
    telefone: "(11) 98765-4321",
    email: "maria.silva@email.com",
    interesse: "Sofá Retrátil Premium",
    status: "NOVO",
    data_criacao: "2026-02-06T10:30:00",
  },
  {
    id: 2,
    nome: "João Santos",
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
  topProdutos: [
    { produto: "Sofá Retrátil Premium", vendas: 24, receita: "R$ 59.976,00" },
    { produto: "Geladeira Frost Free 450L", vendas: 18, receita: "R$ 59.382,00" },
  ],
  novosClientes: 0,
};

export const seedBillingRule: BillingRule = {
  ativa: true,
  limite_envio_por_dia: "10",
  hora_envio: "09:00",
  lembrete_antes_ativo: true,
  dias_antes_vencimento: "2",
  template_antes_vencimento: "Olá {nome}, seu pedido no valor de {valor} vence em {data}.",
  vencimento_hoje_ativo: true,
  template_vencimento_hoje: "Olá {nome}, passando para lembrar que seu pedido no valor de {valor} vence hoje.",
  apos_vencimento_ativo: true,
  dias_apos_vencimento: "1",
  template_apos_vencimento: "Olá {nome}, identificamos que seu pedido no valor de {valor} venceu em {data}. Podemos te ajudar com a regularização?",
  dias_atraso_max: "30",
};
