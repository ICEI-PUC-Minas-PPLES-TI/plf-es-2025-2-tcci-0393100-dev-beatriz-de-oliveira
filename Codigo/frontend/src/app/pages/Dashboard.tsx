import { useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import { Users, ShoppingCart, TrendingUp, MessageSquare, Package, DollarSign } from "lucide-react";
import { KPICard } from "../components/KPICard";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { DateRangePicker } from "../components/DateRangePicker";
import { ImageWithFallback } from "../components/ImageWithFallback";
import { useDashboardSummaryData, useLeadsData, useMetricasData } from "../hooks/useAdminData";
import { authService } from "../services/authService";
import { isInDateRange } from "../utils/dateRange";

function formatRecentTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function Dashboard() {
  const currentUser = authService.getCurrentUser();
  const canViewSensitiveMetrics = currentUser?.role !== "VENDEDOR";
  const [periodo, setPeriodo] = useState<DateRange | undefined>(undefined);
  const { data: dashboardSummary, error: dashboardError } = useDashboardSummaryData(periodo);
  const { data: leads } = useLeadsData();
  const { data: metricas } = useMetricasData(periodo, canViewSensitiveMetrics);

  const leadsNoPeriodo = useMemo(
    () => leads.filter((lead) => isInDateRange(new Date(lead.data_criacao), periodo)),
    [leads, periodo],
  );

  const receitaTotal = metricas.vendasPorDia.reduce((acc, item) => acc + item.receita, 0);
  const totalVendas = metricas.vendasPorDia.reduce((acc, item) => acc + item.vendas, 0);
  const ticketMedio = totalVendas > 0 ? receitaTotal / totalVendas : 0;

  const kpis: Array<{ title: string; value: string | number; icon: typeof Users; description: string; color: string }> = [
    {
      title: "Leads Novos",
      value: leadsNoPeriodo.filter((lead) => lead.status === "NOVO").length,
      icon: Users,
      description: "No período",
      color: "bg-blue-500",
    },
    {
      title: "Em Contato",
      value: leadsNoPeriodo.filter((lead) => lead.status === "EM_CONTATO").length,
      icon: MessageSquare,
      description: "No período",
      color: "bg-yellow-500",
    },
    {
      title: "Convertidos",
      value: leadsNoPeriodo.filter((lead) => lead.status === "CONVERTIDO").length,
      icon: TrendingUp,
      description: "No período",
      color: "bg-primary",
    },
    {
      title: "Pedidos Pendentes",
      value: dashboardSummary.pedidosPendentes,
      icon: ShoppingCart,
      description: "No período",
      color: "bg-orange-500",
    },
    {
      title: "Atendimentos Ativos",
      value: dashboardSummary.atendimentosAtivos,
      icon: MessageSquare,
      description: "No período",
      color: "bg-purple-500",
    },
    {
      title: "Produtos em Estoque",
      value: dashboardSummary.produtosDisponiveis,
      icon: Package,
      description: "Estoque atual",
      color: "bg-indigo-500",
    },
  ];

  if (canViewSensitiveMetrics) {
    kpis.push(
      {
        title: "Receita do Período",
        value: `R$ ${receitaTotal.toLocaleString("pt-BR")}`,
        icon: DollarSign,
        description: "Com base nas métricas",
        color: "bg-green-600",
      },
      {
        title: "Ticket Médio",
        value: `R$ ${ticketMedio.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`,
        icon: DollarSign,
        description: "Por venda",
        color: "bg-cyan-500",
      },
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-gradient-to-r from-primary to-green-600 p-6 text-white shadow-lg">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="mb-2 text-2xl font-bold">Bem-vindo à Eletro Rádio Esperança!</h1>
            <p className="text-green-50">
              Hoje é {new Date().toLocaleDateString("pt-BR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
            {dashboardError && <p className="mt-2 text-sm text-green-100">Erro ao carregar resumo do dashboard: {dashboardError}</p>}
          </div>
          <div className="flex gap-3">
            {canViewSensitiveMetrics ? (
              <>
                <div className="rounded-lg bg-white/20 px-4 py-2 backdrop-blur-sm">
                  <p className="text-xs text-green-100">Receita no Período</p>
                  <p className="text-lg font-bold">R$ {receitaTotal.toLocaleString("pt-BR")}</p>
                </div>
                <div className="rounded-lg bg-white/20 px-4 py-2 backdrop-blur-sm">
                  <p className="text-xs text-green-100">Pedidos no Período</p>
                  <p className="text-lg font-bold">{dashboardSummary.pedidosMes}</p>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-lg bg-white/20 px-4 py-2 backdrop-blur-sm">
                  <p className="text-xs text-green-100">Pedidos no Período</p>
                  <p className="text-lg font-bold">{dashboardSummary.pedidosMes}</p>
                </div>
                <div className="rounded-lg bg-white/20 px-4 py-2 backdrop-blur-sm">
                  <p className="text-xs text-green-100">Atendimentos Ativos</p>
                  <p className="text-lg font-bold">{dashboardSummary.atendimentosAtivos}</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Visão Geral da Loja</h2>
          <p className="mt-1 text-muted-foreground">Acompanhe suas vendas e atendimentos em tempo real</p>
        </div>
        <DateRangePicker value={periodo} onChange={setPeriodo} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <KPICard key={kpi.title} title={kpi.title} value={kpi.value} icon={kpi.icon} description={kpi.description} color={kpi.color} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Package className="mr-2 h-5 w-5 text-primary" />
              Top Produtos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {dashboardSummary.topProdutos.map((produto, index) => (
              <div key={produto.id} className="flex items-center gap-4 rounded-lg border border-transparent p-3 transition-colors hover:border-primary/20 hover:bg-gray-50">
                <div className="relative">
                  <ImageWithFallback src={produto.imagem} alt={produto.nome} className="h-20 w-20 rounded-lg object-cover shadow-sm" />
                  {index === 0 && produto.vendas > 0 && (
                    <span className="absolute -top-2 -right-2 rounded-full bg-red-500 px-2 py-1 text-xs font-semibold text-white shadow-md">
                      HOT
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">{produto.nome}</h4>
                  <p className="mt-0.5 text-sm text-muted-foreground">{produto.vendas} vendas</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-primary">{produto.preco}</p>
                </div>
              </div>
            ))}
            {dashboardSummary.topProdutos.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum produto vendido no período selecionado.</p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center">
              <MessageSquare className="mr-2 h-5 w-5 text-primary" />
              Atendimentos Recentes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {dashboardSummary.atendimentosRecentes.map((atendimento) => (
              <div key={atendimento.id} className="rounded-lg border border-gray-200 p-4 transition-colors hover:border-primary">
                <div className="mb-2 flex items-start justify-between">
                  <h4 className="font-semibold text-gray-900">{atendimento.cliente}</h4>
                  <span className="text-xs text-muted-foreground">{formatRecentTime(atendimento.hora)}</span>
                </div>
                <p className="text-sm text-gray-600">{atendimento.mensagem}</p>
              </div>
            ))}
            {dashboardSummary.atendimentosRecentes.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum atendimento recente encontrado.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

