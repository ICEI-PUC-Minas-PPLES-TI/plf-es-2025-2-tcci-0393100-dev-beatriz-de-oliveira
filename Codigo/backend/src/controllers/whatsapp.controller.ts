import type { FastifyReply, FastifyRequest } from "fastify";
import { container } from "../modules/container.js";
import {
  whatsappConversationIdParamSchema,
  whatsappConversationStatusBodySchema,
  whatsappSendBodySchema,
  whatsappVerifyQuerySchema,
  whatsappWebhookBodySchema,
} from "../schemas/whatsapp.schema.js";
import { parseWithSchema } from "../utils/validation.js";
import { AppError } from "../utils/app-error.js";
import { env } from "../config/env.js";

export async function verifyWhatsAppWebhookController(request: FastifyRequest, reply: FastifyReply) {
  const query = parseWithSchema(whatsappVerifyQuerySchema, request.query);

  if (query["hub.mode"] !== "subscribe" || query["hub.verify_token"] !== env.WHATSAPP_VERIFY_TOKEN) {
    throw new AppError("Webhook verification failed", 403, "WHATSAPP_WEBHOOK_VERIFICATION_FAILED");
  }

  return reply.type("text/plain").send(query["hub.challenge"] ?? "");
}

export async function receiveWhatsAppWebhookController(request: FastifyRequest, reply: FastifyReply) {
  const body = parseWithSchema(whatsappWebhookBodySchema, request.body);
  const result = await container.whatsappService.processWebhookEvent(body);
  return reply.code(200).send({
    received: true,
    consumed: result.consumed,
    extractedMessages: result.extractedMessages,
    responses: result.responses.map((response) => ({
      intent: response.intent,
      handoffRequested: response.handoffRequested,
      actions: response.actions,
    })),
  });
}

export async function listWhatsAppConversationsController(_request: FastifyRequest, reply: FastifyReply) {
  const data = await container.whatsappService.listConversations();
  return reply.send({ data });
}

export async function listWhatsAppMessagesController(request: FastifyRequest, reply: FastifyReply) {
  const params = parseWithSchema(whatsappConversationIdParamSchema, request.params);
  const data = await container.whatsappService.listMessages(params.atendimentoId);
  return reply.send({ data });
}

export async function updateWhatsAppConversationStatusController(request: FastifyRequest, reply: FastifyReply) {
  const params = parseWithSchema(whatsappConversationIdParamSchema, request.params);
  const body = parseWithSchema(whatsappConversationStatusBodySchema, request.body);
  const data = await container.whatsappService.updateConversationStatus(params.atendimentoId, body.status);
  return reply.send({ data });
}

export async function sendWhatsAppMessageController(request: FastifyRequest, reply: FastifyReply) {
  const body = parseWithSchema(whatsappSendBodySchema, request.body);
  const data = await container.whatsappService.sendManualMessage(body);
  return reply.code(201).send({ data });
}
