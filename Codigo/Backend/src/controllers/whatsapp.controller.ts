import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../config/env.js";
import { container } from "../modules/container.js";
import { whatsappVerifyQuerySchema, whatsappWebhookBodySchema } from "../schemas/whatsapp.schema.js";
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
