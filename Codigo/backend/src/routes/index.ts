import type { FastifyInstance } from "fastify";
import { authRoutes } from "../modules/auth/auth.routes.js";
import { billingRoutes } from "../modules/billing/billing.routes.js";
import { conversationsRoutes } from "../modules/conversations/conversations.routes.js";
import { dashboardRoutes } from "../modules/dashboard/dashboard.routes.js";
import { leadsRoutes } from "../modules/leads/leads.routes.js";
import { metricsRoutes } from "../modules/metrics/metrics.routes.js";
import { productsRoutes } from "../modules/products/products.routes.js";
import { promotionsRoutes } from "../modules/promotions/promotions.routes.js";
import { telegramWebhookRoutes } from "../modules/telegram/telegram.routes.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";

export async function registerRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/health",
    {
      schema: {
        tags: ["Health"],
        summary: "Health check da API",
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string", example: "ok" },
            },
          },
        },
      },
    },
    async () => ({ status: "ok" }),
  );

  await fastify.register(authRoutes, { prefix: "/auth" });

  await fastify.register(async (protectedScope) => {
    protectedScope.addHook("preHandler", authMiddleware);
    await protectedScope.register(dashboardRoutes, { prefix: "/dashboard" });
    await protectedScope.register(productsRoutes, { prefix: "/products" });
    await protectedScope.register(promotionsRoutes, { prefix: "/promotions" });
    await protectedScope.register(leadsRoutes, { prefix: "/leads" });
    await protectedScope.register(billingRoutes, { prefix: "/billing-rules" });
    await protectedScope.register(billingRoutes, { prefix: "/billing" });
    await protectedScope.register(conversationsRoutes, { prefix: "/conversations" });

    await protectedScope.register(async (ownerScope) => {
      ownerScope.addHook("preHandler", authorizeRoles(["PROPRIETARIO"]));
      await ownerScope.register(metricsRoutes, { prefix: "/metrics" });
    });
  });

  await fastify.register(telegramWebhookRoutes, { prefix: "/webhooks" });
}
