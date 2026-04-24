import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "../../config/database.js";
import type { BillingRule, BillingRoutineEntry, BillingRoutineRun, Pedido, PedidoStatus } from "../../types/domain.js";
import type { BillingRepository } from "../billing.repository.js";
import { toDateOnlyIso } from "../../utils/date.js";

type DbPedidoStatus = "PENDENTE" | "CONCLUIDO" | "CANCELADO";

type RuleRow = {
  regra_id: string;
  nome: string;
  tipo: string;
  valor: string;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
};

type OrderRow = {
  numeric_id: number;
  pedido_uuid: string;
  cliente_uuid: string | null;
  cliente_nome: string | null;
  telefone_cliente: string | null;
  latest_channel: string | null;
  latest_attendance_contact_id: string | null;
  latest_telegram_chat_id: string | null;
  latest_whatsapp_chat_id: string | null;
  numero_pedido: string | null;
  valor_total: string | number | null;
  forma_pagamento: string | null;
  status: DbPedidoStatus | null;
  data_vencimento: string | null;
  data_criacao: string | null;
  criado_em: string | null;
  atualizado_em: string | null;
  billing_send_status: string | null;
  billing_send_type: string | null;
  billing_send_message: string | null;
  billing_send_sent_at: string | null;
  billing_send_channel: string | null;
};

type BillingRunRow = {
  numeric_id: number;
  run_id: string;
  executado_em: string;
  referencia_em: string;
  regra_ativa: boolean;
  elegiveis: number;
  processados: number;
  ignorados: number;
  itens: BillingRoutineEntry[] | string | null;
};

type SendChannel = "whatsapp" | "telegram";
type DeliveryTarget = {
  available: boolean;
  channel?: SendChannel;
  reason?: string;
  displayTarget: string;
  telegramChatId?: string;
};

type RuleConfig = {
  nome: string;
  tipo: string;
  valor: string;
  ativo: boolean;
};

const PEDIDO_ID_SQL = "abs(hashtext(p.pedido_id::text))";
const RUN_ID_SQL = "abs(hashtext(run_id::text))";
const DEFAULT_RULE: BillingRule = {
  ativa: true,
  limite_envio_por_dia: "10",
  hora_envio: "09:00",
  lembrete_antes_ativo: true,
  dias_antes_vencimento: "2",
  template_antes_vencimento: "Ola {nome}, seu pedido no valor de {valor} vence em {data}.",
  vencimento_hoje_ativo: true,
  template_vencimento_hoje: "Ola {nome}, passando para lembrar que seu pedido no valor de {valor} vence hoje.",
  apos_vencimento_ativo: true,
  dias_apos_vencimento: "1",
  template_apos_vencimento: "Ola {nome}, identificamos que seu pedido no valor de {valor} venceu em {data}. Podemos te ajudar com a regularizacao?",
  dias_atraso_max: "30",
};

function mapDbStatusToDomain(status: DbPedidoStatus | null, dueDate: string): PedidoStatus {
  if (status === "CONCLUIDO") return "PAGO";
  if (status === "CANCELADO") return "CANCELADO";
  const today = toDateOnlyIso(new Date());
  return dueDate < today ? "ATRASADO" : "PENDENTE";
}

function mapDomainStatusToDb(status: PedidoStatus): DbPedidoStatus {
  if (status === "PAGO") return "CONCLUIDO";
  if (status === "CANCELADO") return "CANCELADO";
  return "PENDENTE";
}

export class PostgresBillingRepository implements BillingRepository {
  private ensurePromise?: Promise<void>;

