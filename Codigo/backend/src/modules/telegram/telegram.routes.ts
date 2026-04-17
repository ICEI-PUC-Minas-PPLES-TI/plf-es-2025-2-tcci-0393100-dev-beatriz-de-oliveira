import type { FastifyInstance } from "fastify";
import { receiveTelegramWebhookController } from "../../controllers/telegram.controller.js";

export async function telegramWebhookRoutes(fastify: FastifyInstance) {
  // Register this path in Telegram with:
  // https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://SEU_BACKEND${path}
  fastify.post(
    "/telegram",
    {
      schema: {
        tags: ["Telegram Webhook"],
        summary: "Recebe eventos do Telegram via webhook",
        body: {
          type: "object",
          additionalProperties: true,
        },
        response: {
          200: {
            type: "object",
            properties: {
              received: { type: "boolean" },
              consumed: { type: "boolean" },
              extractedMessages: { type: "number" },
            },
          },
        },
      },
    },
    receiveTelegramWebhookController,
  );
}
