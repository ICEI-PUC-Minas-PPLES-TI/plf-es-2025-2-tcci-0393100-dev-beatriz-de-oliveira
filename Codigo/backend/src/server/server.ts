import Fastify from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { env } from "../config/env.js";
import { container } from "../modules/container.js";
import { registerRoutes } from "../routes/index.js";
import { AppError } from "../utils/app-error.js";

export async function buildServer() {
  const app = Fastify({
    logger: env.NODE_ENV !== "test",
    bodyLimit: 25 * 1024 * 1024,
  });
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

  await app.register(swagger, {
    openapi: {
      info: {
        title: "Chatbot Atendimento API",
        description: "API do sistema de chatbot para atendimento via WhatsApp",
        version: "1.0.0",
      },
      tags: [
        { name: "Health", description: "Verificacao de disponibilidade da API" },
        { name: "Auth", description: "Autenticacao administrativa" },
        { name: "Dashboard", description: "Resumo consolidado do painel" },
        { name: "Products", description: "Catalogo de produtos" },
        { name: "Promotions", description: "Gestao de promocoes e destaques" },
        { name: "Leads", description: "CRM e acompanhamento de leads" },
        { name: "Metrics", description: "Metricas e desempenho comercial" },
        { name: "Billing", description: "Regras, pedidos e rotina de cobranca" },
        { name: "Telegram Webhook", description: "Recebimento de eventos do Telegram" },
        { name: "WhatsApp Webhook", description: "Recebimento e verificacao de eventos do WhatsApp" },
        { name: "WhatsApp Inbox", description: "Inbox e gestao de conversas do WhatsApp" },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
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
  const address = await app.listen({
    host: env.HOST,
    port: env.PORT,
  });
  app.log.info(
    {
      address,
      host: env.HOST,
      port: env.PORT,
      nodeEnv: env.NODE_ENV,
      whatsappProvider: env.WHATSAPP_PROVIDER,
      healthPath: "/health",
      telegramWebhookPath: env.TELEGRAM_WEBHOOK_PATH,
      webhookPath: "/webhooks/whatsapp",
    },
    "Backend started successfully",
  );
  container.dailyBillingJob.start();
  app.log.info("Daily billing job initialized");
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});

