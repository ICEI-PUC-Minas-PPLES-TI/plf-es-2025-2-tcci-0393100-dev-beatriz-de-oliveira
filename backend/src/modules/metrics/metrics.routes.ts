import type { FastifyInstance } from "fastify";
import { getMetricsController } from "../../controllers/metrics.controller.js";

export async function metricsRoutes(fastify: FastifyInstance) {
  fastify.get("/", getMetricsController);
}
