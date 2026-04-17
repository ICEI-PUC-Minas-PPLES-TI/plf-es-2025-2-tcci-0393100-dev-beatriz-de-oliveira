import { type PoolClient } from "pg";
import { pool } from "../../config/database.js";
import type { Mensagem } from "../../types/domain.js";
import type {
  SaveTelegramIncomingMessageInput,
  SaveTelegramOutgoingMessageInput,
  TelegramConversationRecord,
  TelegramRepository,
} from "../telegram.repository.js";

function formatErrorDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      code: "code" in error ? String((error as { code?: unknown }).code) : undefined,
      detail: "detail" in error ? String((error as { detail?: unknown }).detail) : undefined,
      constraint: "constraint" in error ? String((error as { constraint?: unknown }).constraint) : undefined,
    };
  }

  return {
    message: String(error),
    stack: undefined,
    code: undefined,
    detail: undefined,
    constraint: undefined,
  };
}

type ConversationIdentityRow = {
  atendimento_id: string;
  numeric_id: number;
  cliente_id?: string | null;
  telefone: string | null;
  cliente: string | null;
  lead_id?: string | null;
  chat_id?: string | null;
};

type MessageRow = {
  mensagem_id: string;
  numeric_id: number;
  conteudo: string;
  data_envio: string | null;
  direcao: string | null;
  remetente: string | null;
};

function isMeaningfulCustomerName(name: string | null | undefined): boolean {
  if (!name) {
    return false;
  }

  const normalized = name.trim().toLowerCase();
  return Boolean(normalized) && normalized !== "cliente telegram";
}

function getConversationDisplayName(name: string | null | undefined, contactId: string | null | undefined): string {
  if (isMeaningfulCustomerName(name)) {
    return name!.trim();
  }

  if (contactId && contactId.trim()) {
    return contactId.trim();
  }

  return "Cliente Telegram";
}

