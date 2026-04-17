import { pool } from "../../config/database.js";
import type { Produto } from "../../types/domain.js";
import type { ProductListOptions, ProductsRepository } from "../products.repository.js";

type ProductRow = {
  produto_id: number;
  nome: string;
  descricao: string;
  preco: string | number;
  disponibilidade: boolean;
  quantidade?: number | string | null;
  categoria?: string | null;
  imagem?: string | null;
};

type OptionalColumns = {
  categoria: boolean;
  imagem: boolean;
  quantidade: boolean;
};

export class PostgresProductsRepository implements ProductsRepository {
  private optionalColumnsPromise?: Promise<OptionalColumns>;

  async findAll(options: ProductListOptions = {}): Promise<Produto[]> {
    const columns = await this.getOptionalColumns();
    const values: unknown[] = [];
    const where: string[] = [];

    const search = options.search?.trim();
    if (search) {
      values.push(`%${search}%`);
      where.push(`nome ILIKE $${values.length}`);
    }

    let limitClause = "";
    if (options.limit !== undefined) {
      const safeLimit = Math.min(100, Math.max(1, Math.trunc(options.limit)));
      values.push(safeLimit);
      limitClause = `LIMIT $${values.length}`;
    }

    const query = `
      SELECT ${this.buildSelectColumns(columns)}
      FROM produtos
      ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY nome ASC, produto_id ASC
      ${limitClause}
    `;

    const result = await pool.query<ProductRow>(query, values);
    return result.rows.map((row) => this.mapRowToDomain(row, columns));
  }

  async findById(id: number): Promise<Produto | null> {
    const columns = await this.getOptionalColumns();
    const query = `
      SELECT ${this.buildSelectColumns(columns)}
      FROM produtos
      WHERE produto_id = $1
      LIMIT 1
    `;

    const result = await pool.query<ProductRow>(query, [id]);
    const row = result.rows[0];
    return row ? this.mapRowToDomain(row, columns) : null;
  }

  async create(data: Omit<Produto, "id">): Promise<Produto> {
    const columns = await this.getOptionalColumns();
    const payload = this.mapDomainToPersistence(data, columns);
    const columnNames = Object.keys(payload);
    const values = Object.values(payload);
    const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");

    const query = `
      INSERT INTO produtos (${columnNames.join(", ")})
      VALUES (${placeholders})
      RETURNING ${this.buildSelectColumns(columns)}
    `;

    const result = await pool.query<ProductRow>(query, values);
    return this.mapRowToDomain(result.rows[0]!, columns);
  }

  async update(id: number, data: Partial<Omit<Produto, "id">>): Promise<Produto | null> {
    const columns = await this.getOptionalColumns();
    const payload = this.mapDomainToPersistence(data, columns);
    const entries = Object.entries(payload);

    if (entries.length === 0) {
      return this.findById(id);
    }

    const assignments = entries.map(([column], index) => `${column} = $${index + 1}`);
    const values = entries.map(([, value]) => value);

    const query = `
      UPDATE produtos
      SET ${assignments.join(", ")}
      WHERE produto_id = $${values.length + 1}
      RETURNING ${this.buildSelectColumns(columns)}
    `;

    const result = await pool.query<ProductRow>(query, [...values, id]);
    const row = result.rows[0];
    return row ? this.mapRowToDomain(row, columns) : null;
  }

  async delete(id: number): Promise<boolean> {
    const result = await pool.query("DELETE FROM produtos WHERE produto_id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }

  private async getOptionalColumns(): Promise<OptionalColumns> {
    if (!this.optionalColumnsPromise) {
      this.optionalColumnsPromise = this.loadOptionalColumns();
    }

    return this.optionalColumnsPromise;
  }

  private async loadOptionalColumns(): Promise<OptionalColumns> {
    const result = await pool.query<{ column_name: string }>(
      `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'produtos'
          AND column_name = ANY($1::text[])
      `,
      [["categoria", "imagem", "quantidade"]],
    );

    const available = new Set(result.rows.map((row) => row.column_name));

    return {
      categoria: available.has("categoria"),
      imagem: available.has("imagem"),
      quantidade: available.has("quantidade"),
    };
  }

  private buildSelectColumns(columns: OptionalColumns): string {
    const parts = [
      "produto_id",
      "nome",
      "descricao",
      "preco",
      "disponibilidade",
      columns.quantidade ? "quantidade" : "0::int AS quantidade",
      columns.categoria ? "categoria" : "NULL::text AS categoria",
      columns.imagem ? "imagem" : "NULL::text AS imagem",
    ];

    return parts.join(", ");
  }

  private mapRowToDomain(row: ProductRow, columns: OptionalColumns): Produto {
    return {
      id: Number(row.produto_id),
      nome: row.nome,
      categoria: columns.categoria ? row.categoria ?? "Sem categoria" : "Sem categoria",
      descricao: row.descricao,
      preco: String(row.preco),
      quantidade: Number(row.quantidade ?? 0),
      disponivel: Boolean(row.disponibilidade),
      imagem: columns.imagem ? row.imagem ?? "" : "",
    };
  }

  private mapDomainToPersistence(data: Partial<Omit<Produto, "id">>, columns: OptionalColumns): Record<string, unknown> {
    const payload: Record<string, unknown> = {};

    if (data.nome !== undefined) payload.nome = data.nome;
    if (data.descricao !== undefined) payload.descricao = data.descricao;
    if (data.preco !== undefined) payload.preco = data.preco;
    if (data.disponivel !== undefined) payload.disponibilidade = data.disponivel;
    if (columns.quantidade && data.quantidade !== undefined) payload.quantidade = data.quantidade;
    if (columns.categoria && data.categoria !== undefined) payload.categoria = data.categoria;
    if (columns.imagem && data.imagem !== undefined) payload.imagem = data.imagem;

    return payload;
  }
}
