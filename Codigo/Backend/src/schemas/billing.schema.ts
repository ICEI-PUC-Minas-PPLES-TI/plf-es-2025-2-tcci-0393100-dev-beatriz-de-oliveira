import { z } from "zod";

export const billingRuleSchema = z.object({
  ativa: z.boolean(),
  mensagem_template: z.string().min(1),
  limite_envio_por_dia: z.string().min(1),
  hora_envio: z.string().min(1),
  dias_atraso_min: z.string().min(1),
  dias_atraso_max: z.string().min(1),
});