export class PostgresTelegramRepository implements TelegramRepository {
  async saveIncomingMessage(input: SaveTelegramIncomingMessageInput): Promise<TelegramConversationRecord> {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      console.info("[TelegramRepository] inbound_persist_begin", {
        chatId: input.chatId,
        messageId: input.messageId,
        timestamp: input.timestamp,
        customerName: input.customerName,
        preview: input.text.slice(0, 80),
      });
      const conversation = await this.ensureConversation(client, input.chatId, input.customerName);
      console.info("[TelegramRepository] inbound_conversation_resolved", {
        chatId: input.chatId,
        atendimentoId: conversation.numericId,
        atendimentoUuid: conversation.atendimentoUuid,
        atendimentoIdValid: Number.isInteger(conversation.numericId) && conversation.numericId > 0,
      });
      console.info("[TelegramRepository] inbound_message_insert_attempt", {
        atendimentoId: conversation.numericId,
        atendimentoUuid: conversation.atendimentoUuid,
        channel: "TELEGRAM",
        remetente: "CLIENTE",
        direcao: "ENTRADA",
        tipoMensagem: "text",
        statusEntrega: "RECEBIDA",
        preview: input.text.slice(0, 80),
        timestamp: this.resolveTimestamp(input.timestamp),
      });

      await client.query(
        `
          INSERT INTO mensagens (
            mensagem_id,
            atendimento_id,
            conteudo,
            data_envio,
            remetente,
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
            'text',
            'RECEBIDA',
            'ENTRADA'
          )
        `,
        [conversation.atendimentoUuid, input.text, this.resolveTimestamp(input.timestamp)],
      );

      await this.touchConversation(client, conversation.atendimentoUuid);
      await client.query("COMMIT");

      console.info("[TelegramRepository] inbound_message_saved", {
        atendimentoId: conversation.numericId,
        channel: "TELEGRAM",
        contactId: conversation.contactId,
        customerName: conversation.customerName,
      });

      return {
        atendimentoId: conversation.numericId,
        contactId: conversation.contactId,
        cliente: getConversationDisplayName(conversation.customerName, conversation.contactId),
      };
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("[TelegramRepository] inbound_message_save_failed", {
        chatId: input.chatId,
        messageId: input.messageId,
        ...formatErrorDetails(error),
      });
      throw error;
    } finally {
      client.release();
    }
  }

  async saveOutgoingMessage(input: SaveTelegramOutgoingMessageInput): Promise<Mensagem> {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      console.info("[TelegramRepository] outbound_persist_begin", {
        chatId: input.chatId,
        messageId: input.messageId,
        timestamp: input.timestamp,
        type: input.type ?? "text",
        statusEntrega: input.statusEntrega ?? "ENVIADA",
        preview: input.text.slice(0, 80),
      });
      const conversation = await this.ensureConversation(client, input.chatId);
      console.info("[TelegramRepository] outbound_conversation_resolved", {
        chatId: input.chatId,
        atendimentoId: conversation.numericId,
        atendimentoUuid: conversation.atendimentoUuid,
        atendimentoIdValid: Number.isInteger(conversation.numericId) && conversation.numericId > 0,
      });
      console.info("[TelegramRepository] outbound_message_insert_attempt", {
        atendimentoId: conversation.numericId,
        atendimentoUuid: conversation.atendimentoUuid,
        channel: "TELEGRAM",
        remetente: "CHATBOT",
        direcao: "SAIDA",
        tipoMensagem: input.type ?? "text",
        statusEntrega: input.statusEntrega ?? "ENVIADA",
        preview: input.text.slice(0, 80),
        timestamp: this.resolveTimestamp(input.timestamp),
      });

      const inserted = await client.query<MessageRow>(
        `
          INSERT INTO mensagens (
            mensagem_id,
            atendimento_id,
            conteudo,
            data_envio,
            remetente,
            tipo_mensagem,
            status_entrega,
            direcao
          )
          VALUES (
            gen_random_uuid(),
            $1,
            $2,
            $3,
            'CHATBOT',
            $4,
            $5,
            'SAIDA'
          )
          RETURNING mensagem_id, abs(hashtext(mensagem_id::text)) AS numeric_id, conteudo, data_envio, direcao, remetente
        `,
        [conversation.atendimentoUuid, input.text, this.resolveTimestamp(input.timestamp), input.type ?? "text", input.statusEntrega ?? "ENVIADA"],
      );

      await this.touchConversation(client, conversation.atendimentoUuid);
      await client.query("COMMIT");
      console.info("[TelegramRepository] outbound_message_saved", {
        atendimentoId: conversation.numericId,
        channel: "TELEGRAM",
        contactId: conversation.contactId,
        type: input.type ?? "text",
      });
      return {
        ...this.mapMessageRow(inserted.rows[0]!),
        conversationId: conversation.numericId,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("[TelegramRepository] outbound_message_save_failed", {
        chatId: input.chatId,
        ...formatErrorDetails(error),
      });
      throw error;
    } finally {
      client.release();
    }
  }

  async updateCustomerNameByChatId(chatId: string, name: string): Promise<void> {
    const normalizedName = name.trim();
    if (!normalizedName) {
      return;
    }

    await pool.query(
      `
        UPDATE clientes c
        SET nome = $2,
            atualizado_em = NOW()
        WHERE c.telefone = $1
           OR c.cliente_id IN (
             SELECT a.cliente_id
             FROM atendimentos a
             WHERE a.canal = 'TELEGRAM'
               AND a.whatsapp_chat_id = $1
           )
      `,
      [chatId, normalizedName],
    );
  }

  private async ensureConversation(
    client: PoolClient,
    chatId: string,
    customerName?: string,
  ): Promise<{ atendimentoUuid: string; numericId: number; contactId: string; customerName: string }> {
    const existing = await client.query<ConversationIdentityRow>(
      `
        SELECT
          a.atendimento_id,
          abs(hashtext(a.atendimento_id::text)) AS numeric_id,
          a.cliente_id::text AS cliente_id,
          c.telefone,
          c.nome AS cliente,
          a.whatsapp_chat_id AS chat_id
        FROM atendimentos a
        LEFT JOIN clientes c ON c.cliente_id = a.cliente_id
        WHERE a.canal = 'TELEGRAM'
          AND (a.whatsapp_chat_id = $1 OR c.telefone = $1)
        ORDER BY a.ultima_interacao_em DESC NULLS LAST, a.iniciado_em DESC
        LIMIT 1
      `,
      [chatId],
    );

    if (existing.rows[0]) {
      const row = existing.rows[0]!;
      console.info("[TelegramRepository] conversation_lookup_hit", {
        chatId,
        atendimentoId: Number(row.numeric_id),
        atendimentoUuid: row.atendimento_id,
        clienteId: row.cliente_id,
        storedChatId: row.chat_id,
      });
      const customer = await this.ensureCustomer(client, chatId, customerName, row.cliente_id ?? undefined);
      const leadId = await this.findLeadIdByContactId(client, chatId);
      await client.query(
        `
          UPDATE atendimentos
          SET cliente_id = $2,
              lead_id = COALESCE($3, lead_id),
              whatsapp_chat_id = $4,
              status = 'ATIVO',
              ultima_interacao_em = NOW()
          WHERE atendimento_id = $1
        `,
        [row.atendimento_id, customer.customerId, leadId, chatId],
      );

      console.info("[TelegramRepository] conversation_reused", {
        atendimentoId: Number(row.numeric_id),
        channel: "TELEGRAM",
        contactId: customer.contactId,
        leadLinked: Boolean(leadId),
      });

      return {
        atendimentoUuid: row.atendimento_id,
        numericId: Number(row.numeric_id),
        contactId: customer.contactId,
        customerName: customer.name,
      };
    }

    console.info("[TelegramRepository] conversation_lookup_miss", {
      chatId,
    });
    const customer = await this.ensureCustomer(client, chatId, customerName);
    const leadId = await this.findLeadIdByContactId(client, chatId);

    const inserted = await client.query<{ atendimento_id: string; numeric_id: number }>(
      `
        INSERT INTO atendimentos (
          atendimento_id,
          cliente_id,
          canal,
          status,
          iniciado_em,
          ultima_interacao_em,
          lead_id,
          whatsapp_chat_id
        )
        VALUES (
          gen_random_uuid(),
          $1,
          'TELEGRAM',
          'ATIVO',
          NOW(),
          NOW(),
          $2,
          $3
        )
        RETURNING atendimento_id, abs(hashtext(atendimento_id::text)) AS numeric_id
      `,
      [customer.customerId, leadId, chatId],
    );

    console.info("[TelegramRepository] conversation_created", {
      atendimentoId: Number(inserted.rows[0]!.numeric_id),
      channel: "TELEGRAM",
      contactId: customer.contactId,
      leadLinked: Boolean(leadId),
    });

    return {
      atendimentoUuid: inserted.rows[0]!.atendimento_id,
      numericId: Number(inserted.rows[0]!.numeric_id),
      contactId: customer.contactId,
      customerName: customer.name,
    };
  }

  private async findLeadIdByContactId(client: PoolClient, contactId: string): Promise<string | null> {
    const result = await client.query<{ lead_id: string }>(
      `
        SELECT lead_id
        FROM leads
        WHERE telefone = $1
        ORDER BY atualizado_em DESC NULLS LAST, criado_em DESC
        LIMIT 1
      `,
      [contactId],
    );

    return result.rows[0]?.lead_id ?? null;
  }

  private async ensureCustomer(
    client: PoolClient,
    chatId: string,
    customerName?: string,
    existingCustomerId?: string,
  ): Promise<{ customerId: string; contactId: string; name: string }> {
    if (existingCustomerId) {
      const nextName = isMeaningfulCustomerName(customerName) ? customerName!.trim() : "Cliente Telegram";
      await client.query(
        `
          UPDATE clientes
          SET nome = COALESCE($2, nome),
              atualizado_em = NOW()
          WHERE cliente_id = $1::uuid
        `,
        [existingCustomerId, nextName],
      );

      return {
        customerId: existingCustomerId,
        contactId: chatId,
        name: nextName,
      };
    }

    const existing = await client.query<{ cliente_id: string; nome: string | null; telefone: string }>(
      `
        SELECT cliente_id, nome, telefone
        FROM clientes
        WHERE telefone = $1
        ORDER BY atualizado_em DESC NULLS LAST, criado_em DESC
        LIMIT 1
      `,
      [chatId],
    );

    if (existing.rows[0]) {
      const row = existing.rows[0]!;
      const nextName = isMeaningfulCustomerName(customerName) ? customerName!.trim() : row.nome || "Cliente Telegram";
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
        contactId: row.telefone,
        name: nextName,
      };
    }

    const inserted = await client.query<{ cliente_id: string }>(
      `
        INSERT INTO clientes (cliente_id, nome, telefone, criado_em, atualizado_em)
        VALUES (gen_random_uuid(), $1, $2, NOW(), NOW())
        RETURNING cliente_id
      `,
      [isMeaningfulCustomerName(customerName) ? customerName!.trim() : "Cliente Telegram", null],
    );

    return {
      customerId: inserted.rows[0]!.cliente_id,
      contactId: chatId,
      name: isMeaningfulCustomerName(customerName) ? customerName!.trim() : "Cliente Telegram",
    };
  }

  private async touchConversation(client: PoolClient, atendimentoUuid: string): Promise<void> {
    await client.query(
      `
        UPDATE atendimentos
        SET ultima_interacao_em = NOW(),
            status = 'ATIVO'
        WHERE atendimento_id = $1
      `,
      [atendimentoUuid],
    );
    console.info("[TelegramRepository] conversation_touched", {
      atendimentoUuid,
      channel: "TELEGRAM",
    });
  }

  private mapMessageRow(row: MessageRow): Mensagem {
    return {
      id: Number(row.numeric_id),
      tipo: row.direcao === "SAIDA" ? "enviada" : "recebida",
      conteudo: row.conteudo,
      horario: row.data_envio ?? new Date().toISOString(),
      remetente: row.remetente ?? undefined,
      channel: "telegram",
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
