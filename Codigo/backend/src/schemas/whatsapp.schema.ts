import { z } from "zod";

export const whatsappVerifyQuerySchema = z.object({
  "hub.mode": z.string().optional(),
  "hub.verify_token": z.string().optional(),
  "hub.challenge": z.string().optional(),
});

export const whatsappWebhookBodySchema = z.record(z.string(), z.unknown());

export const whatsappConversationIdParamSchema = z.object({
  atendimentoId: z.coerce.number().int().positive(),
});

export const whatsappConversationStatusBodySchema = z.object({
  status: z.enum(["ATIVO", "PENDENTE", "ENCERRADO"]),
});

export const whatsappSendBodySchema = z
  .object({
    atendimentoId: z.coerce.number().int().positive().optional(),
    telefone: z.string().min(8).optional(),
    texto: z.string().min(1),
  })
  .refine((value) => value.atendimentoId !== undefined || value.telefone !== undefined, {
    message: "atendimentoId or telefone is required",
  });
