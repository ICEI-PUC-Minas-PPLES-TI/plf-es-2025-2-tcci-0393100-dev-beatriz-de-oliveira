import { z } from "zod";
import { AppError } from "./app-error.js";

export function parseWithSchema<T>(schema: z.ZodType<T>, payload: unknown): T {
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new AppError("Validation error", 400, "VALIDATION_ERROR");
  }
  return result.data;
}
