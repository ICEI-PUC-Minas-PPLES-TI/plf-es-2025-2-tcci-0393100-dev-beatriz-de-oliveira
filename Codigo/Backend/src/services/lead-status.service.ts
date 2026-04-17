import { pool } from "../config/database.js";
import type { LeadStatus } from "../types/domain.js";

type DbLeadStatus = "NOVO" | "INTERESSADO" | "ENCAMINHADO_HUMANO" | "CONVERTIDO" | "PERDIDO";

type ConversationLeadRow = {
  atendimento_uuid: string;
  atendimento_numeric_id: number;
  atendimento_status: string | null;
  encaminhado_humano: boolean | null;
  estado_conversa: string | null;
  ultima_interacao_em: string | null;
  lead_uuid: string | null;
  lead_numeric_id: number | null;
  lead_status: DbLeadStatus | null;
  telefone: string | null;
};

type ConversationMessageRow = {
  ordem: number;
  remetente: string | null;
  direcao: string | null;
  data_envio: string | null;
};

function mapDbStatusToDomain(status: DbLeadStatus): LeadStatus {
  if (status === "INTERESSADO") {
    return "EM_CONTATO";
  }

  return status;
}

function mapDomainStatusToDb(status: LeadStatus): DbLeadStatus {
  if (status === "EM_CONTATO") {
    return "INTERESSADO";
  }

  return status;
}

function getStatusRank(status: LeadStatus): number {
  switch (status) {
    case "NOVO":
      return 0;
    case "ENCAMINHADO_HUMANO":
      return 1;
    case "EM_CONTATO":
      return 2;
    case "CONVERTIDO":
      return 3;
    case "PERDIDO":
      return 3;
    default:
      return 0;
  }
}

function isTerminalLeadStatus(status: LeadStatus): boolean {
  return status === "CONVERTIDO" || status === "PERDIDO";
}

function normalizeStage(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

export class LeadStatusService {
  async updateLeadStatusFromConversation(atendimentoId: number): Promise<void> {
    const conversation = await this.findConversationLeadContext(atendimentoId);

    if (!conversation?.lead_uuid || !conversation.lead_status) {
      return;
    }

    const currentStatus = mapDbStatusToDomain(conversation.lead_status);
    if (isTerminalLeadStatus(currentStatus)) {
      console.info("[LeadStatus] automatic_transition_skipped_terminal", {
        atendimentoId,
        leadId: conversation.lead_numeric_id,
        currentStatus,
      });
      return;
    }

    const messages = await this.listConversationMessages(conversation.atendimento_uuid);
    const nextStatus = this.resolveAutomaticStatus(conversation, messages, currentStatus);

    if (!nextStatus || nextStatus === currentStatus || getStatusRank(nextStatus) < getStatusRank(currentStatus)) {
      return;
    }

    await pool.query(
      `
        UPDATE leads
        SET status = $2,
            atualizado_em = NOW()
        WHERE lead_id = $1::uuid
      `,
      [conversation.lead_uuid, mapDomainStatusToDb(nextStatus)],
    );

    console.info("[LeadStatus] lead_status_updated", {
      atendimentoId,
      leadId: conversation.lead_numeric_id,
      from: currentStatus,
      to: nextStatus,
      rule: this.describeRule(nextStatus),
    });
  }

  private async findConversationLeadContext(atendimentoId: number): Promise<ConversationLeadRow | null> {
    const result = await pool.query<ConversationLeadRow>(
      `
        SELECT
          a.atendimento_id::text AS atendimento_uuid,
          abs(hashtext(a.atendimento_id::text)) AS atendimento_numeric_id,
          a.status AS atendimento_status,
          a.encaminhado_humano,
          a.estado_conversa,
          a.ultima_interacao_em,
          l.lead_id::text AS lead_uuid,
          CASE WHEN l.lead_id IS NOT NULL THEN abs(hashtext(l.lead_id::text)) ELSE NULL END AS lead_numeric_id,
          l.status AS lead_status,
          COALESCE(c.telefone, a.whatsapp_chat_id) AS telefone
        FROM atendimentos a
        LEFT JOIN clientes c ON c.cliente_id = a.cliente_id
        LEFT JOIN LATERAL (
          SELECT ld.lead_id, ld.status
          FROM leads ld
          WHERE ld.lead_id = a.lead_id
             OR (COALESCE(c.telefone, a.whatsapp_chat_id) IS NOT NULL AND ld.telefone = COALESCE(c.telefone, a.whatsapp_chat_id))
          ORDER BY ld.atualizado_em DESC NULLS LAST, ld.criado_em DESC
          LIMIT 1
        ) l ON TRUE
        WHERE abs(hashtext(a.atendimento_id::text)) = $1
        LIMIT 1
      `,
      [atendimentoId],
    );

    return result.rows[0] ?? null;
  }

  private async listConversationMessages(atendimentoUuid: string): Promise<ConversationMessageRow[]> {
    const result = await pool.query<ConversationMessageRow>(
      `
        SELECT
          ROW_NUMBER() OVER (
            ORDER BY m.xmin::text::bigint ASC, m.data_envio ASC NULLS LAST, m.mensagem_id ASC
          ) AS ordem,
          m.remetente,
          m.direcao,
          m.data_envio
        FROM mensagens m
        WHERE m.atendimento_id = $1::uuid
      `,
      [atendimentoUuid],
    );

    return result.rows;
  }

  private resolveAutomaticStatus(
    conversation: ConversationLeadRow,
    messages: ConversationMessageRow[],
    currentStatus: LeadStatus,
  ): LeadStatus | null {
    const stage = normalizeStage(conversation.estado_conversa);
    const handoffDetected =
      Boolean(conversation.encaminhado_humano) ||
      stage.includes("ENCAMINHADO_HUMANO") ||
      stage.includes("HANDOFF");

    const attendantIndexes = messages
      .filter((message) => (message.remetente ?? "").toUpperCase() === "ATENDENTE")
      .map((message) => message.ordem);

    const firstAttendantIndex = attendantIndexes[0];
    const clientRespondedAfterAttendant =
      firstAttendantIndex !== undefined
        ? messages.some(
            (message) =>
              message.ordem > firstAttendantIndex && (message.remetente ?? "").toUpperCase() === "CLIENTE",
          )
        : false;

    if (handoffDetected && firstAttendantIndex !== undefined && clientRespondedAfterAttendant) {
      return "EM_CONTATO";
    }

    if (handoffDetected && currentStatus === "NOVO") {
      return "ENCAMINHADO_HUMANO";
    }

    return null;
  }

  private describeRule(status: LeadStatus): string {
    if (status === "ENCAMINHADO_HUMANO") {
      return "handoff_humano_detectado";
    }

    if (status === "EM_CONTATO") {
      return "troca_ativa_entre_atendente_e_cliente";
    }

    return "none";
  }
}
