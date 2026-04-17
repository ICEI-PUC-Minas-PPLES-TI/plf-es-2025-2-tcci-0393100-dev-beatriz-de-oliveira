import type { BillingRule, Lead, Metricas, Produto } from "../types/domain.js";
import type { BillingRepository } from "./billing.repository.js";
import type { LeadsRepository } from "./leads.repository.js";
import type { LeadUpsertByPhoneInput } from "./leads.repository.js";
import type { MetricsRepository } from "./metrics.repository.js";
import type { ProductsRepository } from "./products.repository.js";
import { seedBillingRule, seedLeads, seedMetricas, seedProdutos } from "./seed-data.js";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export class InMemoryProductsRepository implements ProductsRepository {
  private items: Produto[] = clone(seedProdutos);
  private sequence = this.items.length + 1;

  async findAll(): Promise<Produto[]> {
    return clone(this.items);
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

  async findAll(): Promise<Lead[]> {
    return clone(this.items);
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

  async getRule(): Promise<BillingRule> {
    return clone(this.rule);
  }

  async saveRule(rule: BillingRule): Promise<BillingRule> {
    this.rule = clone(rule);
    return clone(this.rule);
  }
}
