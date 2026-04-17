import { z } from "zod";

export const leadFiltersQuerySchema = z.object({
  status: z.enum(["NOVO", "ENCAMINHADO_HUMANO", "EM_CONTATO", "CONVERTIDO", "PERDIDO"]).optional(),
  search: z.string().trim().min(1).optional(),
});

export const leadStatusUpdateSchema = z.object({
  status: z.enum(["NOVO", "ENCAMINHADO_HUMANO", "EM_CONTATO", "CONVERTIDO", "PERDIDO"]),
});

export const leadIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});
