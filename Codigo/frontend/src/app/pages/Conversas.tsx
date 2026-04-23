import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { Bot, CheckCircle2, Headphones, MessageCircle, Search, Send, Smartphone, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { HttpError } from "../api/httpClient";
import { StatusBadge } from "../components/StatusBadge";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { ScrollArea } from "../components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Skeleton } from "../components/ui/skeleton";
import { Textarea } from "../components/ui/textarea";
import { useConversationMessagesData, useConversationsData, useProdutosLookup } from "../hooks/useAdminData";
import { adminDataService } from "../services/adminDataService";
import type { AtendimentoStatus, ConversationChannel, LeadStatus, Mensagem } from "../types/domain";

type ChannelFilter = "todos" | ConversationChannel;
type SenderKind = "cliente" | "chatbot" | "humano";

function formatDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getConversationIdentifier(channel: ConversationChannel | undefined, contactId?: string, phone?: string): string {
  const rawValue = contactId ?? phone ?? "";
  if (!rawValue) {
    return "Identificador indisponível";
  }

  if (channel === "telegram") {
    return `ID Telegram: ${rawValue}`;
  }

  return rawValue;
}

function normalizeSender(message: Mensagem): SenderKind {
  const sender = (message.remetente ?? "").toUpperCase();
  if (sender === "CLIENTE") return "cliente";
  if (sender === "ATENDENTE") return "humano";
  if (sender === "CHATBOT") return "chatbot";
  return message.tipo === "recebida" ? "cliente" : "chatbot";
}

function getSenderVisual(sender: SenderKind) {
  if (sender === "cliente") {
    return {
      wrapper: "justify-start",
      bubble: "border border-gray-200 bg-white text-gray-900",
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

function getChannelVisual(channel: ConversationChannel | undefined) {
  if (channel === "telegram") {
    return {
      label: "Telegram",
      className: "border-blue-200 bg-blue-50 text-blue-700",
      icon: Send,
    };
  }

  return {
    label: "WhatsApp",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: Smartphone,
  };
}

function getStatusButtonClasses(status: AtendimentoStatus) {
  if (status === "PENDENTE") {
    return "pointer-events-none h-7 px-2.5 text-xs bg-orange-500 text-white hover:bg-orange-500";
  }

  if (status === "ENCERRADO") {
    return "pointer-events-none h-7 px-2.5 text-xs bg-gray-500 text-white hover:bg-gray-500";
  }

  return "pointer-events-none h-7 px-2.5 text-xs bg-[#05c85a] text-white hover:bg-[#05c85a]";
}

function EmptyConversationState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 rounded-full bg-gray-100 p-4 text-gray-500">
        <MessageCircle className="h-8 w-8" />
      </div>
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function ConversationListSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="space-y-2 rounded-xl border p-3">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-14" />
          </div>
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-5 w-24" />
        </div>
      ))}
    </div>
  );
}

function MessageListSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className={`flex ${index % 2 === 0 ? "justify-start" : "justify-end"}`}>
          <Skeleton className="h-20 w-64 rounded-2xl" />
        </div>
      ))}
    </div>
  );
}

function isValidChannelFilter(value: string | null): value is ConversationChannel {
  return value === "whatsapp" || value === "telegram";
}

