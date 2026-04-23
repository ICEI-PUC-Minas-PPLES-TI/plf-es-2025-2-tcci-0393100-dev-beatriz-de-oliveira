import type { FastifyInstance } from "fastify";
import { container } from "../container.js";

export async function conversationsRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Conversations"],
        summary: "Lista conversas do inbox unificado",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            channel: { type: "string", enum: ["whatsapp", "telegram"] },
          },
        },
      },
    },
    async (request) => {
      const query = request.query as { channel?: string };
      const data = await container.conversationsService.listConversations(query.channel);
      return { data };
    },
  );

  fastify.get(
    "/:conversationId/messages",
    {
      schema: {
        tags: ["Conversations"],
        summary: "Lista mensagens de uma conversa",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["conversationId"],
          properties: {
            conversationId: { type: "number" },
          },
        },
      },
    },
    async (request) => {
      const params = request.params as { conversationId: number };
      const data = await container.conversationsService.listMessages(params.conversationId);
      return { data };
    },
  );

  fastify.post(
    "/:conversationId/messages",
    {
      schema: {
        tags: ["Conversations"],
        summary: "Envia mensagem manual em uma conversa",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["conversationId"],
          properties: {
            conversationId: { type: "number" },
          },
        },
        body: {
          type: "object",
          required: ["content"],
          properties: {
            content: { type: "string", minLength: 1 },
          },
        },
      },
    },
    async (request) => {
      const params = request.params as { conversationId: number };
      const body = request.body as { content: string };
      const data = await container.conversationsService.sendMessage(params.conversationId, body.content.trim());
      return { data };
    },
  );
}
