import { type PoolClient } from "pg";
import { pool } from "../../config/database.js";
import type { Atendimento, AtendimentoStatus, Mensagem } from "../../types/domain.js";
import type {
  ConversationAutomationState,
  SaveIncomingMessageInput,
  SaveOutgoingMessageInput,
  WhatsAppConversationRecord,
  WhatsAppRepository,
} from "../whatsapp.repository.js";

type ConversationRow = {
  atendimento_id: string;
  numeric_id: number;
  telefone: string | null;
  cliente: string | null;
  status: string | null;
  ultima_mensagem: string | null;
  horario: string | null;
};

type MessageRow = {
  mensagem_id: string;
  numeric_id: number;
  conteudo: string;
  data_envio: string | null;
  direcao: string | null;
  remetente: string | null;
};

type ConversationIdentityRow = {
  atendimento_id: string;
  numeric_id: number;
  telefone: string | null;
  cliente: string | null;
};

type ConversationAutomationRow = {
  atendimento_id: string;
  numeric_id: number;
  telefone: string | null;
  cliente: string | null;
  status: string | null;
  encaminhado_humano: boolean | null;
  estado_conversa: string | null;
  ultima_intencao: string | null;
};

function isMeaningfulCustomerName(name: string | null | undefined): boolean {
  if (!name) {
    return false;
  }

  const normalized = name.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  if (["cliente whatsapp", "cliente sem nome", "contato whatsapp", "contato sem nome"].includes(normalized)) {
    return false;
  }

  return true;
}

function getConversationDisplayName(name: string | null | undefined, phone: string | null | undefined): string {
  if (isMeaningfulCustomerName(name)) {
    return name!.trim();
  }

  if (phone && phone.trim()) {
    return phone.trim();
  }

  return "Cliente sem nome";
}

