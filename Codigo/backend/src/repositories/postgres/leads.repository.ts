import { pool } from "../../config/database.js";
import type { ConversationChannel, Lead, LeadFilters } from "../../types/domain.js";
import type { LeadUpsertByPhoneInput, LeadsRepository } from "../leads.repository.js";

type DbLeadStatus = "NOVO" | "INTERESSADO" | "ENCAMINHADO_HUMANO" | "CONVERTIDO" | "PERDIDO" | "ENCERRADO";

type LeadRow = {
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

const LEAD_ID_SQL = "abs(hashtext(lead_id::text))";

function mapDbStatusToDomain(status: DbLeadStatus): Lead["status"] {
  switch (status) {
    case "INTERESSADO":
      return "EM_CONTATO";
    case "ENCERRADO":
      return "PERDIDO";
    default:
      return status;
  }
}

function mapDomainStatusToDb(status: Lead["status"]): DbLeadStatus {
  switch (status) {
    case "EM_CONTATO":
      return "INTERESSADO";
    case "PERDIDO":
      return "ENCERRADO";
    default:
      return status;
  }
}

function normalizeChannel(value?: string | null): ConversationChannel | undefined {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "telegram") return "telegram";
  if (normalized === "whatsapp") return "whatsapp";
  return undefined;
}

export class PostgresLeadsRepository implements LeadsRepository {
  async findAll(filters?: LeadFilters): Promise<Lead[]> {
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

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const query = `
      ${this.buildLeadSelectSql()}
      ${whereClause}
      ORDER BY COALESCE(latest.ultima_interacao_em, l.atualizado_em, l.criado_em) DESC
    `;

    const result = await pool.query<(LeadRow & { numeric_id: number })>(query, values);
    return result.rows.map((row) => this.mapRowToDomain(row));
  }

  async findById(id: number): Promise<Lead | null> {
    const query = `
      ${this.buildLeadSelectSql()}
      WHERE ${LEAD_ID_SQL.replaceAll("lead_id", "l.lead_id")} = $1
      LIMIT 1
    `;

    const result = await pool.query<(LeadRow & { numeric_id: number })>(query, [id]);
    const row = result.rows[0];
    return row ? this.mapRowToDomain(row) : null;
  }

  async create(data: Omit<Lead, "id">): Promise<Lead> {
    const query = `
      INSERT INTO leads (nome, telefone, interesse_produto, status, origem, criado_em, atualizado_em)
      VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamp, NOW()), NOW())
      RETURNING ${LEAD_ID_SQL} AS numeric_id, lead_id::text, nome, telefone, interesse_produto, status, origem, criado_em, atualizado_em,
        NULL::int AS atendimento_numeric_id, NULL::text AS atendimento_canal, NULL::text AS contato, NULL::text AS ultima_intencao,
        NULL::timestamp AS ultima_interacao_em, NULL::boolean AS encaminhado_humano
    `;

    const result = await pool.query<(LeadRow & { numeric_id: number })>(query, [
      data.nome,
      data.telefone,
      data.interesse,
      mapDomainStatusToDb(data.status),
      this.extractOriginFromEmail(data.email),
      this.toTimestampOrNull(data.data_criacao),
    ]);

    return this.mapRowToDomain(result.rows[0]!);
  }

  async update(id: number, data: Partial<Omit<Lead, "id">>): Promise<Lead | null> {
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
      updates.push(`interesse_produto = $${values.length}`);
    }

    if (data.status !== undefined) {
      values.push(mapDomainStatusToDb(data.status));
      updates.push(`status = $${values.length}`);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    updates.push("atualizado_em = NOW()");
    values.push(id);

    const query = `
      UPDATE leads
      SET ${updates.join(", ")}
      WHERE ${LEAD_ID_SQL} = $${values.length}
      RETURNING ${LEAD_ID_SQL} AS numeric_id, lead_id::text, nome, telefone, interesse_produto, status, origem, criado_em, atualizado_em,
        NULL::int AS atendimento_numeric_id, NULL::text AS atendimento_canal, NULL::text AS contato, NULL::text AS ultima_intencao,
        NULL::timestamp AS ultima_interacao_em, NULL::boolean AS encaminhado_humano
    `;

    const result = await pool.query<(LeadRow & { numeric_id: number })>(query, values);
    const row = result.rows[0];
    return row ? this.mapRowToDomain(row) : null;
  }

  async updateStatus(id: number, status: Lead["status"]): Promise<Lead | null> {
    return this.update(id, { status });
  }

