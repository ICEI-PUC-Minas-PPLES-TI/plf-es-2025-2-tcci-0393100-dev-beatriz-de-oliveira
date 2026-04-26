import type { Promocao } from "../types/domain.js";
import type { PromotionsRepository } from "../repositories/promotions.repository.js";

export class PromotionsService {
  constructor(private readonly repository: PromotionsRepository) {}

  list(): Promise<Promocao[]> {
    return this.repository.findAll();
  }

  async listActive(): Promise<Promocao[]> {
    const promotions = await this.repository.findAll();
    const today = this.getTodayIso();
    return promotions.filter((promotion) => {
      if (!promotion.ativa) {
        return false;
      }

      if (promotion.inicio_em && promotion.inicio_em > today) {
        return false;
      }

      if (promotion.fim_em && promotion.fim_em < today) {
        return false;
      }

      return true;
    });
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

  private getTodayIso(): string {
    const parts = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const year = parts.find((part) => part.type === "year")?.value ?? "0000";
    const month = parts.find((part) => part.type === "month")?.value ?? "00";
    const day = parts.find((part) => part.type === "day")?.value ?? "00";

    return `${year}-${month}-${day}`;
  }
}
