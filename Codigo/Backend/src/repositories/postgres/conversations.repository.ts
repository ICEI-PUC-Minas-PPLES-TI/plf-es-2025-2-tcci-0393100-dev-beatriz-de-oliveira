import { pool } from "../../config/database.js";
import type { Atendimento, AtendimentoStatus, LeadStatus, Mensagem } from "../../types/domain.js";
import type { ConversationChannel, ConversationsRepository } from "../conversations.repository.js";

type ConversationRow = {
  atendimento_id: string;
  numeric_id: number;
  telefone: string | null;
  cliente: string | null;
  status: string | null;
  ultima_mensagem: string | null;
  horario: string | null;
  canal: string | null;
  lead_id: number | null;
  lead_status: string | null;
  lead_status_suggestion: string | null;
};

type MessageRow = {
  mensagem_id: string;
  numeric_id: number;
  conteudo: string;
  data_envio: string | null;
  direcao: string | null;
  remetente: string | null;
  tipo_mensagem: string | null;
  canal: string | null;
};

function isMeaningfulCustomerName(name: string | null | undefined): boolean {
  if (!name) {
    return false;
  }

  const normalized = name.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  if (["cliente whatsapp", "cliente sem nome", "contato whatsapp", "contato sem nome", "cliente telegram"].includes(normalized)) {
    return false;
  }

  return true;
}

function mapChannel(value: string | null | undefined): ConversationChannel {
  return value?.toUpperCase() === "TELEGRAM" ? "telegram" : "whatsapp";
}

function mapLeadStatus(value: string | null | undefined): LeadStatus | undefined {
  if (!value) {
    return undefined;
  }

  if (value === "INTERESSADO") {
    return "EM_CONTATO";
  }

  if (value === "NOVO" || value === "ENCAMINHADO_HUMANO" || value === "EM_CONTATO" || value === "CONVERTIDO" || value === "PERDIDO") {
    return value;
  }

  return undefined;
}

function getConversationDisplayName(name: string | null | undefined, contactId: string | null | undefined): string {
  if (isMeaningfulCustomerName(name)) {
    return name!.trim();
  }

  if (contactId && contactId.trim()) {
    return contactId.trim();
  }

  return "Contato sem nome";
}

export class PostgresConversationsRepository implements ConversationsRepository {
  async listConversations(channel?: ConversationChannel): Promise<Atendimento[]> {
    const normalizedChannel = channel?.toUpperCase();
    const result = await pool.query<ConversationRow>(
      `
        SELECT
          a.atendimento_id,
          abs(hashtext(a.atendimento_id::text)) AS numeric_id,
          COALESCE(a.whatsapp_chat_id, c.telefone) AS telefone,
          c.nome AS cliente,
          a.status,
          a.canal,
          CASE WHEN l.lead_id IS NOT NULL THEN abs(hashtext(l.lead_id::text)) ELSE NULL END AS lead_id,
          l.status AS lead_status,
          CASE
            WHEN l.status IN ('CONVERTIDO', 'PERDIDO') THEN NULL
            WHEN EXISTS (
              SELECT 1
              FROM pedidos p
              INNER JOIN clientes pc ON pc.cliente_id = p.cliente_id
              WHERE pc.telefone = c.telefone
                AND p.status = 'CONCLUIDO'
            ) THEN 'CONVERTIDO'
            WHEN a.status = 'ENCERRADO' THEN 'PERDIDO'
            WHEN COALESCE(a.ultima_interacao_em, a.iniciado_em) <= NOW() - INTERVAL '72 hours'
              AND l.status IN ('ENCAMINHADO_HUMANO', 'INTERESSADO') THEN 'PERDIDO'
            ELSE NULL
          END AS lead_status_suggestion,
          lm.conteudo AS ultima_mensagem,
          COALESCE(lm.data_envio, a.ultima_interacao_em, a.iniciado_em) AS horario
        FROM atendimentos a
        LEFT JOIN clientes c ON c.cliente_id = a.cliente_id
        LEFT JOIN LATERAL (
          SELECT ld.lead_id, ld.status
          FROM leads ld
          WHERE ld.lead_id = a.lead_id
             OR (c.telefone IS NOT NULL AND ld.telefone = c.telefone)
             OR (a.whatsapp_chat_id IS NOT NULL AND ld.telefone = a.whatsapp_chat_id)
          ORDER BY ld.atualizado_em DESC NULLS LAST, ld.criado_em DESC
          LIMIT 1
        ) l ON TRUE
        LEFT JOIN LATERAL (
          SELECT m.conteudo, m.data_envio
          FROM mensagens m
          WHERE m.atendimento_id = a.atendimento_id
          ORDER BY m.xmin::text::bigint DESC, m.data_envio DESC NULLS LAST, m.mensagem_id DESC
          LIMIT 1
        ) lm ON TRUE
        WHERE ($1::varchar IS NULL OR a.canal = $1::varchar)
        ORDER BY COALESCE(a.ultima_interacao_em, lm.data_envio, a.iniciado_em) DESC NULLS LAST
      `,
      [normalizedChannel ?? null],
    );

    return result.rows.map((row) => ({
      id: Number(row.numeric_id),
      cliente: getConversationDisplayName(row.cliente, row.telefone),
      telefone: row.telefone ?? "",
      contactId: row.telefone ?? "",
      status: this.mapConversationStatus(row.status),
      ultima_mensagem: row.ultima_mensagem ?? "",
      horario: row.horario ?? new Date().toISOString(),
      channel: mapChannel(row.canal),
      leadId: row.lead_id !== null ? Number(row.lead_id) : undefined,
      leadStatus: mapLeadStatus(row.lead_status),
      leadStatusSuggestion: mapLeadStatus(row.lead_status_suggestion) as Extract<LeadStatus, "CONVERTIDO" | "PERDIDO"> | undefined,
    }));
  }

  async listMessages(conversationId: number): Promise<Mensagem[]> {
    const result = await pool.query<MessageRow>(
      `
        SELECT
          m.mensagem_id,
          abs(hashtext(m.mensagem_id::text)) AS numeric_id,
          m.conteudo,
          m.data_envio,
          m.direcao,
          m.remetente,
          m.tipo_mensagem,
          a.canal
        FROM mensagens m
        INNER JOIN atendimentos a ON a.atendimento_id = m.atendimento_id
        WHERE abs(hashtext(m.atendimento_id::text)) = $1
        ORDER BY m.xmin::text::bigint ASC, m.data_envio ASC NULLS LAST, m.mensagem_id ASC
      `,
      [conversationId],
    );

    return result.rows.map((row) => ({
      id: Number(row.numeric_id),
      tipo: row.direcao === "SAIDA" ? "enviada" : "recebida",
      conteudo: row.conteudo,
      horario: row.data_envio ?? new Date().toISOString(),
      remetente: row.remetente ?? undefined,
      type: row.tipo_mensagem ?? "text",
      channel: mapChannel(row.canal),
      conversationId,
    }));
  }

  private mapConversationStatus(value: string | null): AtendimentoStatus {
    if (value === "ENCERRADO") return "ENCERRADO";
    if (value === "PENDENTE") return "PENDENTE";
    return "ATIVO";
  }
}
