import { describe, expect, it } from "vitest";
import { normalizeProductImages } from "./productImages";

describe("normalizeProductImages", () => {
  it("mantem multiplas imagens, remove duplicadas e preserva principal", () => {
    const images = normalizeProductImages([
      { imageUrl: " https://example.com/a.jpg ", ordem: 9, principal: false },
      { imageUrl: "https://example.com/b.jpg", ordem: 2, principal: true },
      { imageUrl: "https://example.com/a.jpg", ordem: 3, principal: false },
      { imageUrl: "   ", ordem: 4, principal: false },
    ]);

    expect(images).toEqual([
      { imageUrl: "https://example.com/a.jpg", ordem: 0, principal: false },
      { imageUrl: "https://example.com/b.jpg", ordem: 1, principal: true },
    ]);
  });

  it("define a primeira imagem como principal quando nenhuma foi marcada", () => {
    const images = normalizeProductImages([
      { imageUrl: "https://example.com/a.jpg", ordem: 0, principal: false },
      { imageUrl: "https://example.com/b.jpg", ordem: 1, principal: false },
    ]);

    expect(images[0]?.principal).toBe(true);
    expect(images[1]?.principal).toBe(false);
  });
});
