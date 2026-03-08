import type { ChatbotContext } from "./types.js";

function hashText(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

export function pickVariant(context: ChatbotContext, key: string, variants: string[]): string {
  if (variants.length === 0) {
    return "";
  }
  const seed = `${context.message.from}|${context.message.messageId}|${key}`;
  const selected = hashText(seed) % variants.length;
  return variants[selected] ?? variants[0] ?? "";
}

