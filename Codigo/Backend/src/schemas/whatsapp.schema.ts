import { z } from "zod";

export const whatsappVerifyQuerySchema = z.object({
  "hub.mode": z.string().optional(),
  "hub.verify_token": z.string().optional(),
  "hub.challenge": z.string().optional(),
});

export const whatsappWebhookBodySchema = z.record(z.string(), z.unknown());
