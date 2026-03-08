import type { FastifyInstance } from "fastify";
import { authRoutes } from "../modules/auth/auth.routes.js";
import { billingRoutes } from "../modules/billing/billing.routes.js";
import { leadsRoutes } from "../modules/leads/leads.routes.js";
import { metricsRoutes } from "../modules/metrics/metrics.routes.js";
import { productsRoutes } from "../modules/products/products.routes.js";
import { whatsAppRoutes } from "../modules/whatsapp/whatsapp.routes.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

export async function registerRoutes(fastify: FastifyInstance) {
  fastify.get("/health", async () => ({ status: "ok" }));

  await fastify.register(authRoutes, { prefix: "/auth" });

  await fastify.register(async (protectedScope) => {
    protectedScope.addHook("preHandler", authMiddleware);
    await protectedScope.register(productsRoutes, { prefix: "/products" });
    await protectedScope.register(leadsRoutes, { prefix: "/leads" });
    await protectedScope.register(metricsRoutes, { prefix: "/metrics" });
    await protectedScope.register(billingRoutes, { prefix: "/billing-rules" });
  });

  await fastify.register(whatsAppRoutes, { prefix: "/webhooks" });
}