  async getRule(): Promise<BillingRule> {
    await this.ensureSupportTables();
    const result = await pool.query<RuleRow>(
      `
        SELECT regra_id::text, nome, tipo, valor, ativo, criado_em, atualizado_em
        FROM regras_cobranca
        ORDER BY criado_em ASC
      `,
    );

    if (result.rows.length === 0) {
      return { ...DEFAULT_RULE };
    }

    const byType = new Map(result.rows.map((row) => [row.tipo, row]));
    const isActive = result.rows.some((row) => row.ativo);

    return {
      ativa: isActive,
      limite_envio_por_dia: byType.get("DAILY_LIMIT")?.valor ?? DEFAULT_RULE.limite_envio_por_dia,
      hora_envio: byType.get("SEND_TIME")?.valor ?? DEFAULT_RULE.hora_envio,
      lembrete_antes_ativo: this.readBooleanConfig(byType, "BEFORE_ENABLED", DEFAULT_RULE.lembrete_antes_ativo),
      dias_antes_vencimento: byType.get("BEFORE_DUE_DAYS")?.valor ?? byType.get("REMINDER_DAYS")?.valor ?? DEFAULT_RULE.dias_antes_vencimento,
      template_antes_vencimento: byType.get("BEFORE_TEMPLATE")?.valor ?? byType.get("MESSAGE_TEMPLATE")?.valor ?? DEFAULT_RULE.template_antes_vencimento,
      vencimento_hoje_ativo: this.readBooleanConfig(byType, "DUE_TODAY_ENABLED", DEFAULT_RULE.vencimento_hoje_ativo),
      template_vencimento_hoje: byType.get("DUE_TODAY_TEMPLATE")?.valor ?? DEFAULT_RULE.template_vencimento_hoje,
      apos_vencimento_ativo: this.readBooleanConfig(byType, "AFTER_ENABLED", DEFAULT_RULE.apos_vencimento_ativo),
      dias_apos_vencimento: byType.get("AFTER_DUE_DAYS")?.valor ?? byType.get("MIN_DELAY_DAYS")?.valor ?? DEFAULT_RULE.dias_apos_vencimento,
      template_apos_vencimento: byType.get("AFTER_TEMPLATE")?.valor ?? byType.get("MESSAGE_TEMPLATE")?.valor ?? DEFAULT_RULE.template_apos_vencimento,
      dias_atraso_max: byType.get("MAX_DELAY_DAYS")?.valor ?? DEFAULT_RULE.dias_atraso_max,
    };
  }

