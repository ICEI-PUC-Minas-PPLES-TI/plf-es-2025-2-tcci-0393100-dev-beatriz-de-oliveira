import type { BillingRepository } from "../repositories/billing.repository.js";
import { env } from "../config/env.js";
import type { TelegramService } from "./telegram.service.js";
import type { BillingChargeKind, BillingRoutineEntry, BillingRule, BillingRoutineRun, Pedido } from "../types/domain.js";
import { AppError } from "../utils/app-error.js";
import { diffInDays } from "../utils/date.js";

export class BillingService {
  constructor(
    private readonly repository: BillingRepository,
    private readonly telegramService: TelegramService,
  ) {}

  getRule() {
    return this.repository.getRule();
  }

  saveRule(rule: BillingRule) {
    return this.repository.saveRule(rule);
  }

  listOrders(): Promise<Pedido[]> {
    return this.repository.findOrders();
  }

  async sendManualCharge(orderId: number): Promise<Pedido> {
    const order = await this.repository.findOrderById(orderId);
    if (!order) {
      throw new AppError("Charge not found", 404, "BILLING_CHARGE_NOT_FOUND");
    }

    if (!order.cobrancaCanalDisponivel || order.cobrancaCanal !== "telegram") {
      throw new AppError("Canal não disponível para envio", 400, "BILLING_CHARGE_CHANNEL_UNAVAILABLE");
    }

    const rule = await this.repository.getRule();
    const chargeKind = this.resolveChargeKind(order, rule, this.toBillingDateOnlyIso(new Date()));
    if (!chargeKind) {
      throw new AppError("No billing message configured for this order today", 400, "BILLING_CHARGE_NOT_SCHEDULED");
    }

    const message = this.buildMessage(order, rule, chargeKind);

    if (!order.telegramChatId) {
      throw new AppError("Telegram chat id is required for this charge", 400, "BILLING_CHARGE_TELEGRAM_CHAT_REQUIRED");
    }

    await this.telegramService.sendManualMessage({
      chatId: order.telegramChatId,
      texto: message,
    });

    return this.repository.sendManualCharge(orderId, message);
  }

  createOrder(order: Omit<Pedido, "id">): Promise<Pedido> {
    return this.repository.createOrder(order);
  }

  async updateOrder(orderId: number, data: Partial<Omit<Pedido, "id">>): Promise<Pedido> {
    const updated = await this.repository.updateOrder(orderId, data);
    if (!updated) {
      throw new Error("Order not found");
    }
    return updated;
  }

  listRuns(): Promise<BillingRoutineRun[]> {
    return this.repository.listRoutineRuns();
  }

  async runDailyRoutine(referenceDate: Date): Promise<BillingRoutineRun> {
    const referenceDateIso = this.toBillingDateOnlyIso(referenceDate);
    console.info("[BillingAutoJob] iniciado", {
      referencia: referenceDateIso,
    });

    const rule = await this.getRule();
    console.info("[BillingAutoJob] regra carregada", {
      ativa: rule.ativa,
      limite_diario: rule.limite_envio_por_dia,
      hora_envio: rule.hora_envio,
    });

    const orders = await this.repository.findOrders();
    const eligible = orders
      .map((order) => {
        const chargeKind = this.resolveChargeKind(order, rule, referenceDateIso);
        if (!chargeKind) {
          console.info("[BillingAutoJob] ignorado motivo", {
            pedido_id: order.id,
            motivo: "fora_da_regra_ou_status",
            status: order.status,
            vencimento: order.data_vencimento,
          });
          return null;
        }

        return { order, chargeKind };
      })
      .filter((item): item is { order: Pedido; chargeKind: BillingChargeKind } => item !== null);

    console.info("[BillingAutoJob] cobranças_elegiveis", {
      total: eligible.length,
      pedidos: eligible.map((item) => item.order.id),
    });

    const dailyLimit = Number.parseInt(rule.limite_envio_por_dia, 10);
    const maxToSend = Number.isFinite(dailyLimit) && dailyLimit > 0 ? dailyLimit : eligible.length;
    let processed = 0;
    let ignored = 0;
    const entries: BillingRoutineEntry[] = [];

    for (const item of eligible) {
      const { order, chargeKind } = item;
      const alreadySentToday =
        order.cobrancaStatus === "ENVIADO"
        && order.cobrancaTipoEnvio === "AUTOMATICO"
        && order.cobrancaDataEnvio?.slice(0, 10) === referenceDateIso;

      if (processed >= maxToSend) {
        ignored += 1;
        console.info("[BillingAutoJob] ignorado motivo", {
          pedido_id: order.id,
          motivo: "limite_diario_atingido",
        });
        continue;
      }

      if (alreadySentToday) {
        ignored += 1;
        console.info("[BillingAutoJob] ignorado motivo", {
          pedido_id: order.id,
          motivo: "ja_enviado_automaticamente_hoje",
        });
        continue;
      }

      if (!order.cobrancaCanalDisponivel || order.cobrancaCanal !== "telegram" || !order.telegramChatId) {
        ignored += 1;
        console.info("[BillingAutoJob] ignorado motivo", {
          pedido_id: order.id,
          motivo: "canal_indisponivel",
          canal: order.cobrancaCanal ?? null,
        });
        continue;
      }

      const message = this.buildMessage(order, rule, chargeKind);
      console.info("[BillingAutoJob] enviando pedido_id", {
        pedido_id: order.id,
        canal: "telegram",
        telegramChatId: order.telegramChatId,
      });

      try {
        await this.telegramService.sendManualMessage({
          chatId: order.telegramChatId,
          texto: message,
        });
        const updated = await this.repository.sendManualCharge(order.id, message, "AUTOMATICO");
        processed += 1;
        entries.push(this.buildRoutineEntry(updated, message, chargeKind, referenceDateIso));
        console.info("[BillingAutoJob] enviado", {
          pedido_id: order.id,
        });
      } catch (error) {
        ignored += 1;
        console.info("[BillingAutoJob] ignorado motivo", {
          pedido_id: order.id,
          motivo: "falha_envio",
          erro: error instanceof Error ? error.message : String(error),
        });
      }
    }

    console.info("[BillingAutoJob] finalizado", {
      elegiveis: eligible.length,
      processados: processed,
      ignorados: ignored,
    });

    return this.repository.saveRoutineRun({
      executado_em: new Date().toISOString(),
      referencia_em: referenceDateIso,
      regra_ativa: rule.ativa,
      elegiveis: eligible.length,
      processados: processed,
      ignorados: ignored,
      itens: entries,
    });
  }

