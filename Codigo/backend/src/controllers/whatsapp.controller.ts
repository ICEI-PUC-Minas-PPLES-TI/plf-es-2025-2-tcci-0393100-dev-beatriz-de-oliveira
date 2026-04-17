import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../config/env.js";
import { container } from "../modules/container.js";
import {
  whatsappConversationIdParamSchema,
  whatsappConversationStatusBodySchema,
  whatsappNormalizedInboundBodySchema,
  whatsappSendBodySchema,
  whatsappVerifyQuerySchema,
  whatsappWebhookBodySchema,
} from "../schemas/whatsapp.schema.js";
import { AppError } from "../utils/app-error.js";
import { parseWithSchema } from "../utils/validation.js";

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

function validateSharedWebhookToken(request: FastifyRequest): void {
  const expectedToken = env.WHATSAPP_WEBHOOK_SHARED_TOKEN?.trim();
  if (!expectedToken) {
    return;
  }

  const headerName = env.WHATSAPP_WEBHOOK_SHARED_TOKEN_HEADER.trim().toLowerCase();
  const rawHeader = request.headers[headerName];
  const token = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

  if (typeof token !== "string" || token.trim() !== expectedToken) {
    console.warn("[WhatsAppController] normalized_inbound_unauthorized", {
      headerName,
      ip: request.ip,
    });
    throw new AppError("Invalid webhook shared token", 403, "WHATSAPP_WEBHOOK_SHARED_TOKEN_INVALID");
  }
}

export async function receiveNormalizedWhatsAppInboundController(request: FastifyRequest, reply: FastifyReply) {
  validateSharedWebhookToken(request);
  let body: ReturnType<typeof whatsappNormalizedInboundBodySchema.parse>;
  try {
    body = parseWithSchema(whatsappNormalizedInboundBodySchema, request.body);
  } catch (error) {
    console.warn("[WhatsAppController] normalized_inbound_invalid_payload", {
      ip: request.ip,
      contentType: request.headers["content-type"] ?? "unknown",
      error: error instanceof Error ? error.message : "unknown_error",
    });
    throw error;
  }

  console.info("[WhatsAppController] normalized_inbound_received", {
    messageCount: body.messages.length,
    phones: body.messages.slice(0, 5).map((message) => message.from),
  });

  const result = await container.whatsappService.processNormalizedInbound(body);

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

export async function getWhatsAppConnectionStatusController(_request: FastifyRequest, reply: FastifyReply) {
  const data = await container.whatsappService.getConnectionStatus();
  return reply.send({ data });
}

export async function reconnectWhatsAppController(_request: FastifyRequest, reply: FastifyReply) {
  const data = await container.whatsappService.reconnectProvider();
  return reply.send({ data });
}

export async function logoutWhatsAppController(_request: FastifyRequest, reply: FastifyReply) {
  const data = await container.whatsappService.logoutProvider();
  return reply.send({ data });
}
