import type { FastifyInstance } from "fastify";
import {
  createPromotionController,
  deletePromotionController,
  listPromotionsController,
  updatePromotionController,
} from "../../controllers/promotions.controller.js";

const promotionSchema = {
  type: "object",
  properties: {
    id: { type: "number" },
    produto: { type: "string" },
    produto_id: { type: "number" },
    tipo: { type: "string", enum: ["PROMOCAO", "DESTAQUE"] },
    ativa: { type: "boolean" },
    inicio_em: { type: "string" },
    fim_em: { type: "string" },
    imagem: { type: "string" },
  },
};

const promotionBodySchema = {
  type: "object",
  required: ["produto", "produto_id", "tipo", "ativa", "inicio_em", "fim_em"],
  properties: {
    produto: { type: "string" },
    produto_id: { type: "number" },
    tipo: { type: "string", enum: ["PROMOCAO", "DESTAQUE"] },
    ativa: { type: "boolean" },
    inicio_em: { type: "string" },
    fim_em: { type: "string" },
    imagem: { type: "string" },
  },
};

export async function promotionsRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Promotions"],
        summary: "Lista promocoes",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              data: { type: "array", items: promotionSchema },
            },
          },
        },
      },
    },
    listPromotionsController,
  );

  fastify.post(
    "/",
    {
      schema: {
        tags: ["Promotions"],
        summary: "Cria promocao",
        security: [{ bearerAuth: [] }],
        body: promotionBodySchema,
        response: {
          201: {
            type: "object",
            properties: {
              data: promotionSchema,
            },
          },
        },
      },
    },
    createPromotionController,
  );

  fastify.put(
    "/:id",
    {
      schema: {
        tags: ["Promotions"],
        summary: "Atualiza promocao",
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
          minProperties: 1,
          properties: promotionBodySchema.properties,
        },
        response: {
          200: {
            type: "object",
            properties: {
              data: promotionSchema,
            },
          },
          404: {
            type: "object",
            properties: {
              message: { type: "string" },
              code: { type: "string" },
            },
          },
        },
      },
    },
    updatePromotionController,
  );

  fastify.delete(
    "/:id",
    {
      schema: {
        tags: ["Promotions"],
        summary: "Remove promocao",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "number" },
          },
        },
        response: {
          204: { type: "null" },
          404: {
            type: "object",
            properties: {
              message: { type: "string" },
              code: { type: "string" },
            },
          },
        },
      },
    },
    deletePromotionController,
  );
}
