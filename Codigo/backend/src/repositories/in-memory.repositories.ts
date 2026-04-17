import type { BillingRule, BillingRoutineRun, Lead, LeadFilters, Metricas, Pedido, PedidoStatus, Produto } from "../types/domain.js";
import type { BillingRepository } from "./billing.repository.js";
import type { LeadsRepository } from "./leads.repository.js";
import type { LeadUpsertByPhoneInput } from "./leads.repository.js";
import type { MetricsRepository } from "./metrics.repository.js";
import type { ProductsRepository } from "./products.repository.js";
import { seedBillingRule, seedBillingRoutineRuns, seedLeads, seedMetricas, seedPedidos, seedProdutos } from "./seed-data.js";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export class InMemoryProductsRepository implements ProductsRepository {
  private items: Produto[] = clone(seedProdutos);
  private sequence = this.items.length + 1;

  async findAll(): Promise<Produto[]> {
    return clone(this.items);
  }

  async findById(id: number): Promise<Produto | null> {
    return clone(this.items.find((item) => item.id === id) ?? null);
  }

  async create(data: Omit<Produto, "id">): Promise<Produto> {
    const item: Produto = { id: this.sequence++, ...data };
    this.items.push(item);
    return clone(item);
  }

  async update(id: number, data: Partial<Omit<Produto, "id">>): Promise<Produto | null> {
    const index = this.items.findIndex((item) => item.id === id);
    if (index < 0) {
      return null;
    }
    const current = this.items[index];
    if (!current) {
      return null;
    }
    const updated: Produto = { ...current, ...data };
    this.items[index] = updated;
    return clone(updated);
  }

  async delete(id: number): Promise<boolean> {
    const before = this.items.length;
    this.items = this.items.filter((item) => item.id !== id);
    return this.items.length !== before;
  }
}

export class InMemoryLeadsRepository implements LeadsRepository {
  private items: Lead[] = clone(seedLeads);
  private sequence = this.items.length + 1;

  async findAll(filters?: LeadFilters): Promise<Lead[]> {
    let data = clone(this.items);

    if (filters?.status) {
      data = data.filter((item) => item.status === filters.status);
    }

    if (filters?.search) {
      const search = filters.search.toLowerCase();
      data = data.filter((item) => {
        const haystack = [item.nome, item.telefone, item.email, item.interesse].join(" ").toLowerCase();
        return haystack.includes(search);
      });
    }

    return data;
  }

  async findById(id: number): Promise<Lead | null> {
    return clone(this.items.find((item) => item.id === id) ?? null);
  }

  async create(data: Omit<Lead, "id">): Promise<Lead> {
    const created: Lead = { id: this.sequence++, ...data };
    this.items.push(created);
    return clone(created);
  }

  async update(id: number, data: Partial<Omit<Lead, "id">>): Promise<Lead | null> {
    const index = this.items.findIndex((item) => item.id === id);
    if (index < 0) {
      return null;
    }

    const current = this.items[index];
    if (!current) {
      return null;
    }

    const updated: Lead = { ...current, ...data };
    this.items[index] = updated;
    return clone(updated);
  }

  async updateStatus(id: number, status: Lead["status"]): Promise<Lead | null> {
    return this.update(id, { status });
  }

  async upsertByPhone(input: LeadUpsertByPhoneInput): Promise<Lead> {
    const index = this.items.findIndex((item) => item.telefone === input.phone);
    if (index >= 0) {
      const current = this.items[index];
      if (!current) {
        throw new Error("Lead not found");
      }
      const updated: Lead = {
        ...current,
        nome: input.name || current.nome,
        interesse: input.interest,
        status: input.status,
      };
      this.items[index] = updated;
      return clone(updated);
    }

    const digitsOnly = input.phone.replace(/\D/g, "");
    const created: Lead = {
      id: this.sequence++,
      nome: input.name || "Contato WhatsApp",
      telefone: input.phone,
      email: `lead.${digitsOnly || Date.now()}@whatsapp.local`,
      interesse: input.interest,
      status: input.status,
      data_criacao: new Date().toISOString(),
    };
    this.items.push(created);
    return clone(created);
  }
}

export class InMemoryMetricsRepository implements MetricsRepository {
  async get(): Promise<Metricas> {
    return clone(seedMetricas);
  }
}

export class InMemoryBillingRepository implements BillingRepository {
  private rule: BillingRule = clone(seedBillingRule);
  private orders: Pedido[] = clone(seedPedidos);
  private runs: BillingRoutineRun[] = clone(seedBillingRoutineRuns);
  private runSequence = this.runs.length + 1;
  private orderSequence = this.orders.length + 1;

  async getRule(): Promise<BillingRule> {
    return clone(this.rule);
  }

  async saveRule(rule: BillingRule): Promise<BillingRule> {
    this.rule = clone(rule);
    return clone(this.rule);
  }

  async findOrders(): Promise<Pedido[]> {
    return clone(this.orders);
  }

  async createOrder(order: Omit<Pedido, "id">): Promise<Pedido> {
    const created: Pedido = { id: this.orderSequence++, ...order };
    this.orders.push(created);
    return clone(created);
  }

  async updateOrder(orderId: number, data: Partial<Omit<Pedido, "id">>): Promise<Pedido | null> {
    const index = this.orders.findIndex((item) => item.id === orderId);
    if (index < 0) {
      return null;
    }

    const current = this.orders[index];
    if (!current) {
      return null;
    }

    const updated: Pedido = { ...current, ...data };
    this.orders[index] = updated;
    return clone(updated);
  }

  async updateOrderStatus(orderId: number, status: PedidoStatus): Promise<Pedido | null> {
    return this.updateOrder(orderId, { status });
  }

  async saveRoutineRun(run: Omit<BillingRoutineRun, "id">): Promise<BillingRoutineRun> {
    const created: BillingRoutineRun = { id: this.runSequence++, ...clone(run) };
    this.runs.unshift(created);
    return clone(created);
  }

  async listRoutineRuns(): Promise<BillingRoutineRun[]> {
    return clone(this.runs);
  }
}
