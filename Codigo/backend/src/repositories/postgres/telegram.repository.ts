import { type PoolClient } from "pg";
import { pool } from "../../config/database.js";
import type { Atendimento, AtendimentoStatus, Mensagem } from "../../types/domain.js";
import type {
  SaveTelegramIncomingMessageInput,
  SaveTelegramOutgoingMessageInput,
  TelegramConversationAutomationState,
  TelegramConversationRecord,
  TelegramRepository,
} from "../telegram.repository.js";

type ConversationIdentityRow = {
  atendimento_id: string;
  numeric_id: number;
  chat_id: string | null;
  cliente: string | null;
  status?: string | null;
};

type MessageRow = {
  mensagem_id: string;
  numeric_id: number;
  conteudo: string;
  data_envio: string | null;
  direcao: string | null;
  remetente: string | null;
};

type ConversationRow = {
  atendimento_id: string;
  numeric_id: number;
  chat_id: string | null;
  cliente: string | null;
  status: string | null;
  ultima_mensagem: string | null;
  horario: string | null;
  encaminhado_humano: boolean | null;
  estado_conversa: string | null;
  ultima_intencao: string | null;
};

function isMeaningfulCustomerName(name: string | null | undefined): boolean {
  return Boolean(name && name.trim());
}

function mapConversationStatus(value: string | null): AtendimentoStatus {
  if (value === "ENCERRADO") return "ENCERRADO";
  if (value === "PENDENTE") return "PENDENTE";
  return "ATIVO";
}

