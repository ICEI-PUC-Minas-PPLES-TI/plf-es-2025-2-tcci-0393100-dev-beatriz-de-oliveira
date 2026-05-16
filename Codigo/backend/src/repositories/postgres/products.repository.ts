import type { PoolClient } from "pg";
import { pool } from "../../config/database.js";
import type { ProductImage, Produto } from "../../types/domain.js";
import type { ProductSearchInput, ProductsRepository } from "../products.repository.js";

type ProductRow = {
  produto_id: number;
  nome: string;
  descricao: string;
  preco: string | number;
  disponibilidade: boolean;
  categoria?: string | null;
  imagem?: string | null;
  quantidade?: string | number | null;
};

type OptionalColumns = {
  categoria: boolean;
  imagem: boolean;
  quantidade: boolean;
};

type ProductImageRow = {
  image_id: string | number;
  product_id: number;
  image_url: string;
  ordem: number;
  principal: boolean;
  criado_em: string | null;
};

export class PostgresProductsRepository implements ProductsRepository {
  private optionalColumnsPromise?: Promise<OptionalColumns>;
  private ensureImagesPromise?: Promise<void>;

  async findAll(): Promise<Produto[]> {
    await this.ensureProductImagesTable();
    const columns = await this.getOptionalColumns();
    const query = `
      SELECT ${this.buildSelectColumns(columns)}
      FROM produtos
      ORDER BY produto_id ASC
    `;

    const result = await pool.query<ProductRow>(query);
    return this.mapRowsToDomain(result.rows, columns);
  }

  async findById(id: number): Promise<Produto | null> {
    await this.ensureProductImagesTable();
    const columns = await this.getOptionalColumns();
    const query = `
      SELECT ${this.buildSelectColumns(columns)}
      FROM produtos
      WHERE produto_id = $1
      LIMIT 1
    `;

    const result = await pool.query<ProductRow>(query, [id]);
    const row = result.rows[0];
    if (!row) return null;
    const mapped = await this.mapRowsToDomain([row], columns);
    return mapped[0] ?? null;
  }

