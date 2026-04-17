import { pool } from "../../config/database.js";
import type { Lead, LeadFilters } from "../../types/domain.js";
import type { LeadUpsertByPhoneInput, LeadsRepository } from "../leads.repository.js";

type DbLeadStatus = "NOVO" | "INTERESSADO" | "ENCAMINHADO_HUMANO" | "CONVERTIDO" | "ENCERRADO";

type LeadRow = {
  lead_id: string;
  nome: string | null;
  telefone: string;
  interesse_produto: string | null;
  status: DbLeadStatus;
  origem: string;
  criado_em: string;
  atualizado_em: string;
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

export class PostgresLeadsRepository implements LeadsRepository {
  async findAll(filters?: LeadFilters): Promise<Lead[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (filters?.status) {
      values.push(mapDomainStatusToDb(filters.status));
      conditions.push(`status = $${values.length}`);
    }

    if (filters?.search) {
      values.push(`%${filters.search.toLowerCase()}%`);
      conditions.push(`LOWER(CONCAT_WS(' ', COALESCE(nome, ''), telefone, COALESCE(interesse_produto, ''), origem)) LIKE $${values.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const query = `
      SELECT ${LEAD_ID_SQL} AS numeric_id, lead_id::text, nome, telefone, interesse_produto, status, origem, criado_em, atualizado_em
      FROM leads
      ${whereClause}
      ORDER BY criado_em DESC
    `;

    const result = await pool.query<(LeadRow & { numeric_id: number })>(query, values);
    return result.rows.map((row) => this.mapRowToDomain(row));
  }

  async findById(id: number): Promise<Lead | null> {
    const query = `
      SELECT ${LEAD_ID_SQL} AS numeric_id, lead_id::text, nome, telefone, interesse_produto, status, origem, criado_em, atualizado_em
      FROM leads
      WHERE ${LEAD_ID_SQL} = $1
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
      RETURNING ${LEAD_ID_SQL} AS numeric_id, lead_id::text, nome, telefone, interesse_produto, status, origem, criado_em, atualizado_em
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
      RETURNING ${LEAD_ID_SQL} AS numeric_id, lead_id::text, nome, telefone, interesse_produto, status, origem, criado_em, atualizado_em
    `;

    const result = await pool.query<(LeadRow & { numeric_id: number })>(query, values);
    const row = result.rows[0];
    return row ? this.mapRowToDomain(row) : null;
  }

  async updateStatus(id: number, status: Lead["status"]): Promise<Lead | null> {
    return this.update(id, { status });
  }

  async upsertByPhone(input: LeadUpsertByPhoneInput): Promise<Lead> {
    const existing = await pool.query<(LeadRow & { numeric_id: number })>(
      `
        SELECT ${LEAD_ID_SQL} AS numeric_id, lead_id::text, nome, telefone, interesse_produto, status, origem, criado_em, atualizado_em
        FROM leads
        WHERE telefone = $1
        LIMIT 1
      `,
      [input.phone],
    );

    const existingRow = existing.rows[0];
    if (existingRow) {
      const updated = await pool.query<(LeadRow & { numeric_id: number })>(
        `
          UPDATE leads
          SET
            nome = COALESCE($2, nome),
            interesse_produto = $3,
            status = $4,
            atualizado_em = NOW()
          WHERE telefone = $1
          RETURNING ${LEAD_ID_SQL} AS numeric_id, lead_id::text, nome, telefone, interesse_produto, status, origem, criado_em, atualizado_em
        `,
        [input.phone, input.name ?? null, input.interest, mapDomainStatusToDb(input.status)],
      );

      return this.mapRowToDomain(updated.rows[0]!);
    }

    const inserted = await pool.query<(LeadRow & { numeric_id: number })>(
      `
        INSERT INTO leads (nome, telefone, interesse_produto, status, origem, criado_em, atualizado_em)
        VALUES ($1, $2, $3, $4, 'WHATSAPP', NOW(), NOW())
        RETURNING ${LEAD_ID_SQL} AS numeric_id, lead_id::text, nome, telefone, interesse_produto, status, origem, criado_em, atualizado_em
      `,
      [input.name ?? "Contato WhatsApp", input.phone, input.interest, mapDomainStatusToDb(input.status)],
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
    };
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
