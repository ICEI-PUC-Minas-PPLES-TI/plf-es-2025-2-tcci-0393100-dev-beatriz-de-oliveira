import type { ProductListOptions, ProductsRepository } from "../repositories/products.repository.js";
import type { Produto } from "../types/domain.js";

export class ProductsService {
  constructor(private readonly repository: ProductsRepository) {}

  list(options?: ProductListOptions): Promise<Produto[]> {
    return this.repository.findAll(options);
  }

  create(data: Omit<Produto, "id">): Promise<Produto> {
    return this.repository.create(data);
  }

  update(id: number, data: Partial<Omit<Produto, "id">>): Promise<Produto | null> {
    return this.repository.update(id, data);
  }

  delete(id: number): Promise<boolean> {
    return this.repository.delete(id);
  }
}
