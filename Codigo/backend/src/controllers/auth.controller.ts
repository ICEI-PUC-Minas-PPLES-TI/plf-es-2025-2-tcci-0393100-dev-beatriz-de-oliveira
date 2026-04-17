import type { FastifyReply, FastifyRequest } from "fastify";
import { container } from "../modules/container.js";
import { loginBodySchema } from "../schemas/auth.schema.js";
import { parseWithSchema } from "../utils/validation.js";

export async function loginController(request: FastifyRequest, reply: FastifyReply) {
  const body = parseWithSchema(loginBodySchema, request.body);
  const result = await container.authService.login(body.email, body.senha);
  return reply.send(result);
}

