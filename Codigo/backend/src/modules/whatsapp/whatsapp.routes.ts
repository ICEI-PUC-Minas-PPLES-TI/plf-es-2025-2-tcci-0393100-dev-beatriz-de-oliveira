import type { FastifyInstance } from "fastify";
import {
  getWhatsAppConnectionStatusController,
  listWhatsAppConversationsController,
  listWhatsAppMessagesController,
  logoutWhatsAppController,
  receiveNormalizedWhatsAppInboundController,
  receiveWhatsAppWebhookController,
  reconnectWhatsAppController,
  sendWhatsAppMessageController,
  updateWhatsAppConversationStatusController,
  verifyWhatsAppWebhookController,
} from "../../controllers/whatsapp.controller.js";

export async function whatsAppWebhookRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/whatsapp",
    {
      schema: {
        tags: ["WhatsApp Webhook"],
        summary: "Verifica webhook do WhatsApp",
        querystring: {
          type: "object",
          properties: {
            "hub.mode": { type: "string" },
            "hub.verify_token": { type: "string" },
            "hub.challenge": { type: "string" },
          },
        },
        response: {
          200: { type: "string" },
          403: {
            type: "object",
            properties: {
              message: { type: "string" },
              code: { type: "string" },
            },
          },
        },
      },
    },
    verifyWhatsAppWebhookController,
  );

  fastify.post(
    "/whatsapp",
    {
      schema: {
        tags: ["WhatsApp Webhook"],
        summary: "Recebe eventos do WhatsApp",
        body: {
          type: "object",
          additionalProperties: true,
        },
        response: {
          200: {
            type: "object",
            properties: {
              received: { type: "boolean" },
              consumed: { type: "boolean" },
              extractedMessages: { type: "number" },
              responses: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    intent: { type: "string" },
                    handoffRequested: { type: "boolean" },
                    actions: { type: "array", items: { type: "string" } },
                  },
                },
              },
            },
          },
        },
      },
    },
    receiveWhatsAppWebhookController,
  );

  fastify.post(
    "/whatsapp/normalized",
    {
      schema: {
        tags: ["WhatsApp Webhook"],
        summary: "Recebe inbound normalizado para bridge de WhatsApp Web API",
        body: {
          type: "object",
          required: ["messages"],
          properties: {
            messages: {
              type: "array",
              items: {
                type: "object",
                required: ["from", "text"],
                properties: {
                  from: { type: "string" },
                  text: { type: "string" },
                  messageId: { type: "string" },
                  timestamp: { type: "string" },
                  profileName: { type: "string" },
                },
              },
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              received: { type: "boolean" },
              consumed: { type: "boolean" },
              extractedMessages: { type: "number" },
            },
          },
        },
      },
    },
    receiveNormalizedWhatsAppInboundController,
  );
}

export async function whatsAppInboxRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/connection/status",
    {
      schema: {
        tags: ["WhatsApp Inbox"],
        summary: "Consulta status do provider de WhatsApp",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              data: {
                type: "object",
                properties: {
                  provider: { type: "string" },
                  status: { type: "string" },
                  connected: { type: "boolean" },
                  qr: { type: ["string", "null"] },
                },
              },
            },
          },
        },
      },
    },
    getWhatsAppConnectionStatusController,
  );

  fastify.post(
    "/connection/reconnect",
    {
      schema: {
        tags: ["WhatsApp Inbox"],
        summary: "Solicita reconexao do provider de WhatsApp",
        security: [{ bearerAuth: [] }],
      },
    },
    reconnectWhatsAppController,
  );

  fastify.post(
    "/connection/logout",
    {
      schema: {
        tags: ["WhatsApp Inbox"],
        summary: "Desconecta a sessao do provider de WhatsApp",
        security: [{ bearerAuth: [] }],
      },
    },
    logoutWhatsAppController,
  );

  fastify.get(
    "/conversations",
    {
      schema: {
        tags: ["WhatsApp Inbox"],
        summary: "Lista atendimentos do WhatsApp",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              data: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "number" },
                    cliente: { type: "string" },
                    telefone: { type: "string" },
                    status: { type: "string" },
                    ultima_mensagem: { type: "string" },
                    horario: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    listWhatsAppConversationsController,
  );

  fastify.get(
    "/messages/:atendimentoId",
    {
      schema: {
        tags: ["WhatsApp Inbox"],
        summary: "Lista mensagens de um atendimento",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["atendimentoId"],
          properties: {
            atendimentoId: { type: "number" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              data: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "number" },
                    tipo: { type: "string" },
                    conteudo: { type: "string" },
                    horario: { type: "string" },
                    remetente: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    listWhatsAppMessagesController,
  );

  fastify.patch(
    "/conversations/:atendimentoId/status",
    {
      schema: {
        tags: ["WhatsApp Inbox"],
        summary: "Atualiza status de um atendimento do WhatsApp",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["atendimentoId"],
          properties: {
            atendimentoId: { type: "number" },
          },
        },
        body: {
          type: "object",
          required: ["status"],
          properties: {
            status: { type: "string", enum: ["ATIVO", "PENDENTE", "ENCERRADO"] },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              data: {
                type: "object",
                properties: {
                  id: { type: "number" },
                  cliente: { type: "string" },
                  telefone: { type: "string" },
                  status: { type: "string" },
                  ultima_mensagem: { type: "string" },
                  horario: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    updateWhatsAppConversationStatusController,
  );

  fastify.post(
    "/send",
    {
      schema: {
        tags: ["WhatsApp Inbox"],
        summary: "Envia mensagem manual pelo WhatsApp",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["texto"],
          properties: {
            atendimentoId: { type: "number" },
            telefone: { type: "string" },
            texto: { type: "string" },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              data: {
                type: "object",
                properties: {
                  id: { type: "number" },
                  tipo: { type: "string" },
                  conteudo: { type: "string" },
                  horario: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    sendWhatsAppMessageController,
  );
}

