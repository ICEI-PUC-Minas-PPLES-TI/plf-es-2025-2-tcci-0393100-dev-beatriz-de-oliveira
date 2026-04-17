import type { FastifyInstance } from "fastify";
import { exportLeadsCsvController, listLeadsController, updateLeadStatusController } from "../../controllers/leads.controller.js";

const leadSchema = {
  type: "object",
  properties: {
    id: { type: "number" },
    nome: { type: "string" },
    telefone: { type: "string" },
    email: { type: "string" },
    interesse: { type: "string" },
    status: { type: "string" },
    data_criacao: { type: "string", format: "date-time" },
  },
};

const leadQuerySchema = {
  type: "object",
  properties: {
    status: { type: "string" },
    search: { type: "string" },
  },
};

export async function leadsRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Leads"],
        summary: "Lista leads",
        security: [{ bearerAuth: [] }],
        querystring: leadQuerySchema,
        response: {
          200: {
            type: "object",
            properties: {
              data: {
                type: "array",
                items: leadSchema,
              },
            },
          },
        },
      },
    },
    listLeadsController,
  );

  fastify.get(
    "/export.csv",
    {
      schema: {
        tags: ["Leads"],
        summary: "Exporta leads em CSV",
        security: [{ bearerAuth: [] }],
        querystring: leadQuerySchema,
        response: {
          200: {
            type: "string",
          },
        },
      },
    },
    exportLeadsCsvController,
  );

  fastify.patch(
    "/:id/status",
    {
      schema: {
        tags: ["Leads"],
        summary: "Atualiza status de um lead",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "number" },
          },
        },
        body: {
          type: "object",
          required: ["status"],
          properties: {
            status: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              data: leadSchema,
            },
          },
        },
      },
    },
    updateLeadStatusController,
  );
}
