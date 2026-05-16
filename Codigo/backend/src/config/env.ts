import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3333),
  FRONTEND_URL: z.string().default("http://localhost:5173"),
  AUTH_TOKEN_SECRET: z.string().min(8).default("change_me_auth_secret"),
  AUTH_ADMIN_EMAIL: z.string().email().default("admin@eletroradio.com"),
  AUTH_ADMIN_PASSWORD: z.string().min(1).default("senha123"),
  AUTH_SELLER_NAME: z.string().default("Vendedor"),
  AUTH_SELLER_EMAIL: z.string().email().default("vendedor@eletroradio.com"),
  AUTH_SELLER_PASSWORD: z.string().min(1).default("senha123"),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
  BILLING_JOB_ENABLED: z.coerce.boolean().default(true),
  BILLING_JOB_INTERVAL_MS: z.coerce.number().int().positive().default(60000),
  BILLING_JOB_TIMEZONE: z.string().default("America/Sao_Paulo"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("Invalid environment variables", parsedEnv.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsedEnv.data;
