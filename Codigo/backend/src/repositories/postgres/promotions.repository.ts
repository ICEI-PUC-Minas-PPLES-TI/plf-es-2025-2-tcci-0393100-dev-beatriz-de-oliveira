import { pool } from "../../config/database.js";
import type { Promocao } from "../../types/domain.js";
import type { PromotionsRepository } from "../promotions.repository.js";

type PromotionRow = {
  id: number;
  nome: string;
  descricao: string | null;
  desconto: string | number | null;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string | null;
  produto_id: number | null;
  tipo: Promocao["tipo"] | null;
  inicio_em: string | null;
  fim_em: string | null;
  imagem: string | null;
  produto_nome: string | null;
  produto_imagem: string | null;
};

export class PostgresPromotionsRepository implements PromotionsRepository {
  private schemaReadyPromise?: Promise<void>;
  private productImageColumnPromise?: Promise<boolean>;

  async findAll(): Promise<Promocao[]> {
    await this.ensureSchema();
    const query = await this.selectQuery();
    const result = await pool.query<PromotionRow>(query);
    return result.rows.map((row) => this.mapRowToDomain(row));
  }

  async findById(id: number): Promise<Promocao | null> {
    await this.ensureSchema();
    const query = `${await this.selectQuery()} WHERE pr.id = $1`;
    const result = await pool.query<PromotionRow>(query, [id]);
    const row = result.rows[0];
    return row ? this.mapRowToDomain(row) : null;
  }

  async create(data: Omit<Promocao, "id">): Promise<Promocao> {
    await this.ensureSchema();
    const payload = this.mapDomainToPersistence(data);
    const result = await pool.query<PromotionRow>(
      `
        INSERT INTO promocoes (
          nome,
          descricao,
          desconto,
          ativo,
          produto_id,
          tipo,
          inicio_em,
          fim_em,
          imagem,
          criado_em,
          atualizado_em
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        RETURNING id
      `,
      [
        payload.nome,
        payload.descricao,
        payload.desconto,
        payload.ativo,
        payload.produto_id,
        payload.tipo,
        payload.inicio_em,
        payload.fim_em,
        payload.imagem,
      ],
    );

    return (await this.findById(result.rows[0]!.id))!;
  }

  async update(id: number, data: Partial<Omit<Promocao, "id">>): Promise<Promocao | null> {
    await this.ensureSchema();
    const payload = this.mapDomainToPersistence(data);
    const entries = Object.entries(payload);

    if (entries.length === 0) {
      return this.findById(id);
    }

    const assignments = entries.map(([column], index) => `${column} = $${index + 1}`);
    const values = entries.map(([, value]) => value);

    const result = await pool.query<{ id: number }>(
      `
        UPDATE promocoes
        SET ${assignments.join(", ")}, atualizado_em = NOW()
        WHERE id = $${values.length + 1}
        RETURNING id
      `,
      [...values, id],
    );

    const row = result.rows[0];
    return row ? this.findById(row.id) : null;
  }

  async delete(id: number): Promise<boolean> {
    await this.ensureSchema();
    const result = await pool.query(`DELETE FROM promocoes WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  private async selectQuery(): Promise<string> {
    const hasProductImage = await this.hasProductImageColumn();

    return `
      SELECT
        pr.id,
        pr.nome,
        pr.descricao,
        pr.desconto,
        pr.ativo,
        pr.criado_em,
        pr.atualizado_em,
        pr.produto_id,
        pr.tipo,
        pr.inicio_em,
        pr.fim_em,
        pr.imagem,
        p.nome AS produto_nome,
        ${hasProductImage ? "p.imagem" : "NULL::text"} AS produto_imagem
      FROM promocoes pr
      LEFT JOIN produtos p ON p.produto_id = pr.produto_id
    `;
  }

  private mapRowToDomain(row: PromotionRow): Promocao {
    return {
      id: Number(row.id),
      produto_id: Number(row.produto_id ?? 0),
      produto: row.produto_nome ?? row.nome,
      tipo: row.tipo ?? "PROMOCAO",
      desconto: String(row.desconto ?? 0),
      ativa: Boolean(row.ativo),
      inicio_em: this.formatDate(row.inicio_em),
      fim_em: this.formatDate(row.fim_em),
      imagem: row.imagem ?? row.produto_imagem ?? "",
    };
  }

  private mapDomainToPersistence(data: Partial<Omit<Promocao, "id">>): Record<string, unknown> {
    const payload: Record<string, unknown> = {};

    if (data.produto !== undefined) {
      payload.nome = data.produto;
      payload.descricao = `Promocao do produto ${data.produto}`;
    }
    if (data.produto_id !== undefined) payload.produto_id = data.produto_id;
    if (data.tipo !== undefined) payload.tipo = data.tipo;
    if (data.desconto !== undefined) payload.desconto = data.desconto || 0;
    if (data.ativa !== undefined) payload.ativo = data.ativa;
    if (data.inicio_em !== undefined) payload.inicio_em = data.inicio_em || null;
    if (data.fim_em !== undefined) payload.fim_em = data.fim_em || null;
    if (data.imagem !== undefined) payload.imagem = data.imagem || null;
    if (!Object.prototype.hasOwnProperty.call(payload, "desconto")) payload.desconto = 0;
    if (payload.descricao === undefined && data.produto !== undefined) payload.descricao = `Promocao do produto ${data.produto}`;

    return payload;
  }

  private formatDate(value: string | Date | null): string {
    if (!value) {
      return new Date().toISOString().slice(0, 10);
    }

    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }

    return value.slice(0, 10);
  }

  private async hasProductImageColumn(): Promise<boolean> {
    if (!this.productImageColumnPromise) {
      this.productImageColumnPromise = this.loadProductImageColumn();
    }

    return this.productImageColumnPromise;
  }

  private async loadProductImageColumn(): Promise<boolean> {
    const result = await pool.query<{ exists: boolean }>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'produtos'
            AND column_name = 'imagem'
        ) AS exists
      `,
    );

    return Boolean(result.rows[0]?.exists);
  }

  private async ensureSchema(): Promise<void> {
    if (!this.schemaReadyPromise) {
      this.schemaReadyPromise = this.loadSchema();
    }

    await this.schemaReadyPromise;
  }

  private async loadSchema(): Promise<void> {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS promocoes (
        id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        nome VARCHAR(160) NOT NULL,
        descricao TEXT,
        desconto NUMERIC(10, 2) NOT NULL DEFAULT 0,
        ativo BOOLEAN NOT NULL DEFAULT TRUE,
        criado_em TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
        atualizado_em TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
        produto_id INTEGER REFERENCES produtos(produto_id) ON DELETE SET NULL,
        tipo VARCHAR(20) NOT NULL DEFAULT 'PROMOCAO',
        inicio_em DATE,
        fim_em DATE,
        imagem TEXT
      )
    `);
  }
}

