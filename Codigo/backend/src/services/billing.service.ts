import type { BillingRepository } from "../repositories/billing.repository.js";
import type { BillingRule, BillingRoutineRun, Pedido } from "../types/domain.js";

export class BillingService {
  constructor(private readonly repository: BillingRepository) {}

  getRule() {
    return this.repository.getRule();
  }

  saveRule(rule: BillingRule) {
    return this.repository.saveRule(rule);
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
}
