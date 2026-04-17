import { pool, testDatabaseConnection } from "../config/database.js";

async function run() {
  try {
    const result = await testDatabaseConnection();
    console.log("[test-db] success", JSON.stringify(result, null, 2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[test-db] failed", message);
    console.error("[test-db] dica: verifique se a DATABASE_URL veio do Supabase exatamente como no dashboard e se senhas com @ foram escapadas como %40.");
    process.exitCode = 1;
  } finally {
    await pool.end().catch(() => undefined);
  }
}

void run();
