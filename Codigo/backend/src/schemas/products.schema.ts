import { z } from "zod";

export const productBodySchema = z.object({
  nome: z.string().min(1),
  categoria: z.string().min(1),
  descricao: z.string().min(1),
  preco: z.string().min(1),
  quantidade: z.coerce.number().int().min(0),
  disponivel: z.boolean(),
  imagem: z.string().min(1),
});

export const productUpdateBodySchema = productBodySchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  "At least one field must be provided",
);

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});
