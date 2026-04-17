import type { FastifyReply, FastifyRequest } from "fastify";
import { container } from "../modules/container.js";
import { AppError } from "../utils/app-error.js";

export async function authMiddleware(request: FastifyRequest, _reply: FastifyReply) {
  const authorization = request.headers.authorization;
  const token = authorization?.replace(/^Bearer\s+/i, "");

  if (!container.authService.verifyToken(token)) {
    throw new AppError("Unauthorized", 401, "UNAUTHORIZED");
  }
}