  private formatDateToPtBr(value: string): string {
    const [year, month, day] = value.split("-");
    if (!year || !month || !day) {
      return value;
    }
    return `${day}/${month}/${year}`;
  }

  private toBillingDateOnlyIso(value: Date): string {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: env.BILLING_JOB_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(value);
    const byType = new Map(parts.map((part) => [part.type, part.value]));
    return `${byType.get("year")}-${byType.get("month")}-${byType.get("day")}`;
  }

  private resolveChargeKind(order: Pedido, rule: BillingRule, referenceDate: string): BillingChargeKind | null {
    if (order.status === "PAGO" || order.status === "CANCELADO" || !rule.ativa) {
      return null;
    }

    const maxDelayDays = Number.parseInt(rule.dias_atraso_max, 10);
    const dueDate = order.data_vencimento;
    const daysAfterDue = diffInDays(referenceDate, dueDate);

    if (Number.isFinite(maxDelayDays) && maxDelayDays >= 0 && daysAfterDue > maxDelayDays) {
      return null;
    }

    const reminderDays = Number.parseInt(rule.dias_antes_vencimento, 10);
    if (rule.lembrete_antes_ativo && Number.isFinite(reminderDays) && reminderDays >= 0 && diffInDays(dueDate, referenceDate) === reminderDays) {
      return "LEMBRETE";
    }

    if (rule.vencimento_hoje_ativo && referenceDate === dueDate) {
      return "VENCE_HOJE";
    }

    const overdueDays = Number.parseInt(rule.dias_apos_vencimento, 10);
    if (rule.apos_vencimento_ativo && Number.isFinite(overdueDays) && overdueDays >= 0 && daysAfterDue >= overdueDays) {
      return "EM_ATRASO";
    }

    return null;
  }

  private getTemplateForKind(rule: BillingRule, kind: BillingChargeKind): string {
    if (kind === "LEMBRETE") {
      return rule.template_antes_vencimento;
    }

    if (kind === "VENCE_HOJE") {
      return rule.template_vencimento_hoje;
    }

    return rule.template_apos_vencimento;
  }

  private buildMessage(order: Pedido, rule: BillingRule, kind: BillingChargeKind): string {
    return this.getTemplateForKind(rule, kind)
      .replace(/\{nome\}/g, order.cliente)
      .replace(/\{valor\}/g, order.valor_total)
      .replace(/\{data\}/g, this.formatDateToPtBr(order.data_vencimento));
  }

  private buildRoutineEntry(order: Pedido, message: string, kind: BillingChargeKind, referenceDate: string): BillingRoutineEntry {
    return {
      pedido_id: order.id,
      numero_pedido: order.numero_pedido,
      cliente: order.cliente,
      telefone_cliente: order.telefone_cliente,
      valor_total: order.valor_total,
      data_vencimento: order.data_vencimento,
      dias_atraso: Math.max(0, diffInDays(referenceDate, order.data_vencimento)),
      status_original: order.status,
      status_final: order.status,
      mensagem: message,
    };
  }
}
