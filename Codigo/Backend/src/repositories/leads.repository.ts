import type { Lead } from "../types/domain.js";

export interface LeadUpsertByPhoneInput {
  phone: string;
  name?: string;
  interest: string;
  status: Lead["status"];
}

export interface LeadsRepository {
  findAll(): Promise<Lead[]>;
  upsertByPhone(input: LeadUpsertByPhoneInput): Promise<Lead>;
}
