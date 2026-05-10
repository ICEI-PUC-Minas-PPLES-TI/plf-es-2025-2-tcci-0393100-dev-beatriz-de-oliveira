import { pool } from "../../config/database.js";
import type { Metricas, MetricaTopProduto, MetricaVendaDia } from "../../types/domain.js";
import type { MetricsFilters, MetricsRepository } from "../metrics.repository.js";

type SalesByDayRow = {
  dia_iso: string;
  vendas: string | number;
  receita: string | number | null;
};

type TopProductRow = {
  produto: string;
  vendas: string | number;
  receita: string | number | null;
};

function formatDayMonth(value: string): string {
  const date = new Date(value);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export class PostgresMetricsRepository implements MetricsRepository {
  private ensurePromise?: Promise<void>;

  async get(filters: MetricsFilters = {}): Promise<Metricas> {
    await this.ensureSchema();

    const [salesByDay, topProducts, novosClientes] = await Promise.all([
      this.getSalesByDay(filters),
      this.getTopProducts(filters),
      this.getNewCustomersCount(filters),
    ]);

    return {
      vendasPorDia: salesByDay,
      topProdutos: topProducts,
      novosClientes,
    };
  }

  private async getSalesByDay(filters: MetricsFilters): Promise<MetricaVendaDia[]> {
    const result = await pool.query<SalesByDayRow>(
      `
        SELECT
          TO_CHAR(DATE(COALESCE(pago_em, atualizado_em, criado_em, data_criacao)), 'YYYY-MM-DD') AS dia_iso,
          COUNT(*)::int AS vendas,
          COALESCE(SUM(valor_total), 0)::numeric AS receita
        FROM pedidos
        WHERE status = 'CONCLUIDO'
          AND ($1::date IS NULL OR DATE(COALESCE(pago_em, atualizado_em, criado_em, data_criacao)) >= $1::date)
          AND ($2::date IS NULL OR DATE(COALESCE(pago_em, atualizado_em, criado_em, data_criacao)) <= $2::date)
        GROUP BY DATE(COALESCE(pago_em, atualizado_em, criado_em, data_criacao))
        ORDER BY DATE(COALESCE(pago_em, atualizado_em, criado_em, data_criacao)) ASC
      `,
      [filters.startDate ?? null, filters.endDate ?? null],
    );

    return result.rows.map((row) => ({
      dia: formatDayMonth(row.dia_iso),
      vendas: Number(row.vendas),
      receita: Number(row.receita ?? 0),
    }));
  }

  private async getTopProducts(filters: MetricsFilters): Promise<MetricaTopProduto[]> {
    const result = await pool.query<TopProductRow>(
      `
        WITH filtered_orders AS (
          SELECT p.pedido_id, p.valor_total, COALESCE(p.pago_em, p.atualizado_em, p.criado_em, p.data_criacao) AS data_referencia
          FROM pedidos p
          WHERE p.status = 'CONCLUIDO'
            AND ($1::date IS NULL OR DATE(COALESCE(p.pago_em, p.atualizado_em, p.criado_em, p.data_criacao)) >= $1::date)
            AND ($2::date IS NULL OR DATE(COALESCE(p.pago_em, p.atualizado_em, p.criado_em, p.data_criacao)) <= $2::date)
        ),
        item_sales AS (
          SELECT
            pr.nome AS produto,
            SUM(ip.quantidade)::int AS vendas,
            COALESCE(SUM(ip.quantidade * ip.preco_unitario), 0)::numeric AS receita
          FROM filtered_orders fo
          JOIN itens_pedido ip ON ip.pedido_id = fo.pedido_id
          JOIN produtos pr ON pr.produto_id = ip.produto_id
          GROUP BY pr.nome
        ),
        meta_sales AS (
          SELECT
            COALESCE(named_pr.nome, price_pr.nome, 'Produto não identificado') AS produto,
            COUNT(*)::int AS vendas,
            COALESCE(SUM(fo.valor_total), 0)::numeric AS receita
          FROM filtered_orders fo
          JOIN pedido_cobranca_meta m ON m.pedido_id = fo.pedido_id
          LEFT JOIN produtos named_pr ON named_pr.nome = m.numero_pedido
          LEFT JOIN LATERAL (
            SELECT pr.produto_id, pr.nome
            FROM produtos pr
            WHERE named_pr.produto_id IS NULL
              AND pr.preco = fo.valor_total
            ORDER BY pr.disponibilidade DESC, pr.produto_id ASC
            LIMIT 1
          ) price_pr ON TRUE
          WHERE NOT EXISTS (
              SELECT 1
              FROM itens_pedido ip
              WHERE ip.pedido_id = fo.pedido_id
            )
          GROUP BY COALESCE(named_pr.nome, price_pr.nome, 'Produto não identificado')
        ),
        combined AS (
          SELECT produto, vendas, receita FROM item_sales
          UNION ALL
          SELECT produto, vendas, receita FROM meta_sales
        )
        SELECT
          produto,
          SUM(vendas)::int AS vendas,
          COALESCE(SUM(receita), 0)::numeric AS receita
        FROM combined
        GROUP BY produto
        HAVING SUM(vendas) > 0
        ORDER BY SUM(vendas) DESC, SUM(receita) DESC, produto ASC
        LIMIT 5
      `,
      [filters.startDate ?? null, filters.endDate ?? null],
    );

    return result.rows.map((row) => ({
      produto: row.produto,
      vendas: Number(row.vendas),
      receita: formatCurrency(Number(row.receita ?? 0)),
    }));
  }

  private async getNewCustomersCount(filters: MetricsFilters): Promise<number> {
    const result = await pool.query<{ total: string }>(
      `
        SELECT COUNT(DISTINCT cliente_id)::int AS total
        FROM pedidos
        WHERE cliente_id IS NOT NULL
          AND status = 'CONCLUIDO'
          AND ($1::date IS NULL OR DATE(COALESCE(pago_em, atualizado_em, criado_em, data_criacao)) >= $1::date)
          AND ($2::date IS NULL OR DATE(COALESCE(pago_em, atualizado_em, criado_em, data_criacao)) <= $2::date)
      `,
      [filters.startDate ?? null, filters.endDate ?? null],
    );

    return Number(result.rows[0]?.total ?? 0);
  }

  private async ensureSchema(): Promise<void> {
    if (!this.ensurePromise) {
      this.ensurePromise = (async () => {
        await pool.query(`
          ALTER TABLE pedidos
          ADD COLUMN IF NOT EXISTS pago_em timestamp without time zone
        `);

        await pool.query(`
          UPDATE pedidos
          SET pago_em = COALESCE(atualizado_em, criado_em, data_criacao)
          WHERE status = 'CONCLUIDO'
            AND pago_em IS NULL
        `);
      })();
    }

    return this.ensurePromise;
  }
}
