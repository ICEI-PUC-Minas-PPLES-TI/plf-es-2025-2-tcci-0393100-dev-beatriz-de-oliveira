import { useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import { Search, Download } from "lucide-react";
import { toast } from "sonner";
import { DateRangePicker } from "../components/DateRangePicker";
import { StatusBadge } from "../components/StatusBadge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { useLeadsData } from "../hooks/useAdminData";
import { adminDataService } from "../services/adminDataService";
import type { Lead, LeadStatus } from "../types/domain";
import { isInDateRange } from "../utils/dateRange";

function splitInteresses(interesse?: string): string[] {
  return (interesse ?? "")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function Leads() {
  const { data: leads, isLoading, error, reload } = useLeadsData();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [periodo, setPeriodo] = useState<DateRange | undefined>(undefined);
  const [statusByLeadId, setStatusByLeadId] = useState<Record<number, LeadStatus>>({});

  const isLeadStatus = (value: string): value is LeadStatus => {
    return ["NOVO", "ENCAMINHADO_HUMANO", "EM_CONTATO", "CONVERTIDO", "PERDIDO"].includes(value);
  };

  const getLeadStatus = (leadId: number, fallbackStatus: LeadStatus): LeadStatus =>
    statusByLeadId[leadId] ?? fallbackStatus;

  const formatChannel = (lead: Lead) => {
    if (lead.canal === "telegram") return "Telegram";
    if (lead.canal === "whatsapp") return "WhatsApp";
    return lead.origem ?? "Sem canal";
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
            <SelectItem value="ENCAMINHADO_HUMANO">Encaminhado</SelectItem>
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
          <p className="text-2xl font-bold text-purple-700">{leadsNoPeriodo.filter((l) => getLeadStatus(l.id, l.status) === "ENCAMINHADO_HUMANO").length}</p>
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
                      <div className="flex max-w-md flex-wrap gap-1">
                        {splitInteresses(lead.interesse).map((interesse) => (
                          <span key={interesse} className="rounded bg-gray-100 px-2 py-1 text-sm">{interesse}</span>
                        ))}
                      </div>
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
                          <SelectItem value="ENCAMINHADO_HUMANO">Encaminhado</SelectItem>
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
    </div>
  );
}
