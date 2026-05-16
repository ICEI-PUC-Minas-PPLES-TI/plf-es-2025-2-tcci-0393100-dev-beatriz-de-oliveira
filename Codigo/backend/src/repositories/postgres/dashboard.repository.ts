import { pool } from "../../config/database.js";
import type { DashboardAtendimentoRecente, DashboardSummary, DashboardTopProduto } from "../../types/domain.js";
import type { DashboardFilters, DashboardRepository } from "../dashboard.repository.js";

type CountersRow = {
  pedidos_pendentes: string | number;
  atendimentos_ativos: string | number;
  produtos_disponiveis: string | number;
  pedidos_periodo: string | number;
};

type TopProductRow = {
  produto: string;
  preco: string | number | null;
  imagem: string | null;
  vendas: string | number;
  receita: string | number | null;
};

type RecentConversationRow = {
  atendimento_id: string;
  numeric_id: number;
  cliente: string | null;
  mensagem: string | null;
  horario: string | null;
};

function formatPrice(value: string | number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value ?? 0));
}

export class PostgresDashboardRepository implements DashboardRepository {
  private hasImageColumnPromise?: Promise<boolean>;
  private ensurePromise?: Promise<void>;

  async getSummary(filters: DashboardFilters = {}): Promise<DashboardSummary> {
    await this.ensureSchema();

    const [counters, topProdutos, atendimentosRecentes] = await Promise.all([
      this.getCounters(filters),
      this.getTopProdutos(filters),
      this.getRecentConversations(filters),
    ]);

    return {
      ...counters,
      topProdutos,
      atendimentosRecentes,
    };
  }

  private async getCounters(filters: DashboardFilters): Promise<Pick<DashboardSummary, "pedidosPendentes" | "atendimentosAtivos" | "produtosDisponiveis" | "pedidosMes">> {
    const result = await pool.query<CountersRow>(
      `
        SELECT
          (
            SELECT COUNT(*)::int
            FROM pedidos
            WHERE status = 'PENDENTE'
              AND ($1::date IS NULL OR DATE(COALESCE(criado_em, data_criacao)) >= $1::date)
              AND ($2::date IS NULL OR DATE(COALESCE(criado_em, data_criacao)) <= $2::date)
          ) AS pedidos_pendentes,
          (
            SELECT COUNT(*)::int
            FROM (
              SELECT
                a.atendimento_id,
                a.status,
                COALESCE(a.ultima_interacao_em, a.iniciado_em) AS data_referencia,
                row_number() OVER (
                  PARTITION BY
                    lower(a.canal),
                    COALESCE(
                      a.cliente_id::text,
                      NULLIF(CASE
                        WHEN upper(a.canal) = 'TELEGRAM' THEN a.telegram_chat_id
                      END, ''),
                      a.atendimento_id::text
                    )
                  ORDER BY COALESCE(a.ultima_interacao_em, a.iniciado_em) DESC NULLS LAST, a.atendimento_id DESC
                ) AS row_rank
              FROM atendimentos a
              WHERE upper(COALESCE(a.canal, '')) = 'TELEGRAM'
            ) active_attendances
            WHERE row_rank = 1
              AND COALESCE(upper(status), 'ATIVO') IN ('ATIVO', 'PENDENTE')
              AND ($1::date IS NULL OR DATE(data_referencia) >= $1::date)
              AND ($2::date IS NULL OR DATE(data_referencia) <= $2::date)
          ) AS atendimentos_ativos,
          (SELECT COUNT(*)::int FROM produtos WHERE disponibilidade = TRUE) AS produtos_disponiveis,
          (
            SELECT COUNT(*)::int
            FROM pedidos
            WHERE status = 'CONCLUIDO'
              AND ($1::date IS NULL OR DATE(COALESCE(pago_em, atualizado_em, criado_em, data_criacao)) >= $1::date)
              AND ($2::date IS NULL OR DATE(COALESCE(pago_em, atualizado_em, criado_em, data_criacao)) <= $2::date)
          ) AS pedidos_periodo
      `,
      [filters.startDate ?? null, filters.endDate ?? null],
    );

    const row = result.rows[0];

    return {
      pedidosPendentes: Number(row?.pedidos_pendentes ?? 0),
      atendimentosAtivos: Number(row?.atendimentos_ativos ?? 0),
      produtosDisponiveis: Number(row?.produtos_disponiveis ?? 0),
      pedidosMes: Number(row?.pedidos_periodo ?? 0),
    };
  }

