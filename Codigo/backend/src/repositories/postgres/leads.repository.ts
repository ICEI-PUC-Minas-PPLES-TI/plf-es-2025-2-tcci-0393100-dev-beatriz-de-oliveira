import { pool } from "../../config/database.js";
import type { ConversationChannel, Lead, LeadFilters, LeadStatus, LeadTimelineEvent } from "../../types/domain.js";
import type { LeadUpsertByPhoneInput, LeadsRepository } from "../leads.repository.js";

type DbLeadStatus = LeadStatus | "INTERESSADO" | "ENCAMINHADO_HUMANO" | "ENCERRADO";

type LeadRow = {
  numeric_id: number;
  lead_id: string;
  nome: string | null;
  telefone: string;
  interesse_produto: string | null;
  status: DbLeadStatus;
  origem: string;
  criado_em: string;
  atualizado_em: string;
  atendimento_numeric_id: number | null;
  atendimento_canal: string | null;
  contato: string | null;
  ultima_intencao: string | null;
  ultima_interacao_em: string | null;
  encaminhado_humano: boolean | null;
};

type StatusHistoryRow = {
  id: number;
  old_status: DbLeadStatus | null;
  new_status: DbLeadStatus;
  reason: string;
  created_at: string;
};

type MessageTimelineRow = {
  id: string;
  conteudo: string | null;
  data_envio: string;
  remetente: string | null;
  direcao: string | null;
};

const LEAD_ID_SQL = "abs(hashtext(lead_id::text))";
const REOPEN_AFTER_MS = 24 * 60 * 60 * 1000;

function mapDbStatusToDomain(status: DbLeadStatus): LeadStatus {
  switch (status) {
    case "INTERESSADO":
      return "EM_CONTATO";
    case "ENCAMINHADO_HUMANO":
      return "ENCAMINHADO";
    case "ENCERRADO":
      return "PERDIDO";
    default:
      return status;
  }
}

function mapDomainStatusToDb(status: LeadStatus): LeadStatus {
  return status;
}

function normalizeChannel(value?: string | null): ConversationChannel | undefined {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "telegram") return "telegram";
  return undefined;
}

function isTerminalStatus(status: DbLeadStatus): boolean {
  const mapped = mapDbStatusToDomain(status);
  return mapped === "CONVERTIDO" || mapped === "PERDIDO";
}

function normalizeReasonForStatus(status: LeadStatus): string {
  if (status === "ENCAMINHADO") return "seller_handoff";
  if (status === "CONVERTIDO") return "sale_completed";
  if (status === "PERDIDO") return "manual_update";
  if (status === "NOVO") return "first_interaction";
  return "conversation_activity";
}

export class PostgresLeadsRepository implements LeadsRepository {
  private ensurePromise?: Promise<void>;

  async findAll(filters?: LeadFilters): Promise<Lead[]> {
    await this.ensureSchema();

    const conditions: string[] = [];
    const values: unknown[] = [];

    if (filters?.status) {
      values.push(mapDomainStatusToDb(filters.status));
      conditions.push(`l.status = $${values.length}`);
    }

    if (filters?.search) {
      values.push(`%${filters.search.toLowerCase()}%`);
      conditions.push(`LOWER(CONCAT_WS(' ', COALESCE(l.nome, ''), l.telefone, COALESCE(l.interesse_produto, ''), l.origem, COALESCE(latest.ultima_intencao, ''))) LIKE $${values.length}`);
    }

    conditions.push(`upper(l.origem) = 'TELEGRAM'`);

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await pool.query<LeadRow>(
      `
        ${this.buildLeadSelectSql()}
        ${whereClause}
        ORDER BY COALESCE(latest.ultima_interacao_em, l.atualizado_em, l.criado_em) DESC
      `,
      values,
    );

    return Promise.all(result.rows.map((row) => this.mapRowToDomain(row)));
  }

  async findById(id: number): Promise<Lead | null> {
    await this.ensureSchema();

    const result = await pool.query<LeadRow>(
      `
        ${this.buildLeadSelectSql()}
        WHERE ${LEAD_ID_SQL.replaceAll("lead_id", "l.lead_id")} = $1
          AND upper(l.origem) = 'TELEGRAM'
        LIMIT 1
      `,
      [id],
    );

    const row = result.rows[0];
    return row ? this.mapRowToDomain(row) : null;
  }