  async saveRule(rule: BillingRule): Promise<BillingRule> {
    await this.ensureSupportTables();

    const configs: RuleConfig[] = [
      { nome: "Limite diario de envios", tipo: "DAILY_LIMIT", valor: rule.limite_envio_por_dia, ativo: rule.ativa },
      { nome: "Horario de envio", tipo: "SEND_TIME", valor: rule.hora_envio, ativo: rule.ativa },
      { nome: "Lembrete antes do vencimento ativo", tipo: "BEFORE_ENABLED", valor: String(rule.lembrete_antes_ativo), ativo: rule.ativa && rule.lembrete_antes_ativo },
      { nome: "Dias antes do vencimento", tipo: "BEFORE_DUE_DAYS", valor: rule.dias_antes_vencimento, ativo: rule.ativa && rule.lembrete_antes_ativo },
      { nome: "Template antes do vencimento", tipo: "BEFORE_TEMPLATE", valor: rule.template_antes_vencimento, ativo: rule.ativa && rule.lembrete_antes_ativo },
      { nome: "Vencimento hoje ativo", tipo: "DUE_TODAY_ENABLED", valor: String(rule.vencimento_hoje_ativo), ativo: rule.ativa && rule.vencimento_hoje_ativo },
      { nome: "Template vencimento hoje", tipo: "DUE_TODAY_TEMPLATE", valor: rule.template_vencimento_hoje, ativo: rule.ativa && rule.vencimento_hoje_ativo },
      { nome: "Cobranca apos vencimento ativa", tipo: "AFTER_ENABLED", valor: String(rule.apos_vencimento_ativo), ativo: rule.ativa && rule.apos_vencimento_ativo },
      { nome: "Dias apos vencimento", tipo: "AFTER_DUE_DAYS", valor: rule.dias_apos_vencimento, ativo: rule.ativa && rule.apos_vencimento_ativo },
      { nome: "Template apos vencimento", tipo: "AFTER_TEMPLATE", valor: rule.template_apos_vencimento, ativo: rule.ativa && rule.apos_vencimento_ativo },
      { nome: "Dias maximos de atraso", tipo: "MAX_DELAY_DAYS", valor: rule.dias_atraso_max, ativo: rule.ativa },
      { nome: "Mensagem de cobranca legado", tipo: "MESSAGE_TEMPLATE", valor: rule.template_apos_vencimento, ativo: rule.ativa },
      { nome: "Dias minimos de atraso legado", tipo: "MIN_DELAY_DAYS", valor: rule.dias_apos_vencimento, ativo: rule.ativa },
      { nome: "Lembrete de atraso legado", tipo: "REMINDER_DAYS", valor: rule.dias_antes_vencimento, ativo: rule.ativa },
    ];

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const config of configs) {
        const existing = await client.query<{ regra_id: string }>(
          `SELECT regra_id::text FROM regras_cobranca WHERE tipo = $1 ORDER BY criado_em ASC LIMIT 1`,
          [config.tipo],
        );

        const row = existing.rows[0];
        if (row) {
          await client.query(
            `
              UPDATE regras_cobranca
              SET nome = $2, valor = $3, ativo = $4, atualizado_em = NOW()
              WHERE regra_id = $1::uuid
            `,
            [row.regra_id, config.nome, config.valor, config.ativo],
          );
        } else {
          await client.query(
            `
              INSERT INTO regras_cobranca (regra_id, nome, tipo, valor, ativo, criado_em, atualizado_em)
              VALUES ($1::uuid, $2, $3, $4, $5, NOW(), NOW())
            `,
            [randomUUID(), config.nome, config.tipo, config.valor, config.ativo],
          );
        }
      }
      await client.query("COMMIT");
      return rule;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async findOrders(): Promise<Pedido[]> {
    await this.ensureSupportTables();
    const result = await pool.query<OrderRow>(this.buildOrdersSelectQuery());
    return result.rows.map((row) => this.mapOrderRow(row));
  }

  async findOrderById(orderId: number): Promise<Pedido | null> {
    await this.ensureSupportTables();
    const result = await pool.query<OrderRow>(`${this.buildOrdersSelectQuery()} WHERE ${PEDIDO_ID_SQL} = $1 LIMIT 1`, [orderId]);
    const row = result.rows[0];
    return row ? this.mapOrderRow(row) : null;
  }

