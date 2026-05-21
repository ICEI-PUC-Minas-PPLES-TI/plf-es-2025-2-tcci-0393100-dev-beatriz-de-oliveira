import { useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import { Search, Download, ListTree, MessageCircle, Package, Percent, Repeat2, UserRoundCheck } from "lucide-react";
import { toast } from "sonner";
import { DateRangePicker } from "../components/DateRangePicker";
import { StatusBadge } from "../components/StatusBadge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { useLeadsData } from "../hooks/useAdminData";
import { adminDataService } from "../services/adminDataService";
import type { Lead, LeadStatus, LeadTimelineEvent, LeadTimelineEventType } from "../types/domain";
import { isInDateRange } from "../utils/dateRange";

const LEAD_STATUSES: LeadStatus[] = ["NOVO", "EM_CONTATO", "ENCAMINHADO", "CONVERTIDO", "PERDIDO"];

const eventStyles: Record<LeadTimelineEventType, { label: string; className: string; icon: typeof Package }> = {
  produto: { label: "Produto", className: "border-blue-200 bg-blue-50 text-blue-700", icon: Package },
  promocao: { label: "Promoção", className: "border-orange-200 bg-orange-50 text-orange-700", icon: Percent },
  conversa: { label: "Conversa", className: "border-slate-200 bg-slate-50 text-slate-700", icon: MessageCircle },
  status: { label: "Status", className: "border-green-200 bg-green-50 text-green-700", icon: Repeat2 },
  handoff: { label: "Handoff", className: "border-purple-200 bg-purple-50 text-purple-700", icon: UserRoundCheck },
};

function getTimelineEventStyle(event: LeadTimelineEvent) {
  if (event.status === "CONVERTIDO") return { label: "Status", className: "border-green-200 bg-green-50 text-green-700", icon: Repeat2 };
  if (event.status === "PERDIDO") return { label: "Status", className: "border-red-200 bg-red-50 text-red-700", icon: Repeat2 };
  return eventStyles[event.type];
}

function normalizeTimeline(lead: Lead | null): LeadTimelineEvent[] {
  if (!lead) return [];
  return lead.timeline ?? [];
}

function groupTimelineByDay(events: LeadTimelineEvent[]) {
  const groups = new Map<string, LeadTimelineEvent[]>();
  for (const event of [...events].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())) {
    const dateKey = new Date(event.occurredAt).toISOString().slice(0, 10);
    groups.set(dateKey, [...(groups.get(dateKey) ?? []), event]);
  }
  return [...groups.entries()];
}

