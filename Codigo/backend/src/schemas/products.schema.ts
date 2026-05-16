import { z } from "zod";

const productImageSchema = z.object({
  id: z.number().optional(),
  productId: z.number().optional(),
  imageUrl: z.string().min(1),
  ordem: z.coerce.number().int().nonnegative().default(0),
  principal: z.boolean().default(false),
  criadoEm: z.string().optional(),
});

const productBaseSchema = z.object({
  nome: z.string().min(1),
  categoria: z.string().min(1),
  descricao: z.string().min(1),
  preco: z.string().min(1),
  quantidade: z.coerce.number().int().nonnegative().default(0),
  disponivel: z.boolean(),
  imagem: z.string().min(1).optional(),
  images: z.array(productImageSchema).default([]),
  primaryImage: z.string().min(1).optional(),
});

export const productBodySchema = productBaseSchema.refine((data) => Boolean(data.primaryImage || data.imagem || data.images.length > 0), {
  message: "At least one image is required",
  path: ["images"],
});

export const productUpdateBodySchema = productBaseSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  "At least one field must be provided",
);

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});
