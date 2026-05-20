import type { ProductImage } from "../types/domain";

export function normalizeProductImages(images: ProductImage[]): ProductImage[] {
  const cleaned = images
    .map((image) => image.imageUrl.trim())
    .filter(Boolean)
    .filter((imageUrl, index, all) => all.indexOf(imageUrl) === index)
    .map((imageUrl, index) => ({
      imageUrl,
      ordem: index,
      principal: false,
    }));

  if (cleaned.length > 0) {
    const preferred = images.find((image) => image.principal && image.imageUrl.trim());
    const preferredIndex = preferred ? cleaned.findIndex((image) => image.imageUrl === preferred.imageUrl.trim()) : -1;
    cleaned[preferredIndex >= 0 ? preferredIndex : 0] = {
      ...cleaned[preferredIndex >= 0 ? preferredIndex : 0]!,
      principal: true,
    };
  }

  return cleaned;
}
