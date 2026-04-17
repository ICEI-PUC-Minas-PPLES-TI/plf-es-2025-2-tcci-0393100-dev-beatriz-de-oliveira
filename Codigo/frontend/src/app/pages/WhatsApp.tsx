import { useEffect, useMemo, useState } from "react";
import { Search, Send, Phone, X, CheckCircle2, Bot, UserRound, Headphones } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Card } from "../components/ui/card";
import { StatusBadge } from "../components/StatusBadge";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { ScrollArea } from "../components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../components/ui/dialog";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { useAtendimentosData, useMensagensData, useProdutosLookup } from "../hooks/useAdminData";
import { adminDataService } from "../services/adminDataService";
import type { Mensagem } from "../types/domain";
import { HttpError } from "../api/httpClient";

function formatTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeSender(mensagem: Mensagem): "cliente" | "chatbot" | "humano" {
  const remetente = (mensagem.remetente ?? "").toUpperCase();
  if (remetente === "CLIENTE") return "cliente";
  if (remetente === "ATENDENTE") return "humano";
  if (remetente === "CHATBOT") return "chatbot";
  return mensagem.tipo === "recebida" ? "cliente" : "chatbot";
}

function getMessageBubbleClasses(sender: ReturnType<typeof normalizeSender>) {
  if (sender === "cliente") {
    return {
      wrapper: "justify-start",
      bubble: "bg-gray-100 text-gray-900",
      meta: "text-gray-500",
      label: "Cliente",
      icon: UserRound,
    };
  }

  if (sender === "humano") {
    return {
      wrapper: "justify-end",
      bubble: "bg-blue-600 text-white",
      meta: "text-blue-100",
      label: "Atendente",
      icon: Headphones,
    };
  }

  return {
    wrapper: "justify-end",
    bubble: "bg-primary text-white",
    meta: "text-green-100",
    label: "Assistente virtual",
    icon: Bot,
  };
}

