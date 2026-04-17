import { z } from "zod";

export const telegramWebhookBodySchema = z.object({
  update_id: z.number().int().optional(),
  callback_query: z.record(z.string(), z.unknown()).optional(),
  edited_message: z.record(z.string(), z.unknown()).optional(),
  message: z
    .object({
      message_id: z.number().int(),
      date: z.number().int().optional(),
      text: z.string().min(1).optional(),
      photo: z.array(z.record(z.string(), z.unknown())).optional(),
      sticker: z.record(z.string(), z.unknown()).optional(),
      chat: z.object({
        id: z.union([z.number().int(), z.string()]),
        type: z.string().optional(),
      }),
      from: z
        .object({
          first_name: z.string().optional(),
          last_name: z.string().optional(),
          username: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});
