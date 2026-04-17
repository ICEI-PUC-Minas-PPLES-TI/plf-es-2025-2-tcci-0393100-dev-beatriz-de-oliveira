import type { WhatsAppIncomingMessage } from "../../../modules/chatbot/types.js";

export interface WhatsAppWebhookEvent extends Record<string, unknown> {}

export interface NormalizedInboundMessage {
  from: string;
  text: string;
  messageId: string;
  hasStableMessageId: boolean;
  timestamp?: string;
  profileName?: string;
}

export interface NormalizedInboundPayload {
  messages: Array<{
    from: string;
    text: string;
    messageId?: string;
    timestamp?: string;
    profileName?: string;
  }>;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function buildMessageId(from: string, provided?: string): { messageId: string; hasStableMessageId: boolean } {
  const stableId = typeof provided === "string" && provided.trim().length > 0;
  return {
    messageId: stableId ? provided.trim() : `${from}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    hasStableMessageId: stableId,
  };
}

function getTextContent(message: Record<string, unknown>): string | null {
  const type = typeof message.type === "string" ? message.type : "";
  const textNode = asRecord(message.text);
  if (type === "text" && textNode && typeof textNode.body === "string") {
    return textNode.body;
  }

  const buttonNode = asRecord(message.button);
  if (buttonNode && typeof buttonNode.text === "string") {
    return buttonNode.text;
  }

  const interactiveNode = asRecord(message.interactive);
  if (interactiveNode) {
    const buttonReply = asRecord(interactiveNode.button_reply);
    if (buttonReply && typeof buttonReply.title === "string") {
      return buttonReply.title;
    }
    const listReply = asRecord(interactiveNode.list_reply);
    if (listReply && typeof listReply.title === "string") {
      return listReply.title;
    }
  }

  return null;
}

export function extractMetaIncomingMessages(payload: Record<string, unknown>): NormalizedInboundMessage[] {
  const entries = asArray(payload.entry);
  const result: NormalizedInboundMessage[] = [];

  for (const entry of entries) {
    const entryRecord = asRecord(entry);
    if (!entryRecord) continue;

    for (const change of asArray(entryRecord.changes)) {
      const changeRecord = asRecord(change);
      const valueRecord = asRecord(changeRecord?.value);
      if (!valueRecord) continue;

      const contacts = asArray(valueRecord.contacts);
      const namesByPhone = new Map<string, string>();
      for (const contact of contacts) {
        const contactRecord = asRecord(contact);
        if (!contactRecord || typeof contactRecord.wa_id !== "string") continue;
        const profile = asRecord(contactRecord.profile);
        if (profile && typeof profile.name === "string") {
          namesByPhone.set(contactRecord.wa_id, profile.name);
        }
      }

      for (const message of asArray(valueRecord.messages)) {
        const messageRecord = asRecord(message);
        if (!messageRecord || typeof messageRecord.from !== "string") continue;
        const text = getTextContent(messageRecord);
        if (!text || !text.trim()) continue;

        const idData = buildMessageId(messageRecord.from, typeof messageRecord.id === "string" ? messageRecord.id : undefined);
        result.push({
          from: messageRecord.from,
          text,
          messageId: idData.messageId,
          hasStableMessageId: idData.hasStableMessageId,
          timestamp: typeof messageRecord.timestamp === "string" ? messageRecord.timestamp : undefined,
          profileName: namesByPhone.get(messageRecord.from),
        });
      }
    }
  }

  return result;
}

export function extractNormalizedIncomingMessages(payload: NormalizedInboundPayload): NormalizedInboundMessage[] {
  return payload.messages.map((message) => {
    const idData = buildMessageId(message.from, message.messageId);
    return {
      from: message.from,
      text: message.text,
      messageId: idData.messageId,
      hasStableMessageId: idData.hasStableMessageId,
      timestamp: message.timestamp,
      profileName: message.profileName,
    };
  });
}

export function toIncomingChatbotMessage(
  message: NormalizedInboundMessage,
  currentCustomerName?: string,
): WhatsAppIncomingMessage {
  return {
    from: message.from,
    messageId: message.messageId,
    hasStableMessageId: message.hasStableMessageId,
    timestamp: message.timestamp,
    text: message.text,
    profileName: message.profileName,
    currentCustomerName,
    raw: {
      from: message.from,
      id: message.messageId,
      timestamp: message.timestamp,
      text: { body: message.text },
    },
  };
}
