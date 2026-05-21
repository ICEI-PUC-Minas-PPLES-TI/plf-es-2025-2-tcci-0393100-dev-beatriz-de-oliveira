import { Badge } from "./ui/badge";
import type {
  AtendimentoStatus,
  DisponibilidadeStatus,
  LeadStatus,
  PedidoStatus,
} from "../types/domain";

export type StatusType =
  | LeadStatus
  | AtendimentoStatus
  | PedidoStatus
  | DisponibilidadeStatus;

interface StatusBadgeProps {
  status: StatusType;
}

const statusConfig: Record<StatusType, { label: string; className: string }> = {
  NOVO: { label: "Novo", className: "bg-blue-500 text-white hover:bg-blue-600" },
  ENCAMINHADO: { label: "Encaminhado", className: "bg-purple-500 text-white hover:bg-purple-600" },
  EM_CONTATO: { label: "Em Contato", className: "bg-yellow-500 text-white hover:bg-yellow-600" },
  CONVERTIDO: { label: "Convertido", className: "bg-green-500 text-white hover:bg-green-600" },
  PERDIDO: { label: "Perdido", className: "bg-gray-500 text-white hover:bg-gray-600" },
  ENCERRADO: { label: "Encerrado", className: "bg-gray-500 text-white hover:bg-gray-600" },
  ATIVO: { label: "Ativo", className: "bg-green-500 text-white hover:bg-green-600" },
  PENDENTE: { label: "Pendente", className: "bg-orange-500 text-white hover:bg-orange-600" },
  PAGO: { label: "Pago", className: "bg-green-500 text-white hover:bg-green-600" },
  ATRASADO: { label: "Atrasado", className: "bg-red-500 text-white hover:bg-red-600" },
  CANCELADO: { label: "Cancelado", className: "bg-gray-500 text-white hover:bg-gray-600" },
  disponivel: { label: "Disponível", className: "bg-green-500 text-white hover:bg-green-600" },
  indisponivel: { label: "Indisponível", className: "bg-red-500 text-white hover:bg-red-600" },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge className={config.className}>
      {config.label}
    </Badge>
  );
}
