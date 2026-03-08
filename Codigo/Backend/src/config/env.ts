import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3333),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  AUTH_MOCK_TOKEN: z.string().default("mock_token_12345"),
  AUTH_ADMIN_EMAIL: z.string().email().default("admin@eletroradio.com"),
  AUTH_ADMIN_PASSWORD: z.string().min(1).default("senha123"),
  WHATSAPP_VERIFY_TOKEN: z.string().default("change_me"),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("Invalid environment variables", parsedEnv.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsedEnv.data;
