import type { FastifyInstance } from "fastify";
import { listLeadsController } from "../../controllers/leads.controller.js";

export async function leadsRoutes(fastify: FastifyInstance) {
  fastify.get("/", listLeadsController);
}
