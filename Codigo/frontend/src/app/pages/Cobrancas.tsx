import { useEffect, useMemo, useState } from "react";
import { Save, Plus, CreditCard, Edit, Send } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "../components/StatusBadge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { useBillingRuleData, usePedidosData, useProdutosLookup } from "../hooks/useAdminData";
import { adminDataService } from "../services/adminDataService";
import type { BillingChargeKind, BillingRule, Pedido } from "../types/domain";

type ChargePreview = Pedido & {
  mensagem: string;
  tipoCobranca: BillingChargeKind;
};

type BillingAccordionSection = "antes" | "dia" | "depois";

const EMPTY_RULE: BillingRule = {
  ativa: true,
  limite_envio_por_dia: "",
  hora_envio: "",
  lembrete_antes_ativo: true,
  dias_antes_vencimento: "",
  template_antes_vencimento: "",
  vencimento_hoje_ativo: true,
  template_vencimento_hoje: "",
  apos_vencimento_ativo: true,
  dias_apos_vencimento: "",
  template_apos_vencimento: "",
  dias_atraso_max: "",
};

const CHARGE_KIND_LABEL: Record<BillingChargeKind, string> = {
  LEMBRETE: "Lembrete",
  VENCE_HOJE: "Vence hoje",
  EM_ATRASO: "Em atraso",
};

const formatChargeChannelLabel = (channel?: Pedido["cobrancaCanal"]) => {
  if (channel === "telegram") return "Telegram";
  return "Sem canal disponível";
};

const formatIsoDateToPtBr = (isoDate: string) => {
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) {
    return isoDate;
  }
  return `${day}/${month}/${year}`;
};

const parseInteger = (value: string) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const toDateOnlyIso = (value: Date) => value.toISOString().slice(0, 10);

const dateFromIso = (value: string) => new Date(`${value}T00:00:00.000Z`);

const diffInDays = (referenceDate: string, targetDate: string) =>
  Math.floor((dateFromIso(referenceDate).getTime() - dateFromIso(targetDate).getTime()) / 86400000);

const getTemplateForChargeKind = (rule: BillingRule, kind: BillingChargeKind) => {
  if (kind === "LEMBRETE") {
    return rule.template_antes_vencimento;
  }

  if (kind === "VENCE_HOJE") {
    return rule.template_vencimento_hoje;
  }

  return rule.template_apos_vencimento;
};

const renderChargeMessage = (template: string, pedido: Pedido) =>
  template
    .replace(/\{nome\}/g, pedido.cliente)
    .replace(/\{valor\}/g, pedido.valor_total)
    .replace(/\{data\}/g, formatIsoDateToPtBr(pedido.data_vencimento));

const resolveChargeKind = (pedido: Pedido, rule: BillingRule, referenceDate: string): BillingChargeKind | null => {
  if (!rule.ativa || pedido.status === "PAGO" || pedido.status === "CANCELADO") {
    return null;
  }

  const maxDelayDays = parseInteger(rule.dias_atraso_max);
  const daysAfterDue = diffInDays(referenceDate, pedido.data_vencimento);
  if (maxDelayDays !== null && maxDelayDays >= 0 && daysAfterDue > maxDelayDays) {
    return null;
  }

  const reminderDays = parseInteger(rule.dias_antes_vencimento);
  if (rule.lembrete_antes_ativo && reminderDays !== null && reminderDays >= 0 && diffInDays(pedido.data_vencimento, referenceDate) === reminderDays) {
    return "LEMBRETE";
  }

  if (rule.vencimento_hoje_ativo && referenceDate === pedido.data_vencimento) {
    return "VENCE_HOJE";
  }

  const overdueDays = parseInteger(rule.dias_apos_vencimento);
  if (rule.apos_vencimento_ativo && overdueDays !== null && overdueDays >= 0 && daysAfterDue >= overdueDays) {
    return "EM_ATRASO";
  }

  return null;
};

const buildPreviewForKind = (rule: BillingRule, kind: BillingChargeKind) => {
  const sampleOrder: Pedido = {
    id: 0,
    numero_pedido: "PED-0000",
    cliente: "Maria Silva",
    telefone_cliente: "(11) 99999-0000",
    valor_total: "R$ 249,90",
    forma_pagamento: "PIX",
    status: "PENDENTE",
    data_vencimento: kind === "EM_ATRASO" ? "2026-04-20" : "2026-04-26",
  };

  return renderChargeMessage(getTemplateForChargeKind(rule, kind), sampleOrder);
};

