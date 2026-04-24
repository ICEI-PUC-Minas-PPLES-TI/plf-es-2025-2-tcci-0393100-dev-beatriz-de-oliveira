import type { BillingRepository } from "../repositories/billing.repository.js";
import type { TelegramService } from "./telegram.service.js";
import type { WhatsAppService } from "./whatsapp.service.js";
import type { BillingChargeKind, BillingRule, BillingRoutineRun, Pedido } from "../types/domain.js";
import { AppError } from "../utils/app-error.js";
import { diffInDays, toDateOnlyIso } from "../utils/date.js";

export class BillingService {
  constructor(
    private readonly repository: BillingRepository,
    private readonly whatsappService: WhatsAppService,
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
    const chargeKind = this.resolveChargeKind(order, rule, toDateOnlyIso(new Date()));
    if (!chargeKind) {
      throw new AppError("No billing message configured for this order today", 400, "BILLING_CHARGE_NOT_SCHEDULED");
    }

    const message = this.getTemplateForKind(rule, chargeKind)
      .replace(/\{nome\}/g, order.cliente)
      .replace(/\{valor\}/g, order.valor_total)
      .replace(/\{data\}/g, this.formatDateToPtBr(order.data_vencimento));

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
    const referenceDateIso = referenceDate.toISOString().slice(0, 10);
    return this.repository.saveRoutineRun({
      executado_em: new Date().toISOString(),
      referencia_em: referenceDateIso,
      regra_ativa: (await this.getRule()).ativa,
      elegiveis: 0,
      processados: 0,
      ignorados: 0,
      itens: [],
    });
  }

  private formatDateToPtBr(value: string): string {
    const [year, month, day] = value.split("-");
    if (!year || !month || !day) {
      return value;
    }
    return `${day}/${month}/${year}`;
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
}
