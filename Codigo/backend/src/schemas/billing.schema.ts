import { z } from "zod";

export const billingRuleSchema = z.object({
  ativa: z.boolean(),
  limite_envio_por_dia: z.string().min(1),
  hora_envio: z.string().min(1),
  lembrete_antes_ativo: z.boolean(),
  dias_antes_vencimento: z.string().min(1),
  template_antes_vencimento: z.string().min(1),
  vencimento_hoje_ativo: z.boolean(),
  template_vencimento_hoje: z.string().min(1),
  apos_vencimento_ativo: z.boolean(),
  dias_apos_vencimento: z.string().min(1),
  template_apos_vencimento: z.string().min(1),
  dias_atraso_max: z.string().min(1),
});

export const billingRoutineRunBodySchema = z.object({
  referenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const billingOrderSchema = z.object({
  numero_pedido: z.string().min(1),
  produto_id: z.coerce.number().int().positive().optional(),
  produto_nome: z.string().min(1).optional(),
  cliente: z.string().min(1),
  telefone_cliente: z.string().min(1),
  valor_total: z.string().min(1),
  forma_pagamento: z.string().min(1),
  status: z.enum(["PAGO", "ATRASADO", "PENDENTE", "CANCELADO"]),
  data_vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const billingOrderUpdateSchema = billingOrderSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  "At least one field must be provided",
);

export const billingOrderIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});
