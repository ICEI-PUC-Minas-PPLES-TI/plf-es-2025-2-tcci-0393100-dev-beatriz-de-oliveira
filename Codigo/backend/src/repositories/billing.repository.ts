import type { BillingRule, BillingRoutineRun, Pedido, PedidoStatus } from "../types/domain.js";

export interface BillingRepository {
  getRule(): Promise<BillingRule>;
  saveRule(rule: BillingRule): Promise<BillingRule>;
  findOrders(): Promise<Pedido[]>;
  findOrderById(orderId: number): Promise<Pedido | null>;
  createOrder(order: Omit<Pedido, "id">): Promise<Pedido>;
  updateOrder(orderId: number, data: Partial<Omit<Pedido, "id">>): Promise<Pedido | null>;
  updateOrderStatus(orderId: number, status: PedidoStatus): Promise<Pedido | null>;
  sendManualCharge(orderId: number, message: string): Promise<Pedido>;
  saveRoutineRun(run: Omit<BillingRoutineRun, "id">): Promise<BillingRoutineRun>;
  listRoutineRuns(): Promise<BillingRoutineRun[]>;
}
