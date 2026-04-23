import { pool } from "../../config/database.js";
import type { Atendimento, AtendimentoHistorico, Mensagem } from "../../types/domain.js";
import type { ConversationsRepository } from "../conversations.repository.js";

type ConversationRow = {
  atendimento_id: string;
  numeric_id: number;
  cliente_id: string | null;
  cliente: string | null;
  telefone: string | null;
  contact_id: string | null;
  status: string | null;
  ultima_mensagem: string | null;
  horario: string | null;
  canal: string | null;
  iniciado_em: string | null;
  encerrado_em: string | null;
  ultima_interacao_em: string | null;
};

type MessageRow = {
  mensagem_id: string;
  numeric_id: number;
  conteudo: string;
  data_envio: string | null;
  direcao: string | null;
  remetente: string | null;
};

type HistoryMessageRow = MessageRow & {
  atendimento_id: string;
};

export class PostgresConversationsRepository implements ConversationsRepository {
  async listConversations(channel?: string): Promise<Atendimento[]> {
    const values: unknown[] = [];
    const filter =
      channel && channel.trim()
        ? `WHERE lower(a.canal) = $1`
        : "";

    if (channel && channel.trim()) {
      values.push(channel.trim().toUpperCase());
    }

    const result = await pool.query<ConversationRow>(
      `
        SELECT
          a.atendimento_id,
          abs(hashtext(a.atendimento_id::text)) AS numeric_id,
          a.cliente_id::text AS cliente_id,
          c.nome AS cliente,
          c.telefone,
          a.whatsapp_chat_id AS contact_id,
          a.status,
          a.canal,
          lm.conteudo AS ultima_mensagem,
          COALESCE(lm.data_envio, a.ultima_interacao_em, a.iniciado_em) AS horario,
          a.iniciado_em,
          a.encerrado_em,
          a.ultima_interacao_em
        FROM atendimentos a
        LEFT JOIN clientes c ON c.cliente_id = a.cliente_id
        LEFT JOIN LATERAL (
          SELECT m.conteudo, m.data_envio
          FROM mensagens m
          WHERE m.atendimento_id = a.atendimento_id
          ORDER BY m.xmin::text::bigint DESC, m.data_envio DESC NULLS LAST, m.mensagem_id DESC
          LIMIT 1
        ) lm ON TRUE
        ${filter}
        ORDER BY COALESCE(lm.data_envio, a.ultima_interacao_em, a.iniciado_em) DESC NULLS LAST
      `,
      values,
    );

    return result.rows.map((row) => ({
      id: Number(row.numeric_id),
      cliente: row.cliente ?? row.telefone ?? "Cliente sem nome",
      telefone: row.telefone ?? "",
      contactId: row.canal?.toLowerCase() === "telegram" ? row.contact_id ?? "" : undefined,
      status: row.status === "ENCERRADO" ? "ENCERRADO" : row.status === "PENDENTE" ? "PENDENTE" : "ATIVO",
      ultima_mensagem: row.ultima_mensagem ?? "",
      horario: row.horario ?? new Date().toISOString(),
      iniciadoEm: row.iniciado_em ?? row.horario ?? new Date().toISOString(),
      encerradoEm: row.encerrado_em,
      ultimaInteracaoEm: row.ultima_interacao_em,
      channel: row.canal?.toLowerCase() === "telegram" ? "telegram" : "whatsapp",
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
          m.remetente
        FROM mensagens m
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
      conversationId,
    }));
  }