export function Leads() {
  const { data: leads, isLoading, error, reload } = useLeadsData();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [periodo, setPeriodo] = useState<DateRange | undefined>(undefined);
  const [statusByLeadId, setStatusByLeadId] = useState<Record<number, LeadStatus>>({});
  const [selectedInterestLead, setSelectedInterestLead] = useState<Lead | null>(null);

  const isLeadStatus = (value: string): value is LeadStatus => LEAD_STATUSES.includes(value as LeadStatus);

  const getLeadStatus = (leadId: number, fallbackStatus: LeadStatus): LeadStatus =>
    statusByLeadId[leadId] ?? fallbackStatus;

  const formatChannel = (lead: Lead) => {
    if (lead.canal === "telegram") return "Telegram";
    return lead.origem === "TELEGRAM" ? "Telegram" : "Sem canal";
  };

  const formatDateTime = (value?: string) => {
    if (!value) return "-";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatTime = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "--:--";
    return parsed.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const formatTimelineDay = (dateKey: string) => {
    const date = new Date(`${dateKey}T12:00:00.000`);
    const today = new Date();
    const todayKey = today.toISOString().slice(0, 10);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayKey = yesterday.toISOString().slice(0, 10);
    const label = dateKey === todayKey ? "Hoje" : dateKey === yesterdayKey ? "Ontem" : date.toLocaleDateString("pt-BR", { weekday: "long" });
    return `${label} — ${date.toLocaleDateString("pt-BR")}`;
  };

  const handleStatusChange = async (leadId: number, newStatus: LeadStatus) => {
    try {
      await adminDataService.updateLeadStatus(leadId, newStatus);
      setStatusByLeadId((previous) => ({ ...previous, [leadId]: newStatus }));
      await reload();
      toast.success("Status atualizado com sucesso");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao atualizar status";
      toast.error(message);
    }
  };

  const handleExportCSV = async () => {
    try {
      const csv = await adminDataService.exportLeadsCsv({
        status: statusFilter === "todos" ? undefined : statusFilter,
        search: searchTerm || undefined,
      });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "leads.csv";
      link.click();
      URL.revokeObjectURL(url);
      toast.success("CSV exportado com sucesso");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao exportar CSV";
      toast.error(message);
    }
  };

  const leadsNoPeriodo = useMemo(
    () => leads.filter((lead) => isInDateRange(new Date(lead.data_criacao), periodo)),
    [leads, periodo],
  );

  const filteredLeads = leadsNoPeriodo.filter((lead) => {
    const currentStatus = getLeadStatus(lead.id, lead.status);
    const matchesSearch =
      lead.nome.toLowerCase().includes(searchTerm.toLowerCase())
      || lead.telefone.includes(searchTerm)
      || (lead.contatoExibicao ?? lead.contato ?? "").toLowerCase().includes(searchTerm.toLowerCase())
      || (lead.origem ?? "").toLowerCase().includes(searchTerm.toLowerCase())
      || (lead.intencao ?? "").toLowerCase().includes(searchTerm.toLowerCase())
      || (lead.interesse ?? "").toLowerCase().includes(searchTerm.toLowerCase())
      || lead.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "todos" || currentStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestão de Leads</h2>
          <p className="mt-1 text-muted-foreground">Acompanhe e gerencie seus potenciais clientes</p>
          {error && <p className="mt-2 text-sm text-red-600">Erro ao carregar leads: {error}</p>}
        </div>
        <Button onClick={() => void handleExportCSV()} variant="outline" className="shadow-sm">
          <Download className="mr-2 h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, contato, canal ou interesse..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Status</SelectItem>
            <SelectItem value="NOVO">Novo</SelectItem>
            <SelectItem value="ENCAMINHADO">Encaminhado</SelectItem>
            <SelectItem value="EM_CONTATO">Em Contato</SelectItem>
            <SelectItem value="CONVERTIDO">Convertido</SelectItem>
            <SelectItem value="PERDIDO">Perdido</SelectItem>
          </SelectContent>
        </Select>

        <DateRangePicker value={periodo} onChange={setPeriodo} />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-medium text-blue-600">Novos</p>
          <p className="text-2xl font-bold text-blue-700">{leadsNoPeriodo.filter((l) => getLeadStatus(l.id, l.status) === "NOVO").length}</p>
        </div>
        <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
          <p className="text-sm font-medium text-purple-600">Encaminhados</p>
          <p className="text-2xl font-bold text-purple-700">{leadsNoPeriodo.filter((l) => getLeadStatus(l.id, l.status) === "ENCAMINHADO").length}</p>
        </div>
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-sm font-medium text-yellow-600">Em Contato</p>
          <p className="text-2xl font-bold text-yellow-700">{leadsNoPeriodo.filter((l) => getLeadStatus(l.id, l.status) === "EM_CONTATO").length}</p>
        </div>
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-600">Convertidos</p>
          <p className="text-2xl font-bold text-green-700">{leadsNoPeriodo.filter((l) => getLeadStatus(l.id, l.status) === "CONVERTIDO").length}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-medium text-gray-600">Perdidos</p>
          <p className="text-2xl font-bold text-gray-700">{leadsNoPeriodo.filter((l) => getLeadStatus(l.id, l.status) === "PERDIDO").length}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-muted-foreground shadow-md">
          Carregando leads...
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-md">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Nome</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Interesse</TableHead>
                  <TableHead>Origem / intenção</TableHead>
                  <TableHead>Atendimento</TableHead>
                  <TableHead>Última interação</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.map((lead) => (
                  <TableRow key={lead.id} className="hover:bg-gray-50">
                    <TableCell className="font-medium">{lead.nome}</TableCell>
                    <TableCell>{formatChannel(lead)}</TableCell>
                    <TableCell>{lead.contatoExibicao ?? lead.contato ?? lead.telefone}</TableCell>
                    <TableCell>
                      {normalizeTimeline(lead).length > 0 ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 justify-start"
                          onClick={() => setSelectedInterestLead(lead)}
                        >
                          <ListTree className="mr-2 h-4 w-4" />
                          {normalizeTimeline(lead).length === 1
                            ? "1 evento"
                            : `${normalizeTimeline(lead).length} eventos`}
                        </Button>
                      ) : (
                        <span className="text-sm text-muted-foreground">Sem interesse</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>{lead.origem ?? "-"}</div>
                      <div className="text-muted-foreground">{lead.intencao ?? "-"}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {lead.atendimento_id ? `#${lead.atendimento_id}` : "-"}
                      {lead.encaminhado_humano && <div className="text-xs text-purple-700">Encaminhado</div>}
                    </TableCell>
                    <TableCell className="text-sm">{formatDateTime(lead.ultima_interacao ?? lead.data_criacao)}</TableCell>
                    <TableCell>
                      <StatusBadge status={getLeadStatus(lead.id, lead.status)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Select
                        value={getLeadStatus(lead.id, lead.status)}
                        onValueChange={(value) => {
                          if (isLeadStatus(value)) {
                            void handleStatusChange(lead.id, value);
                          }
                        }}
                      >
                        <SelectTrigger className="w-[160px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NOVO">Novo</SelectItem>
                          <SelectItem value="ENCAMINHADO">Encaminhado</SelectItem>
                          <SelectItem value="EM_CONTATO">Em Contato</SelectItem>
                          <SelectItem value="CONVERTIDO">Convertido</SelectItem>
                          <SelectItem value="PERDIDO">Perdido</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <Dialog open={Boolean(selectedInterestLead)} onOpenChange={(open) => !open && setSelectedInterestLead(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Linha do tempo do lead</DialogTitle>
            <DialogDescription>
              {selectedInterestLead
                ? `${selectedInterestLead.nome} tem uma timeline comercial de interesses, handoff e status.`
                : "Eventos registrados durante o atendimento."}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto pr-1">
            <div className="space-y-5">
              {groupTimelineByDay(normalizeTimeline(selectedInterestLead)).map(([dateKey, events]) => (
                <section key={dateKey} className="space-y-3">
                  <div className="border-b pb-2 text-sm font-semibold text-gray-800">{formatTimelineDay(dateKey)}</div>
                  <div className="space-y-0">
                    {events.map((event, index) => {
                      const style = getTimelineEventStyle(event);
                      const Icon = style.icon;
                      return (
                        <div key={event.id} className="grid grid-cols-[64px_28px_minmax(0,1fr)] gap-3">
                          <div className="pt-1 text-right text-xs font-medium text-muted-foreground">{formatTime(event.occurredAt)}</div>
                          <div className="flex flex-col items-center">
                            <div className={`flex h-7 w-7 items-center justify-center rounded-full border ${style.className}`}>
                              <Icon className="h-3.5 w-3.5" />
                            </div>
                            {index < events.length - 1 && <div className="h-full min-h-8 w-px bg-gray-200" />}
                          </div>
                          <div className="pb-5">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-medium text-gray-900">{event.title}</p>
                              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${style.className}`}>{style.label}</span>
                            </div>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">{event.description}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
