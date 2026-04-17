import type { BillingRepository } from "../repositories/billing.repository.js";
import type { BillingRule, BillingRoutineEntry, BillingRoutineRun, Pedido } from "../types/domain.js";
import { AppError } from "../utils/app-error.js";
import { diffInDays, toDateOnlyIso } from "../utils/date.js";

function parsePositiveInt(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function applyBillingTemplate(template: string, order: Pedido): string {
  return template
    .replaceAll("{nome}", order.cliente)
    .replaceAll("{valor}", order.valor_total)
    .replaceAll("{data}", order.data_vencimento);
}

export class BillingService {
  constructor(private readonly repository: BillingRepository) {}

  getRule() {
    return this.repository.getRule();
  }

  saveRule(rule: BillingRule) {
    return this.repository.saveRule(rule);
  }

  listRuns(): Promise<BillingRoutineRun[]> {
    return this.repository.listRoutineRuns();
  }

  listOrders(): Promise<Pedido[]> {
    return this.repository.findOrders();
  }

  createOrder(order: Omit<Pedido, "id">): Promise<Pedido> {
    return this.repository.createOrder(order);
  }

  async updateOrder(orderId: number, data: Partial<Omit<Pedido, "id">>): Promise<Pedido> {
    const updated = await this.repository.updateOrder(orderId, data);
    if (!updated) {
      throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
    }
    return updated;
  }

  async runDailyRoutine(referenceDate = new Date()): Promise<BillingRoutineRun> {
    const rule = await this.repository.getRule();
    const referenceDateIso = toDateOnlyIso(referenceDate);
    const allOrders = await this.repository.findOrders();

    if (!rule.ativa) {
      return this.repository.saveRoutineRun({
        executado_em: new Date().toISOString(),
        referencia_em: referenceDateIso,
        regra_ativa: false,
        elegiveis: 0,
        processados: 0,
        ignorados: allOrders.length,
        itens: [],
      });
    }

    const minDays = parsePositiveInt(rule.dias_atraso_min, 1);
    const maxDays = parsePositiveInt(rule.dias_atraso_max, 30);
    const limitPerDay = parsePositiveInt(rule.limite_envio_por_dia, 10);

    const eligibleOrders = allOrders.filter((order) => {
      if (order.status === "PAGO" || order.status === "CANCELADO") {
        return false;
      }

      const daysOverdue = diffInDays(referenceDateIso, order.data_vencimento);
      return daysOverdue >= minDays && daysOverdue <= maxDays;
    });

    const toProcess = eligibleOrders.slice(0, limitPerDay);
    const entries: BillingRoutineEntry[] = [];

    for (const order of toProcess) {
      const daysOverdue = diffInDays(referenceDateIso, order.data_vencimento);
      const message = applyBillingTemplate(rule.mensagem_template, order);
      const finalStatus = order.status === "PENDENTE" ? "ATRASADO" : order.status;

      if (finalStatus !== order.status) {
        await this.repository.updateOrderStatus(order.id, finalStatus);
      }

      entries.push({
        pedido_id: order.id,
        numero_pedido: order.numero_pedido,
        cliente: order.cliente,
        telefone_cliente: order.telefone_cliente,
        valor_total: order.valor_total,
        data_vencimento: order.data_vencimento,
        dias_atraso: daysOverdue,
        status_original: order.status,
        status_final: finalStatus,
        mensagem: message,
      });
    }

    return this.repository.saveRoutineRun({
      executado_em: new Date().toISOString(),
      referencia_em: referenceDateIso,
      regra_ativa: true,
      elegiveis: eligibleOrders.length,
      processados: entries.length,
      ignorados: Math.max(allOrders.length - entries.length, 0),
      itens: entries,
    });
  }
}
