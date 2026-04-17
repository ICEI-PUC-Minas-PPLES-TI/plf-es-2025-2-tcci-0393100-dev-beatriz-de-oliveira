import type { FastifyInstance } from "fastify";
import { getMetricsController } from "../../controllers/metrics.controller.js";

export async function metricsRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Metrics"],
        summary: "Retorna metricas do dashboard",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              data: {
                type: "object",
                properties: {
                  vendasPorDia: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        dia: { type: "string" },
                        vendas: { type: "number" },
                        receita: { type: "number" },
                      },
                    },
                  },
                  topProdutos: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        produto: { type: "string" },
                        vendas: { type: "number" },
                        receita: { type: "string" },
                      },
                    },
                  },
                  novosClientes: { type: "number" },
                },
              },
            },
          },
        },
      },
    },
    getMetricsController,
  );
}