  async findConversationById(conversationId: number): Promise<Atendimento | null> {
    const result = await pool.query<ConversationRow>(
      `
        SELECT
          a.atendimento_id,
          abs(hashtext(a.atendimento_id::text)) AS numeric_id,
          a.cliente_id::text AS cliente_id,
          c.nome AS cliente,
          c.telefone,
          a.whatsapp_chat_id AS contact_id,
          a.status,
          a.canal,
          lm.conteudo AS ultima_mensagem,
          COALESCE(lm.data_envio, a.ultima_interacao_em, a.iniciado_em) AS horario,
          a.iniciado_em,
          a.encerrado_em,
          a.ultima_interacao_em
        FROM atendimentos a
        LEFT JOIN clientes c ON c.cliente_id = a.cliente_id
        LEFT JOIN LATERAL (
          SELECT m.conteudo, m.data_envio
          FROM mensagens m
          WHERE m.atendimento_id = a.atendimento_id
          ORDER BY m.xmin::text::bigint DESC, m.data_envio DESC NULLS LAST, m.mensagem_id DESC
          LIMIT 1
        ) lm ON TRUE
        WHERE abs(hashtext(a.atendimento_id::text)) = $1
        LIMIT 1
      `,
      [conversationId],
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    const channel = row.canal?.toLowerCase() === "telegram" ? "telegram" : "whatsapp";

    return {
      id: Number(row.numeric_id),
      cliente: row.cliente ?? row.telefone ?? "Cliente sem nome",
      telefone: row.telefone ?? "",
      contactId: channel === "telegram" ? row.contact_id ?? "" : undefined,
      status: row.status === "ENCERRADO" ? "ENCERRADO" : row.status === "PENDENTE" ? "PENDENTE" : "ATIVO",
      ultima_mensagem: row.ultima_mensagem ?? "",
      horario: row.horario ?? new Date().toISOString(),
      iniciadoEm: row.iniciado_em ?? row.horario ?? new Date().toISOString(),
      encerradoEm: row.encerrado_em,
      ultimaInteracaoEm: row.ultima_interacao_em,
      channel,
    };
  }

  async listPreviousConversations(conversationId: number): Promise<AtendimentoHistorico[]> {
    const historyResult = await pool.query<ConversationRow>(
      `
        WITH current_conversation AS (
          SELECT
            a.atendimento_id,
            a.cliente_id,
            a.canal,
            a.whatsapp_chat_id
          FROM atendimentos a
          WHERE abs(hashtext(a.atendimento_id::text)) = $1
          LIMIT 1
        )
        SELECT
          a.atendimento_id,
          abs(hashtext(a.atendimento_id::text)) AS numeric_id,
          a.cliente_id::text AS cliente_id,
          c.nome AS cliente,
          c.telefone,
          a.whatsapp_chat_id AS contact_id,
          a.status,
          a.canal,
          lm.conteudo AS ultima_mensagem,
          COALESCE(lm.data_envio, a.ultima_interacao_em, a.iniciado_em) AS horario,
          a.iniciado_em,
          a.encerrado_em,
          a.ultima_interacao_em
        FROM atendimentos a
        INNER JOIN current_conversation current ON current.canal = a.canal
        LEFT JOIN clientes c ON c.cliente_id = a.cliente_id
        LEFT JOIN LATERAL (
          SELECT m.conteudo, m.data_envio
          FROM mensagens m
          WHERE m.atendimento_id = a.atendimento_id
          ORDER BY m.xmin::text::bigint DESC, m.data_envio DESC NULLS LAST, m.mensagem_id DESC
          LIMIT 1
        ) lm ON TRUE
        WHERE a.atendimento_id <> current.atendimento_id
          AND (
            (current.cliente_id IS NOT NULL AND a.cliente_id = current.cliente_id)
            OR (
              current.cliente_id IS NULL
              AND a.cliente_id IS NULL
              AND COALESCE(a.whatsapp_chat_id, '') = COALESCE(current.whatsapp_chat_id, '')
            )
          )
        ORDER BY COALESCE(a.ultima_interacao_em, a.encerrado_em, a.iniciado_em) DESC NULLS LAST
      `,
      [conversationId],
    );

    if (historyResult.rows.length === 0) {
      return [];
    }

    const attendanceIds = historyResult.rows.map((row) => row.atendimento_id);
    const numericIdByAttendanceId = new Map(historyResult.rows.map((row) => [row.atendimento_id, Number(row.numeric_id)]));

    const messagesResult = await pool.query<HistoryMessageRow>(
      `
        SELECT
          m.atendimento_id::text AS atendimento_id,
          m.mensagem_id,
          abs(hashtext(m.mensagem_id::text)) AS numeric_id,
          m.conteudo,
          m.data_envio,
          m.direcao,
          m.remetente
        FROM mensagens m
        WHERE m.atendimento_id::text = ANY($1::text[])
        ORDER BY m.atendimento_id::text, m.xmin::text::bigint ASC, m.data_envio ASC NULLS LAST, m.mensagem_id ASC
      `,
      [attendanceIds],
    );

    const groupedMessages = new Map<string, Mensagem[]>();
    for (const row of messagesResult.rows) {
      const message: Mensagem = {
        id: Number(row.numeric_id),
        tipo: row.direcao === "SAIDA" ? "enviada" : "recebida",
        conteudo: row.conteudo,
        horario: row.data_envio ?? new Date().toISOString(),
        remetente: row.remetente ?? undefined,
        conversationId: numericIdByAttendanceId.get(row.atendimento_id),
      };

      const currentMessages = groupedMessages.get(row.atendimento_id) ?? [];
      currentMessages.push(message);
      groupedMessages.set(row.atendimento_id, currentMessages);
    }

    return historyResult.rows.map((row) => ({
      id: Number(row.numeric_id),
      cliente: row.cliente ?? row.telefone ?? "Cliente sem nome",
      telefone: row.telefone ?? "",
      contactId: row.canal?.toLowerCase() === "telegram" ? row.contact_id ?? "" : undefined,
      status: row.status === "ENCERRADO" ? "ENCERRADO" : row.status === "PENDENTE" ? "PENDENTE" : "ATIVO",
      ultima_mensagem: row.ultima_mensagem ?? "",
      horario: row.horario ?? new Date().toISOString(),
      iniciadoEm: row.iniciado_em ?? row.horario ?? new Date().toISOString(),
      encerradoEm: row.encerrado_em,
      ultimaInteracaoEm: row.ultima_interacao_em,
      channel: row.canal?.toLowerCase() === "telegram" ? "telegram" : "whatsapp",
      messages: groupedMessages.get(row.atendimento_id) ?? [],
    }));
  }
}
