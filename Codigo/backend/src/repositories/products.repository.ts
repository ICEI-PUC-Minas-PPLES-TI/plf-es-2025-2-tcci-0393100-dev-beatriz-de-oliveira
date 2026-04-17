import type { Produto } from "../types/domain.js";

export interface ProductListOptions {
  search?: string;
  limit?: number;
}

export interface ProductsRepository {
  findAll(options?: ProductListOptions): Promise<Produto[]>;
  findById(id: number): Promise<Produto | null>;
  create(data: Omit<Produto, "id">): Promise<Produto>;
  update(id: number, data: Partial<Omit<Produto, "id">>): Promise<Produto | null>;
  delete(id: number): Promise<boolean>;
}
