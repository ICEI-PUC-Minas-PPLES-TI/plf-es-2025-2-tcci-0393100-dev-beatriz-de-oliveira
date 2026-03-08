import type { NormalizedIncomingMessage, WhatsAppIncomingMessage } from "./types.js";

function collapseSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function removeAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeMessageText(text: string): string {
  return removeAccents(collapseSpaces(text)).toLowerCase();
}

export function normalizeIncomingMessage(message: WhatsAppIncomingMessage): NormalizedIncomingMessage {
  return {
    from: message.from,
    messageId: message.messageId,
    timestamp: message.timestamp,
    originalText: collapseSpaces(message.text),
    normalizedText: normalizeMessageText(message.text),
    profileName: message.profileName,
  };
}