  private async getTopProdutos(filters: DashboardFilters): Promise<DashboardTopProduto[]> {
    const hasImageColumn = await this.hasImageColumn();
    const imageSelect = hasImageColumn ? "pr.imagem" : "NULL::text AS imagem";
    const imageGroupBy = hasImageColumn ? ", pr.imagem" : "";
    const metaImageSelect = hasImageColumn ? "COALESCE(MAX(named_pr.imagem), MAX(price_pr.imagem))" : "NULL::text";

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
            pr.preco,
            ${imageSelect},
            SUM(ip.quantidade)::int AS vendas,
            COALESCE(SUM(ip.quantidade * ip.preco_unitario), 0)::numeric AS receita
          FROM filtered_orders fo
          JOIN itens_pedido ip ON ip.pedido_id = fo.pedido_id
          JOIN produtos pr ON pr.produto_id = ip.produto_id
          GROUP BY pr.nome, pr.preco${imageGroupBy}
        ),
        meta_sales AS (
          SELECT
            COALESCE(named_pr.nome, price_pr.nome, 'Produto não identificado') AS produto,
            COALESCE(MAX(named_pr.preco), MAX(price_pr.preco), AVG(fo.valor_total))::numeric AS preco,
            ${metaImageSelect} AS imagem,
            COUNT(*)::int AS vendas,
            COALESCE(SUM(fo.valor_total), 0)::numeric AS receita
          FROM filtered_orders fo
          JOIN pedido_cobranca_meta m ON m.pedido_id = fo.pedido_id
          LEFT JOIN produtos named_pr ON named_pr.nome = m.numero_pedido
          LEFT JOIN LATERAL (
            SELECT pr.produto_id, pr.nome, pr.preco${hasImageColumn ? ", pr.imagem" : ""}
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
          SELECT produto, preco, imagem, vendas, receita FROM item_sales
          UNION ALL
          SELECT produto, preco, imagem, vendas, receita FROM meta_sales
        )
        SELECT
          produto,
          COALESCE(MAX(preco), 0)::numeric AS preco,
          MAX(imagem) AS imagem,
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

    return result.rows.map((row, index) => ({
      id: index + 1,
      nome: row.produto,
      preco: formatPrice(row.preco ?? 0),
      imagem: row.imagem ?? "",
      vendas: Number(row.vendas ?? 0),
    }));
  }

  private async getRecentConversations(filters: DashboardFilters): Promise<DashboardAtendimentoRecente[]> {
    const result = await pool.query<RecentConversationRow>(
      `
        SELECT
          a.atendimento_id,
          abs(hashtext(a.atendimento_id::text)) AS numeric_id,
          c.nome AS cliente,
          lm.conteudo AS mensagem,
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
        WHERE upper(COALESCE(a.canal, '')) = 'TELEGRAM'
          AND ($1::date IS NULL OR DATE(COALESCE(lm.data_envio, a.ultima_interacao_em, a.iniciado_em)) >= $1::date)
          AND ($2::date IS NULL OR DATE(COALESCE(lm.data_envio, a.ultima_interacao_em, a.iniciado_em)) <= $2::date)
        ORDER BY COALESCE(lm.data_envio, a.ultima_interacao_em, a.iniciado_em) DESC NULLS LAST
        LIMIT 5
      `,
      [filters.startDate ?? null, filters.endDate ?? null],
    );

    return result.rows.map((row) => ({
      id: Number(row.numeric_id),
      cliente: row.cliente ?? "Cliente sem nome",
      mensagem: row.mensagem ?? "",
      hora: row.horario ?? new Date().toISOString(),
    }));
  }

  private async hasImageColumn(): Promise<boolean> {
    if (!this.hasImageColumnPromise) {
      this.hasImageColumnPromise = this.loadImageColumn();
    }

    return this.hasImageColumnPromise;
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

  private async loadImageColumn(): Promise<boolean> {
    const result = await pool.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'produtos'
          AND column_name = 'imagem'
      ) AS exists
    `);

    return Boolean(result.rows[0]?.exists);
  }
}