export function Conversas() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialChannel = searchParams.get("channel");
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>(isValidChannelFilter(initialChannel) ? initialChannel : "todos");
  const [statusFilter, setStatusFilter] = useState<AtendimentoStatus | "todos">("todos");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isUpdatingConversation, setIsUpdatingConversation] = useState(false);
  const [isUpdatingLeadStatus, setIsUpdatingLeadStatus] = useState(false);
  const [isFinalizarModalOpen, setIsFinalizarModalOpen] = useState(false);
  const [isEncerrarModalOpen, setIsEncerrarModalOpen] = useState(false);
  const [produtoSearch, setProdutoSearch] = useState("");
  const [pedidoData, setPedidoData] = useState({
    produto_id: "",
    valor_total: "",
    forma_pagamento: "",
    observacoes: "",
  });

  const {
    data: conversations,
    reload: reloadConversations,
    isLoading: conversationsLoading,
    error: conversationsError,
  } = useConversationsData(channelFilter);
  const { data: produtos } = useProdutosLookup(produtoSearch, isFinalizarModalOpen);

  useEffect(() => {
    const queryChannel = searchParams.get("channel");
    if (isValidChannelFilter(queryChannel) && queryChannel !== channelFilter) {
      setChannelFilter(queryChannel);
      return;
    }

    if (!queryChannel && channelFilter !== "todos") {
      setChannelFilter("todos");
    }
  }, [channelFilter, searchParams]);

  const filteredConversations = useMemo(
    () =>
      conversations.filter((conversation) => {
        const haystack = [conversation.cliente, conversation.contactId ?? conversation.telefone, conversation.ultima_mensagem].join(" ").toLowerCase();
        const matchesSearch = haystack.includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === "todos" || conversation.status === statusFilter;
        return matchesSearch && matchesStatus;
      }),
    [conversations, searchTerm, statusFilter],
  );

  useEffect(() => {
    if (selectedConversationId !== null && filteredConversations.some((conversation) => conversation.id === selectedConversationId)) {
      return;
    }

    setSelectedConversationId(filteredConversations[0]?.id ?? null);
  }, [filteredConversations, selectedConversationId]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void reloadConversations({ silent: true });
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [reloadConversations]);

  const selectedConversation = filteredConversations.find((conversation) => conversation.id === selectedConversationId) ?? null;
  const {
    data: messages,
    reload: reloadMessages,
    isLoading: messagesLoading,
    error: messagesError,
  } = useConversationMessagesData(selectedConversation?.id ?? null);

  useEffect(() => {
    if (!selectedConversation?.id) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void reloadMessages({ silent: true });
      void reloadConversations({ silent: true });
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [selectedConversation?.id, reloadConversations, reloadMessages]);

  const isWhatsAppConversation = selectedConversation?.channel === "whatsapp";
  const canSendManualMessage = Boolean(selectedConversation && selectedConversation.status !== "ENCERRADO");
  const canUpdateStatus = Boolean(selectedConversation && isWhatsAppConversation);
  const canFinalizeOrder = Boolean(selectedConversation && selectedConversation.status !== "ENCERRADO");

  const handleAtualizarLeadStatus = async (status: Extract<LeadStatus, "CONVERTIDO" | "PERDIDO">) => {
    if (!selectedConversation?.leadId) {
      toast.error("Este atendimento ainda não possui lead vinculado.");
      return;
    }

    setIsUpdatingLeadStatus(true);
    try {
      await adminDataService.updateLeadStatus(selectedConversation.leadId, status);
      await reloadConversations();
      toast.success(status === "CONVERTIDO" ? "Lead marcado como convertido" : "Lead marcado como perdido");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao atualizar status do lead";
      toast.error(message);
    } finally {
      setIsUpdatingLeadStatus(false);
    }
  };

  const updateChannelFilter = (nextFilter: ChannelFilter) => {
    setChannelFilter(nextFilter);
    setStatusFilter("todos");
    setSelectedConversationId(null);

    if (nextFilter === "todos") {
      setSearchParams({});
      return;
    }

    setSearchParams({ channel: nextFilter });
  };

  const handleEnviarMensagem = async () => {
    if (!selectedConversation || !newMessage.trim()) {
      return;
    }

    setIsSendingMessage(true);
    try {
      await adminDataService.sendConversationMessage({ conversationId: selectedConversation.id, content: newMessage.trim() });
      setNewMessage("");
      await Promise.all([reloadMessages(), reloadConversations()]);
      toast.success("Mensagem enviada");
    } catch (error) {
      if (
        error instanceof HttpError &&
        (error.payload?.code === "WHATSAPP_OUTBOUND_NOT_CONFIGURED" || error.payload?.code === "TELEGRAM_BOT_NOT_CONFIGURED")
      ) {
        toast.error("O provedor de envio deste canal ainda não está configurado neste ambiente.");
      } else {
        const message = error instanceof Error ? error.message : "Falha ao enviar mensagem";
        toast.error(message);
      }
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleAtualizarStatus = async (status: AtendimentoStatus) => {
    if (!selectedConversation) {
      return;
    }

    if (!isWhatsAppConversation) {
      toast.error("A atualização de status operacional está disponível apenas para atendimentos de WhatsApp no momento.");
      return;
    }

    setIsUpdatingConversation(true);
    try {
      await adminDataService.updateAtendimentoStatus(selectedConversation.id, status);
      await reloadConversations();
      toast.success(status === "ENCERRADO" ? "Atendimento encerrado" : "Status do atendimento atualizado");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao atualizar atendimento";
      toast.error(message);
    } finally {
      setIsUpdatingConversation(false);
    }
  };

  const handleAbrirFinalizarPedido = () => {
    if (!selectedConversation) {
      return;
    }

    if (selectedConversation.status === "ENCERRADO") {
      toast.error("Reabra o atendimento para finalizar um pedido.");
      return;
    }

    setProdutoSearch("");
    setIsFinalizarModalOpen(true);
  };

  const handleAbrirEncerrarAtendimento = () => {
    if (!selectedConversation) {
      return;
    }

    if (!isWhatsAppConversation) {
      toast.error("A atualização de status operacional está disponível apenas para atendimentos de WhatsApp no momento.");
      return;
    }

    if (selectedConversation.status === "ENCERRADO") {
      toast.error("Este atendimento já está encerrado.");
      return;
    }

    setIsEncerrarModalOpen(true);
  };

  const handleFinalizarPedido = async () => {
    if (!selectedConversation) {
      return;
    }

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
        numero_pedido: `ATD-${Date.now()}`,
        cliente: selectedConversation.cliente,
        telefone_cliente: selectedConversation.contactId ?? selectedConversation.telefone,
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

  const conversationVisual = getChannelVisual(selectedConversation?.channel);
  const ConversationChannelIcon = conversationVisual.icon;

  return (
    <div className="flex h-[calc(100vh-8.5rem)] min-h-0 flex-col gap-6 overflow-hidden">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold text-gray-900">Conversas</h2>
        <p className="text-muted-foreground">Painel único de atendimento para WhatsApp e Telegram, com visão operacional do atendimento.</p>
        {conversationsError && <p className="text-sm text-red-600">Erro ao carregar conversas: {conversationsError}</p>}
        {messagesError && <p className="text-sm text-red-600">Erro ao carregar mensagens: {messagesError}</p>}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 overflow-hidden xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card className="flex min-h-0 flex-col overflow-hidden shadow-md">
          <div className="space-y-3 border-b p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, contato ou mensagem..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                { value: "todos", label: "Todos" },
                { value: "whatsapp", label: "WhatsApp" },
                { value: "telegram", label: "Telegram" },
              ].map((item) => (
                <Button
                  key={item.value}
                  type="button"
                  variant={channelFilter === item.value ? "default" : "outline"}
                  className="rounded-full"
                  onClick={() => updateChannelFilter(item.value as ChannelFilter)}
                >
                  {item.label}
                </Button>
              ))}
            </div>

            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as AtendimentoStatus | "todos")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="ATIVO">Ativos</SelectItem>
                <SelectItem value="PENDENTE">Pendentes</SelectItem>
                <SelectItem value="ENCERRADO">Encerrados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            {conversationsLoading ? (
              <ConversationListSkeleton />
            ) : filteredConversations.length === 0 ? (
              <EmptyConversationState
                title="Nenhuma conversa encontrada"
                description="Ajuste os filtros ou aguarde novas mensagens para que os atendimentos apareçam aqui."
              />
            ) : (
              <div className="divide-y">
                {filteredConversations.map((conversation) => {
                  const visual = getChannelVisual(conversation.channel);
                  const ChannelIcon = visual.icon;
                  const isSelected = conversation.id === selectedConversation?.id;

                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => setSelectedConversationId(conversation.id)}
                      className={`w-full px-4 py-4 text-left transition-colors hover:bg-gray-50 ${
                        isSelected ? "border-l-4 border-primary bg-green-50/60" : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-primary text-white">
                            {conversation.cliente.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-gray-900">{conversation.cliente}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {getConversationIdentifier(conversation.channel, conversation.contactId, conversation.telefone)}
                              </p>
                            </div>
                            <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(conversation.horario)}</span>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className={visual.className}>
                              <ChannelIcon className="mr-1 h-3 w-3" />
                              {visual.label}
                            </Badge>
                            <StatusBadge status={conversation.status} />
                            {conversation.leadStatus && <StatusBadge status={conversation.leadStatus} />}
                            {conversation.leadStatusSuggestion && (
                              <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">
                                Sugerido: {conversation.leadStatusSuggestion === "CONVERTIDO" ? "Convertido" : "Perdido"}
                              </Badge>
                            )}
                          </div>

                          <p className="mt-2 truncate text-sm text-gray-600">{conversation.ultima_mensagem || "Sem mensagens registradas"}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </Card>

        <Card className="flex min-h-0 flex-col overflow-hidden shadow-md">
          {!selectedConversation ? (
            <EmptyConversationState
              title="Selecione uma conversa"
              description="Escolha um atendimento da lista para visualizar o histórico e as ações operacionais."
            />
          ) : (
            <>
              <div className="border-b bg-gray-50 p-4">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex min-w-0 flex-col gap-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-11 w-11">
                          <AvatarFallback className="bg-primary text-white">
                            {selectedConversation.cliente.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-semibold text-gray-900">{selectedConversation.cliente}</h3>
                          <p className="text-sm text-muted-foreground">
                            {getConversationIdentifier(selectedConversation.channel, selectedConversation.contactId, selectedConversation.telefone)}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="pointer-events-none h-7 px-2.5 text-xs border-emerald-200 bg-white text-emerald-600 hover:bg-white hover:text-emerald-600"
                        >
                          <ConversationChannelIcon className="mr-1.5 h-3.5 w-3.5" />
                          {conversationVisual.label}
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          className={getStatusButtonClasses(selectedConversation.status)}
                        >
                          {selectedConversation.status === "ATIVO" ? "Ativo" : selectedConversation.status === "PENDENTE" ? "Pendente" : "Encerrado"}
                        </Button>
                        {selectedConversation.leadStatus && <StatusBadge status={selectedConversation.leadStatus} />}
                        {selectedConversation.leadStatusSuggestion && (
                          <Badge variant="outline" className="h-7 border-amber-300 bg-amber-50 px-2.5 text-xs text-amber-700">
                            Sugerido: {selectedConversation.leadStatusSuggestion === "CONVERTIDO" ? "Convertido" : "Perdido"}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {selectedConversation.leadId && (
                        <Select
                          value={selectedConversation.leadStatus ?? "NOVO"}
                          onValueChange={(value) => {
                            if (value === "CONVERTIDO" || value === "PERDIDO") {
                              void handleAtualizarLeadStatus(value);
                            }
                          }}
                          disabled={isUpdatingLeadStatus}
                        >
                          <SelectTrigger className="h-9 w-[190px] bg-white">
                            <SelectValue placeholder="Status comercial" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={selectedConversation.leadStatus ?? "NOVO"}>
                              Lead: {selectedConversation.leadStatus === "NOVO"
                                ? "Novo"
                                : selectedConversation.leadStatus === "ENCAMINHADO_HUMANO"
                                  ? "Encaminhado"
                                  : selectedConversation.leadStatus === "EM_CONTATO"
                                    ? "Em contato"
                                    : selectedConversation.leadStatus === "CONVERTIDO"
                                      ? "Convertido"
                                      : "Perdido"}
                            </SelectItem>
                            <SelectItem value="CONVERTIDO">Marcar como convertido</SelectItem>
                            <SelectItem value="PERDIDO">Marcar como perdido</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      <Button
                        variant="default"
                        size="sm"
                        onClick={handleAbrirFinalizarPedido}
                        disabled={!canFinalizeOrder}
                        className="bg-primary hover:bg-primary/90"
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Finalizar Pedido
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleAbrirEncerrarAtendimento}
                        disabled={!canUpdateStatus || selectedConversation.status === "ENCERRADO" || isUpdatingConversation}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Encerrar Atendimento
                      </Button>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    O envio manual funciona no canal da conversa. O encerramento operacional segue as regras disponíveis para cada canal.
                  </p>
                </div>
              </div>

              <ScrollArea className="min-h-0 flex-1 bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_100%)] p-4">
                {messagesLoading ? (
                  <MessageListSkeleton />
                ) : messages.length === 0 ? (
                  <EmptyConversationState
                    title="Sem mensagens nesta conversa"
                    description="Assim que houver troca de mensagens neste canal, elas aparecerão aqui em ordem cronológica."
                  />
                ) : (
                  <div className="space-y-4">
                    {messages.map((message) => {
                      const sender = normalizeSender(message);
                      const visual = getSenderVisual(sender);
                      const SenderIcon = visual.icon;

                      return (
                        <div key={message.id} className={`flex ${visual.wrapper}`}>
                          <div className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${visual.bubble}`}>
                            <div className="mb-2 flex items-center gap-2 text-xs font-medium opacity-90">
                              <SenderIcon className="h-3.5 w-3.5" />
                              <span>{visual.label}</span>
                            </div>
                            <p className="whitespace-pre-wrap text-sm leading-6">{message.conteudo}</p>
                            <div className={`mt-2 flex items-center justify-between gap-3 text-xs ${visual.meta}`}>
                              <span>{message.remetente ?? visual.label}</span>
                              <span>{formatDateTime(message.horario)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>

              <div className="border-t bg-gray-50 p-4">
                <div className="mb-2 text-xs text-muted-foreground">
                  {selectedConversation.status === "ENCERRADO"
                    ? "Conversa encerrada. Reabra o atendimento no fluxo operacional para voltar a interagir."
                    : "O envio manual usa a integração ativa do canal desta conversa."}
                </div>

                <div className="flex gap-2">
                  <Input
                    placeholder="Digite sua mensagem..."
                    value={newMessage}
                    onChange={(event) => setNewMessage(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void handleEnviarMensagem();
                      }
                    }}
                    disabled={!canSendManualMessage || isSendingMessage}
                  />
                  <Button onClick={() => void handleEnviarMensagem()} disabled={!canSendManualMessage || isSendingMessage || !newMessage.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>

      {selectedConversation && (
        <Dialog open={isFinalizarModalOpen} onOpenChange={setIsFinalizarModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                Finalizar Pedido - {selectedConversation.cliente}
              </DialogTitle>
              <DialogDescription>Preencha os campos abaixo para registrar o pedido no contexto deste atendimento.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="produto_search">
                  Produto <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="produto_search"
                  list="conversas-produtos-sugestoes"
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
                <datalist id="conversas-produtos-sugestoes">
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
                  onChange={(event) => setPedidoData((previous) => ({ ...previous, valor_total: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="forma_pagamento">
                  Forma de Pagamento <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={pedidoData.forma_pagamento}
                  onValueChange={(value) => setPedidoData((previous) => ({ ...previous, forma_pagamento: value }))}
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
                  onChange={(event) => setPedidoData((previous) => ({ ...previous, observacoes: event.target.value }))}
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

      {selectedConversation && (
        <Dialog open={isEncerrarModalOpen} onOpenChange={setIsEncerrarModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <X className="h-5 w-5 text-red-600" />
                Confirmar encerramento
              </DialogTitle>
              <DialogDescription>
                Tem certeza que deseja encerrar o atendimento de {selectedConversation.cliente}? Essa ação pode interromper o fluxo operacional atual.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEncerrarModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  await handleAtualizarStatus("ENCERRADO");
                  setIsEncerrarModalOpen(false);
                }}
                disabled={isUpdatingConversation}
              >
                <X className="mr-2 h-4 w-4" />
                Confirmar Encerramento
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