  async create(data: Omit<Lead, "id">): Promise<Lead> {
    await this.ensureSchema();

    const status = mapDomainStatusToDb(data.status);
    const result = await pool.query<LeadRow>(
      `
        INSERT INTO leads (nome, telefone, interesse_produto, status, origem, criado_em, atualizado_em)
        VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamp, NOW()), NOW())
        RETURNING ${LEAD_ID_SQL} AS numeric_id, lead_id::text, nome, telefone, interesse_produto, status, origem, criado_em, atualizado_em,
          NULL::int AS atendimento_numeric_id, NULL::text AS atendimento_canal, NULL::text AS contato, NULL::text AS ultima_intencao,
          NULL::timestamp AS ultima_interacao_em, NULL::boolean AS encaminhado_humano
      `,
      [data.nome, data.telefone, data.interesse, status, this.extractOriginFromEmail(data.email), this.toTimestampOrNull(data.data_criacao)],
    );

    await this.recordStatusHistory(result.rows[0]!.lead_id, null, status, "first_interaction");
    return this.mapRowToDomain(result.rows[0]!);
  }

  async update(id: number, data: Partial<Omit<Lead, "id">>): Promise<Lead | null> {
    await this.ensureSchema();
    const current = await this.findRawByNumericId(id);
    if (!current) return null;

    const updates: string[] = [];
    const values: unknown[] = [];

    if (data.nome !== undefined) {
      values.push(data.nome);
      updates.push(`nome = $${values.length}`);
    }

    if (data.telefone !== undefined) {
      values.push(data.telefone);
      updates.push(`telefone = $${values.length}`);
    }

    if (data.interesse !== undefined) {
      values.push(data.interesse);
      updates.push(`interesse_produto = ${this.appendInterestSql(values.length)}`);
    }

    let nextStatus: LeadStatus | undefined;
    if (data.status !== undefined) {
      nextStatus = mapDomainStatusToDb(data.status);
      values.push(nextStatus);
      updates.push(`status = $${values.length}`);
    }

    if (updates.length === 0) {
      return this.mapRowToDomain(current);
    }

    updates.push("atualizado_em = NOW()");
    values.push(current.lead_id);

    const result = await pool.query<LeadRow>(
      `
        UPDATE leads
        SET ${updates.join(", ")}
        WHERE lead_id = $${values.length}::uuid
        RETURNING ${LEAD_ID_SQL} AS numeric_id, lead_id::text, nome, telefone, interesse_produto, status, origem, criado_em, atualizado_em,
          NULL::int AS atendimento_numeric_id, NULL::text AS atendimento_canal, NULL::text AS contato, NULL::text AS ultima_intencao,
          NULL::timestamp AS ultima_interacao_em, NULL::boolean AS encaminhado_humano
      `,
      values,
    );

    if (nextStatus && mapDbStatusToDomain(current.status) !== nextStatus) {
      await this.recordStatusHistory(current.lead_id, current.status, nextStatus, normalizeReasonForStatus(nextStatus));
    }

    return this.mapRowToDomain(result.rows[0]!);
  }

  async updateStatus(id: number, status: LeadStatus): Promise<Lead | null> {
    return this.update(id, { status });
  }

