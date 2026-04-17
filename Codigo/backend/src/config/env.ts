import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3333),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  AUTH_TOKEN_SECRET: z.string().min(8).default("change_me_auth_secret"),
  AUTH_ADMIN_EMAIL: z.string().email().default("admin@eletroradio.com"),
  AUTH_ADMIN_PASSWORD: z.string().min(1).default("senha123"),
  AUTH_SELLER_NAME: z.string().default("Vendedor"),
  AUTH_SELLER_EMAIL: z.string().email().default("vendedor@eletroradio.com"),
  AUTH_SELLER_PASSWORD: z.string().min(1).default("senha123"),
  WHATSAPP_VERIFY_TOKEN: z.string().default("change_me"),
  WHATSAPP_META_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_API_VERSION: z.string().default("v21.0"),
  WHATSAPP_GRAPH_BASE_URL: z.string().default("https://graph.facebook.com"),
  WHATSAPP_WEB_API_BASE_URL: z.string().optional(),
  WHATSAPP_WEB_API_TOKEN: z.string().optional(),
  WHATSAPP_WEB_API_AUTH_HEADER: z.string().default("Authorization"),
  WHATSAPP_WEB_API_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
  BILLING_JOB_ENABLED: z.coerce.boolean().default(true),
  BILLING_JOB_INTERVAL_MS: z.coerce.number().int().positive().default(86400000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("Invalid environment variables", parsedEnv.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsedEnv.data;
