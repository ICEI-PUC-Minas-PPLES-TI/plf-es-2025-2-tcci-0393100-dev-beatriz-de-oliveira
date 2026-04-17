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

  const updateKind = body.edited_message
    ? "edited_message"
    : body.callback_query
      ? "callback_query"
      : body.message?.photo?.length
        ? "photo"
        : body.message?.sticker
          ? "sticker"
          : body.message
            ? "message"
            : "unsupported_update";

  console.info("[TelegramWebhook] received", {
    updateId: body.update_id,
    updateKind,
    chatId: body.message?.chat?.id ? String(body.message.chat.id) : undefined,
    messageId: body.message?.message_id ? String(body.message.message_id) : undefined,
    hasText: Boolean(body.message?.text?.trim()),
  });

  let result;
  try {
    result = await container.telegramService.processWebhookEvent(body);
  } catch (error) {
    console.error("[Telegram] Erro no webhook", {
      ip: request.ip,
      error: error instanceof Error ? error.message : "unknown_error",
      stack: error instanceof Error ? error.stack : undefined,
      code: typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code) : undefined,
      detail: typeof error === "object" && error !== null && "detail" in error ? String((error as { detail?: unknown }).detail) : undefined,
      constraint: typeof error === "object" && error !== null && "constraint" in error ? String((error as { constraint?: unknown }).constraint) : undefined,
    });
    return reply.code(200).send({
      received: true,
      consumed: false,
      extractedMessages: 0,
    });
  }

  console.info("[TelegramWebhook] processed", {
    updateId: body.update_id,
    consumed: result.consumed,
    extractedMessages: result.extractedMessages,
    reason: result.reason,
    processed: result.messageResults?.filter((item) => item.status === "processed").length ?? 0,
    duplicates: result.ignoredDuplicates ?? 0,
    failed: result.failedMessages ?? 0,
  });

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
