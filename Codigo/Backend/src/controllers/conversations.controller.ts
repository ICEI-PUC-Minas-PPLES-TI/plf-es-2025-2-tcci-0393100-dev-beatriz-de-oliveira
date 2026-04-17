import type { FastifyReply, FastifyRequest } from "fastify";
import { container } from "../modules/container.js";
import { conversationsListQuerySchema, conversationIdParamSchema } from "../schemas/conversations.schema.js";
import { parseWithSchema } from "../utils/validation.js";

export async function listConversationsController(request: FastifyRequest, reply: FastifyReply) {
  const query = parseWithSchema(conversationsListQuerySchema, request.query);
  const data = await container.conversationsService.listConversations(query.channel);
  if (query.channel) {
    console.info("[ConversationsController] list_conversations", {
      channel: query.channel,
      count: data.length,
    });
  }
  return reply.send({ data });
}

export async function listConversationMessagesController(request: FastifyRequest, reply: FastifyReply) {
  const params = parseWithSchema(conversationIdParamSchema, request.params);
  const data = await container.conversationsService.listMessages(params.conversationId);
  console.info("[ConversationsController] list_messages", {
    conversationId: params.conversationId,
    count: data.length,
  });
  return reply.send({ data });
}
