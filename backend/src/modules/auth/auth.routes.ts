import type { FastifyInstance } from "fastify";
import { loginController } from "../../controllers/auth.controller.js";

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post("/login", loginController);
}