  async upsertByPhone(input: LeadUpsertByPhoneInput): Promise<Lead> {
    await this.ensureSchema();

    const interest = this.normalizeCommercialInterest(input.interest);
    const existing = await pool.query<LeadRow>(
      `
        SELECT ${LEAD_ID_SQL} AS numeric_id, lead_id::text, nome, telefone, interesse_produto, status, origem, criado_em, atualizado_em,
          NULL::int AS atendimento_numeric_id, NULL::text AS atendimento_canal, NULL::text AS contato, NULL::text AS ultima_intencao,
          NULL::timestamp AS ultima_interacao_em, NULL::boolean AS encaminhado_humano
        FROM leads
        WHERE telefone = $1
          OR ($2 = 'telegram' AND telefone = concat('telegram:', $1))
        ORDER BY CASE WHEN telefone = $1 THEN 0 ELSE 1 END, atualizado_em DESC NULLS LAST, criado_em DESC
        LIMIT 1
      `,
      [input.phone, input.channel ?? "telegram"],
    );

    const existingRow = existing.rows[0];
    if (existingRow) {
      const desiredStatus = mapDomainStatusToDb(input.status);
      const { status: nextStatus, reason } = this.resolveUpsertStatus(existingRow, desiredStatus);
      const updated = await pool.query<LeadRow>(
        `
          UPDATE leads
          SET
            nome = COALESCE($2, nome),
            telefone = $1,
            interesse_produto = ${this.appendInterestSql(3)},
            status = $4,
            origem = COALESCE($5, origem),
            atualizado_em = NOW()
          WHERE lead_id = $6::uuid
          RETURNING ${LEAD_ID_SQL} AS numeric_id, lead_id::text, nome, telefone, interesse_produto, status, origem, criado_em, atualizado_em,
            NULL::int AS atendimento_numeric_id, NULL::text AS atendimento_canal, NULL::text AS contato, NULL::text AS ultima_intencao,
            NULL::timestamp AS ultima_interacao_em, NULL::boolean AS encaminhado_humano
        `,
        [input.phone, input.name ?? null, interest, nextStatus, this.resolveOrigin(input.channel), existingRow.lead_id],
      );

      if (mapDbStatusToDomain(existingRow.status) !== nextStatus) {
        await this.recordStatusHistory(existingRow.lead_id, existingRow.status, nextStatus, reason);
      }

      if (reason === "automatic_reopen") {
        console.info("[LeadReopen] lead_reopened", { lead_id: existingRow.lead_id, phone: input.phone });
      }
      console.info("[LeadStatus] lead_upserted", { lead_id: existingRow.lead_id, status: nextStatus, reason });
      return this.mapRowToDomain(updated.rows[0]!);
    }

    const status = mapDomainStatusToDb(input.status);
    const inserted = await pool.query<LeadRow>(
      `
        INSERT INTO leads (nome, telefone, interesse_produto, status, origem, criado_em, atualizado_em)
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        RETURNING ${LEAD_ID_SQL} AS numeric_id, lead_id::text, nome, telefone, interesse_produto, status, origem, criado_em, atualizado_em,
          NULL::int AS atendimento_numeric_id, NULL::text AS atendimento_canal, NULL::text AS contato, NULL::text AS ultima_intencao,
          NULL::timestamp AS ultima_interacao_em, NULL::boolean AS encaminhado_humano
      `,
      [input.name ?? this.defaultName(input.channel), input.phone, interest, status, this.resolveOrigin(input.channel)],
    );

    await this.recordStatusHistory(inserted.rows[0]!.lead_id, null, status, "first_interaction");
    console.info("[LeadStatus] lead_created", { lead_id: inserted.rows[0]!.lead_id, status });
    return this.mapRowToDomain(inserted.rows[0]!);
  }

  private resolveUpsertStatus(existing: LeadRow, desiredStatus: LeadStatus): { status: LeadStatus; reason: string } {
    const currentStatus = mapDbStatusToDomain(existing.status);
    if (isTerminalStatus(existing.status) && desiredStatus !== "CONVERTIDO" && desiredStatus !== "PERDIDO") {
      const lastInteraction = new Date(existing.atualizado_em).getTime();
      if (Number.isFinite(lastInteraction) && Date.now() - lastInteraction > REOPEN_AFTER_MS) {
        return { status: "EM_CONTATO", reason: "automatic_reopen" };
      }
      return { status: currentStatus, reason: "terminal_status_preserved" };
    }

    return { status: desiredStatus, reason: normalizeReasonForStatus(desiredStatus) };
  }

  private async mapRowToDomain(row: LeadRow): Promise<Lead> {
    return {
      id: Number(row.numeric_id),
      nome: row.nome ?? "Contato sem nome",
      telefone: row.telefone,
      email: this.buildEmail(row.telefone, row.origem),
      interesse: row.interesse_produto ?? "",
      status: mapDbStatusToDomain(row.status),
      data_criacao: new Date(row.criado_em).toISOString(),
      canal: normalizeChannel(row.atendimento_canal ?? row.origem),
      contato: row.contato ?? row.telefone,
      contatoExibicao: this.buildContactDisplay(row.atendimento_canal ?? row.origem, row.contato ?? row.telefone),
      origem: row.origem,
      intencao: row.ultima_intencao ?? undefined,
      ultima_interacao: row.ultima_interacao_em ? new Date(row.ultima_interacao_em).toISOString() : new Date(row.atualizado_em).toISOString(),
      atendimento_id: row.atendimento_numeric_id ?? undefined,
      encaminhado_humano: Boolean(row.encaminhado_humano),
      timeline: await this.buildTimeline(row),
    };
  }

