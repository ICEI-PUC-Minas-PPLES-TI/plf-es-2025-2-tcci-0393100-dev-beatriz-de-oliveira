import type { FastifyReply, FastifyRequest } from "fastify";
import { container } from "../modules/container.js";
import { idParamSchema, productBodySchema, productUpdateBodySchema } from "../schemas/products.schema.js";
import { AppError } from "../utils/app-error.js";
import { parseWithSchema } from "../utils/validation.js";

export async function listProductsController(request: FastifyRequest, reply: FastifyReply) {
  const query = request.query as { search?: string; limit?: string | number } | undefined;
  const rawUrl = new URL(request.url, "http://localhost");
  const search = query?.search ?? rawUrl.searchParams.get("search") ?? undefined;
  const rawLimit = query?.limit ?? rawUrl.searchParams.get("limit") ?? undefined;
  const limit = rawLimit === undefined || rawLimit === null ? undefined : Number(rawLimit);

  const data = await container.productsService.list({
    search,
    limit: Number.isFinite(limit) ? limit : undefined,
  });
  return reply.send({ data });
}

export async function createProductController(request: FastifyRequest, reply: FastifyReply) {
  const body = parseWithSchema(productBodySchema, request.body);
  const created = await container.productsService.create(body);
  return reply.code(201).send({ data: created });
}

export async function updateProductController(request: FastifyRequest, reply: FastifyReply) {
  const params = parseWithSchema(idParamSchema, request.params);
  const body = parseWithSchema(productUpdateBodySchema, request.body);
  const updated = await container.productsService.update(params.id, body);

  if (!updated) {
    throw new AppError("Product not found", 404, "PRODUCT_NOT_FOUND");
  }

  return reply.send({ data: updated });
}

export async function deleteProductController(request: FastifyRequest, reply: FastifyReply) {
  const params = parseWithSchema(idParamSchema, request.params);
  const deleted = await container.productsService.delete(params.id);

  if (!deleted) {
    throw new AppError("Product not found", 404, "PRODUCT_NOT_FOUND");
  }

  return reply.code(204).send();
}

