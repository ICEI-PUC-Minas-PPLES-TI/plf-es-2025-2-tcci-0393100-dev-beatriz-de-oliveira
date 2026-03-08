import Fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "../config/env.js";
import { registerRoutes } from "../routes/index.js";
import { AppError } from "../utils/app-error.js";

export async function buildServer() {
  const app = Fastify({ logger: env.NODE_ENV !== "test" });
  const allowedOrigins = env.CORS_ORIGIN.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  await app.register(cors, {
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      // Allow local frontend dev servers regardless of Vite port.
      if (/^http:\/\/localhost:\d+$/.test(origin) || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin not allowed by CORS"), false);
    },
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        message: error.message,
        code: error.code,
      });
    }

    app.log.error(error);
    return reply.status(500).send({
      message: "Internal Server Error",
      code: "INTERNAL_SERVER_ERROR",
    });
  });

  await registerRoutes(app);

  return app;
}

async function start() {
  const app = await buildServer();
  await app.listen({
    host: env.HOST,
    port: env.PORT,
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
