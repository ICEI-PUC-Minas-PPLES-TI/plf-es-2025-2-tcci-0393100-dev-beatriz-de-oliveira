import type { FastifyInstance } from "fastify";
import { getBillingRulesController, saveBillingRulesController } from "../../controllers/billing.controller.js";

export async function billingRoutes(fastify: FastifyInstance) {
  fastify.get("/", getBillingRulesController);
  fastify.post("/", saveBillingRulesController);
}
