import { pool } from "../../config/database.js";
import type { Atendimento, Mensagem } from "../../types/domain.js";
import type { ConversationsRepository } from "../conversations.repository.js";

type ConversationRow = {
  atendimento_id: string;
  numeric_id: number;
  cliente: string | null;
  telefone: string | null;
  status: string | null;
  ultima_mensagem: string | null;
  horario: string | null;
  canal: string | null;
};

type MessageRow = {
  mensagem_id: string;
  numeric_id: number;
  conteudo: string;
  data_envio: string | null;
  direcao: string | null;
  remetente: string | null;
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
          c.nome AS cliente,
          c.telefone,
          a.status,
          a.canal,
          lm.conteudo AS ultima_mensagem,
          COALESCE(lm.data_envio, a.ultima_interacao_em, a.iniciado_em) AS horario
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
      status: row.status === "ENCERRADO" ? "ENCERRADO" : row.status === "PENDENTE" ? "PENDENTE" : "ATIVO",
      ultima_mensagem: row.ultima_mensagem ?? "",
      horario: row.horario ?? new Date().toISOString(),
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
}
