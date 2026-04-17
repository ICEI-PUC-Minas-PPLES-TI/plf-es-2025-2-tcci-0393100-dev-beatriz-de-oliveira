import type { WhatsAppIncomingMessage } from "../../modules/chatbot/types.js";

export type TelegramWebhookPayload = {
  update_id?: number;
  callback_query?: Record<string, unknown>;
  edited_message?: Record<string, unknown>;
  message?: {
    message_id: number;
    date?: number;
    text?: string;
    photo?: unknown[];
    sticker?: Record<string, unknown>;
    chat?: {
      id?: number | string;
      type?: string;
    };
    from?: {
      first_name?: string;
      last_name?: string;
      username?: string;
    };
  };
};

export type TelegramParseResult =
  | { kind: "message"; message: WhatsAppIncomingMessage }
  | { kind: "ignored"; reason: string }
  | { kind: "invalid"; reason: string };

function buildProfileName(payload: TelegramWebhookPayload): string | undefined {
  const from = payload.message?.from;
  if (!from) {
    return undefined;
  }

  const fullName = [from.first_name, from.last_name].filter(Boolean).join(" ").trim();
  if (fullName) {
    return fullName;
  }

  return from.username?.trim() || undefined;
}

export function parseTelegramUpdate(payload: TelegramWebhookPayload): TelegramParseResult {
  if (payload.edited_message) {
    return { kind: "ignored", reason: "edited_message" };
  }

  if (payload.callback_query) {
    return { kind: "ignored", reason: "callback_query" };
  }

  if (!payload.message) {
    return { kind: "ignored", reason: "unsupported_update" };
  }

  if (!payload.message.chat?.id) {
    return { kind: "invalid", reason: "missing_chat_id" };
  }

  if (payload.message.sticker) {
    return { kind: "ignored", reason: "sticker" };
  }

  if (payload.message.photo?.length) {
    return { kind: "ignored", reason: "photo" };
  }

  const text = payload.message.text?.trim();
  if (!text) {
    return { kind: "ignored", reason: "no_text" };
  }

  return {
    kind: "message",
    message: {
      from: String(payload.message.chat.id),
      messageId: String(payload.message.message_id),
      hasStableMessageId: true,
      timestamp: payload.message.date ? new Date(payload.message.date * 1000).toISOString() : undefined,
      text,
      profileName: buildProfileName(payload),
      raw: payload as Record<string, unknown>,
    },
  };
}
