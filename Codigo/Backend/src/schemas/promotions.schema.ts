import { z } from "zod";

export const promotionIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const promotionBodySchema = z.object({
  produto: z.string().min(1),
  produto_id: z.coerce.number().int().nonnegative(),
  tipo: z.enum(["PROMOCAO", "DESTAQUE"]),
  ativa: z.boolean(),
  inicio_em: z.string().min(1),
  fim_em: z.string().min(1),
  imagem: z.string().optional().default(""),
});

export const promotionUpdateBodySchema = promotionBodySchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one field must be provided",
);
