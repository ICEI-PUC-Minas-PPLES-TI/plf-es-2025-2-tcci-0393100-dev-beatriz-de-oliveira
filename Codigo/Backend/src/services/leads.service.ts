import type { LeadsRepository } from "../repositories/leads.repository.js";
import type { LeadUpsertByPhoneInput } from "../repositories/leads.repository.js";

export class LeadsService {
  constructor(private readonly repository: LeadsRepository) {}

  list() {
    return this.repository.findAll();
  }

  upsertByPhone(input: LeadUpsertByPhoneInput) {
    return this.repository.upsertByPhone(input);
  }
}
