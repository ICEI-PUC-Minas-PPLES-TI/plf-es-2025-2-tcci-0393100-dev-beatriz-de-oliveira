import type { Promocao } from "../types/domain.js";

export interface PromotionsRepository {
  findAll(): Promise<Promocao[]>;
  findById(id: number): Promise<Promocao | null>;
  create(data: Omit<Promocao, "id">): Promise<Promocao>;
  update(id: number, data: Partial<Omit<Promocao, "id">>): Promise<Promocao | null>;
  delete(id: number): Promise<boolean>;
}
