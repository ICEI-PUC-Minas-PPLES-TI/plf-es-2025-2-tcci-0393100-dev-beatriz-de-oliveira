import type { FastifyReply, FastifyRequest } from "fastify";
import { container } from "../modules/container.js";

export async function getMetricsController(_request: FastifyRequest, reply: FastifyReply) {
  const data = await container.metricsService.get();
  return reply.send({ data });
}
