import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { TrendingUp, DollarSign, ShoppingCart, Users } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { DateRangePicker } from "../components/DateRangePicker";
import { KPICard } from "../components/KPICard";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { useMetricasData } from "../hooks/useAdminData";

export function Metricas() {
  const [periodo, setPeriodo] = useState<DateRange | undefined>(undefined);
  const { data: metricas, isLoading, error } = useMetricasData(periodo);

  const totalReceita = metricas.vendasPorDia.reduce((acc, item) => acc + item.receita, 0);
  const totalVendas = metricas.vendasPorDia.reduce((acc, item) => acc + item.vendas, 0);
  const ticketMedio = totalVendas > 0 ? totalReceita / totalVendas : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{"M\u00e9tricas de Vendas"}</h2>
          <p className="mt-1 text-muted-foreground">{"An\u00e1lise de desempenho e resultados"}</p>
          {error && <p className="mt-2 text-sm text-red-600">{"Erro ao carregar m\u00e9tricas: "}{error}</p>}
        </div>
        <DateRangePicker value={periodo} onChange={setPeriodo} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Receita Total"
          value={`R$ ${totalReceita.toLocaleString("pt-BR")}`}
          icon={DollarSign}
          description={"Per\u00edodo selecionado"}
          color="bg-green-600"
        />
        <KPICard title="Total de Vendas" value={totalVendas} icon={ShoppingCart} description="Pedidos fechados" color="bg-primary" />
        <KPICard title={"Ticket M\u00e9dio"} value={`R$ ${ticketMedio.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`} icon={TrendingUp} description="Por venda" color="bg-blue-500" />
        <KPICard title="Novos Clientes" value={metricas.novosClientes} icon={Users} description="Clientes com pedido" color="bg-purple-500" />
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-muted-foreground shadow-md">
          {"Carregando m\u00e9tricas..."}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle>Vendas por Dia</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metricas.vendasPorDia}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="dia" />
                    <YAxis yAxisId="vendas" />
                    <Tooltip />
                    <Bar dataKey="vendas" fill="#10B981" radius={[8, 8, 0, 0]} name="Vendas" yAxisId="vendas" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="shadow-md">
              <CardHeader>
                <CardTitle>Receita por Dia (R$)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={metricas.vendasPorDia}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="dia" />
                    <YAxis yAxisId="receita" />
                    <Tooltip />
                    <Line type="monotone" dataKey="receita" stroke="#10B981" strokeWidth={3} name="Receita" yAxisId="receita" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Top 5 Produtos Mais Vendidos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                {metricas.topProdutos.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-center">Quantidade Vendida</TableHead>
                        <TableHead className="text-right">Receita Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {metricas.topProdutos.map((produto, index) => (
                        <TableRow key={produto.produto} className="hover:bg-gray-50">
                          <TableCell>
                            <div className={`flex h-8 w-8 items-center justify-center rounded-full font-bold text-white ${
                              index === 0 ? "bg-yellow-500" : index === 1 ? "bg-gray-400" : index === 2 ? "bg-orange-600" : "bg-gray-300"
                            }`}>
                              {index + 1}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{produto.produto}</TableCell>
                          <TableCell className="text-center">
                            <span className="rounded-full bg-primary/10 px-3 py-1 font-semibold text-primary">{produto.vendas}</span>
                          </TableCell>
                          <TableCell className="text-right font-bold text-primary">{produto.receita}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="py-4 text-sm text-muted-foreground">Nenhum produto vendido no período selecionado.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
