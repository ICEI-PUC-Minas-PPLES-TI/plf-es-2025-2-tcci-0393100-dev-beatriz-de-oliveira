process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://test:test@localhost:5432/test";
process.env.TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "test-token";
process.env.BILLING_JOB_TIMEZONE = process.env.BILLING_JOB_TIMEZONE ?? "America/Sao_Paulo";
