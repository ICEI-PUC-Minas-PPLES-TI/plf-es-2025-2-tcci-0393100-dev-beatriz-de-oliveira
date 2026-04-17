import type { FastifyReply, FastifyRequest } from "fastify";
import { container } from "../modules/container.js";
import type { UserRole } from "../types/auth.js";
import { AppError } from "../utils/app-error.js";

export function authorizeRoles(allowedRoles: UserRole[]) {
  return async function roleMiddleware(request: FastifyRequest, _reply: FastifyReply) {
    const authorization = request.headers.authorization;
    const token = authorization?.replace(/^Bearer\s+/i, "");
    const user = container.authService.getUserFromToken(token);

    if (!user) {
      throw new AppError("Unauthorized", 401, "UNAUTHORIZED");
    }

    if (!allowedRoles.includes(user.role)) {
      throw new AppError("Forbidden", 403, "FORBIDDEN");
    }
  };
}