export function WhatsApp() {
  const { data: atendimentos, reload: reloadAtendimentos, isLoading: atendimentosLoading, error: atendimentosError } = useAtendimentosData();
  const [selectedAtendimentoId, setSelectedAtendimentoId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [novaMensagem, setNovaMensagem] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isUpdatingConversation, setIsUpdatingConversation] = useState(false);
  const [isFinalizarModalOpen, setIsFinalizarModalOpen] = useState(false);
  const [produtoSearch, setProdutoSearch] = useState("");
  const { data: produtos } = useProdutosLookup(produtoSearch, isFinalizarModalOpen);
  const [pedidoData, setPedidoData] = useState({
    produto_id: "",
    valor_total: "",
    forma_pagamento: "",
    observacoes: "",
  });

  const filteredAtendimentos = useMemo(
    () =>
      atendimentos.filter((atendimento) => {
        const matchesSearch =
          atendimento.cliente.toLowerCase().includes(searchTerm.toLowerCase()) || atendimento.telefone.includes(searchTerm);
        const matchesStatus = statusFilter === "todos" || atendimento.status === statusFilter;
        return matchesSearch && matchesStatus;
      }),
    [atendimentos, searchTerm, statusFilter],
  );

  useEffect(() => {
    if (selectedAtendimentoId !== null && atendimentos.some((atendimento) => atendimento.id === selectedAtendimentoId)) {
      return;
    }

    const nextSelected = filteredAtendimentos[0]?.id ?? atendimentos[0]?.id ?? null;
    setSelectedAtendimentoId(nextSelected);
  }, [atendimentos, filteredAtendimentos, selectedAtendimentoId]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void reloadAtendimentos({ silent: true });
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [reloadAtendimentos]);

  const selectedAtendimento = atendimentos.find((atendimento) => atendimento.id === selectedAtendimentoId) ?? null;
  const {
    data: mensagens,
    reload: reloadMensagens,
    isLoading: mensagensLoading,
    error: mensagensError,
  } = useMensagensData(selectedAtendimento?.id ?? null);

  const canSendManualMessage = selectedAtendimento !== null && selectedAtendimento.status !== "ENCERRADO";

  useEffect(() => {
    if (!selectedAtendimento?.id) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void reloadMensagens({ silent: true });
      void reloadAtendimentos({ silent: true });
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [selectedAtendimento?.id, reloadAtendimentos, reloadMensagens]);

  const handleEnviarMensagem = async () => {
    if (!selectedAtendimento || !novaMensagem.trim()) return;

    setIsSendingMessage(true);
    try {
      await adminDataService.sendWhatsAppMessage({ atendimentoId: selectedAtendimento.id, texto: novaMensagem.trim() });
      setNovaMensagem("");
      await Promise.all([reloadMensagens(), reloadAtendimentos()]);
      toast.success("Mensagem enviada");
    } catch (error) {
      if (error instanceof HttpError && error.payload?.code === "WHATSAPP_OUTBOUND_NOT_CONFIGURED") {
        toast.error("O envio manual ainda não está configurado neste ambiente.");
      } else {
        const message = error instanceof Error ? error.message : "Falha ao enviar mensagem";
        toast.error(message);
      }
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleAtualizarStatus = async (status: "ATIVO" | "PENDENTE" | "ENCERRADO") => {
    if (!selectedAtendimento) return;

    setIsUpdatingConversation(true);
    try {
      const updated = await adminDataService.updateAtendimentoStatus(selectedAtendimento.id, status);
      await reloadAtendimentos();
      if (updated.id === selectedAtendimento.id) {
        setSelectedAtendimentoId(updated.id);
      }
      toast.success(status === "ENCERRADO" ? "Atendimento encerrado" : "Status do atendimento atualizado");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao atualizar atendimento";
      toast.error(message);
    } finally {
      setIsUpdatingConversation(false);
    }
  };

  const handleAbrirFinalizarPedido = () => {
    setProdutoSearch("");
    setIsFinalizarModalOpen(true);
  };

  const handleFinalizarPedido = async () => {
    if (!pedidoData.produto_id || !pedidoData.valor_total || !pedidoData.forma_pagamento) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    const formaPagamentoLabelMap: Record<string, string> = {
      PIX: "PIX",
      CARTAO_CREDITO: "Cartão de Crédito",
      CARTAO_DEBITO: "Cartão de Débito",
      BOLETO: "Boleto",
      DINHEIRO: "Dinheiro",
    };

    const produtoSelecionado = produtos.find((produto) => produto.id === Number(pedidoData.produto_id));

    try {
      await adminDataService.createPedido({
        numero_pedido: `WPP-${Date.now()}`,
        cliente: selectedAtendimento?.cliente ?? "Cliente",
        telefone_cliente: selectedAtendimento?.telefone ?? "",
        valor_total: pedidoData.valor_total,
        forma_pagamento: formaPagamentoLabelMap[pedidoData.forma_pagamento] ?? pedidoData.forma_pagamento,
        status: "PENDENTE",
        data_vencimento: new Date().toISOString().slice(0, 10),
      });

      toast.success(`Pedido de ${produtoSelecionado?.nome ?? "produto"} finalizado com sucesso!`);
      setIsFinalizarModalOpen(false);
      setPedidoData({
        produto_id: "",
        valor_total: "",
        forma_pagamento: "",
        observacoes: "",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao finalizar pedido";
      toast.error(message);
    }
  };

  const showConversationListEmpty = !atendimentosLoading && filteredAtendimentos.length === 0;

  return (
    <div className="flex h-[calc(100vh-8.5rem)] min-h-0 flex-col gap-6 overflow-hidden">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Atendimentos WhatsApp</h2>
        <p className="mt-1 text-muted-foreground">Gerencie conversas com clientes em tempo real</p>
        {atendimentosError && <p className="mt-2 text-sm text-red-600">Erro ao carregar atendimentos: {atendimentosError}</p>}
        {mensagensError && <p className="mt-2 text-sm text-red-600">Erro ao carregar mensagens: {mensagensError}</p>}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 overflow-hidden lg:grid-cols-3">
        <Card className="flex min-h-0 flex-col overflow-hidden shadow-md lg:col-span-1">
          <div className="space-y-3 border-b p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
              <Input
                placeholder="Buscar atendimento..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ATIVO">Ativos</SelectItem>
                <SelectItem value="PENDENTE">Pendentes</SelectItem>
                <SelectItem value="ENCERRADO">Encerrados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            {atendimentosLoading ? (
              <div className="p-4 text-sm text-muted-foreground">Carregando conversas...</div>
            ) : showConversationListEmpty ? (
              <div className="p-4 text-sm text-muted-foreground">Nenhuma conversa encontrada para os filtros selecionados.</div>
            ) : (
              <div className="divide-y">
                {filteredAtendimentos.map((atendimento) => {
                  const isActive = selectedAtendimento?.id === atendimento.id;
                  return (
                    <button
                      key={atendimento.id}
                      onClick={() => setSelectedAtendimentoId(atendimento.id)}
                      className={`w-full p-4 text-left transition-colors hover:bg-gray-50 ${
                        isActive ? "border-l-4 border-primary bg-green-50" : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Avatar>
                          <AvatarFallback className="bg-primary text-white">{atendimento.cliente.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex items-start justify-between gap-2">
                            <h4 className="truncate text-sm font-semibold">{atendimento.cliente}</h4>
                            <span className="shrink-0 text-xs text-muted-foreground">{formatTime(atendimento.horario)}</span>
                          </div>
                          <p className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {atendimento.telefone}
                          </p>
                          <p className="mb-2 truncate text-sm text-gray-600">{atendimento.ultima_mensagem || "Sem mensagens registradas"}</p>
                          <StatusBadge status={atendimento.status} />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </Card>

        <Card className="flex min-h-0 flex-col overflow-hidden shadow-md lg:col-span-2">
          {!selectedAtendimento ? (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
              Selecione uma conversa para visualizar as mensagens do atendimento.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b bg-gray-50 p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary text-white">{selectedAtendimento.cliente.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold">{selectedAtendimento.cliente}</h3>
                    <p className="text-sm text-muted-foreground">{selectedAtendimento.telefone}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleAbrirFinalizarPedido}
                    disabled={selectedAtendimento.status === "ENCERRADO"}
                    className="bg-primary hover:bg-primary/90"
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Finalizar Pedido
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => void handleAtualizarStatus("ENCERRADO")}
                    disabled={selectedAtendimento.status === "ENCERRADO" || isUpdatingConversation}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Encerrar
                  </Button>
                </div>
              </div>

              <ScrollArea className="min-h-0 flex-1 p-4">
                {mensagensLoading ? (
                  <div className="text-sm text-muted-foreground">Carregando mensagens...</div>
                ) : mensagens.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma mensagem encontrada para esta conversa.</p>
                ) : (
                  <div className="space-y-4">
                    {mensagens.map((mensagem) => {
                      const sender = normalizeSender(mensagem);
                      const visual = getMessageBubbleClasses(sender);
                      const Icon = visual.icon;

                      return (
                        <div key={mensagem.id} className={`flex ${visual.wrapper}`}>
                          <div className={`max-w-[75%] rounded-lg px-4 py-3 ${visual.bubble}`}>
                            <div className="mb-2 flex items-center gap-2 text-xs font-medium opacity-90">
                              <Icon className="h-3.5 w-3.5" />
                              <span>{visual.label}</span>
                            </div>
                            <p className="whitespace-pre-wrap text-sm">{mensagem.conteudo}</p>
                            <p className={`mt-2 text-xs ${visual.meta}`}>{formatTime(mensagem.horario)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>

              <div className="border-t bg-gray-50 p-4">
                <div className="mb-2 text-xs text-muted-foreground">
                  {selectedAtendimento.status === "ENCERRADO"
                    ? "Conversa encerrada. Reabra o atendimento para voltar a interagir."
                    : "O envio manual depende da configuracao de outbound do WhatsApp neste ambiente."}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Digite sua mensagem..."
                    value={novaMensagem}
                    onChange={(e) => setNovaMensagem(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handleEnviarMensagem();
                      }
                    }}
                    disabled={!canSendManualMessage || isSendingMessage}
                  />
                  <Button onClick={() => void handleEnviarMensagem()} disabled={!canSendManualMessage || isSendingMessage || !novaMensagem.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>

      {selectedAtendimento && (
        <Dialog open={isFinalizarModalOpen} onOpenChange={setIsFinalizarModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                Finalizar Pedido - {selectedAtendimento.cliente}
              </DialogTitle>
              <DialogDescription>Preencha os campos abaixo para finalizar o pedido.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="produto_search">
                  Produto <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="produto_search"
                  list="whatsapp-produtos-sugestoes"
                  value={produtoSearch}
                  onChange={(event) => {
                    const value = event.target.value;
                    const produto = produtos.find((item) => item.nome === value);
                    setProdutoSearch(value);
                    setPedidoData((previous) => ({
                      ...previous,
                      produto_id: produto ? String(produto.id) : "",
                      valor_total: produto?.preco ?? previous.valor_total,
                    }));
                  }}
                  placeholder="Digite para buscar e selecione um produto"
                />
                <datalist id="whatsapp-produtos-sugestoes">
                  {produtos.map((produto) => (
                    <option key={produto.id} value={produto.nome} />
                  ))}
                </datalist>
              </div>

              <div className="space-y-2">
                <Label htmlFor="valor_total">
                  Valor Total <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="valor_total"
                  placeholder="Ex: R$ 2.499,00"
                  value={pedidoData.valor_total}
                  onChange={(e) => setPedidoData({ ...pedidoData, valor_total: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="forma_pagamento">
                  Forma de Pagamento <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={pedidoData.forma_pagamento}
                  onValueChange={(value) => setPedidoData({ ...pedidoData, forma_pagamento: value })}
                >
                  <SelectTrigger id="forma_pagamento">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PIX">PIX</SelectItem>
                    <SelectItem value="CARTAO_CREDITO">Cartão de Crédito</SelectItem>
                    <SelectItem value="CARTAO_DEBITO">Cartão de Débito</SelectItem>
                    <SelectItem value="BOLETO">Boleto</SelectItem>
                    <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  placeholder="Informações adicionais sobre o pedido..."
                  value={pedidoData.observacoes}
                  onChange={(e) => setPedidoData({ ...pedidoData, observacoes: e.target.value })}
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsFinalizarModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={() => void handleFinalizarPedido()} className="bg-primary hover:bg-primary/90">
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Confirmar Pedido
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}



