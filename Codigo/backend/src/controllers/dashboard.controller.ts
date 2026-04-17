import type { FastifyReply, FastifyRequest } from "fastify";
import { container } from "../modules/container.js";

type DashboardQuery = {
  startDate?: string;
  endDate?: string;
};

export async function getDashboardSummaryController(request: FastifyRequest<{ Querystring: DashboardQuery }>, reply: FastifyReply) {
  const data = await container.dashboardService.getSummary({
    startDate: request.query.startDate,
    endDate: request.query.endDate,
  });

  return reply.send({ data });
}

