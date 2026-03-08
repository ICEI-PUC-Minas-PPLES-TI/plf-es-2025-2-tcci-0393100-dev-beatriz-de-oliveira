import type { FastifyReply, FastifyRequest } from "fastify";
import { container } from "../modules/container.js";
import { billingRuleSchema } from "../schemas/billing.schema.js";
import { parseWithSchema } from "../utils/validation.js";

export async function getBillingRulesController(_request: FastifyRequest, reply: FastifyReply) {
  const data = await container.billingService.getRule();
  return reply.send({ data });
}

export async function saveBillingRulesController(request: FastifyRequest, reply: FastifyReply) {
  const body = parseWithSchema(billingRuleSchema, request.body);
  const data = await container.billingService.saveRule(body);
  return reply.send({ data });
}
