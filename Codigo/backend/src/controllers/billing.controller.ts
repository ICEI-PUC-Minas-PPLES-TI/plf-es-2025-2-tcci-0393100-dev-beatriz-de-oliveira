import type { FastifyReply, FastifyRequest } from "fastify";
import { container } from "../modules/container.js";
import {
  billingOrderIdParamSchema,
  billingOrderSchema,
  billingOrderUpdateSchema,
  billingRoutineRunBodySchema,
  billingRuleSchema,
} from "../schemas/billing.schema.js";
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

export async function listBillingRoutineRunsController(_request: FastifyRequest, reply: FastifyReply) {
  const data = await container.billingService.listRuns();
  return reply.send({ data });
}

export async function runDailyBillingRoutineController(request: FastifyRequest, reply: FastifyReply) {
  const body = parseWithSchema(billingRoutineRunBodySchema, request.body ?? {});
  const referenceDate = body.referenceDate ? new Date(`${body.referenceDate}T00:00:00.000Z`) : new Date();
  const data = await container.billingService.runDailyRoutine(referenceDate);
  return reply.send({ data });
}

export async function listBillingOrdersController(_request: FastifyRequest, reply: FastifyReply) {
  const data = await container.billingService.listOrders();
  return reply.send({ data });
}

export async function createBillingOrderController(request: FastifyRequest, reply: FastifyReply) {
  const body = parseWithSchema(billingOrderSchema, request.body);
  const data = await container.billingService.createOrder(body);
  return reply.code(201).send({ data });
}

export async function updateBillingOrderController(request: FastifyRequest, reply: FastifyReply) {
  const params = parseWithSchema(billingOrderIdParamSchema, request.params);
  const body = parseWithSchema(billingOrderUpdateSchema, request.body);
  const data = await container.billingService.updateOrder(params.id, body);
  return reply.send({ data });
}

