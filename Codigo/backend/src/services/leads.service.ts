import type { LeadFilters, Lead } from "../types/domain.js";
import type { LeadsRepository } from "../repositories/leads.repository.js";
import type { LeadUpsertByPhoneInput } from "../repositories/leads.repository.js";
import { AppError } from "../utils/app-error.js";
import { buildCsv } from "../utils/csv.js";

export class LeadsService {
  constructor(private readonly repository: LeadsRepository) {}

  list(filters?: LeadFilters) {
    return this.repository.findAll(filters);
  }

  async exportCsv(filters?: LeadFilters): Promise<string> {
    const leads = await this.repository.findAll(filters);
    return buildCsv(
      ["id", "nome", "telefone", "email", "interesse", "status", "data_criacao"],
      leads.map((lead) => [
        String(lead.id),
        lead.nome,
        lead.telefone,
        lead.email,
        lead.interesse,
        lead.status,
        lead.data_criacao,
      ]),
    );
  }

  async updateStatus(id: number, status: Lead["status"]): Promise<Lead> {
    const updated = await this.repository.updateStatus(id, status);
    if (!updated) {
      throw new AppError("Lead not found", 404, "LEAD_NOT_FOUND");
    }
    return updated;
  }

  upsertByPhone(input: LeadUpsertByPhoneInput) {
    return this.repository.upsertByPhone(input);
  }
}
