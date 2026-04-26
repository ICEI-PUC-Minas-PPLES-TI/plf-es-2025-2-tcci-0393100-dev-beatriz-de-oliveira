import type { FastifyInstance } from "fastify";
import {
  createProductController,
  deleteProductController,
  listProductsController,
  updateProductController,
} from "../../controllers/products.controller.js";

const productSchema = {
  type: "object",
  properties: {
    id: { type: "number" },
    nome: { type: "string" },
    categoria: { type: "string" },
    descricao: { type: "string" },
    preco: { type: "string" },
    quantidade: { type: "number" },
    disponivel: { type: "boolean" },
    imagem: { type: "string" },
  },
};

const productBodySchema = {
  type: "object",
  required: ["nome", "categoria", "descricao", "preco", "disponivel", "imagem"],
  properties: {
    nome: { type: "string" },
    categoria: { type: "string" },
    descricao: { type: "string" },
    preco: { type: "string" },
    quantidade: { type: "number", minimum: 0 },
    disponivel: { type: "boolean" },
    imagem: { type: "string", format: "uri" },
  },
};

export async function productsRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Products"],
        summary: "Lista produtos",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              data: { type: "array", items: productSchema },
            },
          },
        },
      },
    },
    listProductsController,
  );

  fastify.post(
    "/",
    {
      schema: {
        tags: ["Products"],
        summary: "Cria produto",
        security: [{ bearerAuth: [] }],
        body: productBodySchema,
        response: {
          201: {
            type: "object",
            properties: {
              data: productSchema,
            },
          },
        },
      },
    },
    createProductController,
  );

  fastify.put(
    "/:id",
    {
      schema: {
        tags: ["Products"],
        summary: "Atualiza produto",
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
          properties: productBodySchema.properties,
        },
        response: {
          200: {
            type: "object",
            properties: {
              data: productSchema,
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
    updateProductController,
  );

  fastify.delete(
    "/:id",
    {
      schema: {
        tags: ["Products"],
        summary: "Remove produto",
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
    deleteProductController,
  );
}
