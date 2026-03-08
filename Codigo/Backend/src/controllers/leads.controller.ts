import type { FastifyReply, FastifyRequest } from "fastify";
import { container } from "../modules/container.js";

export async function listLeadsController(_request: FastifyRequest, reply: FastifyReply) {
  const data = await container.leadsService.list();
  return reply.send({ data });
}
