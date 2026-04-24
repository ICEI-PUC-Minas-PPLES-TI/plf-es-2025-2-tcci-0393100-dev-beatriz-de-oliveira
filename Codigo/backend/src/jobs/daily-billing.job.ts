import { env } from "../config/env.js";
import type { BillingService } from "../services/billing.service.js";

export class DailyBillingJob {
  private timer: NodeJS.Timeout | null = null;
  private lastRunKey: string | null = null;

  constructor(private readonly billingService: BillingService) {}

  start() {
    if (!env.BILLING_JOB_ENABLED || this.timer) {
      console.log("[BillingAutoJob] iniciado", {
        enabled: env.BILLING_JOB_ENABLED,
        skipped: this.timer ? "already_running" : "disabled",
      });
      return;
    }

    console.log("[BillingAutoJob] iniciado", {
      interval_ms: env.BILLING_JOB_INTERVAL_MS,
      effective_interval_ms: this.getEffectiveIntervalMs(),
      timezone: env.BILLING_JOB_TIMEZONE,
    });

    const tick = async () => {
      try {
        const rule = await this.billingService.getRule();
        const now = new Date();
        const zonedNow = this.getZonedDateTime(now);
        const runKey = `${zonedNow.date}:${rule.hora_envio}`;

        console.log("[BillingAutoJob] regra carregada", {
          ativa: rule.ativa,
          limite_diario: rule.limite_envio_por_dia,
        });
        console.log("[BillingAutoJob] horario_configurado", {
          hora_envio: rule.hora_envio,
          timezone: env.BILLING_JOB_TIMEZONE,
        });
        console.log("[BillingAutoJob] agora", zonedNow);

        if (!rule.ativa) {
          console.log("[BillingAutoJob] ignorado motivo", {
            motivo: "regra_inativa",
          });
          return;
        }

        if (zonedNow.time !== rule.hora_envio) {
          console.log("[BillingAutoJob] ignorado motivo", {
            motivo: "fora_do_horario",
            esperado: rule.hora_envio,
            atual: zonedNow.time,
          });
          return;
        }

        if (this.lastRunKey === runKey) {
          console.log("[BillingAutoJob] ignorado motivo", {
            motivo: "horario_ja_executado",
            runKey,
          });
          return;
        }

        this.lastRunKey = runKey;
        const result = await this.billingService.runDailyRoutine(now);
        console.log("[BillingAutoJob] finalizado", {
          processed: result.processados,
          eligible: result.elegiveis,
          ignored: result.ignorados,
        });
      } catch (error) {
        console.error("[BillingAutoJob] ignorado motivo", {
          motivo: "falha_job",
          erro: error instanceof Error ? error.message : String(error),
        });
      }
    };

    void tick();
    this.timer = setInterval(() => {
      void tick();
    }, this.getEffectiveIntervalMs());
  }

  private getEffectiveIntervalMs(): number {
    return Math.min(env.BILLING_JOB_INTERVAL_MS, 60000);
  }

  private getZonedDateTime(date: Date): { date: string; time: string; iso: string } {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: env.BILLING_JOB_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date);

    const byType = new Map(parts.map((part) => [part.type, part.value]));
    const dateOnly = `${byType.get("year")}-${byType.get("month")}-${byType.get("day")}`;
    const timeOnly = `${byType.get("hour")}:${byType.get("minute")}`;

    return {
      date: dateOnly,
      time: timeOnly,
      iso: date.toISOString(),
    };
  }
}
