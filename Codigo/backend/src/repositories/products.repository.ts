import type { Produto } from "../types/domain.js";

export interface ProductSearchInput {
  originalText: string;
  extractedTerm: string;
  normalizedExactPhrase: string;
  requiredTokens: string[];
}

export interface ProductsRepository {
  findAll(): Promise<Produto[]>;
  findById(id: number): Promise<Produto | null>;
  searchByName(input: ProductSearchInput): Promise<Produto[]>;
  create(data: Omit<Produto, "id">): Promise<Produto>;
  update(id: number, data: Partial<Omit<Produto, "id">>): Promise<Produto | null>;
  delete(id: number): Promise<boolean>;
}
