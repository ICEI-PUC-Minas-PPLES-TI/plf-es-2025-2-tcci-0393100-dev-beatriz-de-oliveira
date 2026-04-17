import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../config/env.js";
import { container } from "../modules/container.js";
import { telegramWebhookBodySchema } from "../schemas/telegram.schema.js";
import { AppError } from "../utils/app-error.js";
import { parseWithSchema } from "../utils/validation.js";

function validateTelegramSecret(request: FastifyRequest): void {
  const expected = env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!expected) {
    return;
  }

  const received = request.headers["x-telegram-bot-api-secret-token"];
  const secret = Array.isArray(received) ? received[0] : received;
  if (typeof secret !== "string" || secret.trim() !== expected) {
    console.warn("[Telegram] Secret inválido", {
      ip: request.ip,
    });
    throw new AppError("Invalid Telegram webhook secret", 403, "TELEGRAM_WEBHOOK_SECRET_INVALID");
  }
}

export async function receiveTelegramWebhookController(request: FastifyRequest, reply: FastifyReply) {
  // Telegram sends updates to this webhook after setWebhook.
  // If a secret token is configured, the request must include X-Telegram-Bot-Api-Secret-Token.
  validateTelegramSecret(request);

  let body: ReturnType<typeof telegramWebhookBodySchema.parse>;
  try {
    body = parseWithSchema(telegramWebhookBodySchema, request.body);
  } catch (error) {
    console.warn("[Telegram] Payload inválido", {
      ip: request.ip,
      error: error instanceof Error ? error.message : "unknown_error",
    });
    return reply.code(200).send({
      received: true,
      consumed: false,
      extractedMessages: 0,
    });
  }

  let result;
  try {
    result = await container.telegramService.processWebhookEvent(body);
  } catch (error) {
    console.warn("[Telegram] Erro no webhook", {
      ip: request.ip,
      error: error instanceof Error ? error.message : "unknown_error",
    });
    return reply.code(200).send({
      received: true,
      consumed: false,
      extractedMessages: 0,
    });
  }

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
