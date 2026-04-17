import { useEffect, useMemo, useState } from "react";
import { Save, Plus, CreditCard, Edit } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "../components/StatusBadge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { useBillingRuleData, usePedidosData, useProdutosLookup } from "../hooks/useAdminData";
import { adminDataService } from "../services/adminDataService";
import type { BillingRule, Pedido } from "../types/domain";

const EMPTY_RULE: BillingRule = {
  ativa: true,
  mensagem_template: "",
  limite_envio_por_dia: "",
  hora_envio: "",
  dias_atraso_min: "",
  dias_atraso_max: "",
};

const formatIsoDateToPtBr = (isoDate: string) => {
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) {
    return isoDate;
  }
  return `${day}/${month}/${year}`;
};

export function Cobrancas() {
  const {
    data: billingRule,
    isLoading: billingRuleLoading,
    error: billingRuleError,
    reload: reloadBillingRule,
  } = useBillingRuleData();
  const { data: pedidos, reload: reloadPedidos } = usePedidosData();
  const [regraCobranca, setRegraCobranca] = useState<BillingRule>(EMPTY_RULE);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [produtoSearch, setProdutoSearch] = useState("");
  const { data: produtos } = useProdutosLookup(produtoSearch, dialogOpen);
  const [editingPedidoId, setEditingPedidoId] = useState<number | null>(null);
  const [novoPedido, setNovoPedido] = useState({
    produto_nome: "",
    cliente: "",
    telefone_cliente: "",
    valor_total: "",
    forma_pagamento: "",
    status: "PENDENTE",
    data_vencimento: "",
  });

  useEffect(() => {
    setRegraCobranca(billingRule);
  }, [billingRule]);

  const cobrancasPrevistas = useMemo(() => {
    if (!billingRule.ativa) {
      return [];
    }

    const template = billingRule.mensagem_template.trim();
    const limite = Number.parseInt(billingRule.limite_envio_por_dia, 10);
    const limiteNormalizado = Number.isFinite(limite) && limite > 0 ? limite : Number.POSITIVE_INFINITY;

    const renderMessage = (pedido: Pedido) =>
      (template || "Olá {nome}, seu pedido no valor de {valor} vence em {data}.")
        .replace(/\{nome\}/g, pedido.cliente)
        .replace(/\{valor\}/g, pedido.valor_total)
        .replace(/\{data\}/g, formatIsoDateToPtBr(pedido.data_vencimento));

    const pendentesParaCobranca = pedidos.filter((pedido) => pedido.status === "PENDENTE" || pedido.status === "ATRASADO");
    return pendentesParaCobranca.slice(0, limiteNormalizado).map((pedido) => ({
      ...pedido,
      mensagem: renderMessage(pedido),
    }));
  }, [billingRule, pedidos]);

  const resetPedidoForm = () => {
    setProdutoSearch("");
    setNovoPedido({
      produto_nome: "",
      cliente: "",
      telefone_cliente: "",
      valor_total: "",
      forma_pagamento: "",
      status: "PENDENTE",
      data_vencimento: "",
    });
    setEditingPedidoId(null);
  };

  const handleSaveRegra = async () => {
    try {
      await adminDataService.saveBillingRule(regraCobranca);
      toast.success("Regra de cobrança salva com sucesso");
      await reloadBillingRule();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao salvar regra de cobrança";
      toast.error(message);
    }
  };

  const handleOpenCreatePedido = () => {
    resetPedidoForm();
    setDialogOpen(true);
  };

  const handleOpenEditPedido = (pedido: Pedido) => {
    setEditingPedidoId(pedido.id);
    setNovoPedido({
      produto_nome: pedido.numero_pedido,
      cliente: pedido.cliente,
      telefone_cliente: pedido.telefone_cliente,
      valor_total: pedido.valor_total,
      forma_pagamento: pedido.forma_pagamento,
      status: pedido.status,
      data_vencimento: pedido.data_vencimento,
    });
    setProdutoSearch(pedido.numero_pedido);
    setDialogOpen(true);
  };

  const handleProdutoChange = (produtoNome: string) => {
    const produtoSelecionado = produtos.find((produto) => produto.nome === produtoNome);
    setNovoPedido((current) => ({
      ...current,
      produto_nome: produtoNome,
      valor_total: produtoSelecionado?.preco ?? current.valor_total,
    }));
    setProdutoSearch(produtoNome);
  };

  const handleSavePedido = async () => {
    if (!novoPedido.produto_nome || !novoPedido.cliente || !novoPedido.telefone_cliente || !novoPedido.valor_total || !novoPedido.forma_pagamento || !novoPedido.data_vencimento) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    try {
      if (editingPedidoId !== null) {
        await adminDataService.updatePedido(editingPedidoId, {
          numero_pedido: novoPedido.produto_nome,
          cliente: novoPedido.cliente,
          telefone_cliente: novoPedido.telefone_cliente,
          valor_total: novoPedido.valor_total,
          forma_pagamento: novoPedido.forma_pagamento,
          status: novoPedido.status as Pedido["status"],
          data_vencimento: novoPedido.data_vencimento,
        });
        toast.success("Pedido atualizado com sucesso");
      } else {
        await adminDataService.createPedido({
          numero_pedido: novoPedido.produto_nome,
          cliente: novoPedido.cliente,
          telefone_cliente: novoPedido.telefone_cliente,
          valor_total: novoPedido.valor_total,
          forma_pagamento: novoPedido.forma_pagamento,
          status: novoPedido.status as Pedido["status"],
          data_vencimento: novoPedido.data_vencimento,
        });
        toast.success("Pedido criado com sucesso");
      }
      await reloadPedidos();
      resetPedidoForm();
      setDialogOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao salvar pedido";
      toast.error(message);
    }
  };

  const handleQuickStatusChange = async (pedidoId: number, status: Pedido["status"]) => {
    try {
      await adminDataService.updatePedido(pedidoId, { status });
      await reloadPedidos();
      toast.success("Status do pedido atualizado");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao atualizar pedido";
      toast.error(message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Gestão de Cobranças</h2>
        <p className="mt-1 text-muted-foreground">Configure regras e gerencie pedidos de pagamento</p>
        {billingRuleError && <p className="mt-2 text-sm text-red-600">Erro ao carregar regra: {billingRuleError}</p>}
      </div>

      <Tabs defaultValue="regras" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="regras">Regras de Cobrança</TabsTrigger>
          <TabsTrigger value="pedidos">Pedidos</TabsTrigger>
        </TabsList>

        <TabsContent value="regras" className="space-y-6">
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center">
                <CreditCard className="mr-2 h-5 w-5 text-primary" />
                Configuração de Cobrança Automática
              </CardTitle>
              <CardDescription>Configure como e quando as mensagens de cobrança serão enviadas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-4">
                <div>
                  <h4 className="font-semibold text-gray-900">Sistema de Cobrança</h4>
                  <p className="text-sm text-muted-foreground">
                    {regraCobranca.ativa ? "Envio automático ativado" : "Envio automático desativado"}
                  </p>
                </div>
                <Switch
                  checked={regraCobranca.ativa}
                  onCheckedChange={(checked) => setRegraCobranca({ ...regraCobranca, ativa: checked })}
                  disabled={billingRuleLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mensagem_template">Mensagem Template *</Label>
                <Textarea
                  id="mensagem_template"
                  value={regraCobranca.mensagem_template}
                  onChange={(e) => setRegraCobranca({ ...regraCobranca, mensagem_template: e.target.value })}
                  rows={4}
                  placeholder="Use {nome}, {valor}, {data} como variáveis"
                  disabled={billingRuleLoading}
                />
                <p className="text-xs text-muted-foreground">Variáveis disponíveis: {"{nome}, {valor}, {data}"}</p>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="limite_envio_por_dia">Limite de Envios por Dia</Label>
                  <Input
                    id="limite_envio_por_dia"
                    type="number"
                    value={regraCobranca.limite_envio_por_dia}
                    onChange={(e) => setRegraCobranca({ ...regraCobranca, limite_envio_por_dia: e.target.value })}
                    disabled={billingRuleLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="hora_envio">Horário de Envio</Label>
                  <Input
                    id="hora_envio"
                    type="time"
                    value={regraCobranca.hora_envio}
                    onChange={(e) => setRegraCobranca({ ...regraCobranca, hora_envio: e.target.value })}
                    disabled={billingRuleLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dias_atraso_min">Dias de Atraso Mínimo</Label>
                  <Input
                    id="dias_atraso_min"
                    type="number"
                    value={regraCobranca.dias_atraso_min}
                    onChange={(e) => setRegraCobranca({ ...regraCobranca, dias_atraso_min: e.target.value })}
                    disabled={billingRuleLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dias_atraso_max">Dias de Atraso Máximo</Label>
                  <Input
                    id="dias_atraso_max"
                    type="number"
                    value={regraCobranca.dias_atraso_max}
                    onChange={(e) => setRegraCobranca({ ...regraCobranca, dias_atraso_max: e.target.value })}
                    disabled={billingRuleLoading}
                  />
                </div>
              </div>

              <div className="flex justify-end border-t pt-4">
                <Button onClick={() => void handleSaveRegra()} disabled={billingRuleLoading}>
                  <Save className="mr-2 h-4 w-4" />
                  {billingRuleLoading ? "Carregando..." : "Salvar Configurações"}
                </Button>
              </div>

              <div className="space-y-4 border-t pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-gray-900">Cobranças Previstas</h4>
                    <p className="text-sm text-muted-foreground">
                      Mensagens que serão enviadas com base na última configuração salva.
                    </p>
                  </div>
                  <span className="text-sm text-muted-foreground">Total: {cobrancasPrevistas.length}</span>
                </div>

                {cobrancasPrevistas.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-muted-foreground">
                    Nenhuma cobrança prevista no momento.
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-lg border border-gray-200">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50">
                            <TableHead>Telefone</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Vencimento</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Mensagem</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {cobrancasPrevistas.map((cobranca) => (
                            <TableRow key={cobranca.id}>
                              <TableCell>{cobranca.telefone_cliente}</TableCell>
                              <TableCell className="font-medium">{cobranca.cliente}</TableCell>
                              <TableCell>{formatIsoDateToPtBr(cobranca.data_vencimento)}</TableCell>
                              <TableCell>
                                <StatusBadge status={cobranca.status} />
                              </TableCell>
                              <TableCell className="max-w-[520px] truncate text-sm text-muted-foreground">
                                {cobranca.mensagem}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pedidos" className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Total de {pedidos.length} pedidos</p>
            <Button onClick={handleOpenCreatePedido}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Pedido
            </Button>
          </div>

          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-md">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Produto</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Forma Pagamento</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pedidos.map((pedido) => (
                    <TableRow key={pedido.id} className="hover:bg-gray-50">
                      <TableCell className="font-medium">{pedido.numero_pedido}</TableCell>
                      <TableCell className="font-medium">{pedido.cliente}</TableCell>
                      <TableCell>{pedido.telefone_cliente}</TableCell>
                      <TableCell className="font-semibold text-primary">{pedido.valor_total}</TableCell>
                      <TableCell>
                        <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700">{pedido.forma_pagamento}</span>
                      </TableCell>
                      <TableCell className="text-sm">{formatIsoDateToPtBr(pedido.data_vencimento)}</TableCell>
                      <TableCell>
                        <StatusBadge status={pedido.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleOpenEditPedido(pedido)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Select
                            value={pedido.status}
                            onValueChange={(value) => {
                              void handleQuickStatusChange(pedido.id, value as Pedido["status"]);
                            }}
                          >
                            <SelectTrigger className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="PENDENTE">Pendente</SelectItem>
                              <SelectItem value="PAGO">Pago</SelectItem>
                              <SelectItem value="ATRASADO">Atrasado</SelectItem>
                              <SelectItem value="CANCELADO">Cancelado</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingPedidoId ? "Editar Pedido" : "Criar Novo Pedido"}</DialogTitle>
            <DialogDescription>
              {editingPedidoId ? "Atualize os dados do pedido" : "Cadastre um novo pedido de venda"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="produto_search">Produto *</Label>
              <Input
                id="produto_search"
                list="cobrancas-produtos-sugestoes"
                value={produtoSearch}
                onChange={(event) => handleProdutoChange(event.target.value)}
                placeholder="Digite para buscar e selecione um produto"
              />
              <datalist id="cobrancas-produtos-sugestoes">
                {produtos.map((produto) => (
                  <option key={produto.id} value={produto.nome} />
                ))}
              </datalist>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cliente">Nome do Cliente *</Label>
              <Input
                id="cliente"
                placeholder="Ex: Maria Silva"
                value={novoPedido.cliente}
                onChange={(e) => setNovoPedido({ ...novoPedido, cliente: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefone_cliente">Telefone do Cliente *</Label>
              <Input
                id="telefone_cliente"
                placeholder="(11) 98765-4321"
                value={novoPedido.telefone_cliente}
                onChange={(e) => setNovoPedido({ ...novoPedido, telefone_cliente: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="valor_total">Valor Total (R$) *</Label>
              <Input
                id="valor_total"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={novoPedido.valor_total}
                onChange={(e) => setNovoPedido({ ...novoPedido, valor_total: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="forma_pagamento">Forma de Pagamento *</Label>
              <Select
                value={novoPedido.forma_pagamento}
                onValueChange={(value) => setNovoPedido({ ...novoPedido, forma_pagamento: value })}
              >
                <SelectTrigger id="forma_pagamento">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PIX">PIX</SelectItem>
                  <SelectItem value="Boleto">Boleto</SelectItem>
                  <SelectItem value="Cartao">Cartão de Crédito</SelectItem>
                  <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status *</Label>
              <Select
                value={novoPedido.status}
                onValueChange={(value) => setNovoPedido({ ...novoPedido, status: value })}
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDENTE">Pendente</SelectItem>
                  <SelectItem value="PAGO">Pago</SelectItem>
                  <SelectItem value="ATRASADO">Atrasado</SelectItem>
                  <SelectItem value="CANCELADO">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="data_vencimento">Data de Vencimento *</Label>
              <Input
                id="data_vencimento"
                type="date"
                value={novoPedido.data_vencimento}
                onChange={(e) => setNovoPedido({ ...novoPedido, data_vencimento: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                resetPedidoForm();
                setDialogOpen(false);
              }}
            >
              Cancelar
            </Button>
            <Button onClick={() => void handleSavePedido()}>{editingPedidoId ? "Salvar Alterações" : "Criar Pedido"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

