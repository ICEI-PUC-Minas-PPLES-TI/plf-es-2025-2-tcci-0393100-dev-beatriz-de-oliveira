import type { FastifyReply, FastifyRequest } from "fastify";
import { container } from "../modules/container.js";

type MetricsQuery = {
  startDate?: string;
  endDate?: string;
};

export async function getMetricsController(request: FastifyRequest<{ Querystring: MetricsQuery }>, reply: FastifyReply) {
  const data = await container.metricsService.get({
    startDate: request.query.startDate,
    endDate: request.query.endDate,
  });

  return reply.send({ data });
}