const getBillingSectionSummary = (rule: BillingRule, section: BillingAccordionSection) => {
  if (section === "antes") {
    const days = parseInteger(rule.dias_antes_vencimento) ?? 0;
    return `Enviado ${days} ${days === 1 ? "dia" : "dias"} antes`;
  }

  if (section === "dia") {
    return "No dia do vencimento";
  }

  const days = parseInteger(rule.dias_apos_vencimento) ?? 0;
  return `${days} ${days === 1 ? "dia" : "dias"} após atraso`;
};

function BillingConfigSection(props: {
  dayField?: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    hint?: string;
  };
  extraField?: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    hint?: string;
  };
  templateLabel: string;
  templateValue: string;
  onTemplateChange: (value: string) => void;
  preview: string;
  loading: boolean;
}) {
  const { dayField, extraField, templateLabel, templateValue, onTemplateChange, preview, loading } = props;

  return (
    <div className="space-y-4 px-1 pt-2">
        {dayField && (
          <div className="space-y-2">
            <Label>{dayField.label}</Label>
            <Input type="number" value={dayField.value} onChange={(event) => dayField.onChange(event.target.value)} disabled={loading} />
            {dayField.hint && <p className="text-xs text-muted-foreground">{dayField.hint}</p>}
          </div>
        )}

        {extraField && (
          <div className="space-y-2">
            <Label>{extraField.label}</Label>
            <Input type="number" value={extraField.value} onChange={(event) => extraField.onChange(event.target.value)} disabled={loading} />
            {extraField.hint && <p className="text-xs text-muted-foreground">{extraField.hint}</p>}
          </div>
        )}

        <div className="space-y-2">
          <Label>{templateLabel}</Label>
          <Textarea
            value={templateValue}
            onChange={(event) => onTemplateChange(event.target.value)}
            rows={4}
            placeholder="Use {nome}, {valor}, {data} como variáveis"
            disabled={loading}
          />
          <p className="text-xs text-muted-foreground">Variáveis disponíveis: {"{nome}, {valor}, {data}"}</p>
        </div>

        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Prévia</p>
          <p className="mt-2 text-sm leading-6 text-gray-700">{preview}</p>
        </div>
    </div>
  );
}

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
  const [sendChargeDialogOpen, setSendChargeDialogOpen] = useState(false);
  const [selectedCharge, setSelectedCharge] = useState<ChargePreview | null>(null);
  const [isSendingCharge, setIsSendingCharge] = useState(false);
  const [openBillingSection, setOpenBillingSection] = useState<BillingAccordionSection | undefined>(undefined);
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
      return [] as ChargePreview[];
    }

    const referenceDate = toDateOnlyIso(new Date());

    return pedidos
      .map((pedido) => {
        const tipoCobranca = resolveChargeKind(pedido, billingRule, referenceDate);
        if (!tipoCobranca) {
          return null;
        }

        return {
          ...pedido,
          tipoCobranca,
          mensagem: renderChargeMessage(getTemplateForChargeKind(billingRule, tipoCobranca), pedido),
        };
      })
      .filter((pedido): pedido is ChargePreview => pedido !== null);
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
      toast.success("Configuração de cobrança salva com sucesso");
      await reloadBillingRule();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao salvar configuração de cobrança";
      toast.error(message);
    }
  };

  const handleBillingSystemToggle = (checked: boolean) => {
    setRegraCobranca((current) => ({
      ...current,
      ativa: checked,
      lembrete_antes_ativo: checked ? current.lembrete_antes_ativo : false,
      vencimento_hoje_ativo: checked ? current.vencimento_hoje_ativo : false,
      apos_vencimento_ativo: checked ? current.apos_vencimento_ativo : false,
    }));

    if (!checked) {
      setOpenBillingSection(undefined);
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

  const handleOpenSendCharge = (charge: ChargePreview) => {
    setSelectedCharge(charge);
    setSendChargeDialogOpen(true);
  };

  const handleSendCharge = async () => {
    if (!selectedCharge) {
      return;
    }

    setIsSendingCharge(true);
    try {
      await adminDataService.sendBillingCharge(selectedCharge.id);
      await reloadPedidos();
      toast.success("Cobrança enviada com sucesso");
      setSendChargeDialogOpen(false);
      setSelectedCharge(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao enviar cobrança";
      toast.error(message);
    } finally {
      setIsSendingCharge(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Gestão de Cobranças</h2>
        <p className="mt-1 text-muted-foreground">Organize lembretes, avisos de vencimento e cobranças em atraso com mais clareza operacional.</p>
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
              <CardDescription>O fluxo agora está separado em três momentos: antes do vencimento, no dia e após o vencimento.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between rounded-2xl border border-green-200 bg-green-50 p-4">
                <div>
                  <h4 className="font-semibold text-gray-900">Sistema de cobrança</h4>
                  <p className="text-sm text-muted-foreground">
                    {regraCobranca.ativa ? "Envio automático ativado" : "Envio automático desativado"}
                  </p>
                </div>
                <Switch checked={regraCobranca.ativa} onCheckedChange={handleBillingSystemToggle} disabled={billingRuleLoading} />
              </div>

              <Accordion
                type="single"
                collapsible
                value={openBillingSection}
                onValueChange={(value) => {
                  if (value === "antes" || value === "dia" || value === "depois") {
                    setOpenBillingSection(value);
                    return;
                  }
                  setOpenBillingSection(undefined);
                }}
                className="rounded-2xl border border-gray-200 bg-white px-5"
              >
                <AccordionItem value="antes">
                  <AccordionTrigger className="py-5">
                    <div className="flex w-full items-start justify-between gap-4 pr-2">
                      <div className="space-y-1 text-left">
                        <div className="text-base font-semibold text-gray-900">Lembrete antes do vencimento</div>
                        <div className="text-sm text-muted-foreground">{getBillingSectionSummary(regraCobranca, "antes")}</div>
                      </div>
                      <div
                        onClick={(event) => {
                          event.stopPropagation();
                        }}
                      >
                        <Switch
                          checked={regraCobranca.lembrete_antes_ativo}
                          onCheckedChange={(value) => setRegraCobranca({ ...regraCobranca, lembrete_antes_ativo: value })}
                          disabled={billingRuleLoading || !regraCobranca.ativa}
                        />
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <BillingConfigSection
                      dayField={{
                        label: "Dias antes do vencimento",
                        value: regraCobranca.dias_antes_vencimento,
                        onChange: (value) => setRegraCobranca({ ...regraCobranca, dias_antes_vencimento: value }),
                        hint: "Exemplo: 2 envia exatamente dois dias antes.",
                      }}
                      templateLabel="Template do lembrete"
                      templateValue={regraCobranca.template_antes_vencimento}
                      onTemplateChange={(value) => setRegraCobranca({ ...regraCobranca, template_antes_vencimento: value })}
                      preview={buildPreviewForKind(regraCobranca, "LEMBRETE")}
                      loading={billingRuleLoading}
                    />
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="dia">
                  <AccordionTrigger className="py-5">
                    <div className="flex w-full items-start justify-between gap-4 pr-2">
                      <div className="space-y-1 text-left">
                        <div className="text-base font-semibold text-gray-900">Aviso no dia do vencimento</div>
                        <div className="text-sm text-muted-foreground">{getBillingSectionSummary(regraCobranca, "dia")}</div>
                      </div>
                      <div
                        onClick={(event) => {
                          event.stopPropagation();
                        }}
                      >
                        <Switch
                          checked={regraCobranca.vencimento_hoje_ativo}
                          onCheckedChange={(value) => setRegraCobranca({ ...regraCobranca, vencimento_hoje_ativo: value })}
                          disabled={billingRuleLoading || !regraCobranca.ativa}
                        />
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <BillingConfigSection
                      templateLabel="Template do aviso"
                      templateValue={regraCobranca.template_vencimento_hoje}
                      onTemplateChange={(value) => setRegraCobranca({ ...regraCobranca, template_vencimento_hoje: value })}
                      preview={buildPreviewForKind(regraCobranca, "VENCE_HOJE")}
                      loading={billingRuleLoading}
                    />
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="depois">
                  <AccordionTrigger className="py-5">
                    <div className="flex w-full items-start justify-between gap-4 pr-2">
                      <div className="space-y-1 text-left">
                        <div className="text-base font-semibold text-gray-900">Cobrança após vencimento</div>
                        <div className="text-sm text-muted-foreground">{getBillingSectionSummary(regraCobranca, "depois")}</div>
                      </div>
                      <div
                        onClick={(event) => {
                          event.stopPropagation();
                        }}
                      >
                        <Switch
                          checked={regraCobranca.apos_vencimento_ativo}
                          onCheckedChange={(value) => setRegraCobranca({ ...regraCobranca, apos_vencimento_ativo: value })}
                          disabled={billingRuleLoading || !regraCobranca.ativa}
                        />
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <BillingConfigSection
                      dayField={{
                        label: "Iniciar cobrança após X dias de atraso",
                        value: regraCobranca.dias_apos_vencimento,
                        onChange: (value) => setRegraCobranca({ ...regraCobranca, dias_apos_vencimento: value }),
                        hint: "Exemplo: 1 envia a partir do primeiro dia de atraso.",
                      }}
                      extraField={{
                        label: "Não enviar após X dias de atraso",
                        value: regraCobranca.dias_atraso_max,
                        onChange: (value) => setRegraCobranca({ ...regraCobranca, dias_atraso_max: value }),
                        hint: "Define a janela máxima para continuar enviando cobranças em atraso.",
                      }}
                      templateLabel="Template da cobrança"
                      templateValue={regraCobranca.template_apos_vencimento}
                      onTemplateChange={(value) => setRegraCobranca({ ...regraCobranca, template_apos_vencimento: value })}
                      preview={buildPreviewForKind(regraCobranca, "EM_ATRASO")}
                      loading={billingRuleLoading}
                    />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <div className="grid grid-cols-1 gap-4 rounded-2xl border border-gray-200 bg-gray-50 p-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="limite_envio_por_dia">Limite de envios por dia</Label>
                  <Input
                    id="limite_envio_por_dia"
                    type="number"
                    value={regraCobranca.limite_envio_por_dia}
                    onChange={(event) => setRegraCobranca({ ...regraCobranca, limite_envio_por_dia: event.target.value })}
                    disabled={billingRuleLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="hora_envio">Horário de envio</Label>
                  <Input
                    id="hora_envio"
                    type="time"
                    value={regraCobranca.hora_envio}
                    onChange={(event) => setRegraCobranca({ ...regraCobranca, hora_envio: event.target.value })}
                    disabled={billingRuleLoading}
                  />
                </div>

              </div>

              <div className="flex justify-end border-t pt-4">
                <Button onClick={() => void handleSaveRegra()} disabled={billingRuleLoading}>
                  <Save className="mr-2 h-4 w-4" />
                  {billingRuleLoading ? "Carregando..." : "Salvar configurações"}
                </Button>
              </div>

              <div className="space-y-4 border-t pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-gray-900">Cobranças previstas</h4>
                    <p className="text-sm text-muted-foreground">A tabela agora indica exatamente em qual etapa cada cobrança será disparada.</p>
                  </div>
                  <span className="text-sm text-muted-foreground">Total: {cobrancasPrevistas.length}</span>
                </div>

                {cobrancasPrevistas.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-muted-foreground">
                    Nenhuma cobrança prevista para hoje com a configuração atual.
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-lg border border-gray-200">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50">
                            <TableHead>Tipo</TableHead>
                            <TableHead>Canal</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Vencimento</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Último envio</TableHead>
                            <TableHead>Mensagem prevista</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {cobrancasPrevistas.map((cobranca) => (
                            <TableRow key={cobranca.id}>
                              <TableCell>
                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                                  {CHARGE_KIND_LABEL[cobranca.tipoCobranca]}
                                </span>
                              </TableCell>
                              <TableCell className="text-sm">
                                <div
                                  className="text-gray-900"
                                  title={cobranca.cobrancaCanalDisponivel ? undefined : cobranca.cobrancaMotivoIndisponivel ?? "Sem canal disponível"}
                                >
                                  {formatChargeChannelLabel(cobranca.cobrancaCanal)}
                                </div>
                                <div className="text-muted-foreground">{cobranca.contatoExibicao || "Sem contato"}</div>
                              </TableCell>
                              <TableCell className="font-medium">{cobranca.cliente}</TableCell>
                              <TableCell>{formatIsoDateToPtBr(cobranca.data_vencimento)}</TableCell>
                              <TableCell>
                                <StatusBadge status={cobranca.status} />
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {cobranca.cobrancaStatus === "ENVIADO" && cobranca.cobrancaDataEnvio
                                  ? `${cobranca.cobrancaTipoEnvio ?? "MANUAL"} • ${new Date(cobranca.cobrancaDataEnvio).toLocaleString("pt-BR")}`
                                  : "Ainda não enviada"}
                              </TableCell>
                              <TableCell className="max-w-[520px] truncate text-sm text-muted-foreground">{cobranca.mensagem}</TableCell>
                              <TableCell className="text-right">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOpenSendCharge(cobranca)}
                                  disabled={!cobranca.cobrancaCanalDisponivel || isSendingCharge}
                                  title={cobranca.cobrancaCanalDisponivel ? "Enviar cobrança agora" : cobranca.cobrancaMotivoIndisponivel ?? "Sem canal disponível"}
                                >
                                  <Send className="mr-2 h-4 w-4" />
                                  Enviar agora
                                </Button>
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
            <DialogDescription>{editingPedidoId ? "Atualize os dados do pedido" : "Cadastre um novo pedido de venda"}</DialogDescription>
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
              <Input id="cliente" placeholder="Ex: Maria Silva" value={novoPedido.cliente} onChange={(e) => setNovoPedido({ ...novoPedido, cliente: e.target.value })} />
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
              <Select value={novoPedido.forma_pagamento} onValueChange={(value) => setNovoPedido({ ...novoPedido, forma_pagamento: value })}>
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
              <Select value={novoPedido.status} onValueChange={(value) => setNovoPedido({ ...novoPedido, status: value })}>
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
              <Input id="data_vencimento" type="date" value={novoPedido.data_vencimento} onChange={(e) => setNovoPedido({ ...novoPedido, data_vencimento: e.target.value })} />
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

      <Dialog open={sendChargeDialogOpen} onOpenChange={setSendChargeDialogOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Enviar cobrança manual</DialogTitle>
            <DialogDescription>Confirme os dados abaixo antes de disparar a cobrança pelo canal disponível do cliente.</DialogDescription>
          </DialogHeader>

          {selectedCharge && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-1 gap-4 rounded-lg border bg-gray-50 p-4 md:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Tipo</p>
                  <p className="text-sm font-medium text-gray-900">{CHARGE_KIND_LABEL[selectedCharge.tipoCobranca]}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Canal / contato</p>
                  <p className="text-sm font-medium text-gray-900">
                    {formatChargeChannelLabel(selectedCharge.cobrancaCanal)} • {selectedCharge.contatoExibicao || "Sem canal disponível"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Cliente</p>
                  <p className="text-sm font-medium text-gray-900">{selectedCharge.cliente}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Valor</p>
                  <p className="text-sm font-medium text-gray-900">{selectedCharge.valor_total}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Vencimento</p>
                  <p className="text-sm font-medium text-gray-900">{formatIsoDateToPtBr(selectedCharge.data_vencimento)}</p>
                </div>
              </div>

              {!selectedCharge.cobrancaCanalDisponivel && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  {selectedCharge.cobrancaMotivoIndisponivel ?? "Não há telefone/canal válido para envio."}
                </div>
              )}

              <div className="space-y-2">
                <Label>Prévia da mensagem</Label>
                <div className="rounded-lg border bg-white p-4 text-sm leading-6 text-gray-700">{selectedCharge.mensagem}</div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSendChargeDialogOpen(false);
                setSelectedCharge(null);
              }}
              disabled={isSendingCharge}
            >
              Cancelar
            </Button>
            <Button onClick={() => void handleSendCharge()} disabled={!selectedCharge?.cobrancaCanalDisponivel || isSendingCharge}>
              <Send className="mr-2 h-4 w-4" />
              {isSendingCharge ? "Enviando..." : "Enviar cobrança"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
