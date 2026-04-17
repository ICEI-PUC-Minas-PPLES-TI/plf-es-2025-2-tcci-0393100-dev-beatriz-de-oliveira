import type { Promocao } from "../types/domain.js";
import type { PromotionsRepository } from "../repositories/promotions.repository.js";

export class PromotionsService {
  constructor(private readonly repository: PromotionsRepository) {}

  list(): Promise<Promocao[]> {
    return this.repository.findAll();
  }

  async listActive(): Promise<Promocao[]> {
    const promotions = await this.repository.findAll();
    return promotions.filter((promotion) => promotion.ativa);
  }

  create(data: Omit<Promocao, "id">): Promise<Promocao> {
    return this.repository.create(data);
  }

  update(id: number, data: Partial<Omit<Promocao, "id">>): Promise<Promocao | null> {
    return this.repository.update(id, data);
  }

  delete(id: number): Promise<boolean> {
    return this.repository.delete(id);
  }
}