  private async buildTimeline(row: LeadRow): Promise<LeadTimelineEvent[]> {
    const events: LeadTimelineEvent[] = [];
    events.push(...await this.buildCommercialEventsFromMessages(row));

    const history = await pool.query<StatusHistoryRow>(
      `
        SELECT id, old_status, new_status, reason, created_at
        FROM lead_status_history
        WHERE lead_id = $1::uuid
        ORDER BY created_at ASC, id ASC
      `,
      [row.lead_id],
    );

    for (const item of history.rows) {
      const status = mapDbStatusToDomain(item.new_status);
      events.push({
        id: `status-${item.id}`,
        type: item.reason === "seller_handoff" ? "handoff" : "status",
        title: this.statusTitle(status, item.reason),
        description: this.statusDescription(status, item.reason),
        occurredAt: new Date(item.created_at).toISOString(),
        status,
        reason: item.reason,
      });
    }

    const uniqueEvents = this.dedupeTimelineEvents(events);
    const sorted = uniqueEvents.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
    console.info("[LeadTimeline] timeline_built", { lead_id: row.lead_id, total: sorted.length });
    return sorted;
  }

  private async buildCommercialEventsFromMessages(row: LeadRow): Promise<LeadTimelineEvent[]> {
    const result = await pool.query<MessageTimelineRow>(
      `
        SELECT
          m.mensagem_id::text AS id,
          m.conteudo,
          m.data_envio,
          m.remetente,
          m.direcao
        FROM atendimentos a
        INNER JOIN mensagens m ON m.atendimento_id = a.atendimento_id
        LEFT JOIN clientes c ON c.cliente_id = a.cliente_id
        WHERE upper(a.canal) = 'TELEGRAM'
          AND (
            a.lead_id = $1::uuid
            OR a.telegram_chat_id = $2
            OR c.telefone = concat('telegram:', $2)
            OR c.telefone = $2
          )
          AND m.data_envio IS NOT NULL
        ORDER BY m.data_envio ASC, m.mensagem_id ASC
      `,
      [row.lead_id, row.telefone],
    );

    return result.rows
      .map((message) => this.messageToTimelineEvent(message))
      .filter((event): event is LeadTimelineEvent => Boolean(event));
  }

  private messageToTimelineEvent(message: MessageTimelineRow): LeadTimelineEvent | null {
    const content = message.conteudo?.trim();
    if (!content || message.direcao !== "ENTRADA" || message.remetente !== "CLIENTE") {
      return null;
    }

    const occurredAt = new Date(message.data_envio).toISOString();
    const productInterest = content.match(/^tenho interesse em\s+(.+)$/i);
    if (productInterest?.[1]?.trim()) {
      const productName = productInterest[1].trim();
      return {
        id: `product-interest-${message.id}`,
        type: "produto",
        title: `Interesse no produto: ${productName}`,
        description: `Cliente demonstrou interesse em ${productName}.`,
        occurredAt,
      };
    }

    const productView = content.match(/^ver mais(?: fotos)?\s+(.+)$/i);
    if (productView?.[1]?.trim()) {
      const productName = productView[1].trim();
      return {
        id: `product-view-${message.id}`,
        type: "produto",
        title: `Produto visualizado: ${productName}`,
        description: `Cliente abriu detalhes de ${productName}.`,
        occurredAt,
      };
    }

    const categoryRefinement = content.match(/^categoria\s+(.+?)\s+busca\s+(.+)$/i);
    if (categoryRefinement?.[1]?.trim()) {
      const categoryName = categoryRefinement[1].trim();
      const searchTerm = categoryRefinement[2]?.trim();
      return {
        id: `category-${message.id}`,
        type: "produto",
        title: `Categoria consultada: ${categoryName}`,
        description: searchTerm ? `Cliente buscou "${searchTerm}" em ${categoryName}.` : `Cliente consultou a categoria ${categoryName}.`,
        occurredAt,
      };
    }

    const categoryBrowse = content.match(/^categoria\s+(.+?)(?:\s+geral|\s+pagina\s+\d+)$/i);
    if (categoryBrowse?.[1]?.trim()) {
      const categoryName = categoryBrowse[1].trim();
      return {
        id: `category-${message.id}`,
        type: "produto",
        title: `Categoria consultada: ${categoryName}`,
        description: `Cliente consultou a categoria ${categoryName}.`,
        occurredAt,
      };
    }

    const promotionInterest = content.match(/^promoc(?:ao|oes)\s*(.*)$/i);
    if (promotionInterest) {
      const promotionName = promotionInterest[1]?.trim();
      return {
        id: `promotion-${message.id}`,
        type: "promocao",
        title: promotionName ? `Promocao consultada: ${promotionName}` : "Promocoes consultadas",
        description: promotionName ? `Cliente consultou a promocao de ${promotionName}.` : "Cliente abriu a lista de promocoes.",
        occurredAt,
      };
    }

    return null;
  }

