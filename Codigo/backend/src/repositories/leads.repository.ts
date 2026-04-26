import type { LeadFilters, Lead } from "../types/domain.js";

export interface LeadUpsertByPhoneInput {
  phone: string;
  name?: string;
  interest?: string;
  status: Lead["status"];
  channel?: "whatsapp" | "telegram";
  conversationId?: number;
}

export interface LeadsRepository {
  findAll(filters?: LeadFilters): Promise<Lead[]>;
  findById(id: number): Promise<Lead | null>;
  create(data: Omit<Lead, "id">): Promise<Lead>;
  update(id: number, data: Partial<Omit<Lead, "id">>): Promise<Lead | null>;
  updateStatus(id: number, status: Lead["status"]): Promise<Lead | null>;
  upsertByPhone(input: LeadUpsertByPhoneInput): Promise<Lead>;
}
