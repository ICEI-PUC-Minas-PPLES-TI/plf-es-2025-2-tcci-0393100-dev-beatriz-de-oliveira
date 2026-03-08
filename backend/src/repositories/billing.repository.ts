import type { BillingRule } from "../types/domain.js";

export interface BillingRepository {
  getRule(): Promise<BillingRule>;
  saveRule(rule: BillingRule): Promise<BillingRule>;
}