  async searchByName(input: ProductSearchInput): Promise<Produto[]> {
    await this.ensureProductImagesTable();
    const columns = await this.getOptionalColumns();
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (input.extractedTerm.trim()) {
      values.push(`%${input.extractedTerm.trim()}%`);
      conditions.push(`unaccent(lower(nome)) LIKE unaccent(lower($${values.length}))`);
    }

    for (const token of input.requiredTokens) {
      values.push(`%${token}%`);
      const tokenCondition = columns.categoria
        ? `(unaccent(lower(nome)) LIKE unaccent(lower($${values.length})) OR unaccent(lower(categoria)) LIKE unaccent(lower($${values.length})))`
        : `unaccent(lower(nome)) LIKE unaccent(lower($${values.length}))`;
      conditions.push(tokenCondition);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" OR ")}` : "";
    const query = `
      SELECT ${this.buildSelectColumns(columns)}
      FROM produtos
      ${whereClause}
      ORDER BY produto_id ASC
      LIMIT 25
    `;

    const result = await pool.query<ProductRow>(query, values);
    return this.mapRowsToDomain(result.rows, columns);
  }

  async create(data: Omit<Produto, "id">): Promise<Produto> {
    await this.ensureProductImagesTable();
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

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<ProductRow>(query, values);
      const productId = Number(result.rows[0]!.produto_id);
      await this.replaceProductImages(client, productId, this.normalizeImagesForPersistence(data));
      await client.query("COMMIT");
      const created = await this.findById(productId);
      return created!;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async update(id: number, data: Partial<Omit<Produto, "id">>): Promise<Produto | null> {
    await this.ensureProductImagesTable();
    const columns = await this.getOptionalColumns();
    const payload = this.mapDomainToPersistence(data, columns);
    const entries = Object.entries(payload);

    if (entries.length === 0 && data.images === undefined && data.primaryImage === undefined) {
      return this.findById(id);
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      if (entries.length > 0) {
        const assignments = entries.map(([column], index) => `${column} = $${index + 1}`);
        const values = entries.map(([, value]) => value);

        const query = `
          UPDATE produtos
          SET ${assignments.join(", ")}
          WHERE produto_id = $${values.length + 1}
          RETURNING ${this.buildSelectColumns(columns)}
        `;

        const result = await client.query<ProductRow>(query, [...values, id]);
        if (!result.rows[0]) {
          await client.query("ROLLBACK");
          return null;
        }
      } else {
        const exists = await client.query("SELECT 1 FROM produtos WHERE produto_id = $1 LIMIT 1", [id]);
        if (!exists.rows[0]) {
          await client.query("ROLLBACK");
          return null;
        }
      }

      if (data.images !== undefined || data.primaryImage !== undefined || data.imagem !== undefined) {
        await this.replaceProductImages(client, id, this.normalizeImagesForPersistence(data));
      }

      await client.query("COMMIT");
      return this.findById(id);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
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

  private async ensureProductImagesTable(): Promise<void> {
    if (!this.ensureImagesPromise) {
      this.ensureImagesPromise = (async () => {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS product_images (
            image_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            product_id integer NOT NULL REFERENCES produtos(produto_id) ON DELETE CASCADE,
            image_url text NOT NULL,
            ordem integer NOT NULL DEFAULT 0,
            principal boolean NOT NULL DEFAULT false,
            criado_em timestamp without time zone NOT NULL DEFAULT NOW()
          )
        `);

        await pool.query(`
          CREATE INDEX IF NOT EXISTS idx_product_images_product_id_ordem
          ON product_images(product_id, ordem, image_id)
        `);

        await pool.query(`
          CREATE UNIQUE INDEX IF NOT EXISTS idx_product_images_one_primary
          ON product_images(product_id)
          WHERE principal
        `);

        const legacyImageColumn = await pool.query<{ exists: boolean }>(`
          SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = 'produtos'
              AND column_name = 'imagem'
          ) AS exists
        `);

        if (legacyImageColumn.rows[0]?.exists) {
          await pool.query(`
            INSERT INTO product_images (product_id, image_url, ordem, principal)
            SELECT p.produto_id, p.imagem, 0, true
            FROM produtos p
            WHERE NULLIF(TRIM(COALESCE(p.imagem, '')), '') IS NOT NULL
              AND NOT EXISTS (
                SELECT 1
                FROM product_images pi
                WHERE pi.product_id = p.produto_id
              )
          `);
        }
      })();
    }

    return this.ensureImagesPromise;
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
      columns.categoria ? "categoria" : "NULL::text AS categoria",
      columns.imagem ? "imagem" : "NULL::text AS imagem",
      columns.quantidade ? "quantidade" : "0::int AS quantidade",
    ];

    return parts.join(", ");
  }

  private async mapRowsToDomain(rows: ProductRow[], columns: OptionalColumns): Promise<Produto[]> {
    if (rows.length === 0) {
      return [];
    }

    const imageMap = await this.loadImagesByProductIds(rows.map((row) => Number(row.produto_id)));
    return rows.map((row) => this.mapRowToDomain(row, columns, imageMap.get(Number(row.produto_id)) ?? []));
  }

  private async loadImagesByProductIds(productIds: number[]): Promise<Map<number, ProductImage[]>> {
    const result = await pool.query<ProductImageRow>(
      `
        SELECT image_id, product_id, image_url, ordem, principal, criado_em
        FROM product_images
        WHERE product_id = ANY($1::int[])
        ORDER BY product_id ASC, principal DESC, ordem ASC, image_id ASC
      `,
      [productIds],
    );

    const byProduct = new Map<number, ProductImage[]>();
    for (const row of result.rows) {
      const current = byProduct.get(Number(row.product_id)) ?? [];
      current.push({
        id: Number(row.image_id),
        productId: Number(row.product_id),
        imageUrl: row.image_url,
        ordem: Number(row.ordem),
        principal: Boolean(row.principal),
        criadoEm: row.criado_em ? new Date(row.criado_em).toISOString() : undefined,
      });
      byProduct.set(Number(row.product_id), current);
    }

    return byProduct;
  }

  private mapRowToDomain(row: ProductRow, columns: OptionalColumns, storedImages: ProductImage[]): Produto {
    const legacyImage = columns.imagem ? row.imagem ?? "" : "";
    const images = storedImages.length > 0
      ? storedImages
      : legacyImage
        ? [{ imageUrl: legacyImage, ordem: 0, principal: true }]
        : [];
    const primaryImage = images.find((image) => image.principal)?.imageUrl ?? images[0]?.imageUrl ?? legacyImage;

    return {
      id: Number(row.produto_id),
      nome: row.nome,
      categoria: columns.categoria ? row.categoria ?? "Sem categoria" : "Sem categoria",
      descricao: row.descricao,
      preco: String(row.preco),
      quantidade: Number(row.quantidade ?? 0),
      disponivel: Boolean(row.disponibilidade),
      imagem: primaryImage ?? "",
      images,
      primaryImage,
    };
  }

  private mapDomainToPersistence(data: Partial<Omit<Produto, "id">>, columns: OptionalColumns): Record<string, unknown> {
    const payload: Record<string, unknown> = {};

    if (data.nome !== undefined) payload.nome = data.nome;
    if (data.descricao !== undefined) payload.descricao = data.descricao;
    if (data.preco !== undefined) payload.preco = data.preco;
    if (columns.quantidade && data.quantidade !== undefined) payload.quantidade = data.quantidade;
    if (data.disponivel !== undefined) payload.disponibilidade = data.disponivel;
    if (columns.categoria && data.categoria !== undefined) payload.categoria = data.categoria;
    if (columns.imagem && (data.primaryImage !== undefined || data.imagem !== undefined || data.images !== undefined)) {
      payload.imagem = data.primaryImage ?? data.images?.find((image) => image.principal)?.imageUrl ?? data.images?.[0]?.imageUrl ?? data.imagem ?? "";
    }

    return payload;
  }

  private normalizeImagesForPersistence(data: Partial<Omit<Produto, "id">>): ProductImage[] {
    const rawImages =
      data.images !== undefined && data.images.length > 0
        ? data.images
        : data.primaryImage || data.imagem
          ? [{ imageUrl: data.primaryImage ?? data.imagem ?? "", ordem: 0, principal: true }]
          : [];

    const unique = new Map<string, ProductImage>();
    rawImages
      .map((image, index) => ({
        imageUrl: image.imageUrl?.trim() ?? "",
        ordem: Number.isFinite(image.ordem) ? Number(image.ordem) : index,
        principal: Boolean(image.principal),
      }))
      .filter((image) => image.imageUrl)
      .forEach((image) => {
        if (!unique.has(image.imageUrl)) {
          unique.set(image.imageUrl, image);
        }
      });

    const images = Array.from(unique.values())
      .sort((left, right) => left.ordem - right.ordem)
      .map((image, index) => ({ ...image, ordem: index }));

    const explicitPrimary = images.findIndex((image) => image.principal);
    return images.map((image, index) => ({
      ...image,
      principal: explicitPrimary >= 0 ? index === explicitPrimary : index === 0,
    }));
  }

  private async replaceProductImages(client: PoolClient, productId: number, images: ProductImage[]): Promise<void> {
    await client.query("DELETE FROM product_images WHERE product_id = $1", [productId]);

    for (const image of images) {
      await client.query(
        `
          INSERT INTO product_images (product_id, image_url, ordem, principal)
          VALUES ($1, $2, $3, $4)
        `,
        [productId, image.imageUrl, image.ordem, image.principal],
      );
    }
  }
}