  private dedupeTimelineEvents(events: LeadTimelineEvent[]): LeadTimelineEvent[] {
    const seen = new Set<string>();
    return events.filter((event) => {
      const key = `${event.type}|${event.title}|${event.occurredAt}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private async findRawByNumericId(id: number): Promise<LeadRow | null> {
    const result = await pool.query<LeadRow>(
      `
        ${this.buildLeadSelectSql()}
        WHERE ${LEAD_ID_SQL.replaceAll("lead_id", "l.lead_id")} = $1
        LIMIT 1
      `,
      [id],
    );
    return result.rows[0] ?? null;
  }

  private async recordStatusHistory(leadId: string, oldStatus: DbLeadStatus | null, newStatus: LeadStatus, reason: string): Promise<void> {
    await pool.query(
      `
        INSERT INTO lead_status_history (lead_id, old_status, new_status, reason, created_at)
        VALUES ($1::uuid, $2, $3, $4, NOW())
      `,
      [leadId, oldStatus ? mapDbStatusToDomain(oldStatus) : null, newStatus, reason],
    );
  }

  private buildLeadSelectSql(): string {
    return `
      SELECT
        ${LEAD_ID_SQL.replaceAll("lead_id", "l.lead_id")} AS numeric_id,
        l.lead_id::text,
        l.nome,
        l.telefone,
        l.interesse_produto,
        l.status,
        l.origem,
        l.criado_em,
        l.atualizado_em,
        latest.atendimento_numeric_id,
        latest.atendimento_canal,
        latest.contato,
        latest.ultima_intencao,
        latest.ultima_interacao_em,
        latest.encaminhado_humano
      FROM leads l
      LEFT JOIN LATERAL (
        SELECT
          abs(hashtext(a.atendimento_id::text)) AS atendimento_numeric_id,
          lower(a.canal) AS atendimento_canal,
          CASE
            WHEN upper(a.canal) = 'TELEGRAM' THEN a.telegram_chat_id
          END AS contato,
          a.ultima_intencao,
          COALESCE(a.ultima_interacao_em, a.iniciado_em) AS ultima_interacao_em,
          a.encaminhado_humano
        FROM atendimentos a
        LEFT JOIN clientes c ON c.cliente_id = a.cliente_id
        WHERE upper(a.canal) = 'TELEGRAM'
          AND (
            a.lead_id = l.lead_id
            OR a.telegram_chat_id = l.telefone
            OR c.telefone = concat('telegram:', l.telefone)
            OR c.telefone = l.telefone
          )
        ORDER BY COALESCE(a.ultima_interacao_em, a.iniciado_em) DESC NULLS LAST
        LIMIT 1
      ) latest ON TRUE
    `;
  }

  private statusTitle(status: LeadStatus, reason: string): string {
    if (reason === "automatic_reopen") return "Lead reaberto automaticamente";
    if (status === "CONVERTIDO") return "Lead convertido";
    if (status === "PERDIDO") return "Lead perdido";
    if (status === "ENCAMINHADO") return "Encaminhado para vendedor";
    if (status === "NOVO") return "Lead criado";
    return "Lead em contato";
  }

  private statusDescription(status: LeadStatus, reason: string): string {
    if (reason === "automatic_reopen") return "Cliente voltou a interagir apos conversao ou perda.";
    if (reason === "sale_completed") return "Venda concluida para este relacionamento comercial.";
    if (reason === "seller_handoff") return "Cliente pediu atendimento humano.";
    if (reason === "manual_update" && status === "PERDIDO") return "Lead marcado manualmente como perdido.";
    if (reason === "first_interaction") return "Primeira interacao registrada para este cliente.";
    return "Status comercial atualizado.";
  }

  private resolveOrigin(_channel?: "telegram"): string {
    return "TELEGRAM";
  }

  private defaultName(_channel?: "telegram"): string {
    return "Cliente Telegram";
  }

  private normalizeCommercialInterest(value?: string | null): string | null {
    const trimmed = value?.trim();
    if (!trimmed) return null;
    const normalized = trimmed.toLowerCase();
    const blockedValues = new Set(["greeting", "menu", "human_handoff", "unknown", "fallback"]);
    if (blockedValues.has(normalized) || normalized.includes("solicitou atendimento humano")) return null;
    return trimmed;
  }

  private appendInterestSql(valueIndex: number): string {
    const value = `$${valueIndex}::text`;
    return `
      CASE
        WHEN NULLIF(BTRIM(${value}), '') IS NULL THEN interesse_produto
        WHEN interesse_produto IS NULL OR BTRIM(interesse_produto) = '' THEN BTRIM(${value})
        WHEN EXISTS (
          SELECT 1
          FROM unnest(string_to_array(interesse_produto, ' | ')) AS interest_item(value)
          WHERE LOWER(BTRIM(interest_item.value)) = LOWER(BTRIM(${value}))
        ) THEN interesse_produto
        ELSE concat_ws(' | ', interesse_produto, BTRIM(${value}))
      END
    `;
  }

  private async ensureSchema(): Promise<void> {
    if (!this.ensurePromise) {
      this.ensurePromise = (async () => {
        await pool.query(`
          ALTER TABLE leads
          ALTER COLUMN interesse_produto TYPE text
        `);
        await pool.query(`
          ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check
        `);
        await pool.query(`
          UPDATE leads
          SET status = CASE
            WHEN status = 'INTERESSADO' THEN 'EM_CONTATO'
            WHEN status = 'ENCAMINHADO_HUMANO' THEN 'ENCAMINHADO'
            WHEN status = 'ENCERRADO' THEN 'PERDIDO'
            ELSE status
          END
        `);
        await pool.query(`
          ALTER TABLE leads
          ADD CONSTRAINT leads_status_check
          CHECK (status IN ('NOVO','EM_CONTATO','ENCAMINHADO','CONVERTIDO','PERDIDO'))
        `);
        await pool.query(`
          CREATE TABLE IF NOT EXISTS lead_status_history (
            id serial PRIMARY KEY,
            lead_id uuid NOT NULL REFERENCES leads(lead_id) ON DELETE CASCADE,
            old_status varchar(50),
            new_status varchar(50) NOT NULL,
            reason varchar(80) NOT NULL,
            created_at timestamp without time zone NOT NULL DEFAULT NOW()
          )
        `);
        await pool.query(`
          CREATE INDEX IF NOT EXISTS idx_lead_status_history_lead_id
          ON lead_status_history(lead_id, created_at DESC)
        `);
      })();
    }

    return this.ensurePromise;
  }

  private buildContactDisplay(origin: string | null, contact: string): string {
    return normalizeChannel(origin) === "telegram" ? `ID Telegram: ${contact}` : contact;
  }

  private buildEmail(phone: string, origin: string): string {
    const digitsOnly = phone.replace(/\D/g, "");
    const normalizedOrigin = origin.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "lead";
    return `lead.${digitsOnly || "sem-telefone"}@${normalizedOrigin}.local`;
  }

  private extractOriginFromEmail(email: string): string {
    const domain = email.split("@")[1]?.toUpperCase();
    if (!domain) return "TELEGRAM";
    return domain.replace(/\.LOCAL$/i, "") || "PAINEL_ADMIN";
  }

  private toTimestampOrNull(value?: string): string | null {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
}
