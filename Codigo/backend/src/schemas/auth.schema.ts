import { z } from "zod";

export const loginBodySchema = z.object({
  email: z.string().email(),
  senha: z.string().min(1),
});
