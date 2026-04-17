import { env } from "../config/env.js";
import type { BillingService } from "../services/billing.service.js";

export class DailyBillingJob {
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly billingService: BillingService) {}

  start() {
    if (!env.BILLING_JOB_ENABLED || this.timer) {
      return;
    }

    this.timer = setInterval(async () => {
      try {
        const result = await this.billingService.runDailyRoutine();
        console.log("[DailyBillingJob] run completed", {
          processed: result.processados,
          eligible: result.elegiveis,
          ignored: result.ignorados,
        });
      } catch (error) {
        console.error("[DailyBillingJob] run failed", error);
      }
    }, env.BILLING_JOB_INTERVAL_MS);
  }
}