export class PostgresTelegramRepository implements TelegramRepository {
  async saveIncomingMessage(input: SaveTelegramIncomingMessageInput): Promise<TelegramConversationRecord> {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      const conversation = await this.ensureConversation(client, input.chatId, input.customerName, {
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
        chatId: conversation.chatId,
        cliente: conversation.customerName,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async saveOutgoingMessage(input: SaveTelegramOutgoingMessageInput): Promise<Mensagem> {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      const conversation = await this.ensureConversation(client, input.chatId, undefined, {
        status: input.status ?? "ATIVO",
        handoffRequested: input.handoffRequested,
        intent: input.intent,
        stage: input.stage,
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
            NOW(),
            $3,
            $4,
            $5,
            'SAIDA'
          )
          RETURNING mensagem_id, abs(hashtext(mensagem_id::text)) AS numeric_id, conteudo, data_envio, direcao, remetente
        `,
        [conversation.atendimentoUuid, input.text, input.sender ?? "CHATBOT", input.type, input.statusEntrega],
      );

      await this.touchConversation(client, conversation.atendimentoUuid, {
        status: input.status ?? "ATIVO",
        handoffRequested: input.handoffRequested,
        intent: input.intent,
        stage: input.stage,
      });

      await client.query("COMMIT");

      return {
        id: Number(inserted.rows[0]!.numeric_id),
        tipo: "enviada",
        conteudo: inserted.rows[0]!.conteudo,
        horario: inserted.rows[0]!.data_envio ?? new Date().toISOString(),
        remetente: inserted.rows[0]!.remetente ?? undefined,
        conversationId: conversation.numericId,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async updateCustomerNameByChatId(chatId: string, name: string): Promise<void> {
    if (!name.trim()) {
      return;
    }

    await pool.query(
      `
        UPDATE clientes c
        SET nome = $2,
            atualizado_em = NOW()
        FROM atendimentos a
        WHERE a.cliente_id = c.cliente_id
          AND a.canal = 'TELEGRAM'
          AND a.whatsapp_chat_id = $1
      `,
      [chatId, name.trim()],
    );
  }

  async findConversationById(conversationId: number): Promise<TelegramConversationRecord | null> {
    const result = await pool.query<ConversationIdentityRow>(
      `
        SELECT
          a.atendimento_id,
          abs(hashtext(a.atendimento_id::text)) AS numeric_id,
          a.whatsapp_chat_id AS chat_id,
          c.nome AS cliente
        FROM atendimentos a
        LEFT JOIN clientes c ON c.cliente_id = a.cliente_id
        WHERE abs(hashtext(a.atendimento_id::text)) = $1
          AND a.canal = 'TELEGRAM'
        LIMIT 1
      `,
      [conversationId],
    );

    const row = result.rows[0];
    if (!row?.chat_id) {
      return null;
    }

    return {
      atendimentoId: Number(row.numeric_id),
      chatId: row.chat_id,
      cliente: row.cliente ?? "Cliente Telegram",
    };
  }

  async getConversationAutomationStateByChatId(chatId: string): Promise<TelegramConversationAutomationState | null> {
    const result = await pool.query<ConversationRow>(
      `
        SELECT
          a.atendimento_id,
          abs(hashtext(a.atendimento_id::text)) AS numeric_id,
          a.whatsapp_chat_id AS chat_id,
          c.nome AS cliente,
          a.status,
          a.encaminhado_humano,
          a.estado_conversa,
          a.ultima_intencao,
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
        WHERE a.canal = 'TELEGRAM'
          AND a.whatsapp_chat_id = $1
        ORDER BY a.ultima_interacao_em DESC NULLS LAST, a.iniciado_em DESC
        LIMIT 1
      `,
      [chatId],
    );

    const row = result.rows[0];
    if (!row?.chat_id) {
      return null;
    }

    return {
      atendimentoId: Number(row.numeric_id),
      chatId: row.chat_id,
      status: mapConversationStatus(row.status),
      handoffRequested: Boolean(row.encaminhado_humano),
      stage: row.estado_conversa,
      intent: row.ultima_intencao,
    };
  }

  async updateConversationStatus(conversationId: number, status: AtendimentoStatus): Promise<Atendimento | null> {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const identity = await client.query<ConversationRow>(
        `
          SELECT
            a.atendimento_id,
            abs(hashtext(a.atendimento_id::text)) AS numeric_id,
            a.whatsapp_chat_id AS chat_id,
            c.nome AS cliente,
            a.status,
            a.encaminhado_humano,
            a.estado_conversa,
            a.ultima_intencao,
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
          WHERE a.canal = 'TELEGRAM'
            AND abs(hashtext(a.atendimento_id::text)) = $1
          LIMIT 1
        `,
        [conversationId],
      );

      const conversation = identity.rows[0];
      if (!conversation) {
        await client.query("ROLLBACK");
        return null;
      }

      await client.query(
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
              encerrado_em = CASE
                WHEN $2::varchar = 'ENCERRADO' THEN NOW()
                ELSE encerrado_em
              END,
              ultima_interacao_em = NOW()
          WHERE canal = 'TELEGRAM'
            AND abs(hashtext(atendimento_id::text)) = $1
        `,
        [conversationId, status],
      );

      const result = await client.query<ConversationRow>(
        `
          SELECT
            a.atendimento_id,
            abs(hashtext(a.atendimento_id::text)) AS numeric_id,
            a.whatsapp_chat_id AS chat_id,
            c.nome AS cliente,
            a.status,
            a.encaminhado_humano,
            a.estado_conversa,
            a.ultima_intencao,
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
          WHERE a.canal = 'TELEGRAM'
            AND abs(hashtext(a.atendimento_id::text)) = $1
          LIMIT 1
        `,
        [conversationId],
      );

      await client.query("COMMIT");

      const row = result.rows[0];
      if (!row) {
        return null;
      }

      return {
        id: Number(row.numeric_id),
        cliente: row.cliente ?? "Cliente Telegram",
        telefone: "",
        contactId: row.chat_id ?? undefined,
        status: mapConversationStatus(row.status),
        ultima_mensagem: row.ultima_mensagem ?? "",
        horario: row.horario ?? new Date().toISOString(),
        channel: "telegram",
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async ensureConversation(
    client: PoolClient,
    chatId: string,
    customerName?: string,
    options?: {
      status?: "ATIVO" | "PENDENTE" | "ENCERRADO";
      handoffRequested?: boolean;
      intent?: string;
      stage?: string;
    },
  ): Promise<{ atendimentoUuid: string; numericId: number; chatId: string; customerName: string }> {
    const customer = await this.ensureCustomer(client, chatId, customerName);

    const existing = await client.query<ConversationIdentityRow>(
      `
        SELECT
          a.atendimento_id,
          abs(hashtext(a.atendimento_id::text)) AS numeric_id,
          a.whatsapp_chat_id AS chat_id,
          c.nome AS cliente,
          a.status
        FROM atendimentos a
        LEFT JOIN clientes c ON c.cliente_id = a.cliente_id
        WHERE a.canal = 'TELEGRAM'
          AND a.whatsapp_chat_id = $1
        ORDER BY a.ultima_interacao_em DESC NULLS LAST, a.iniciado_em DESC
        LIMIT 1
      `,
      [chatId],
    );

    if (existing.rows[0]) {
      const row = existing.rows[0]!;
      const shouldCreateNewCycle = row.status === "ENCERRADO" && (options?.status ?? "ATIVO") === "ATIVO" && !options?.handoffRequested;

      if (shouldCreateNewCycle) {
        return this.createConversation(client, customer.customerId, customer.name, chatId, options);
      }

      await client.query(
        `
          UPDATE atendimentos
          SET cliente_id = $2,
              status = COALESCE($3, status),
              encaminhado_humano = COALESCE($4, encaminhado_humano),
              ultima_intencao = COALESCE($5, ultima_intencao),
              estado_conversa = COALESCE($6, estado_conversa),
              ultima_interacao_em = NOW()
          WHERE atendimento_id = $1
        `,
        [row.atendimento_id, customer.customerId, options?.status ?? null, options?.handoffRequested, options?.intent ?? null, options?.stage ?? null],
      );

      return {
        atendimentoUuid: row.atendimento_id,
        numericId: Number(row.numeric_id),
        chatId,
        customerName: customer.name,
      };
    }

    return this.createConversation(client, customer.customerId, customer.name, chatId, options);
  }

  private async createConversation(
    client: PoolClient,
    customerId: string,
    customerName: string,
    chatId: string,
    options?: {
      status?: "ATIVO" | "PENDENTE" | "ENCERRADO";
      handoffRequested?: boolean;
      intent?: string;
      stage?: string;
    },
  ): Promise<{ atendimentoUuid: string; numericId: number; chatId: string; customerName: string }> {
    const inserted = await client.query<{ atendimento_id: string; numeric_id: number }>(
      `
        INSERT INTO atendimentos (
          atendimento_id,
          cliente_id,
          canal,
          status,
          iniciado_em,
          ultima_interacao_em,
          whatsapp_chat_id,
          encaminhado_humano,
          ultima_intencao,
          estado_conversa
        )
        VALUES (
          gen_random_uuid(),
          $1,
          'TELEGRAM',
          $2,
          NOW(),
          NOW(),
          $3,
          $4,
          $5,
          $6
        )
        RETURNING atendimento_id, abs(hashtext(atendimento_id::text)) AS numeric_id
      `,
      [
        customerId,
        options?.status ?? "ATIVO",
        chatId,
        options?.handoffRequested ?? false,
        options?.intent ?? null,
        options?.stage ?? null,
      ],
    );

    return {
      atendimentoUuid: inserted.rows[0]!.atendimento_id,
      numericId: Number(inserted.rows[0]!.numeric_id),
      chatId,
      customerName,
    };
  }

  private async ensureCustomer(
    client: PoolClient,
    chatId: string,
    customerName?: string,
  ): Promise<{ customerId: string; name: string }> {
    const existing = await client.query<{ cliente_id: string; nome: string | null }>(
      `
        SELECT c.cliente_id, c.nome
        FROM clientes c
        JOIN atendimentos a ON a.cliente_id = c.cliente_id
        WHERE a.canal = 'TELEGRAM'
          AND a.whatsapp_chat_id = $1
        LIMIT 1
      `,
      [chatId],
    );

    if (existing.rows[0]) {
      const row = existing.rows[0]!;
      const nextName = isMeaningfulCustomerName(customerName) ? customerName!.trim() : row.nome ?? "Cliente Telegram";
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
        name: nextName,
      };
    }

    const inserted = await client.query<{ cliente_id: string }>(
      `
        INSERT INTO clientes (cliente_id, nome, telefone, criado_em, atualizado_em)
        VALUES (gen_random_uuid(), $1, $2, NOW(), NOW())
        RETURNING cliente_id
      `,
      [isMeaningfulCustomerName(customerName) ? customerName!.trim() : "Cliente Telegram", `telegram:${chatId}`],
    );

    return {
      customerId: inserted.rows[0]!.cliente_id,
      name: isMeaningfulCustomerName(customerName) ? customerName!.trim() : "Cliente Telegram",
    };
  }

  private resolveTimestamp(timestamp?: string): string {
    if (!timestamp) {
      return new Date().toISOString();
    }

    const parsed = new Date(timestamp);
    return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  }

  private async touchConversation(
    client: PoolClient,
    atendimentoUuid: string,
    options: {
      status?: "ATIVO" | "PENDENTE" | "ENCERRADO";
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
}
