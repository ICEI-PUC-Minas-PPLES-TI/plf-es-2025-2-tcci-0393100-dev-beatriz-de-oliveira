import type { FastifyReply, FastifyRequest } from "fastify";
import { container } from "../modules/container.js";
import { leadFiltersQuerySchema, leadIdParamSchema, leadStatusUpdateSchema } from "../schemas/leads.schema.js";
import { parseWithSchema } from "../utils/validation.js";

export async function listLeadsController(request: FastifyRequest, reply: FastifyReply) {
  const filters = parseWithSchema(leadFiltersQuerySchema, request.query);
  const data = await container.leadsService.list(filters);
  return reply.send({ data });
}

export async function exportLeadsCsvController(request: FastifyRequest, reply: FastifyReply) {
  const filters = parseWithSchema(leadFiltersQuerySchema, request.query);
  const csv = await container.leadsService.exportCsv(filters);

  reply.header("Content-Type", "text/csv; charset=utf-8");
  reply.header("Content-Disposition", 'attachment; filename="leads.csv"');
  return reply.send(csv);
}

export async function updateLeadStatusController(request: FastifyRequest, reply: FastifyReply) {
  const params = parseWithSchema(leadIdParamSchema, request.params);
  const body = parseWithSchema(leadStatusUpdateSchema, request.body);
  const data = await container.leadsService.updateStatus(params.id, body.status);
  return reply.send({ data });
}

