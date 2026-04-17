import { container } from "../modules/container.js";

async function run() {
  const result = await container.billingService.runDailyRoutine(new Date("2026-03-21T00:00:00.000Z"));
  console.log("[billing-routine-smoke] summary", {
    processed: result.processados,
    eligible: result.elegiveis,
    ignored: result.ignorados,
    firstMessage: result.itens[0]?.mensagem ?? null,
  });
}

run().catch((error) => {
  console.error("[billing-routine-smoke] failed", error);
  process.exit(1);
});
