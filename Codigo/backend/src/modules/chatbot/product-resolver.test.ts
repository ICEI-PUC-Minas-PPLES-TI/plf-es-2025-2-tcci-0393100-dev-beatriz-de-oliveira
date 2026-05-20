import { describe, expect, it, vi } from "vitest";
import { findMatchingProducts } from "./product-resolver.js";
import { product } from "../../test/factories.js";

const catalog = [
  product({ id: 1, nome: "TV 50 SMART MULTILASER", categoria: "Eletronicos", descricao: "Televisao 4K" }),
  product({ id: 2, nome: "TV 43 LG SMART", categoria: "Eletronicos", descricao: "Smart TV" }),
  product({ id: 3, nome: "CAIXA DE SOM BLUETOOTH", categoria: "Eletronicos", descricao: "Portatil" }),
  product({ id: 4, nome: "FOGAO 4 BOCAS", categoria: "Eletrodomesticos", descricao: "Fogao de piso" }),
];

async function search(term: string) {
  return findMatchingProducts(
    term,
    vi.fn(async () => catalog),
    vi.fn(async () => catalog),
  );
}

describe("product-resolver", () => {
  it("encontra TVs por termo curto literal", async () => {
    const result = await search("tv");
    expect(result.products.map((item) => item.nome)).toContain("TV 50 SMART MULTILASER");
  });

  it("normaliza televisao para tv", async () => {
    const result = await search("televisao");
    expect(result.products.map((item) => item.nome)).toContain("TV 43 LG SMART");
  });

  it("encontra caixa de som", async () => {
    const result = await search("quero caixa de som");
    expect(result.products[0]?.nome).toContain("CAIXA DE SOM");
  });

  it("encontra fogao", async () => {
    const result = await search("fogao");
    expect(result.products[0]?.nome).toBe("FOGAO 4 BOCAS");
  });

  it("faz fallback para listProducts quando a query direta nao retorna nada", async () => {
    const listProducts = vi.fn(async () => catalog);
    const result = await findMatchingProducts("tv", vi.fn(async () => []), listProducts);
    expect(listProducts).toHaveBeenCalled();
    expect(result.products.length).toBeGreaterThan(0);
  });
});
