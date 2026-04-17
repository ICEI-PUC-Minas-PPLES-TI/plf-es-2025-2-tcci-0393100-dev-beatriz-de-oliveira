import type { FastifyInstance } from "fastify";
import { loginController } from "../../controllers/auth.controller.js";

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/login",
    {
      schema: {
        tags: ["Auth"],
        summary: "Realiza login administrativo",
        body: {
          type: "object",
          required: ["email", "senha"],
          properties: {
            email: { type: "string", format: "email" },
            senha: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              token: { type: "string" },
              user: {
                type: "object",
                properties: {
                  id: { type: "number" },
                  nome: { type: "string" },
                  login: { type: "string" },
                  role: { type: "string", enum: ["PROPRIETARIO", "VENDEDOR"] },
                },
              },
            },
          },
          400: {
            type: "object",
            properties: {
              message: { type: "string" },
              code: { type: "string" },
            },
          },
          401: {
            type: "object",
            properties: {
              message: { type: "string" },
              code: { type: "string" },
            },
          },
        },
      },
    },
    loginController,
  );
}
