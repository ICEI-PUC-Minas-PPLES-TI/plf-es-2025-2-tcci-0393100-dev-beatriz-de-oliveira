import type { FastifyInstance } from "fastify";
import {
  createBillingOrderController,
  getBillingRulesController,
  listBillingOrdersController,
  listBillingRoutineRunsController,
  runDailyBillingRoutineController,
  saveBillingRulesController,
  sendBillingChargeController,
  updateBillingOrderController,
} from "../../controllers/billing.controller.js";

const billingRuleSchema = {
  type: "object",
  required: [
    "ativa",
    "limite_envio_por_dia",
    "hora_envio",
    "lembrete_antes_ativo",
    "dias_antes_vencimento",
    "template_antes_vencimento",
    "vencimento_hoje_ativo",
    "template_vencimento_hoje",
    "apos_vencimento_ativo",
    "dias_apos_vencimento",
    "template_apos_vencimento",
    "dias_atraso_max",
  ],
  properties: {
    ativa: { type: "boolean" },
    limite_envio_por_dia: { type: "string" },
    hora_envio: { type: "string" },
    lembrete_antes_ativo: { type: "boolean" },
    dias_antes_vencimento: { type: "string" },
    template_antes_vencimento: { type: "string" },
    vencimento_hoje_ativo: { type: "boolean" },
    template_vencimento_hoje: { type: "string" },
    apos_vencimento_ativo: { type: "boolean" },
    dias_apos_vencimento: { type: "string" },
    template_apos_vencimento: { type: "string" },
    dias_atraso_max: { type: "string" },
  },
};

const billingOrderSchema = {
  type: "object",
  properties: {
    id: { type: "number" },
    numero_pedido: { type: "string" },
    cliente: { type: "string" },
    telefone_cliente: { type: "string" },
    valor_total: { type: "string" },
    forma_pagamento: { type: "string" },
    status: { type: "string" },
    data_vencimento: { type: "string" },
  },
};

const billingOrderBodySchema = {
  type: "object",
  required: ["numero_pedido", "cliente", "telefone_cliente", "valor_total", "forma_pagamento", "status", "data_vencimento"],
  properties: {
    numero_pedido: { type: "string" },
    cliente: { type: "string" },
    telefone_cliente: { type: "string" },
    valor_total: { type: "string" },
    forma_pagamento: { type: "string" },
    status: { type: "string" },
    data_vencimento: { type: "string" },
  },
};

const billingRoutineRunSchema = {
  type: "object",
  properties: {
    referenceDate: { type: "string" },
  },
};

const billingRoutineResultSchema = {
  type: "object",
  properties: {
    id: { type: "number" },
    executado_em: { type: "string", format: "date-time" },
    referencia_em: { type: "string" },
    regra_ativa: { type: "boolean" },
    elegiveis: { type: "number" },
    processados: { type: "number" },
    ignorados: { type: "number" },
    itens: {
      type: "array",
      items: {
        type: "object",
        properties: {
          pedido_id: { type: "number" },
          numero_pedido: { type: "string" },
          cliente: { type: "string" },
          telefone_cliente: { type: "string" },
          valor_total: { type: "string" },
          data_vencimento: { type: "string" },
          dias_atraso: { type: "number" },
          status_original: { type: "string" },
          status_final: { type: "string" },
          mensagem: { type: "string" },
        },
      },
    },
  },
};

export async function billingRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Billing"],
        summary: "Busca regra de cobranca",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              data: billingRuleSchema,
            },
          },
        },
      },
    },
    getBillingRulesController,
  );

  fastify.post(
    "/",
    {
      schema: {
        tags: ["Billing"],
        summary: "Salva regra de cobranca",
        security: [{ bearerAuth: [] }],
        body: billingRuleSchema,
        response: {
          200: {
            type: "object",
            properties: {
              data: billingRuleSchema,
            },
          },
        },
      },
    },
    saveBillingRulesController,
  );

  fastify.get(
    "/orders",
    {
      schema: {
        tags: ["Billing"],
        summary: "Lista pedidos de cobranca",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              data: {
                type: "array",
                items: billingOrderSchema,
              },
            },
          },
        },
      },
    },
    listBillingOrdersController,
  );

  fastify.post(
    "/orders",
    {
      schema: {
        tags: ["Billing"],
        summary: "Cria pedido de cobranca",
        security: [{ bearerAuth: [] }],
        body: billingOrderBodySchema,
        response: {
          201: {
            type: "object",
            properties: {
              data: billingOrderSchema,
            },
          },
        },
      },
    },
    createBillingOrderController,
  );

  fastify.put(
    "/orders/:id",
    {
      schema: {
        tags: ["Billing"],
        summary: "Atualiza pedido de cobranca",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "number" },
          },
        },
        body: {
          type: "object",
          properties: billingOrderBodySchema.properties,
        },
        response: {
          200: {
            type: "object",
            properties: {
              data: billingOrderSchema,
            },
          },
        },
      },
    },
    updateBillingOrderController,
  );

  fastify.post(
    "/charges/:id/send",
    {
      schema: {
        tags: ["Billing"],
        summary: "Envia manualmente uma cobranca prevista",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "number" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              data: billingOrderSchema,
            },
          },
        },
      },
    },
    sendBillingChargeController,
  );

  fastify.get(
    "/runs",
    {
      schema: {
        tags: ["Billing"],
        summary: "Lista execucoes da rotina de cobranca",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              data: {
                type: "array",
                items: billingRoutineResultSchema,
              },
            },
          },
        },
      },
    },
    listBillingRoutineRunsController,
  );

  fastify.post(
    "/run-daily",
    {
      schema: {
        tags: ["Billing"],
        summary: "Executa manualmente a rotina diaria de cobranca",
        security: [{ bearerAuth: [] }],
        body: billingRoutineRunSchema,
        response: {
          200: {
            type: "object",
            properties: {
              data: billingRoutineResultSchema,
            },
          },
        },
      },
    },
    runDailyBillingRoutineController,
  );
}
