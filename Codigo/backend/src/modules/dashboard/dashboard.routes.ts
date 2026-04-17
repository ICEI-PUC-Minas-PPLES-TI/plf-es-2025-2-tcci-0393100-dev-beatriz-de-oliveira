import type { FastifyInstance } from "fastify";
import { getDashboardSummaryController } from "../../controllers/dashboard.controller.js";

const topProductSchema = {
  type: "object",
  properties: {
    id: { type: "number" },
    nome: { type: "string" },
    preco: { type: "string" },
    imagem: { type: "string" },
    vendas: { type: "number" },
  },
};

const recentConversationSchema = {
  type: "object",
  properties: {
    id: { type: "number" },
    cliente: { type: "string" },
    mensagem: { type: "string" },
    hora: { type: "string" },
  },
};

export async function dashboardRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/summary",
    {
      schema: {
        tags: ["Dashboard"],
        summary: "Retorna resumo do dashboard",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              data: {
                type: "object",
                properties: {
                  pedidosPendentes: { type: "number" },
                  atendimentosAtivos: { type: "number" },
                  produtosDisponiveis: { type: "number" },
                  pedidosMes: { type: "number" },
                  topProdutos: { type: "array", items: topProductSchema },
                  atendimentosRecentes: { type: "array", items: recentConversationSchema },
                },
              },
            },
          },
        },
      },
    },
    getDashboardSummaryController,
  );
}
