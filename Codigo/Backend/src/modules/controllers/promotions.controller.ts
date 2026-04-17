import type { FastifyReply, FastifyRequest } from "fastify";
import { container } from "../modules/container.js";
import { AppError } from "../utils/app-error.js";
import { parseWithSchema } from "../utils/validation.js";
import { promotionBodySchema, promotionIdParamSchema, promotionUpdateBodySchema } from "../schemas/promotions.schema.js";

export async function listPromotionsController(_request: FastifyRequest, reply: FastifyReply) {
  const data = await container.promotionsService.list();
  return reply.send({ data });
}

export async function createPromotionController(request: FastifyRequest, reply: FastifyReply) {
  const body = parseWithSchema(promotionBodySchema, request.body);
  const data = await container.promotionsService.create(body);
  return reply.code(201).send({ data });
}

export async function updatePromotionController(request: FastifyRequest, reply: FastifyReply) {
  const params = parseWithSchema(promotionIdParamSchema, request.params);
  const body = parseWithSchema(promotionUpdateBodySchema, request.body);
  const data = await container.promotionsService.update(params.id, body);

  if (!data) {
    throw new AppError("Promotion not found", 404, "PROMOTION_NOT_FOUND");
  }

  return reply.send({ data });
}

export async function deletePromotionController(request: FastifyRequest, reply: FastifyReply) {
  const params = parseWithSchema(promotionIdParamSchema, request.params);
  const deleted = await container.promotionsService.delete(params.id);

  if (!deleted) {
    throw new AppError("Promotion not found", 404, "PROMOTION_NOT_FOUND");
  }

  return reply.code(204).send();
}
