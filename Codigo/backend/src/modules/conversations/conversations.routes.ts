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
            channel: { type: "string", enum: ["telegram"] },
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

  fastify.get(
    "/:conversationId/full-history",
    {
      schema: {
        tags: ["Conversations"],
        summary: "Lista o histórico completo de mensagens da conversa agrupada por cliente/canal",
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
      const data = await container.conversationsService.listFullHistory(params.conversationId);
      return { data };
    },
  );

  fastify.get(
    "/:conversationId/previous",
    {
      schema: {
        tags: ["Conversations"],
        summary: "Lista atendimentos anteriores do mesmo cliente/canal",
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
      const data = await container.conversationsService.listPreviousConversations(params.conversationId);
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
      try {
        const data = await container.conversationsService.sendMessage(params.conversationId, body.content.trim());
        return { data };
      } catch (error) {
        console.error("[ConversationsManualSend] route_failed", {
          conversationId: params.conversationId,
          error: error instanceof Error ? error.message : "unknown_error",
          stack: error instanceof Error ? error.stack : undefined,
          code: typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code) : undefined,
        });
        throw error;
      }
    },
  );

  fastify.patch(
    "/:conversationId/status",
    {
      schema: {
        tags: ["Conversations"],
        summary: "Atualiza status operacional de uma conversa",
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
          required: ["status"],
          properties: {
            status: { type: "string", enum: ["ATIVO", "PENDENTE", "ENCERRADO"] },
          },
        },
      },
    },
    async (request) => {
      const params = request.params as { conversationId: number };
      const body = request.body as { status: "ATIVO" | "PENDENTE" | "ENCERRADO" };
      const data = await container.conversationsService.updateStatus(params.conversationId, body.status);
      return { data };
    },
  );
}