export class PostgresWhatsAppRepository implements WhatsAppRepository {
  async saveIncomingMessage(input: SaveIncomingMessageInput): Promise<WhatsAppConversationRecord> {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      const conversation = await this.ensureConversation(client, input.phone, {
        customerName: input.customerName,
        status: input.status ?? "ATIVO",
        handoffRequested: input.handoffRequested,
        intent: input.intent,
        stage: input.stage,
      });

      await client.query(
        `
          INSERT INTO mensagens (
            mensagem_id,
            atendimento_id,
            conteudo,
            data_envio,
            remetente,
            whatsapp_message_id,
            tipo_mensagem,
            status_entrega,
            direcao
          )
          VALUES (
            gen_random_uuid(),
            $1,
            $2,
            $3,
            'CLIENTE',
            $4,
            'text',
            'RECEBIDA',
            'ENTRADA'
          )
        `,
        [conversation.atendimentoUuid, input.text, this.resolveTimestamp(input.timestamp), input.messageId],
      );

      await this.touchConversation(client, conversation.atendimentoUuid, {
        status: input.status ?? "ATIVO",
        handoffRequested: input.handoffRequested,
        intent: input.intent,
        stage: input.stage,
      });

      await client.query("COMMIT");

      return {
        atendimentoId: conversation.numericId,
        telefone: conversation.phone,
        cliente: getConversationDisplayName(conversation.customerName, conversation.phone),
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async saveOutgoingMessage(input: SaveOutgoingMessageInput): Promise<Mensagem> {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      const conversation =
        input.atendimentoId !== undefined
          ? await this.findConversationIdentityById(client, input.atendimentoId)
          : await this.ensureConversation(client, input.phone, {
              customerName: undefined,
              status: input.handoffRequested ? "PENDENTE" : "ATIVO",
              handoffRequested: input.handoffRequested,
              intent: input.intent,
              stage: input.stage,
            });

      if (!conversation) {
        throw new Error("Conversation not found");
      }

      const inserted = await client.query<MessageRow>(
        `
          INSERT INTO mensagens (
            mensagem_id,
            atendimento_id,
            conteudo,
            data_envio,
            remetente,
            whatsapp_message_id,
            tipo_mensagem,
            status_entrega,
            direcao
          )
          VALUES (
            gen_random_uuid(),
            $1,
            $2,
            $3,
            $4,
            $5,
            'text',
            $6,
            'SAIDA'
          )
          RETURNING mensagem_id, abs(hashtext(mensagem_id::text)) AS numeric_id, conteudo, data_envio, direcao, remetente
        `,
        [
          conversation.atendimentoUuid,
          input.text,
          this.resolveTimestamp(input.timestamp),
          input.remetente ?? "CHATBOT",
          input.messageId ?? null,
          input.statusEntrega ?? "ENVIADA",
        ],
      );

      await this.touchConversation(client, conversation.atendimentoUuid, {
        status: input.handoffRequested ? "PENDENTE" : "ATIVO",
        handoffRequested: input.handoffRequested,
        intent: input.intent,
        stage: input.stage,
      });

      await client.query("COMMIT");
      return this.mapMessageRow(inserted.rows[0]!);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async listConversations(): Promise<Atendimento[]> {
    const result = await pool.query<ConversationRow>(`
      SELECT
        a.atendimento_id,
        abs(hashtext(a.atendimento_id::text)) AS numeric_id,
        c.telefone,
        c.nome AS cliente,
        a.status,
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
      WHERE a.canal = 'WHATSAPP'
      ORDER BY COALESCE(a.ultima_interacao_em, lm.data_envio, a.iniciado_em) DESC NULLS LAST
    `);

    return result.rows.map((row) => this.mapConversationRow(row));
  }

  async listMessages(atendimentoId: number): Promise<Mensagem[]> {
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
      [atendimentoId],
    );

    return result.rows.map((row) => this.mapMessageRow(row));
  }

  async findConversationById(atendimentoId: number): Promise<WhatsAppConversationRecord | null> {
    const result = await pool.query<ConversationIdentityRow>(
      `
        SELECT
          a.atendimento_id,
          abs(hashtext(a.atendimento_id::text)) AS numeric_id,
          c.telefone,
          c.nome AS cliente
        FROM atendimentos a
        LEFT JOIN clientes c ON c.cliente_id = a.cliente_id
        WHERE a.canal = 'WHATSAPP'
          AND abs(hashtext(a.atendimento_id::text)) = $1
        LIMIT 1
      `,
      [atendimentoId],
    );

    const row = result.rows[0];
    return row
      ? {
          atendimentoId: Number(row.numeric_id),
          telefone: row.telefone ?? "",
          cliente: getConversationDisplayName(row.cliente, row.telefone),
        }
      : null;
  }

  async getConversationAutomationStateByPhone(phone: string): Promise<ConversationAutomationState | null> {
    const result = await pool.query<ConversationAutomationRow>(
      `
        SELECT
          a.atendimento_id,
          abs(hashtext(a.atendimento_id::text)) AS numeric_id,
          c.telefone,
          c.nome AS cliente,
          a.status,
          a.encaminhado_humano,
          a.estado_conversa,
          a.ultima_intencao
        FROM atendimentos a
        LEFT JOIN clientes c ON c.cliente_id = a.cliente_id
        WHERE a.canal = 'WHATSAPP'
          AND (a.whatsapp_chat_id = $1 OR c.telefone = $1)
        ORDER BY a.ultima_interacao_em DESC NULLS LAST, a.iniciado_em DESC
        LIMIT 1
      `,
      [phone],
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      atendimentoId: Number(row.numeric_id),
      telefone: row.telefone ?? phone,
      customerName: row.cliente,
      status: this.mapConversationStatus(row.status),
      handoffRequested: Boolean(row.encaminhado_humano),
      stage: row.estado_conversa,
      intent: row.ultima_intencao,
    };
  }

  async updateConversationStatus(atendimentoId: number, status: AtendimentoStatus): Promise<Atendimento | null> {
    const updated = await pool.query(
      `
        UPDATE atendimentos
        SET status = $2::varchar,
            encaminhado_humano = CASE
              WHEN $2::varchar IN ('ATIVO', 'ENCERRADO') THEN FALSE
              WHEN $2::varchar = 'PENDENTE' THEN TRUE
              ELSE encaminhado_humano
            END,
            estado_conversa = CASE
              WHEN $2::varchar IN ('ATIVO', 'ENCERRADO') THEN 'IDLE'
              WHEN $2::varchar = 'PENDENTE' THEN 'ENCAMINHADO_HUMANO'
              ELSE estado_conversa
            END,
            ultima_interacao_em = NOW()
        WHERE canal = 'WHATSAPP'
          AND abs(hashtext(atendimento_id::text)) = $1
      `,
      [atendimentoId, status],
    );

    if ((updated.rowCount ?? 0) === 0) {
      return null;
    }

    const result = await pool.query<ConversationRow>(
      `
        SELECT
          a.atendimento_id,
          abs(hashtext(a.atendimento_id::text)) AS numeric_id,
          c.telefone,
          c.nome AS cliente,
          a.status,
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
        WHERE a.canal = 'WHATSAPP'
          AND abs(hashtext(a.atendimento_id::text)) = $1
        LIMIT 1
      `,
      [atendimentoId],
    );

    const row = result.rows[0];
    return row ? this.mapConversationRow(row) : null;
  }

  async updateCustomerNameByPhone(phone: string, name: string): Promise<void> {
    const normalizedName = name.trim();
    if (!normalizedName) {
      return;
    }

    await pool.query(
      `
        UPDATE clientes
        SET nome = $2,
            atualizado_em = NOW()
        WHERE telefone = $1
      `,
      [phone, normalizedName],
    );
  }

  private async ensureConversation(
    client: PoolClient,
    phone: string,
    options: {
      customerName?: string;
      status: AtendimentoStatus;
      handoffRequested?: boolean;
      intent?: string;
      stage?: string;
    },
  ): Promise<{ atendimentoUuid: string; numericId: number; phone: string; customerName: string }> {
    const customer = await this.ensureCustomer(client, phone, options.customerName);

    const existing = await client.query<ConversationIdentityRow>(
      `
        SELECT
          a.atendimento_id,
          abs(hashtext(a.atendimento_id::text)) AS numeric_id,
          c.telefone,
          c.nome AS cliente
        FROM atendimentos a
        LEFT JOIN clientes c ON c.cliente_id = a.cliente_id
        WHERE a.canal = 'WHATSAPP'
          AND (a.whatsapp_chat_id = $1 OR c.telefone = $1)
        ORDER BY a.ultima_interacao_em DESC NULLS LAST, a.iniciado_em DESC
        LIMIT 1
      `,
      [phone],
    );

    const leadId = await this.findLeadIdByPhone(client, phone);

    if (existing.rows[0]) {
      const row = existing.rows[0]!;
      await client.query(
        `
          UPDATE atendimentos
          SET cliente_id = $2,
              status = $3,
              encaminhado_humano = COALESCE($4, encaminhado_humano),
              lead_id = COALESCE($5, lead_id),
              ultima_intencao = COALESCE($6, ultima_intencao),
              estado_conversa = COALESCE($7, estado_conversa),
              ultima_interacao_em = NOW(),
              whatsapp_chat_id = $1
          WHERE atendimento_id = $8
        `,
        [phone, customer.customerId, options.status, options.handoffRequested, leadId, options.intent ?? null, options.stage ?? null, row.atendimento_id],
      );

      return {
        atendimentoUuid: row.atendimento_id,
        numericId: Number(row.numeric_id),
        phone: customer.phone,
        customerName: customer.name,
      };
    }

    const inserted = await client.query<{ atendimento_id: string; numeric_id: number }>(
      `
        INSERT INTO atendimentos (
          atendimento_id,
          cliente_id,
          canal,
          status,
          iniciado_em,
          encaminhado_humano,
          lead_id,
          ultima_intencao,
          estado_conversa,
          ultima_interacao_em,
          whatsapp_chat_id
        )
        VALUES (
          gen_random_uuid(),
          $1,
          'WHATSAPP',
          $2,
          NOW(),
          $3,
          $4,
          $5,
          $6,
          NOW(),
          $7
        )
        RETURNING atendimento_id, abs(hashtext(atendimento_id::text)) AS numeric_id
      `,
      [customer.customerId, options.status, options.handoffRequested ?? false, leadId, options.intent ?? null, options.stage ?? null, phone],
    );

    return {
      atendimentoUuid: inserted.rows[0]!.atendimento_id,
      numericId: Number(inserted.rows[0]!.numeric_id),
      phone: customer.phone,
      customerName: customer.name,
    };
  }

  private async ensureCustomer(
    client: PoolClient,
    phone: string,
    customerName?: string,
  ): Promise<{ customerId: string; phone: string; name: string }> {
    const existing = await client.query<{ cliente_id: string; nome: string | null; telefone: string }>(
      `
        SELECT cliente_id, nome, telefone
        FROM clientes
        WHERE telefone = $1
        ORDER BY atualizado_em DESC NULLS LAST, criado_em DESC
        LIMIT 1
      `,
      [phone],
    );

    if (existing.rows[0]) {
      const row = existing.rows[0]!;
      const nextName = isMeaningfulCustomerName(customerName)
        ? customerName!.trim()
        : row.nome || "Cliente WhatsApp";
      await client.query(
        `
          UPDATE clientes
          SET nome = $2,
              atualizado_em = NOW()
          WHERE cliente_id = $1
        `,
        [row.cliente_id, nextName],
      );

      return {
        customerId: row.cliente_id,
        phone: row.telefone,
        name: nextName,
      };
    }

    const inserted = await client.query<{ cliente_id: string }>(
      `
        INSERT INTO clientes (cliente_id, nome, telefone, criado_em, atualizado_em)
        VALUES (gen_random_uuid(), $1, $2, NOW(), NOW())
        RETURNING cliente_id
      `,
      [isMeaningfulCustomerName(customerName) ? customerName!.trim() : "Cliente WhatsApp", phone],
    );

    return {
      customerId: inserted.rows[0]!.cliente_id,
      phone,
      name: isMeaningfulCustomerName(customerName) ? customerName!.trim() : "Cliente WhatsApp",
    };
  }

  private async findLeadIdByPhone(client: PoolClient, phone: string): Promise<string | null> {
    const result = await client.query<{ lead_id: string }>(
      `
        SELECT lead_id
        FROM leads
        WHERE telefone = $1
        ORDER BY atualizado_em DESC NULLS LAST, criado_em DESC
        LIMIT 1
      `,
      [phone],
    );

    return result.rows[0]?.lead_id ?? null;
  }

  private async findConversationIdentityById(
    client: PoolClient,
    atendimentoId: number,
  ): Promise<{ atendimentoUuid: string; numericId: number; phone: string; customerName: string } | null> {
    const result = await client.query<ConversationIdentityRow>(
      `
        SELECT
          a.atendimento_id,
          abs(hashtext(a.atendimento_id::text)) AS numeric_id,
          c.telefone,
          c.nome AS cliente
        FROM atendimentos a
        LEFT JOIN clientes c ON c.cliente_id = a.cliente_id
        WHERE a.canal = 'WHATSAPP'
          AND abs(hashtext(a.atendimento_id::text)) = $1
        LIMIT 1
      `,
      [atendimentoId],
    );

    const row = result.rows[0];
    return row
      ? {
          atendimentoUuid: row.atendimento_id,
          numericId: Number(row.numeric_id),
          phone: row.telefone ?? "",
          customerName: getConversationDisplayName(row.cliente, row.telefone),
        }
      : null;
  }

  private async touchConversation(
    client: PoolClient,
    atendimentoUuid: string,
    options: {
      status?: AtendimentoStatus;
      handoffRequested?: boolean;
      intent?: string;
      stage?: string;
    },
  ): Promise<void> {
    await client.query(
      `
        UPDATE atendimentos
        SET status = COALESCE($2, status),
            encaminhado_humano = COALESCE($3, encaminhado_humano),
            ultima_intencao = COALESCE($4, ultima_intencao),
            estado_conversa = COALESCE($5, estado_conversa),
            ultima_interacao_em = NOW()
        WHERE atendimento_id = $1
      `,
      [atendimentoUuid, options.status ?? null, options.handoffRequested, options.intent ?? null, options.stage ?? null],
    );
  }

  private mapConversationRow(row: ConversationRow): Atendimento {
    return {
      id: Number(row.numeric_id),
      cliente: getConversationDisplayName(row.cliente, row.telefone),
      telefone: row.telefone ?? "",
      status: this.mapConversationStatus(row.status),
      ultima_mensagem: row.ultima_mensagem ?? "",
      horario: row.horario ?? new Date().toISOString(),
    };
  }

  private mapConversationStatus(value: string | null): AtendimentoStatus {
    if (value === "ENCERRADO") return "ENCERRADO";
    if (value === "PENDENTE") return "PENDENTE";
    return "ATIVO";
  }

  private mapMessageRow(row: MessageRow): Mensagem {
    return {
      id: Number(row.numeric_id),
      tipo: row.direcao === "SAIDA" ? "enviada" : "recebida",
      conteudo: row.conteudo,
      horario: row.data_envio ?? new Date().toISOString(),
      remetente: row.remetente ?? undefined,
    };
  }

  private resolveTimestamp(timestamp?: string): string {
    if (!timestamp) {
      return new Date().toISOString();
    }

    if (/^\d+$/.test(timestamp)) {
      return new Date(Number(timestamp) * 1000).toISOString();
    }

    const parsed = new Date(timestamp);
    return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  }
}