  async createOrder(order: Omit<Pedido, "id">): Promise<Pedido> {
    await this.ensureSupportTables();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      const clientId = await this.findOrCreateClient(client, order.cliente, order.telefone_cliente);
      const pedidoId = randomUUID();

      await client.query(
        `
          INSERT INTO pedidos (pedido_id, cliente_id, data_criacao, valor_total, forma_pagamento, status, criado_em, atualizado_em)
          VALUES ($1::uuid, $2::uuid, NOW(), $3::numeric, $4, $5, NOW(), NOW())
        `,
        [pedidoId, clientId, order.valor_total, order.forma_pagamento, mapDomainStatusToDb(order.status)],
      );

      await client.query(
        `
          INSERT INTO pedido_cobranca_meta (pedido_id, numero_pedido, telefone_cliente, data_vencimento, criado_em, atualizado_em)
          VALUES ($1::uuid, $2, $3, $4::date, NOW(), NOW())
        `,
        [pedidoId, order.numero_pedido, order.telefone_cliente, order.data_vencimento],
      );

      await client.query("COMMIT");
      const created = await pool.query<OrderRow>(`${this.buildOrdersSelectQuery()} WHERE p.pedido_id = $1::uuid`, [pedidoId]);
      return this.mapOrderRow(created.rows[0]!);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async updateOrder(orderId: number, data: Partial<Omit<Pedido, "id">>): Promise<Pedido | null> {
    await this.ensureSupportTables();
    const current = await this.resolveOrderIdentity(orderId);
    if (!current) {
      return null;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const nextClientName = data.cliente ?? current.cliente_nome ?? "Cliente sem nome";
      const nextPhone = data.telefone_cliente ?? current.telefone_cliente ?? "";
      const clientId = await this.findOrCreateClient(client, nextClientName, nextPhone, current.cliente_uuid);

      const pedidoUpdates: string[] = [];
      const pedidoValues: unknown[] = [];

      if (data.valor_total !== undefined) {
        pedidoValues.push(data.valor_total);
        pedidoUpdates.push(`valor_total = $${pedidoValues.length}::numeric`);
      }
      if (data.forma_pagamento !== undefined) {
        pedidoValues.push(data.forma_pagamento);
        pedidoUpdates.push(`forma_pagamento = $${pedidoValues.length}`);
      }
      if (data.status !== undefined) {
        pedidoValues.push(mapDomainStatusToDb(data.status));
        pedidoUpdates.push(`status = $${pedidoValues.length}`);
      }
      if (clientId !== current.cliente_uuid) {
        pedidoValues.push(clientId);
        pedidoUpdates.push(`cliente_id = $${pedidoValues.length}::uuid`);
      }

      if (pedidoUpdates.length > 0) {
        pedidoUpdates.push("atualizado_em = NOW()");
        pedidoValues.push(current.pedido_uuid);
        await client.query(
          `UPDATE pedidos SET ${pedidoUpdates.join(", ")} WHERE pedido_id = $${pedidoValues.length}::uuid`,
          pedidoValues,
        );
      }

      const metaUpdates: string[] = [];
      const metaValues: unknown[] = [];
      if (data.numero_pedido !== undefined) {
        metaValues.push(data.numero_pedido);
        metaUpdates.push(`numero_pedido = $${metaValues.length}`);
      }
      if (data.telefone_cliente !== undefined) {
        metaValues.push(data.telefone_cliente);
        metaUpdates.push(`telefone_cliente = $${metaValues.length}`);
      }
      if (data.data_vencimento !== undefined) {
        metaValues.push(data.data_vencimento);
        metaUpdates.push(`data_vencimento = $${metaValues.length}::date`);
      }

      if (metaUpdates.length > 0) {
        metaUpdates.push("atualizado_em = NOW()");
        metaValues.push(current.pedido_uuid);
        await client.query(
          `UPDATE pedido_cobranca_meta SET ${metaUpdates.join(", ")} WHERE pedido_id = $${metaValues.length}::uuid`,
          metaValues,
        );
      }

      await client.query("COMMIT");
      const updated = await pool.query<OrderRow>(`${this.buildOrdersSelectQuery()} WHERE ${PEDIDO_ID_SQL} = $1`, [orderId]);
      const row = updated.rows[0];
      return row ? this.mapOrderRow(row) : null;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async updateOrderStatus(orderId: number, status: PedidoStatus): Promise<Pedido | null> {
    return this.updateOrder(orderId, { status });
  }

  async sendManualCharge(orderId: number, message: string, type: "MANUAL" | "AUTOMATICO" = "MANUAL"): Promise<Pedido> {
    await this.ensureSupportTables();
    const current = await this.resolveOrderIdentity(orderId);
    if (!current) {
      throw new Error("Charge not found");
    }

    const channelInfo = this.resolveDeliveryTarget(current);
    if (!channelInfo.available || !channelInfo.channel) {
      throw new Error(channelInfo.reason ?? "No valid delivery channel");
    }

    await pool.query(
      `
        INSERT INTO billing_charge_sends (
          send_id,
          pedido_id,
          tipo_envio,
          status,
          canal,
          mensagem,
          data_envio,
          erro
        )
        VALUES ($1::uuid, $2::uuid, $3, 'ENVIADO', $4, $5, NOW(), NULL)
      `,
      [randomUUID(), current.pedido_uuid, type, channelInfo.channel.toUpperCase(), message],
    );

    const updated = await this.findOrderById(orderId);
    if (!updated) {
      throw new Error("Charge not found");
    }
    return updated;
  }

  async saveRoutineRun(run: Omit<BillingRoutineRun, "id">): Promise<BillingRoutineRun> {
    await this.ensureSupportTables();
    const runId = randomUUID();
    const result = await pool.query<BillingRunRow>(
      `
        INSERT INTO billing_routine_runs (run_id, executado_em, referencia_em, regra_ativa, elegiveis, processados, ignorados, itens)
        VALUES ($1::uuid, $2::timestamp, $3::date, $4, $5, $6, $7, $8::jsonb)
        RETURNING ${RUN_ID_SQL} AS numeric_id, run_id::text, executado_em, referencia_em, regra_ativa, elegiveis, processados, ignorados, itens
      `,
      [runId, run.executado_em, run.referencia_em, run.regra_ativa, run.elegiveis, run.processados, run.ignorados, JSON.stringify(run.itens)],
    );

    return this.mapRunRow(result.rows[0]!);
  }

  async listRoutineRuns(): Promise<BillingRoutineRun[]> {
    await this.ensureSupportTables();
    const result = await pool.query<BillingRunRow>(
      `
        SELECT ${RUN_ID_SQL} AS numeric_id, run_id::text, executado_em, referencia_em, regra_ativa, elegiveis, processados, ignorados, itens
        FROM billing_routine_runs
        ORDER BY executado_em DESC
      `,
    );

    return result.rows.map((row) => this.mapRunRow(row));
  }

  private async ensureSupportTables(): Promise<void> {
    if (!this.ensurePromise) {
      this.ensurePromise = this.createSupportTables();
    }
    return this.ensurePromise;
  }

  private async createSupportTables(): Promise<void> {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pedido_cobranca_meta (
        pedido_id uuid PRIMARY KEY REFERENCES pedidos(pedido_id) ON DELETE CASCADE,
        numero_pedido varchar(100) NOT NULL,
        telefone_cliente varchar(50),
        data_vencimento date NOT NULL,
        criado_em timestamp without time zone NOT NULL DEFAULT NOW(),
        atualizado_em timestamp without time zone NOT NULL DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS billing_routine_runs (
        run_id uuid PRIMARY KEY,
        executado_em timestamp without time zone NOT NULL,
        referencia_em date NOT NULL,
        regra_ativa boolean NOT NULL,
        elegiveis integer NOT NULL,
        processados integer NOT NULL,
        ignorados integer NOT NULL,
        itens jsonb NOT NULL DEFAULT '[]'::jsonb
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS billing_charge_sends (
        send_id uuid PRIMARY KEY,
        pedido_id uuid NOT NULL REFERENCES pedidos(pedido_id) ON DELETE CASCADE,
        tipo_envio varchar(20) NOT NULL,
        status varchar(20) NOT NULL,
        canal varchar(20),
        mensagem text NOT NULL,
        data_envio timestamp without time zone NOT NULL DEFAULT NOW(),
        erro text,
        criado_em timestamp without time zone NOT NULL DEFAULT NOW()
      )
    `);
  }

  private buildOrdersSelectQuery(): string {
    return `
      SELECT
        ${PEDIDO_ID_SQL} AS numeric_id,
        p.pedido_id::text AS pedido_uuid,
        p.cliente_id::text AS cliente_uuid,
        c.nome AS cliente_nome,
        COALESCE(m.telefone_cliente, c.telefone) AS telefone_cliente,
        latest_attendance.canal AS latest_channel,
        latest_attendance.contact_id AS latest_attendance_contact_id,
        CASE WHEN latest_attendance.canal = 'telegram' THEN latest_attendance.contact_id END AS latest_telegram_chat_id,
        CASE WHEN latest_attendance.canal = 'whatsapp' THEN latest_attendance.contact_id END AS latest_whatsapp_chat_id,
        m.numero_pedido,
        p.valor_total,
        p.forma_pagamento,
        p.status,
        m.data_vencimento::text AS data_vencimento,
        p.data_criacao,
        p.criado_em,
        p.atualizado_em,
        latest_send.status AS billing_send_status,
        latest_send.tipo_envio AS billing_send_type,
        latest_send.mensagem AS billing_send_message,
        latest_send.data_envio::text AS billing_send_sent_at,
        lower(latest_send.canal) AS billing_send_channel
      FROM pedidos p
      LEFT JOIN clientes c ON c.cliente_id = p.cliente_id
      LEFT JOIN pedido_cobranca_meta m ON m.pedido_id = p.pedido_id
      LEFT JOIN LATERAL (
        SELECT
          lower(a.canal) AS canal,
          CASE
            WHEN upper(a.canal) = 'TELEGRAM' THEN a.telegram_chat_id
            WHEN upper(a.canal) = 'WHATSAPP' THEN a.whatsapp_chat_id
          END AS contact_id
        FROM atendimentos a
        WHERE a.cliente_id = p.cliente_id
        ORDER BY COALESCE(a.ultima_interacao_em, a.iniciado_em) DESC NULLS LAST
        LIMIT 1
      ) latest_attendance ON TRUE
      LEFT JOIN LATERAL (
        SELECT bcs.status, bcs.tipo_envio, bcs.mensagem, bcs.data_envio, bcs.canal
        FROM billing_charge_sends bcs
        WHERE bcs.pedido_id = p.pedido_id
        ORDER BY bcs.data_envio DESC, bcs.criado_em DESC
        LIMIT 1
      ) latest_send ON TRUE
    `;
  }

  private mapOrderRow(row: OrderRow): Pedido {
    const dueDate = row.data_vencimento ?? this.coerceDate(row.data_criacao ?? row.criado_em) ?? toDateOnlyIso(new Date());
    const channelInfo = this.resolveDeliveryTarget(row);
    return {
      id: Number(row.numeric_id),
      numero_pedido: row.numero_pedido ?? `PED-${String(row.numeric_id).padStart(6, "0")}`,
      cliente: row.cliente_nome ?? "Cliente sem nome",
      telefone_cliente: row.telefone_cliente ?? "",
      telegramChatId: channelInfo.telegramChatId,
      contatoExibicao: channelInfo.displayTarget,
      valor_total: row.valor_total !== null ? String(row.valor_total) : "0",
      forma_pagamento: row.forma_pagamento ?? "",
      status: mapDbStatusToDomain(row.status, dueDate),
      data_vencimento: dueDate,
      cobrancaStatus: row.billing_send_status === "ENVIADO" ? "ENVIADO" : row.billing_send_status === "FALHA" ? "FALHA" : undefined,
      cobrancaTipoEnvio: row.billing_send_type === "MANUAL" ? "MANUAL" : row.billing_send_type === "AUTOMATICO" ? "AUTOMATICO" : undefined,
      cobrancaDataEnvio: row.billing_send_sent_at ?? undefined,
      cobrancaMensagem: row.billing_send_message ?? undefined,
      cobrancaCanal: channelInfo.channel,
      cobrancaCanalDisponivel: channelInfo.available,
      cobrancaMotivoIndisponivel: channelInfo.reason,
    };
  }

  private mapRunRow(row: BillingRunRow): BillingRoutineRun {
    const itens = Array.isArray(row.itens)
      ? row.itens
      : typeof row.itens === "string"
        ? JSON.parse(row.itens) as BillingRoutineEntry[]
        : [];

    return {
      id: Number(row.numeric_id),
      executado_em: new Date(row.executado_em).toISOString(),
      referencia_em: row.referencia_em,
      regra_ativa: row.regra_ativa,
      elegiveis: Number(row.elegiveis),
      processados: Number(row.processados),
      ignorados: Number(row.ignorados),
      itens,
    };
  }

  private async resolveOrderIdentity(orderId: number): Promise<OrderRow | null> {
    const result = await pool.query<OrderRow>(`${this.buildOrdersSelectQuery()} WHERE ${PEDIDO_ID_SQL} = $1 LIMIT 1`, [orderId]);
    return result.rows[0] ?? null;
  }

  private resolveDeliveryTarget(
    row: Pick<OrderRow, "numeric_id" | "cliente_uuid" | "latest_channel" | "latest_attendance_contact_id" | "latest_telegram_chat_id" | "latest_whatsapp_chat_id">,
  ): DeliveryTarget {
    const latestChannel = row.latest_channel?.trim().toLowerCase() ?? null;
    const latestAttendanceContactId = row.latest_attendance_contact_id?.trim();
    const latestTelegramChatId = row.latest_telegram_chat_id?.trim();

    let result: DeliveryTarget;

    if (latestChannel === "telegram") {
      const telegramChatId =
        latestTelegramChatId
        ?? latestAttendanceContactId
        ?? null;

      if (telegramChatId) {
        result = {
          available: true,
          channel: "telegram",
          displayTarget: `ID Telegram: ${telegramChatId}`,
          telegramChatId,
        };
        this.logResolvedDeliveryTarget(row, result);
        return result;
      }
    }

    result = {
      available: false,
      reason: "Sem canal disponível",
      displayTarget: "Sem canal disponível",
    };
    this.logResolvedDeliveryTarget(row, result);
    return result;
  }

  private async findOrCreateClient(client: PoolClient, nome: string, telefone: string, existingClientId?: string | null): Promise<string | null> {
    if (existingClientId) {
      await client.query(
        `UPDATE clientes SET nome = $2, telefone = $3, atualizado_em = NOW() WHERE cliente_id = $1::uuid`,
        [existingClientId, nome, telefone],
      );
      return existingClientId;
    }

    const existing = await client.query<{ cliente_id: string }>(
      `SELECT cliente_id::text FROM clientes WHERE telefone = $1 LIMIT 1`,
      [telefone],
    );

    const existingRow = existing.rows[0];
    if (existingRow) {
      await client.query(
        `UPDATE clientes SET nome = $2, atualizado_em = NOW() WHERE cliente_id = $1::uuid`,
        [existingRow.cliente_id, nome],
      );
      return existingRow.cliente_id;
    }

    const clientId = randomUUID();
    await client.query(
      `
        INSERT INTO clientes (cliente_id, nome, telefone, criado_em, atualizado_em)
        VALUES ($1::uuid, $2, $3, NOW(), NOW())
      `,
      [clientId, nome, telefone],
    );
    return clientId;
  }

  private coerceDate(value?: string | null): string | null {
    if (!value) {
      return null;
    }
    return new Date(value).toISOString().slice(0, 10);
  }

  private readBooleanConfig(byType: Map<string, RuleRow>, type: string, fallback: boolean): boolean {
    const rawValue = byType.get(type)?.valor;
    if (!rawValue) {
      return fallback;
    }

    return rawValue.trim().toLowerCase() === "true";
  }

  private logResolvedDeliveryTarget(
    row: Pick<OrderRow, "numeric_id" | "cliente_uuid" | "latest_channel" | "latest_telegram_chat_id" | "latest_whatsapp_chat_id">,
    result: DeliveryTarget,
  ): void {
    console.info("[BillingChannelStrictResolve]", {
      pedido_id: row.numeric_id,
      cliente_id: row.cliente_uuid ?? null,
      canal_ultimo_atendimento: row.latest_channel ?? null,
      telegram_chat_id: row.latest_telegram_chat_id ?? null,
      whatsapp_chat_id: row.latest_whatsapp_chat_id ?? null,
      canal_final: result.channel ?? null,
      telegramChatId_final: result.telegramChatId ?? null,
      contatoExibicao_final: result.displayTarget,
    });
  }
}

