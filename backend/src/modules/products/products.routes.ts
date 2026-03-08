import type { FastifyInstance } from "fastify";
import {
  createProductController,
  deleteProductController,
  listProductsController,
  updateProductController,
} from "../../controllers/products.controller.js";

export async function productsRoutes(fastify: FastifyInstance) {
  fastify.get("/", listProductsController);
  fastify.post("/", createProductController);
  fastify.put("/:id", updateProductController);
  fastify.delete("/:id", deleteProductController);
}
