import type { FastifyInstance } from "fastify";
import { listConversationMessagesController, listConversationsController } from "../../controllers/conversations.controller.js";

export async function conversationsRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Conversations"],
        summary: "Lista conversas unificadas por canal",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            channel: { type: "string", enum: ["whatsapp", "telegram"] },
          },
        },
      },
    },
    listConversationsController,
  );

  fastify.get(
    "/:conversationId/messages",
    {
      schema: {
        tags: ["Conversations"],
        summary: "Lista mensagens de uma conversa unificada",
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
    listConversationMessagesController,
  );
}
