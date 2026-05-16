import { randomUUID } from "node:crypto";
import { pool } from "../config/database.js";

type ConversationLeadSyncRow = {
  atendimento_id: string;
  lead_id: string | null;
  numeric_id: number;
  cliente_id: string | null;
  cliente_nome: string | null;
  cliente_telefone: string | null;
  canal: string;
  status: string | null;
  encaminhado_humano: boolean | null;
  ultima_intencao: string | null;
  estado_conversa: string | null;
  contato: string | null;
  ultima_interacao_em: string | null;
  has_attendant_reply: boolean | null;
  has_completed_order: boolean | null;
};

type LeadStatusDb = "NOVO" | "INTERESSADO" | "ENCAMINHADO_HUMANO" | "CONVERTIDO" | "ENCERRADO";

export class LeadStatusService {
  private ensurePromise?: Promise<void>;

  async updateLeadStatusFromConversation(conversationId: number): Promise<void> {
    await this.ensureSchema();

    const result = await pool.query<ConversationLeadSyncRow>(
      `
        SELECT
          a.atendimento_id::text,
          a.lead_id::text,
          abs(hashtext(a.atendimento_id::text)) AS numeric_id,
          a.cliente_id::text,
          c.nome AS cliente_nome,
          c.telefone AS cliente_telefone,
          upper(a.canal) AS canal,
          a.status,
          a.encaminhado_humano,
          a.ultima_intencao,
          a.estado_conversa,
          CASE
            WHEN upper(a.canal) = 'TELEGRAM' THEN a.telegram_chat_id
          END AS contato,
          COALESCE(a.ultima_interacao_em, a.iniciado_em) AS ultima_interacao_em,
          EXISTS (
            SELECT 1
            FROM mensagens m
            WHERE m.atendimento_id = a.atendimento_id
              AND upper(COALESCE(m.remetente, '')) = 'ATENDENTE'
          ) AS has_attendant_reply,
          EXISTS (
            SELECT 1
            FROM pedidos p
            WHERE p.cliente_id = a.cliente_id
              AND p.status = 'CONCLUIDO'
          ) AS has_completed_order
        FROM atendimentos a
        LEFT JOIN clientes c ON c.cliente_id = a.cliente_id
        WHERE abs(hashtext(a.atendimento_id::text)) = $1
          AND upper(a.canal) = 'TELEGRAM'
        LIMIT 1
      `,
      [conversationId],
    );

    const row = result.rows[0];
    if (!row) {
      return;
    }

    const contact = this.resolveContact(row);
    if (!contact) {
      return;
    }

    const leadId = row.lead_id ?? (await this.findLeadId(row.canal, contact, row.cliente_telefone));
    const status = this.resolveLeadStatus(row);
    const interest = this.resolveInterest(row);
    const origin = "TELEGRAM";
    const name = row.cliente_nome ?? "Cliente Telegram";

    if (leadId) {
      await pool.query(
        `
          UPDATE leads
          SET nome = COALESCE($2, nome),
              telefone = $3,
              interesse_produto = CASE
                WHEN NULLIF(BTRIM($4::text), '') IS NULL THEN interesse_produto
                WHEN interesse_produto IS NULL OR BTRIM(interesse_produto) = '' THEN BTRIM($4::text)
                WHEN EXISTS (
                  SELECT 1
                  FROM unnest(string_to_array(interesse_produto, ' | ')) AS interest_item(value)
                  WHERE LOWER(BTRIM(interest_item.value)) = LOWER(BTRIM($4::text))
                ) THEN interesse_produto
                ELSE concat_ws(' | ', interesse_produto, BTRIM($4::text))
              END,
              status = CASE
                WHEN status IN ('CONVERTIDO', 'ENCERRADO') AND $5 NOT IN ('CONVERTIDO', 'ENCERRADO') THEN status
                ELSE $5
              END,
              origem = $6,
              atualizado_em = NOW()
          WHERE lead_id = $1::uuid
        `,
        [leadId, name, contact, interest, status, origin],
      );

      await this.linkConversation(row.atendimento_id, leadId);
      return;
    }

    const createdLeadId = randomUUID();
    await pool.query(
      `
        INSERT INTO leads (lead_id, nome, telefone, interesse_produto, status, origem, criado_em, atualizado_em)
        VALUES ($1::uuid, $2, $3, $4, $5, $6, COALESCE($7::timestamp, NOW()), NOW())
      `,
      [createdLeadId, name, contact, interest, status, origin, row.ultima_interacao_em],
    );
    await this.linkConversation(row.atendimento_id, createdLeadId);
  }

  private resolveContact(row: ConversationLeadSyncRow): string | null {
    return row.contato?.trim() || row.cliente_telefone?.replace(/^telegram:/, "").trim() || null;
  }

  private async findLeadId(channel: string, contact: string, customerPhone: string | null): Promise<string | null> {
    const result = await pool.query<{ lead_id: string }>(
      `
        SELECT lead_id::text
        FROM leads
        WHERE telefone = $1
          OR ($2 = 'TELEGRAM' AND telefone = $3)
          OR ($2 = 'TELEGRAM' AND telefone = concat('telegram:', $1))
        ORDER BY atualizado_em DESC NULLS LAST, criado_em DESC
        LIMIT 1
      `,
      [contact, channel, customerPhone?.replace(/^telegram:/, "") ?? contact],
    );

    return result.rows[0]?.lead_id ?? null;
  }

  private resolveLeadStatus(row: ConversationLeadSyncRow): LeadStatusDb {
    if (row.has_completed_order) {
      return "CONVERTIDO";
    }

    if (row.has_attendant_reply) {
      return "INTERESSADO";
    }

    if (row.encaminhado_humano || row.status === "PENDENTE" || row.estado_conversa === "ENCAMINHADO_HUMANO") {
      return "ENCAMINHADO_HUMANO";
    }

    if (row.status === "ENCERRADO") {
      return "ENCERRADO";
    }

    if (row.ultima_intencao === "lead_interest") {
      return "INTERESSADO";
    }

    return "NOVO";
  }

  private resolveInterest(row: ConversationLeadSyncRow): string | null {
    if (row.ultima_intencao === "human_handoff") {
      return null;
    }

    if (row.ultima_intencao === "lead_interest") {
      return "Demonstrou interesse em produto";
    }

    if (row.ultima_intencao === "promotions") {
      return "Consultou promocoes";
    }

    if (row.ultima_intencao === "products") {
      return "Consultou produtos";
    }

    return null;
  }

  private async linkConversation(atendimentoId: string, leadId: string): Promise<void> {
    await pool.query(
      `
        UPDATE atendimentos
        SET lead_id = $2::uuid
        WHERE atendimento_id = $1::uuid
          AND lead_id IS DISTINCT FROM $2::uuid
      `,
      [atendimentoId, leadId],
    );
  }

  private async ensureSchema(): Promise<void> {
    if (!this.ensurePromise) {
      this.ensurePromise = pool.query(`
        ALTER TABLE leads
        ALTER COLUMN interesse_produto TYPE text
      `).then(() => undefined);
    }

    return this.ensurePromise;
  }
}
