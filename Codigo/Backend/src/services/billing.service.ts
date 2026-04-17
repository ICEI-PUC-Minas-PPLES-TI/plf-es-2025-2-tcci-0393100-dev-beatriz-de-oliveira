import type { BillingRepository } from "../repositories/billing.repository.js";
import type { BillingRule } from "../types/domain.js";

export class BillingService {
  constructor(private readonly repository: BillingRepository) {}

  getRule() {
    return this.repository.getRule();
  }

  saveRule(rule: BillingRule) {
    return this.repository.saveRule(rule);
  }
}
