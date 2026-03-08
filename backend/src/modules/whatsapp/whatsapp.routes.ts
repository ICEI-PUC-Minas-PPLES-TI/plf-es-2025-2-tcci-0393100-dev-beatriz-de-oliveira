import type { FastifyInstance } from "fastify";
import {
  receiveWhatsAppWebhookController,
  verifyWhatsAppWebhookController,
} from "../../controllers/whatsapp.controller.js";

export async function whatsAppRoutes(fastify: FastifyInstance) {
  fastify.get("/whatsapp", verifyWhatsAppWebhookController);
  fastify.post("/whatsapp", receiveWhatsAppWebhookController);
}
