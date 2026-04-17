import { z } from "zod";

export const conversationsListQuerySchema = z.object({
  channel: z.enum(["whatsapp", "telegram"]).optional(),
});

export const conversationIdParamSchema = z.object({
  conversationId: z.coerce.number().int().positive(),
});