  async upsertByPhone(input: LeadUpsertByPhoneInput): Promise<Lead> {
    const interest = this.normalizeCommercialInterest(input.interest);
    const existing = await pool.query<(LeadRow & { numeric_id: number })>(
      `
        SELECT ${LEAD_ID_SQL} AS numeric_id, lead_id::text, nome, telefone, interesse_produto, status, origem, criado_em, atualizado_em
        FROM leads
        WHERE telefone = $1
          OR ($2 = 'telegram' AND telefone = concat('telegram:', $1))
        ORDER BY CASE WHEN telefone = $1 THEN 0 ELSE 1 END, atualizado_em DESC NULLS LAST, criado_em DESC
        LIMIT 1
      `,
      [input.phone, input.channel ?? "whatsapp"],
    );

    const existingRow = existing.rows[0];
    if (existingRow) {
      const updated = await pool.query<(LeadRow & { numeric_id: number })>(
        `
          UPDATE leads
          SET
            nome = COALESCE($2, nome),
            telefone = $1,
            interesse_produto = COALESCE($3, interesse_produto),
            status = CASE
              WHEN status IN ('CONVERTIDO', 'ENCERRADO') AND $4 NOT IN ('CONVERTIDO', 'ENCERRADO') THEN status
              ELSE $4
            END,
            origem = COALESCE($5, origem),
            atualizado_em = NOW()
          WHERE lead_id = $6::uuid
          RETURNING ${LEAD_ID_SQL} AS numeric_id, lead_id::text, nome, telefone, interesse_produto, status, origem, criado_em, atualizado_em,
            NULL::int AS atendimento_numeric_id, NULL::text AS atendimento_canal, NULL::text AS contato, NULL::text AS ultima_intencao,
            NULL::timestamp AS ultima_interacao_em, NULL::boolean AS encaminhado_humano
        `,
        [input.phone, input.name ?? null, interest, mapDomainStatusToDb(input.status), this.resolveOrigin(input.channel), existingRow.lead_id],
      );

      return this.mapRowToDomain(updated.rows[0]!);
    }

    const inserted = await pool.query<(LeadRow & { numeric_id: number })>(
      `
        INSERT INTO leads (nome, telefone, interesse_produto, status, origem, criado_em, atualizado_em)
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        RETURNING ${LEAD_ID_SQL} AS numeric_id, lead_id::text, nome, telefone, interesse_produto, status, origem, criado_em, atualizado_em,
          NULL::int AS atendimento_numeric_id, NULL::text AS atendimento_canal, NULL::text AS contato, NULL::text AS ultima_intencao,
          NULL::timestamp AS ultima_interacao_em, NULL::boolean AS encaminhado_humano
      `,
      [input.name ?? this.defaultName(input.channel), input.phone, interest, mapDomainStatusToDb(input.status), this.resolveOrigin(input.channel)],
    );

    return this.mapRowToDomain(inserted.rows[0]!);
  }

  private mapRowToDomain(row: LeadRow & { numeric_id: number }): Lead {
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
    };
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
            WHEN upper(a.canal) = 'WHATSAPP' THEN a.whatsapp_chat_id
          END AS contato,
          a.ultima_intencao,
          COALESCE(a.ultima_interacao_em, a.iniciado_em) AS ultima_interacao_em,
          a.encaminhado_humano
        FROM atendimentos a
        LEFT JOIN clientes c ON c.cliente_id = a.cliente_id
        WHERE a.lead_id = l.lead_id
          OR (
            upper(a.canal) = 'TELEGRAM'
            AND (
              a.telegram_chat_id = l.telefone
              OR c.telefone = concat('telegram:', l.telefone)
              OR c.telefone = l.telefone
            )
          )
          OR (
            upper(a.canal) = 'WHATSAPP'
            AND (a.whatsapp_chat_id = l.telefone OR c.telefone = l.telefone)
          )
        ORDER BY COALESCE(a.ultima_interacao_em, a.iniciado_em) DESC NULLS LAST
        LIMIT 1
      ) latest ON TRUE
    `;
  }

  private resolveOrigin(channel?: "whatsapp" | "telegram"): string {
    return channel === "telegram" ? "TELEGRAM" : "WHATSAPP";
  }

  private defaultName(channel?: "whatsapp" | "telegram"): string {
    return channel === "telegram" ? "Cliente Telegram" : "Contato WhatsApp";
  }

  private normalizeCommercialInterest(value?: string | null): string | null {
    const trimmed = value?.trim();
    if (!trimmed) {
      return null;
    }

    const normalized = trimmed.toLowerCase();
    const blockedValues = new Set(["greeting", "menu", "human_handoff", "unknown", "fallback"]);
    if (blockedValues.has(normalized) || normalized.includes("solicitou atendimento humano")) {
      return null;
    }

    return trimmed;
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
    if (!domain || domain === "WHATSAPP.LOCAL") {
      return "WHATSAPP";
    }
    return domain.replace(/\.LOCAL$/i, "") || "PAINEL_ADMIN";
  }

  private toTimestampOrNull(value?: string): string | null {
    if (!value) {
      return null;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
}
